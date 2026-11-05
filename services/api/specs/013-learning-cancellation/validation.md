# Validation — 2026-11-05

Branch: `fix/path-cancellation`. Verification recorded before commit. No push,
deployment, application-schema migration or financial-policy activation performed.

## Checks

| Check                           | Result                                         |
| ------------------------------- | ---------------------------------------------- |
| `pnpm --filter api check-types` | PASS                                           |
| `pnpm --filter api lint`        | PASS; final fixture edits also linted directly |
| `pnpm --filter api build`       | PASS                                           |
| `pnpm --filter api db:validate` | PASS                                           |
| `git diff --check`              | PASS                                           |
| Focused regression/HTTP group   | 158/158 PASS across 24 files; zero skips       |
| Real PostgreSQL group           | 28/28 PASS across 7 files; zero skips          |

The regression group includes all learning-sessions tests, learning-platform
phase tests, Request reconciliation, Credit amount/cursor/adjustment tests,
audit policy/writer, configuration policy/update and scheduling schema checks.
The PostgreSQL group includes both session integration files, finalize rollback,
payment provenance, Credit persistence/HTTP and material ledger tests.

HTTP/PG tests ran outside the network-restricted sandbox to permit localhost
connections. A local-only connection guard was checked before setting the
child process's TEST_DATABASE_URL. Every persistence fixture created and dropped
its own UUID-named schema; no application schema was migrated or seeded.

## Verified behavior

- Cancellation needs the other participant, targets the exact occurrence and
  preserves progress 2/5 -> 2/5 -> 3/5 after makeup, without adding a Session.
- Duplicate keys/decisions cannot duplicate a cancellation or financial posting;
  fresh keys cannot create multiple open requests for the same target.
- Rejection/withdrawal/expiry keep the original obligation until a valid decision;
  automatic expiry releases a termination settlement block without releasing money.
- Blocking reports defer execution; recovery checks the occurrence again.
- Expired cancellation makeup is resolvable without fabricated attendance evidence.
- Admin execution rejects absent approval reference, blocking case, stale snapshot,
  unresolved Session state, invalid allocation total and missing permissions.
- Real ONE_WAY and TWO_WAY distribution preserves every Credit unit and original
  refund source; beneficiary lots/wallet source counters reconcile.
- Concurrent real PG responses/executions replay one result and one operation.
- Injected audit failure rolls back wallets, source lots, ledger, Session/Path,
  request decisions and source Request together; a subsequent retry succeeds.
- Terminal history cannot be rewritten. Completed settlement is not recorded for
  terminated agreements; source Request closure passes read-only reconciliation.
- Delayed completion/report effects cannot reopen a terminated agreement.
- Settlement diagnostics expose safe review/retry codes after failure and do not
  leak raw database/provider exception text.

## Limits and rollout

Production migration/seed/readiness, real mobile journeys and LiveKit Cloud
acceptance were not run. Sonar cloud analysis/Quality Gate was not requested or
claimed. The Constitution Check records local evidence only.

Termination Credit execution remains disabled by default. PO-approved liability,
free cancellation, partial-work pricing, fee/penalty and shortage handling still
need an approved policy reference before activation. Tests use an isolated test
reference and explicit allocations, never production defaults.

See [rollout](quickstart.md) for migration order and policy gate; see
[HTTP contracts](contracts.md) for client integration. No mobile code changed.

## Session policy amendment validation 2026-11-05

Branch `fix/session-policy-settlement`. This evidence covers the later
[approved policy amendment](session-policy-amendment.md), not a production rollout.

- `pnpm --filter api lint`: Pass, zero warnings.
- `pnpm --filter api check-types`: Pass.
- `pnpm --filter api build`: Pass; Prisma generated before Nest build.
- Session suites, learning-platform phases 1–4 and learning-platform audit:
  **139/139 passed**, no skips. Includes HTTP membership/body/version validation,
  Swagger consent body, distinct completion/financial consent, exact 48-hour
  expiry and early settlement, report clearing, shared quota rounding, last-session
  anchor, sequence, three successful changes, no-op/replay and same-grant extension.
- Session integration suites plus path-scheduling/runtime-v3 schema suites:
  **18/18 passed**, no skips, against a dedicated localhost PostgreSQL 18 cluster
  with explicit TEST_DATABASE_URL. The harness applied migrations in disposable
  UUID schemas and removed those schemas; no application database was migrated.
- Real PostgreSQL concurrent plan-quota acceptance grants exactly one opportunity;
  injected audit failure rolls back the counter and request decision.
- Concurrent/replayed schedule confirmations count once. Database checks retain
  the original anchor and prevent counter decreases. Backfill retains legacy
  excess, excludes identifiable makeup/no-op changes and preserves expired grants.
- Injected consent audit failure leaves no consent. Injected failure after ledger
  posting rolls back the financial transaction but retains committed consents.
  Worker/participant retries converge on one settlement operation with conserved
  tracked source lots and exact 96/4 distribution.
- A report racing the second approval either blocks settlement with Held intact
  and consents cleared, or follows already committed settlement as nonblocking.
- `git diff --check`: Pass. No frontend/mobile/shared-package changes.

These results replace preliminary local runs that failed to reach localhost from
the sandbox or ran supplemental schema checks before the build had finished.
The final runs used the completed build and explicit isolated test connection.
Production migration/activation, deployed behavior, device journeys and Sonar
cloud Quality Gate were not tested or claimed.
