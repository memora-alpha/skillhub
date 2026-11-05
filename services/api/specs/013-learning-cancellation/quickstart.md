# Rollout and verification

1. Back up and preflight the target database using the normal deployment process.
2. Deploy migration `20261105000000_learning_cancellation` before this API code.
   It adds request/diagnostic tables, immutable-history checks and Session identity
   indexing. CreditLot uniqueness changes from operation alone to operation/user;
   existing lots remain unchanged. Top-up/material/settlement consumers retain
   their operation identities; no consumer queries a lot by operation alone.
3. Regenerate Prisma and run `pnpm --filter api db:seed-configuration` using the
   existing controlled release procedure. This adds the request window/default
   disabled termination policy if absent; it must not overwrite operator values.
4. Verify the configured `session.attendancePolicy`; cancellation snapshots its
   makeup window. No changes to the approved 60-minute reschedule cutoff.
5. Exercise request/response/replay/expiry and settlement-status on test accounts.
   Both participants receive the committed change notification.
6. Keep `learningPath.changeRequests.terminationPolicyReference` null until the
   PO-approved cancellation/partial-completion policy exists. Enable only through
   the existing audited configuration update, with the approval reference/reason.
   Do not use the test policy reference or infer refund/penalty percentages.

For isolated integration tests set TEST_DATABASE_URL explicitly to an approved
test PostgreSQL connection. The harness creates UUID-named test schemas, applies
all migrations and drops only its own schemas. It does not migrate application
schemas. Local source and tests do not establish deployed behavior.

```powershell
pnpm --filter api check-types
pnpm --filter api lint
pnpm --filter api build
pnpm --filter api exec node --test test/learning-sessions/*.test.mjs
pnpm --filter api exec node --test --test-concurrency=1 test/learning-sessions/integration/cancellation.test.mjs
```

Operator workflow: check `settlement-status`; resolve the linked report/termination
request, repair fee policy/Hold/provenance/source inconsistencies using their owning
procedures, then allow worker retry or participant settlement command. Never change
a completed ledger entry or mark a Session COMPLETED just to bypass a financial error.
