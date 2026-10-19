# Wallet and Payment contract checkpoint

**Implementation checkpoint — 2026-10-18, BE7fc0f83 / HEAD5101aea + working tree:** Test-first eligible source batch is implemented. T043/T052/T076/T078..T088/T094 complete within DOC/L/C/W/source-check criteria;100 IDs,83 checked/17 unchecked, original68 completed task bodies preserved. Normal Payment/status/create/recovery/Confirm flags remain off. Private native QA read/financial entries are source-ready, not an activated or accepted deployment. Current fields, cleanup/store/claim/create/replay/QR/status replace earlier pending-source proposals below. D1/D2/D3/D4 are not reopened. Actual API/payOS/Android/iOS acceptance and full T100 stay gated; historical results keep their original scope.

**Current backend replan — 2026-10-18:** [Audit7fc0f83](contracts/backend-review-7fc0f83.md) at HEAD5101aea replaces earlier source-missing/D1-unknown status. Creation-policy and identity fallback/pause/REVIEW guards are implemented. D1 is SOURCE_VERIFIED_WITH_LIMITATIONS; GAP-06 SOURCE_READY / MOBILE_AND_ACCEPTANCE_PENDING. Current HTTP/recovery/gates/plan define new required recovery metadata and equal-version correction, proposed native cleanup/claim/create/QA work and separate release evidence. Existing status/schema drops those metadata fields and needs tests-first extension. Total-loss/clearance remains unsupported support-stop. D2/D3/D4 and100 IDs/68 checked preserved; all previous snapshots below retain historical scope, no Payment activation.

**QR implementation checkpoint — T089..T093**: local QR renderer and independent decoder are implemented with L/W evidence, T089..T093 complete;68/100. Payment create/recovery/QA host and actual API/G/native remain gated; no public API/payload/capability change. [QR validation](contracts/qr-validation.md) separates actual pixels from bank/native acceptance.

**Current source review**: 2026-10-17 at `4121c3f`; new BE Payment `081b3d2` / merge `f80ef7a`, compared with `17e3ac1`.
**Authority**: SRS V1.6 defines business requirements; source establishes implemented API; fixtures establish only controlled model/HTTP behavior. Backend spec009 design is not proof of execution.

## Historical implementation snapshot — prior081b3d2

| Capability                           | Backend source                                                                  | Mobile now                                                                                         | Acceptance                                                                    |
| ------------------------------------ | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Wallet/Home                          | Owner GET implemented; unchanged wire                                           | P1/P2 done, exact strings/virtual zero/session projection                                          | Historical L/C/W; deployed A and native not established                       |
| Ledger list/detail                   | Owner GETs, type/referenceType, sequence snapshot                               | P3 done; limit20, opaque chain, denial eviction                                                    | Historical L/C/W; deployed/native pending                                     |
| Create/confirmed quote/QR descriptor | **Implemented** POST/payOS worker/nullable checkout                             | I1 DTO/quote schema complete; P4 intent/shell inert, no create adapter                             | Synthetic contract/model only; create/recovery still gated                    |
| Owner Payment detail/list            | **Implemented**, seven statuses/numeric version                                 | I1/I2 schema, GET adapters/query, independent status UI/refresh complete; capabilities off         | L/C/W recorded; deployed A/native and activation pending                      |
| Verified posting                     | **Implemented** signed receipt/atomic PAID + TOP_UP + wallet/lot + audit/events | Always backend-owned; client only refreshes reads                                                  | Mocked-provider BE evidence reported; merchant proof pending                  |
| Recovery                             | Known-ID GET; retained replay; foundation no automatic TTL; durable worker      | D2 native financial SecureStore design approved; no durable implementation                         | D1 operational exceptions/total-loss, implementation and evidence remain open |
| Local QR matrix                      | Raw backend payload source-backed                                               | Pinned core adapter/SVG, typed geometry and independent screenshot decoder; synthetic preview only | L/W observed; QR-01 native/channel/T042 remain open                           |

Current100 task IDs and68 completed tasks:49 historical completions within the original62 IDs, T063..T075/T077 and T089..T093. Remaining32 tasks stay unchecked. No Payment flag or Confirm/status activation is authorized by this replan. Earlier P1..P5 and I1/I2 results remain in [validation](validation.md) with their original evidence boundaries, not re-labelled as deployed backend acceptance.

## Contract documents

- [Wallet/history HTTP](contracts/wallet-http.md): unchanged three owner GETs; exact amount/delta strings, virtual zero, limit20, type/referenceType and ledger snapshot.
- [Payment HTTP](contracts/payment-http.md): actual POST/list/detail, quote fields, REVIEW/version, QR suppression, current replay/error contract and source anchors.
- [Integration gates](contracts/integration-gates.md): GAP-01..08, QR-01 and environment dispositions.
- [Recovery](contracts/payment-recovery.md): uncertainty, known/lost identity, scope cleanup and unresolved durable correlation/retention.
- [UI flows](contracts/ui-flows.md): user-visible states and safe retries.
- [QR validation](contracts/qr-validation.md): renderer/decoder/channel/native prerequisites; no skipped=PASS.
- [Completion decision record](contracts/completion-proposal.md): D2/D3/workflow approval, user-confirmed environment availability, backend audit and remaining D1/binding/QR evidence. All100 task blocks remain unchanged; no gate closes from design approval.
- [Data model](data-model.md), [research](research.md), [validation matrix](validation-matrix.md): design, evidence and retained US/FR/SC/V traceability.

## Non-negotiable authority boundaries

Money is exact VND integer text or two-decimal Credit text, never client floating-point settlement. Only backend owner Payment status determines outcome; providerStatus/redirect/clock/QR closure do not. PAID remains PAID when independent wallet/history reads fail. No synthetic Credit, ledger entry, refund/cash-out, expiry, status ranking or financial administrative mutation.

Shared HTTP/auth/query/connection runtime and owner/session isolation remain mandatory. Create must opt out of auth-renewal resend and every automatic mutation replay. No unconfirmed public quote/lookup/admin API is introduced. Client recovery and integration work in [plan](plan.md), now mapped to T063..T100 in [tasks](tasks.md), is explicitly future work with entry gates.

## Outstanding decisions

D2 native-first financial SecureStore/logout and D3 QR tooling/mobile-package/root-lockfile scope are approved for later authorized implementation; D4 two-device QA-entry workflow is approved and environment reported available. Actual binding/results are unverified. D1 retains BE-owner confirmation for no-TTL deployment exceptions/restore and total-loss handling. No new endpoint, numeric/infinite horizon, installed dependency or A/G/native acceptance is inferred. Later tasks synchronize accepted scope, preserving100 task blocks/63 completions here.

## Implemented mobile contract boundary — current batch

See [current readiness/stop record](contracts/integration-gates.md#current-source-readiness-and-activation-stop--t043t088). Payment DTO/status/policy, native correlation/claim, explicit create/replay and private QA review→QR→status are implemented at source/fixture level. Owner status stays independent of US2 intent/store/QR. Normal capabilities remain disabled; API/payOS/device evidence is separate. PAID and quote/QR/cleanup/Wallet/History outcomes remain distinct.
