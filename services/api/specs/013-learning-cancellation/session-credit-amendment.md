# Per-session Credit for early termination

Authorized in this chat on 2026-11-06. Branch: `fix/two-way-session-credit`.
The user approved the TWO_WAY plan, then explicitly included the preceding
ONE_WAY plan. Backend only. This amendment supersedes the earlier prohibition
on prorating and partial-work payment in this feature for newly locked Holds.
It does not change the completed-agreement settlement or enable production policy.

## Accepted calculation

Store an immutable `sessionCreditSnapshot` in each Held allocation during the
same transaction that locks the agreement and creates its original Sessions.
Values use integer hundredths. ONE_WAY divides negotiatedCredit over its plan;
TWO_WAY divides each person's own totalCreditPerUser over BOTH plans together.
The two original Holds remain independent. Each participant still has the same
commitment amount; this is not a new model with separately negotiated Hold values.

Order the original A-teaches-B direction first, then B-teaches-A, each by original
outlineSessionNo. For C units and N Sessions, assign floor(C/N) to each and one
additional unit to each of the first C mod N Sessions. Never round each share
independently. Zero-unit shares are possible when a small ONE_WAY total has more
Sessions than hundredths; their sum remains exactly C.

Only COMPLETED original Sessions contribute to D (performed Credit). Makeup
retains the original Session/share, and schedule dates never determine money.
U=C-D. Compute F=floor(D*400/10000) ONCE per Hold, not once per Session.

- ONE_WAY: refund learner U, pay teacher D-F, platform fee F. Teacher Holds zero.
- TWO_WAY: refund the owner C-F, fee F, no inferred transfer to the partner.
- TWO_WAY explicit Admin compensation P reduces that owner's refund to C-F-P
  and pays P to the partner. Require compensationReason when any P>0. Amounts
  remain case decisions; direction imbalance alone never determines fault or P.
  No extra fee on P. Enforce 0<=P<=C-F, never debit Available or create debt.

The 4% on performed work during termination and ONE_WAY partial payment are the
newly authorized rules. Already completed agreements retain their existing total
96/4 settlement; no money moves after individual Session completion.

## State and review behavior

Expose a participant-only, read-only quote at
GET /api/v1/learning-paths/:pathId/termination-requests/quote. Existing independent
Staff/Admin review includes the same calculation under execution.quote. Return
direction progress, original per-session values, performed/unperformed amounts,
base refund/payment/fee and safe blocker codes. This is a calculation preview;
it does not approve termination or compensation. Participant acceptance of a
termination request retains its existing meaning, not financial execution.
Admin keeps the reasoned final review and execution authority.

Pending, rejected, withdrawn and expired requests do not move money. Ongoing,
awaiting confirmation, unresolved no-show/disputed, unruled elapsed occurrences
and expired makeup require a ruling first. Blocking reports prevent execution.
When all Sessions are COMPLETED, return TERMINATION_USE_FINAL_SETTLEMENT:
withdraw/reject a pending termination and use the ordinary 48-hour/bilateral
settlement path. Do not bypass that window with termination.

Execution recomputes under the existing lifecycle locks and compares the exact
refund, payment and fee against the approved formula. A conservation-correct but
wrong fee is rejected with TERMINATION_FORMULA_MISMATCH. Snapshot/occurrence/
policy/amount changes invalidate the execution digest. Persist the reviewed base
quote, actual allocations and compensation reason in immutable resolution.
Ledger, source lots, Session/Path state, source Request closure, audit and outbox
retain their shared PostgreSQL transaction and permanent replay protection.

## Historical data and rollout

Apply additive migration `20261106000000_session_credit` after the existing
personal makeup migration and before deploying this code. The generator is the
source for runtime Prisma changes; do not edit catalog.prisma or old migrations.

