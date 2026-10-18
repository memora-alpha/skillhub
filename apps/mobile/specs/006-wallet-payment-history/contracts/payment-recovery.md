# Payment intent and recovery contract

**Current D1 decision — 2026-10-18:** [BE confirmation and local-source delta](d1-backend-confirmation.md) supersedes earlier policy-unknown statements below. BE confirms no-TTL mapping plus Payment identity fallback, explicit same-key/body replay, operational pause/channel gates and blocking CREATED/PENDING/REVIEW. Total loss has no complete recovery/owner-clearance API: remain support-required, never infer no transfer from404/empty list. These new fixes are not present in local4121c3f; SOURCE_SYNC_REQUIRED before reliance. D2 remains approved, storage/cleanup implementation uncompleted; no automatic unresolved-record expiry/logout purge. Full GAP-06/T079/T080 are not ticked by this policy confirmation.

**Clarified D1/D2 — 2026-10-17**: [Decision/source audit](completion-proposal.md) records D2 native-first financial SecureStore/logout design approved, but D1 remains BLOCKED. Foundation spec005 R-07 explicitly forbids automatic TTL deletion, matching current source with no expiry/delete. This is not an infinite deployment guarantee through manual cleanup/restore, nor a solution for lost key/body/ID. Quote60min and webhook-after-prune tests do not prove create replay after pruning.63/100 task completions/runtime flags remain unchanged.

D2 approves the installed SecureStore primitive through a separate financial module/namespace, independent of the auth-token store, with only encrypted unresolved correlation retained across logout and access after reauthentication of the same owner; runtime/cache/QR clear immediately and B cannot read/enumerate A. Web create stays unavailable. Single-writer/storage-loss limitations remain explicit; final retention/replay/cleanup and total-loss operator policy still require D1. No implementation, lookup endpoint or SLA is introduced.

**Current review**: 2026-10-17; Payment081b3d2/f80ef7a at checkout4121c3f, compared with17e3ac1. [Payment HTTP](payment-http.md) records the implemented API. P4/P5 memory-only preparation remains unchanged. GAP-06 is **partial**, not absent and not fully accepted.

## Backend guarantees actually available

- `services/api/src/modules/payments/application/use-cases/create-payment.use-case.ts:35–85` durably commits Payment, immutable checkout quote and resource identity with idempotency record before provider work, then returns current owner detail.
- `services/api/src/infrastructure/idempotency/idempotency.service.ts:80–134` scopes retained key/body to owner/operation, checks current authorization, replays same ID and rejects changed body409.
- `services/api/src/modules/payments/application/use-cases/read-payments.use-case.ts:49–108` supplies known-ID owner GET and owner payment discovery list. There is no GET-by-key endpoint.
- `services/api/src/modules/payments/application/services/payment-checkout.worker.ts:25–293` recovers durable provider-side preparation/lookup using immutable orderCode and fenced lease. Backend worker recovery is not mobile key/ID recovery.
- `services/api/specs/005-transaction-idempotency/spec.md:62–64` R-07 forbids automatic TTL deletion. Current `services/api/prisma/runtime-support.prisma:114–125` and service have no expiry/delete; this does not guarantee retained mapping after manual prune/restore or solve total loss. Confirm deployment exceptions and recovery with BE owner; do not invent a numeric horizon.
- Create use case:28–34 validates provider/policy **before** replay lookup. Disabled-provider503 can therefore occur after an earlier attempt committed. Known-ID GET does not require provider enablement.

## Client intent rules

Future live intent must freeze owner/session binding, canonical `{paymentAmountVnd,gateway:"PAYOS"}`, stable Idempotency-Key and dispatch state **before await**. One synchronous claim across caller/remount; button disabling alone is insufficient.

Create uses shared HTTP with AbortSignal, `replayAfterRenewal:false` and no automatic mutation retry. No offline/reconnect/foreground/session-renewal queue. Never rotate a key/change body to bypass an unknown outcome or409 conflict. Replay is a deliberate same-intent recovery action under the approved horizon, not a fresh top-up. A replay can return a later status than the first response and never extends the persisted quote TTL.

Backend may support multiple distinct payments; that does not authorize a new client intent while the current dispatch is unresolved. Exact quote mismatch or inaccessible ID is not permission to try another key.

## Scenario contract and stop conditions

