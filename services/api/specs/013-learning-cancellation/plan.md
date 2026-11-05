# Learning cancellation and early termination

Branch: `fix/path-cancellation`. Date: 2026-11-05. Backend only.

Implementation continues on `fix/session-policy-settlement` for the subsequent
user-approved [Session policy amendment](session-policy-amendment.md), including
the accepted rounding, counting and original-schedule anchor proposals. The
historical validation below covers the initial cancellation tranche only.

The user authorized implementation after reviewing the proposed fixes. Preserve a
Session's identity and promised session count when cancelling an occurrence for
makeup. Require bilateral consent; an unanswered request does not cancel a class.
Keep append-only request/decision history and reuse the configured makeup window.
Do not treat cancellation as no-show or apply a new reputation/Credit penalty.

Early termination is agreement-wide, including both TWO_WAY plans. Participants
request/respond/withdraw; disputed or rejected requests require Staff review.
Only an Admin with report moderation and Credit adjustment/override permissions
may execute a reasoned allocation of existing Held. Execution remains disabled
until the audited configuration references an approved termination policy (G05).
No per-session prorating, 96/4 cancellation defaults, Available debit, negative
balance, cash refund, release/relock or automatic post-settlement reversal.

Request expiry defaults to 72h as an operational timeout, configurable 1–720h;
session cancellation requests also expire at the original occurrence start.
Expiry and withdrawal release the settlement block without releasing money.
Unresolved blocking reports defer execution, not intake. Revalidate the complete
execution snapshot under locks after a report closes. Unfinished past/ongoing
sessions require their existing attendance/Staff ruling before termination.

## Constitution check

| Principle                            | Design                                                                                          | Evidence                                                          |
| ------------------------------------ | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| 1 scope/architecture                 | API only; existing owners retain writes                                                         | Pass: source review, lint/types/build                             |
| 2/3 authoritative state/atomic money | PostgreSQL; integer hundredths; ledger, owner state, audit/outbox in one transaction            | Pass locally: real PG rollback/conservation/concurrency           |
| 4 authorization                      | Participant membership, live identity guard; explicit Admin powers for execution                | Pass: service/HTTP regressions                                    |
| 5 contracts/config                   | Validated DTOs, UTC, exact money strings; policy disabled by default                            | Pass: schema, HTTP/Swagger, configuration tests                   |
| 6 verification                       | Focused lifecycle, financial rollback/replay and integration tests                              | Pass: 158 regressions + 28 PG tests, no skips                     |
| 7 ownership                          | Path owns requests/termination/diagnostics; Sessions own cancellation; Credit owns distribution | Pass: source review and shared transaction contracts              |
| 8 delivery                           | Durable outbox; domain keys; sorted locks and post-rollback diagnostic persistence              | Pass locally: outbox/notifications, replay, expiry, failure tests |

No constitutional exceptions. Deployments, production migrations, mobile UI and
policy approval are outside this change. Validation records actual evidence.