Existing rows keep SQL NULL snapshots. Never silently backfill their prices or
attach a new financial policy. Preview/execution returns
SESSION_CREDIT_SNAPSHOT_MISSING for these agreements; normal completed settlement
remains available. A reviewed historical recovery procedure is a separate task.
The database prevents rewriting/deleting a frozen snapshot and changing its Hold
identity or amount. Read validation also checks original Session membership,
roles, plan versions, counts, order, total and distribution.

Keep the existing audited terminationPolicyReference gate. No environment value,
production configuration, seed, application migration or deployment is performed
as part of implementation. An operator must reference this approved policy before
execution. No automatic cancellation penalty or compensation tariff is invented.
Mobile/web adoption of the new quote and compensation reason is separate work.

## Implementation and verification plan

- [x] Persist immutable exact-money allocation and policy at Hold.
- [x] Add owner calculation and participant/reviewer preview.
- [x] Validate formula and bounded, reasoned TWO_WAY compensation at execution.
- [x] Preserve makeup identity, blockers, completion settlement and legacy review.
- [x] Verify rounding, uneven directions, missing/changed snapshots and HTTP access.
- [x] Verify PG conservation, concurrent replay, audit rollback and snapshot guards.
- [x] Run API lint, typecheck, build and schema validation; record actual evidence.

## Constitution check

| Principle                   | Status       | Evidence or remaining work                                                           |
| --------------------------- | ------------ | ------------------------------------------------------------------------------------ |
| Scope and architecture      | Pass         | API only; Credit owns snapshots/math/posting; Path owns authorization/lifecycle      |
| Authority and atomic money  | Pass locally | PostgreSQL conservation, source lots and injected audit rollback verified            |
| Permissions and privacy     | Pass locally | Participant HTTP membership/no-store; existing independent Admin gates verified      |
| Contracts and configuration | Pass locally | Versioned snapshot, exact strings, policy gate and migration guards verified         |
| Verification                | Pass locally | 173/173 regressions, no skips; lint, types, build and schema validation passed       |
| Reliable delivery           | Pass locally | Concurrent/replayed execution converges on one operation; audit/outbox remain atomic |

No constitutional exception; the current user authorization changes the financial
business rule, not the architecture or transaction guarantees.

## Validation 2026-11-06

Final build passed. API lint, check-types, Prisma db:validate and git diff --check
passed. The final suite passed **173/173**, zero failed/cancelled/skipped:

- All top-level learning-sessions tests and all its PostgreSQL integration files.
- Learning-platform phases 1–4 and real PostgreSQL finalize rollback.
- Credit exact-money and new session-credit tests (including exhaustive small-unit
  conservation, unequal teaching directions and an outside teacher rejection).
- PostgreSQL payment provenance through Hold and ordinary completed settlement.

New PG cases verify ONE_WAY 100/5 partial payment (60 refund, 38.40 payment, 1.60
fee), 100/3 remainder pricing (66.66 refund, 32.01 payment, 1.33 fee), independent
TWO_WAY compensation, wrong-fee rejection even with conserved totals, required
compensation reason, immutable snapshot, concurrent replay and rollback of both
financial and lifecycle writes after injected audit failure. The dedicated
migration test retains historical SQL NULLs and verifies the update/delete guards.
The new quote tests cover missing policy, legacy review, expired makeup, reports,
ordinary settlement after full completion, and no financial allocation before Hold.

Integration connections were guarded to localhost and explicitly supplied through
TEST_DATABASE_URL. Harnesses created/dropped isolated UUID schemas; no application
schema was migrated or seeded. Initial test attempts caught an empty migration
directory left by the ONE_WAY scope rename and a fixture's Session-count assumption;
both were corrected before the successful final run. The preliminary lint finding
for an unused destructured field was fixed before the passing lint check.

Production migration, policy activation, deployment, frontend/mobile integration
and Sonar cloud analysis were not performed or claimed. Historical termination
remains a review/recovery task; no automatic financial backfill was attempted.
