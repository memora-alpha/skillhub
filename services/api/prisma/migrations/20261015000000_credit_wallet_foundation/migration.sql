BEGIN;
-- Keep preflight/backfill/constraints atomic and exclude concurrent financial writers.
LOCK TABLE credit_wallets, credit_operations, credit_transactions, held_credit_allocations
  IN SHARE ROW EXCLUSIVE MODE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM credit_wallets WHERE available_credit < 0 OR held_credit < 0 OR wallet_version < 0)
    OR EXISTS (SELECT 1 FROM credit_transactions WHERE status <> 'SUCCESS' OR amount <= 0 OR entry_no <= 0
      OR available_after < 0 OR held_after < 0)
    OR EXISTS (SELECT 1 FROM held_credit_allocations WHERE amount <= 0 OR remaining_held < 0 OR remaining_held > amount)
  THEN RAISE EXCEPTION 'CREDIT_PREFLIGHT_INVALID_HISTORY: reconcile legacy data before migration'; END IF;

  -- Require a complete zero-origin ledger. An unexplained opening balance is never invented.
  IF EXISTS (
    SELECT 1 FROM credit_wallets w
    LEFT JOIN (SELECT user_id, sum(available_delta) AS available, sum(held_delta) AS held
      FROM credit_transactions GROUP BY user_id) t USING(user_id)
    WHERE w.available_credit <> coalesce(t.available,0) OR w.held_credit <> coalesce(t.held,0)
  ) THEN RAISE EXCEPTION 'CREDIT_PREFLIGHT_OPENING_BALANCE_REQUIRED'; END IF;

  IF EXISTS (
    SELECT 1 FROM (
      SELECT t.available_after, t.held_after,
        sum(t.available_delta) OVER history AS expected_available,
        sum(t.held_delta) OVER history AS expected_held
      FROM credit_transactions t JOIN credit_operations o ON o.operation_id=t.operation_id
      WINDOW history AS (PARTITION BY t.user_id ORDER BY o.created_at,o.operation_id,t.entry_no,t.transaction_id
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)
    ) history WHERE available_after<>expected_available OR held_after<>expected_held
  ) THEN RAISE EXCEPTION 'CREDIT_PREFLIGHT_AMBIGUOUS_HISTORY_ORDER'; END IF;

  IF EXISTS (
    SELECT 1 FROM credit_wallets w LEFT JOIN (
      SELECT user_id,sum(remaining_held) AS held FROM held_credit_allocations GROUP BY user_id
    ) a USING(user_id) WHERE w.held_credit<>coalesce(a.held,0)
  ) THEN RAISE EXCEPTION 'CREDIT_PREFLIGHT_HELD_ALLOCATION_MISMATCH'; END IF;
END $$;

ALTER TABLE credit_wallets ADD COLUMN last_entry_sequence bigint NOT NULL DEFAULT 0;
ALTER TABLE credit_transactions ADD COLUMN entry_sequence bigint NOT NULL DEFAULT 0;
WITH ranked AS (
  SELECT t.transaction_id,row_number() OVER (PARTITION BY t.user_id
    ORDER BY o.created_at,o.operation_id,t.entry_no,t.transaction_id) AS sequence
  FROM credit_transactions t JOIN credit_operations o ON o.operation_id=t.operation_id
)
UPDATE credit_transactions t SET entry_sequence=r.sequence FROM ranked r WHERE t.transaction_id=r.transaction_id;
UPDATE credit_wallets w SET last_entry_sequence=(SELECT coalesce(max(entry_sequence),0)
  FROM credit_transactions t WHERE t.user_id=w.user_id);
CREATE UNIQUE INDEX credit_transactions_user_id_entry_sequence_key ON credit_transactions(user_id,entry_sequence);
ALTER TABLE credit_wallets ADD CONSTRAINT credit_wallets_nonnegative
  CHECK (available_credit>=0 AND held_credit>=0 AND wallet_version>=0 AND last_entry_sequence>=0);
ALTER TABLE credit_transactions ADD CONSTRAINT credit_transactions_values
  CHECK (amount>0 AND entry_no>0 AND entry_sequence>0 AND available_after>=0 AND held_after>=0);
ALTER TABLE held_credit_allocations ADD CONSTRAINT credit_allocations_bounds
  CHECK (amount>0 AND remaining_held>=0 AND remaining_held<=amount);

CREATE FUNCTION assign_credit_entry_sequence() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE credit_wallets SET last_entry_sequence=last_entry_sequence+1
    WHERE user_id=NEW.user_id RETURNING last_entry_sequence INTO NEW.entry_sequence;
  IF NOT FOUND THEN RAISE EXCEPTION 'CREDIT_WALLET_REQUIRED'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER credit_entry_sequence BEFORE INSERT ON credit_transactions
  FOR EACH ROW EXECUTE FUNCTION assign_credit_entry_sequence();
CREATE FUNCTION protect_credit_ledger() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'CREDIT_LEDGER_APPEND_ONLY'; END $$;
CREATE TRIGGER credit_ledger_append_only BEFORE UPDATE OR DELETE ON credit_transactions
  FOR EACH ROW EXECUTE FUNCTION protect_credit_ledger();

-- Zero initialization issues no Credit and needs no monetary ledger entry.
INSERT INTO credit_wallets(user_id,available_credit,held_credit,purchased_credit,bonus_credit,wallet_version)
  SELECT user_id,0,0,0,0,0 FROM users ON CONFLICT(user_id) DO NOTHING;
COMMIT;