| Situation / precondition                                               | Authorized model/read behavior                                                                                                              | Blocked or future action                                                                       |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Not dispatched draft / Back                                            | Preserve exact input and review; explicit Confirm needed                                                                                    | No automatic create from navigation                                                            |
| Repeated tap/caller/remount in same session                            | Reuse same synchronous claim/intent; only one dispatch                                                                                      | No model-intent-N promoted to HTTP key                                                         |
| Valid create201/200 with ID and nullable checkout                      | Bind same ID/quote/version; owner GET for preparing/status; manual read on null QR                                                          | No new payment for missing QR, REVIEW or render error                                          |
| Timeout/abort/disconnect/malformed response after dispatch, no ID      | UNKNOWN_OUTCOME; freeze known key/body; block new intent                                                                                    | Explicit same-key/body replay only after retention/recovery policy approval; never auto rotate |
| Known ID after response lost or owner reopening                        | Current owner GET, independent of US2 draft/QR; ID must match response                                                                      | No route-supplied amount/state/providerStatus authority                                        |
| Same key/body replay after prior success                               | Same retained resource/current projection; accept later status/version safely                                                               | No assumption of byte-identical response or refreshed expiry                                   |
| Same key with edited body409                                           | Preserve unresolved association; explain conflict                                                                                           | No new key as shortcut, even if amount changed                                                 |
| Provider-disabled503 or generic401/409/429/5xx                         | Preserve previous unknown/known intent; known-ID reads may still work                                                                       | Do not classify as unconditional no-creation proof                                             |
| Proven preflight/provenance rejection with no earlier unknown dispatch | Clear current in-flight UI, explain policy/eligibility block, retain draft for review                                                       | No client repair, balance seeding, or automatic resubmission                                   |
| QR closed / render retry / expired QR visibility                       | Preserve known payment access; render/read retry only, respect server null suppression                                                      | No client cancellation, payment expiry or create                                               |
| PAID then Wallet/History refresh failure                               | Keep PAID; separate independent read errors/retries                                                                                         | No create/local Credit/TOP_UP or success downgrade                                             |
| A logs out / B logs in while request active                            | Abort, dispose private state, invalidate tickets/owner caches; late A result cannot affect B                                                | No A intent replay in B, no raw QR persistence                                                 |
| Relogin A with known ID                                                | Reauthorize/read with new session generation; never reuse stale private projection                                                          | Process-restart claim requires actual approved durable correlation                             |
| Process termination loses key/body/ID                                  | Explicitly unrecoverable correlation under current mobile implementation; show safe unavailable/support/discovery behavior only as approved | GAP-06 BLOCKED: no durable store/policy, no GET-by-key, no automatic amount/time match         |
| Owner list discovers candidate                                         | User explicitly selects ID, then owner GET; distinct payments may share amount/time                                                         | Candidate is not proof it belongs to a lost intent or that it is safe to create a replacement  |
| Retention horizon absent/exceeded                                      | Do not replay unknown intent as if deduplication were guaranteed                                                                            | Backend/product recovery decision required before real create activation                       |

“Proven no creation” is contextual: a specific rejected request does not prove that an **earlier** dispatch never committed. Denial removes private data; a later transient failure cannot revive it from cache.

## Durable correlation design approved — not implemented, D1 unresolved

A minimal durable owner/key/canonical-body/optional-ID record is selected under D2: native-first separate financial SecureStore, unresolved encrypted owner record through logout, cleared runtime/cache/QR, same-owner reauthentication and B isolation, web create unavailable. This is design approval, not implemented recovery. Remaining closure requirements are:

1. Confirm foundation R-07 no automatic TTL in deployment and document exceptional prune/restore/replay and total-loss handling; do not invent a numeric horizon. Provider-disabled/auth/channel behavior remains relevant.
2. Implement the approved native at-rest/minimal-record/logout/reauth scope; final deletion/cleanup follows D1. No promise of recovery after uninstall/lost device or undetectable total record loss.
3. Exact pre-dispatch persistence/locking/crash boundary, safe read-only resume and explicit user recovery actions; no automatic financial replay.
4. Approved evidence for kill-before/after-dispatch, commit-before-response, key/body/ID loss, same-key conflict and orphaned pending payment discovery.

Do not place a financial journal in auth-token storage, persist raw QR/provider payload/credentials, or equate query cache/memory remount with durable recovery. Storage work needs future task/file ownership and security review after decisions.

## Evidence and activation gate

Existing `wallet-payment-intent`, `wallet-payment-transport`, `wallet-payment-recovery` tests prove inert lock/lifecycle/recovery-case preparation only. A backend worker-restart case proves backend durability, not application kill/relogin. New HTTP fixtures can test actual key/body/replay/status semantics but remain C, not A/G/native.

Real create stays disabled until accepted recovery/retention policy is implemented and independently tested, actual contract integration is complete, QR-01 is met for QR continuation and approved operational evidence exists. Known-ID status read work is independent and may proceed earlier under its own scope. No mutation, storage or activation is authorized by this planning document.
