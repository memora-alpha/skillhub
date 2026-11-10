# Schedule time validation details

Date: 2026-11-10. Branch: `fix/schedule-validation-details`.

## Scope and contract

Fix the ambiguous `INVALID_SCHEDULE_ITEMS` response from
`POST /api/v1/learning-paths/:pathId/final-validation` and
`POST /api/v1/learning-paths/:pathId/finalize`. Preserve HTTP 409 and the existing
message code. Add `details` containing:

- `invalidItems`: all invalid items from the confirmed current schedule versions;
  each has `scheduleId`, `scheduleVersion`, `planId`, `planVersion`, `teacherId`,
  `learnerId`, `sessionNo`, `startAt`, `endAt`, and `reasons`.
- `evaluatedAt`: the database timestamp used by validation, in UTC.
- `durationMinutes`: the effective configured `{ min, max }` limits.

Reason codes:

| Code                  | Meaning                                            |
| --------------------- | -------------------------------------------------- |
| `START_NOT_IN_FUTURE` | Start is at or before `evaluatedAt`.               |
| `END_NOT_AFTER_START` | End is at or before start.                         |
| `DURATION_TOO_SHORT`  | Positive duration is below the configured minimum. |
| `DURATION_TOO_LONG`   | Positive duration is above the configured maximum. |

An item may have multiple reasons. Nonpositive durations only receive the
specific end/start reason, plus the start reason if applicable. Exact min/max
durations remain valid. Dates remain UTC; clients format them in the viewer's
timezone and resolve teacher/learner IDs to existing participant display names.
For example, the client can render “Lịch Bình dạy An — Buổi 2, ngày … lúc …:
giờ bắt đầu đã qua. Bình cần cập nhật lại lịch.”

Return all errors in chronological order, with stable plan/session ordering for
ties. At most 200 items are possible (two plans, at most 100 sessions per plan).
The global exception filter explicitly validates and allowlists this new detail
shape, including reversed end/start timestamps, and drops unknown properties.

Backend only. No schema, configuration, fee-policy, notification or mobile
changes. No change to existing validation precedence: missing confirmations and
authorization errors still precede time validation. SRS V1.6 §18.13 requires
valid confirmed schedules before atomic Hold/lock/Session creation; this fix
adds diagnostic details without changing that rule or duration policies.

## Constitution Check

| Principles                              | Status and evidence                                                                                                                                                                                                |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1, 7: scope and ownership               | Pass: Path owner enriches already-loaded schedule items with plan roles; HTTP filter only shapes the public error. No cross-module writes or additional profile lookups.                                           |
| 2, 3: authoritative state and atomicity | Pass locally: existing PostgreSQL/configuration/clock reads and pre-write validation remain; fixtures verify no Hold/Session/lock/outbox or balance change on failure. Real database verification remains pending. |
| 4: authorization/privacy                | Pass locally: outsiders are denied; HTTP tests preserve only allowlisted detail fields, including on the finalize route.                                                                                           |
| 5: contract/storage                     | Pass locally: additive details and unchanged code/status verified through Nest HTTP, OpenAPI updated; UTC serialization. No migration.                                                                             |
| 6: verification                         | Pass: lint, type checking, Nest build and all 70 distinct learning-platform cases verified, with HTTP suites rerun outside the sandbox as described below.                                                         |
| 8: jobs/webhooks                        | Not applicable: no asynchronous delivery changes.                                                                                                                                                                  |

No exceptions. Runtime database/deployment verification is outside this local
fix; tests use the existing transactional fixtures and real Nest HTTP transport.

## Validation

Completed on 2026-11-10:

- `pnpm --filter api lint`: passed.
- `pnpm --filter api check-types`: passed (including Prisma generation).
- `pnpm --filter api test:learning-platform`: Nest build passed; 68/70 tests
  passed inside the sandbox. The two HTTP tests failed to connect to their local
  test server (`fetch failed`), including the pre-existing HTTP regression.
- `node --test test/learning-platform/error-http.test.mjs test/learning-platform/schedule-validation.test.mjs`
  from `services/api`, outside the sandbox: all 7/7 tests passed, including both
  preceding HTTP failures. All 70 distinct cases are therefore verified.
- Formatting and `git diff --check`: passed.

New regressions cover the second session in only the B→A plan, all invalid
directions/reasons, exact duration limits and start-time boundary, current
schedule-version selection, denial for outsiders, no Hold/Session/lock/outbox or
balance changes on failure, and actual error envelopes for both endpoints.
HTTP detail validation also covers reversed times, all 200 possible errors,
malformed payload rejection and stripping unknown fields.

No live database run or deployment was performed during local validation.
No migration is required.
