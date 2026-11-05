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

## Session policy and early settlement rollout

Apply additive migration `20261105010000_session_policy_settlement` after
`20261105000000_learning_cancellation`, before running the amended API. Deploy the
schema and API in one controlled maintenance window so old writers cannot apply
uncounted changes between backfill and restart. No new env variables, grants or
configuration keys are required by this amendment.

The migration pins the earliest recorded scheduled start, backfills ordinary
changed occurrences while excluding identifiable makeup/no-op revisions, records
existing makeup grants and preserves over-limit legacy counts. Unknown historical
changes are counted conservatively. Review Sessions with rescheduleCount > 3,
makeupCount > 1, or a plan whose used makeup exceeds its new quota; new grants stay
blocked and history is never reduced. Existing granted makeup can still be booked.
The original anchor and counters cannot be rewritten/decreased by ordinary UPDATE.
Neither the migration nor the new consent endpoint edits completed ledger entries.

Verify one approval waits with Held unchanged, two approvals settle exactly once,
and a report before settlement clears approvals and retains Held. Verify no consent
is inferred from completion; expiry settlement still works with neither approval.
Run all Session integration files against TEST_DATABASE_URL, including the policy
migration/backfill test. Frontend/mobile integration and production rollout remain
separate work.

## Personal makeup quota correction

Also apply `20261105020000_personal_makeup_quota` after the previous policy
migration and before the corrected API starts. Existing bootstrap applies both
pending migrations in order. No new env, seed or permissions are needed.

The correction stores the requester/absent participants per Session and calculates
20% separately for each person over all Sessions they participate in within this
agreement, shared across both teaching directions. A grant's attribution cannot be
changed by ordinary UPDATE. Existing records without reliable responsibility, or
ambiguous legacy multiple grants, require review instead of charging both users.
Verify one participant exhausting their allowance does not consume the partner's
allowance; simultaneous requests across directions cannot exceed the person's cap.
