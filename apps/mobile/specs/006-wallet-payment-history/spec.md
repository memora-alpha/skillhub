# Feature Specification: Wallet, payment status and transaction history

**Backend clarification — 2026-10-18:** [Source audit7fc0f83](contracts/backend-review-7fc0f83.md) confirms D1 guards and authenticated creation-policy, which is an availability snapshot rather than a standalone quote API. New Payment recovery metadata supports existing unknown/REVIEW/recovery requirements; no new US/FR/SC is added. Total-loss/REVIEW replacement has no clearance API and stays support-required. Date filtering remains deferred. Current plan/contracts supersede earlier API-absent/await-D1 implementation notes below;100 task IDs/68 checked,25 FR/7 SC and financial authority remain preserved.

**QR implementation checkpoint — T089..T093**: I5 QR source/fixture/web is complete after accepted D3/workflow decisions.100 task IDs/68 completions; all25FR/7SC remain unchanged. UI uses local SVG and an independent labeled preview on the existing preview route; normal Payment/create/Confirm stays unavailable. Android/iOS Metro export is source/build proof, no device/native/bank/payOS acceptance. Full top-up/recovery still depends D1 and operational evidence; [validation](validation.md) records limits.

**Feature Branch**: `feat/mobile-wallet-payment-history`

**Feature Directory**: `specs/006-wallet-payment-history`

**Created**: 2026-10-16

**Status**: Wallet/Home, History/detail, I1/I2 and I5 synthetic QR source/W complete;68/100 tasks. Native-first design and two-device workflow approved. Real create/recovery still D1-gated; operational binding and API/payOS/native evidence unverified.

**Implementation design**: [plan.md](plan.md), with explicit capability gates and separate evidence layers. Historical implementation evidence is in [validation.md](validation.md); this replan claims no new runtime acceptance.

**Replanned**: 2026-10-17 against checkout `4121c3f`, comparing Payment `081b3d2`/merge `f80ef7a` with baseline `17e3ac1`. Owner create/list/detail, durable payOS checkout and verified atomic posting now exist in source. Mobile Payment remains unavailable until create/recovery/QR integration and financial gates are satisfied. See [Payment HTTP](contracts/payment-http.md) and [decision record](contracts/completion-proposal.md). US/FR/SC IDs and100 task IDs/63 completions are preserved.

**Input**: User description: "Tạo feature mobile Wallet, payment status and transaction history trong apps/mobile. Đọc AGENTS.md, constitution, docs mobile và SRS V1.6; kiểm tra source và API hiện có. Phạm vi gồm số dư ví, nạp Credit, trạng thái thanh toán và lịch sử giao dịch. Chỉ xác nhận thanh toán qua backend, không suy ra thành công từ redirect, không có rút tiền. Ghi rõ API còn thiếu và nghiệp vụ chưa rõ. Giữ nhánh hiện tại, không sửa backend."

## Clarifications

### Session 2026-10-17

- Q: Đã có cam kết BE owner về retention, replay và mất toàn bộ correlation chưa? → A: Chưa có; giữ D1/GAP-06 BLOCKED và chuẩn bị phiếu xác nhận BE. Không đặt SLA hoặc đoán lookup API.
- Q: Duyệt native-first, storage tài chính riêng và cleanup qua logout theo phương án D2 không? → A: Duyệt. Giữ encrypted unresolved correlation cho đúng owner sau reauthentication; xóa RAM/cache/QR ngay khi logout/đổi tài khoản, không cho B truy cập A; chưa bật web create. Cleanup/horizon cuối cùng vẫn chờ D1; không bảo đảm phục hồi khi mất hết dữ liệu thiết bị.
- Q: Duyệt bộ QR và phạm vi dependency D3 cho lượt triển khai được cho phép sau không? → A: Duyệt qrcode1.5.4, SVG hiện có, jsqr1.4.0/pngjs7.0.0 dev-only và typings khi cần; phạm vi package mobile/root lockfile trong lượt được cho phép sau. License/dependency, native/web và rendered-pixel decode vẫn phải kiểm chứng; chưa cài dependency.
- Q: Duyệt workflow hai thiết bị/QA entry và môi trường đã có chưa? → A: Duyệt workflow/QA entry. Sau lựa chọn ban đầu “môi trường còn chờ chuẩn bị”, người dùng đính chính “có rồi chỉnh lại đi”: môi trường được xác nhận đã có. Chưa kiểm chứng connection/build/channel/runbook hoặc có kết quả A/G/native; không suy ra quyền chạy thanh toán thật.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Know my available and held Credit (Priority: P1)

As a signed-in user, I can open my wallet from Home or my own Profile and distinguish spendable Credit from Credit held for an agreement.

**Why this priority**: Trustworthy balances are the foundation for top-up and transaction decisions.

**Independent Test**: Open wallets with zero, positive, fractional and held balances; verify the owner-visible amounts independently of payment creation.

**Acceptance Scenarios**:

1. **Given** an authenticated owner and a confirmed wallet snapshot, **When** the wallet opens, **Then** Available and Held Credit are separately labeled and exactly match the snapshot with two decimal places.
2. **Given** a successful owner read returning zero, including the backend's virtual zero wallet when no physical row exists, **When** it opens, **Then** zero is displayed normally; failed, unavailable or not-yet-loaded reads never become an invented zero balance.
3. **Given** wallet data is loading, stale, unavailable or cannot be read, **When** the screen opens or refreshes, **Then** it shows the appropriate state with a read retry, preserves recognizable stale data only for the same session, and never substitutes sample balances.
4. **Given** payment status was checked or the user refreshes the wallet, **When** a fresh snapshot is received, **Then** the wallet and any visible Home balance use the current account's confirmed amounts.
5. **Given** account A logs out while a financial read is pending and account B signs in, **When** A's response arrives, **Then** none of A's wallet, payment or history data appears in B's session.

---

### User Story 2 - Prepare and submit a Credit top-up (Priority: P1)

As a signed-in user, I can review a VND amount, payOS and the Credit conversion, explicitly create one top-up intent, and view its payment QR directly inside SkillHub.

**Why this priority**: Users must understand what they pay and avoid accidentally creating duplicate payment requests.

**Independent Test**: Prepare a top-up with the approved policy and exercise the immutable intent using isolated models. Real HTTP/financial acceptance waits for mobile integration, accepted recovery, QR-01 and approved environment evidence against the now-implemented backend. Rendering failure preserves the known payment and never creates another one.

**Acceptance Scenarios**:

1. **Given** the approved 1,000–2,000,000 VND policy in 1,000-VND steps, **When** the user enters a valid amount, **Then** review shows VND, payOS and the standard 1,000 VND per Credit rate; estimated Credit remains distinct from the confirmed quote returned by creation. There is no standalone public quote endpoint; source availability alone does not enable mobile creation.
2. **Given** a blank, zero, negative, fractional-VND, unrepresentable or policy-disallowed amount, **When** the user continues, **Then** submission is blocked with a readable reason and the input remains available for correction.
3. **Given** a valid review, **When** the user confirms repeatedly, **Then** only one creation attempt is active; a confirmed owner payment can display its exact backend-supplied QR payload encoded locally, without hosted checkout, browser/WebView or remote QR-image service.
4. **Given** creation times out, QR preparation is incomplete or rendering fails, **When** the user retries or connectivity returns, **Then** the app retains its known identity/intent and retries only the appropriate read/render/reconciliation action; it never silently creates a new intent.
5. **Given** a known payment and the user leaves/closes QR or returns manually from another app, **When** SkillHub resumes, **Then** the user can check that payment; closing QR does not cancel it or mark it failed, paid or expired.
6. **Given** operational creation/status/recovery APIs are unavailable, **When** top-up opens, **Then** real confirmation is unavailable with an explanation and no simulated real-money success. No return/cancel screen, bank-app deep link or QR save/share action is required by this QR-only scope.
7. **Given** the approved native-first scope, **When** a user opens top-up on web, **Then** real creation remains unavailable while owner reads/status and labeled preview remain supported. On native, the supported scan workflow displays QR for a second device; same-device bank navigation/save/share is not implicitly included. Actual use still requires satisfied financial gates and verified environment binding.

---

### User Story 3 - Check a payment's actual outcome (Priority: P1)

As the payment owner, I can check a known payment while viewing/leaving its in-app QR, when reopening status or when verification is delayed, so I know whether Credit was recorded.

**Why this priority**: QR visibility, provider checkout metadata, manual return and waiting time must never be mistaken for a verified owner payment result.

**Independent Test**: Read payment observations in all defined states and exercise QR/providerStatus confusion, forged legacy links, delayed verification and read failures independently of QR rendering or a US2 intent. The owner API now exists; mobile adapter/REVIEW/version behavior and real environment evidence remain future integration work.

**Acceptance Scenarios**:

1. **Given** QR/provider metadata or a forged/legacy link claims success, failure or expiry, **When** status opens, **Then** only an authorized backend payment read determines the outcome; providerStatus, QR visibility, link data and screen closure never change balances. No redirect flow is required.
2. **Given** the backend reports `CREATED` or `PENDING`, **When** status is displayed, **Then** verification is shown as incomplete and owner status reads update automatically while focused in the foreground; leaving, backgrounding or exhausting automatic checks never turns waiting into failure or expiry.
3. **Given** the backend confirms `PAID`, **When** status is displayed, **Then** success uses the confirmed payment amount and Credit and triggers fresh wallet/history reads without a local balance increment.
4. **Given** confirmed `PAID` and a failed or stale wallet/history refresh, **When** results are shown, **Then** payment remains successful, the refresh issue is separate and retry repeats reads only.
5. **Given** backend `FAILED`, `EXPIRED` or `REFUNDED`, **When** status is shown, **Then** the exact outcome is explained without inferring cash-out or applying a local balance change; starting another top-up requires an explicit new intent.
6. **Given** a missing, malformed, inaccessible or other-owner payment identifier, **When** status opens, **Then** no private payment details are disclosed and a safe return to wallet is available.
7. **Given** backend `REVIEW`, a failed read or unfamiliar payment state, **When** status is checked, **Then** REVIEW is shown neutrally as needing checking/reconciliation, and an unknown result remains unconfirmed with a retry; neither becomes a fabricated failure, success or permission to create again. Only owner reads determine state; newer authoritative observations may replace older ones, including EXPIRED→PAID, while server-suppressed QR must not reappear from stale data.

---

### User Story 4 - Understand my transaction history (Priority: P2)

As a signed-in user, I can browse recorded Credit movements and inspect an entry's amount, type, status and related business context.

**Why this priority**: Read-only history explains what happened without asking users to reconstruct their balances.

**Independent Test**: Browse and filter a multi-page owner history, inspect different transaction types/statuses, and open inaccessible identifiers without creating payments.

**Acceptance Scenarios**:

1. **Given** owner ledger entries, **When** history opens or loads more, **Then** entries preserve descending committed ledger-sequence order with amount/direction, type, status and timestamp; displayed time is not a client sort key and loaded records are not duplicated.
2. **Given** a supported type/referenceType filter, **When** it is selected, **Then** results match that criterion across the history with a new cursor-free selection; no status query/control or partial-page status filtering is presented as the full result.
3. **Given** an owner entry, **When** details open, **Then** its identifier, type, status, timestamp and recorded Credit movement are shown together with any supplied authorized reference, balance deltas, post-entry balances and reversal relationship; optional missing fields are not invented.
4. **Given** a pending or failed payment attempt, **When** history opens, **Then** payment status remains distinct from ledger-entry status and no successful ledger entry is manufactured.
5. **Given** a reversal or adjustment entry, **When** it is inspected, **Then** recorded status and available reversal/reference context remain visible without editing/deleting the original record or exposing an administrative action.
6. **Given** empty, filtered-empty, unavailable history or a later-page failure, **When** results are displayed, **Then** those states are distinguishable and earlier loaded records survive a page failure with a read retry.
7. **Given** a stale, unauthorized or sample transaction identifier, **When** it opens in the real-account flow, **Then** no invented or other-owner entry is displayed and the user can return to history.

### Shared acceptance scenarios

1. **Given** entry from Home, own Profile or a direct financial link, **When** Back is used through wallet/preparation/status/detail screens, **Then** origin context is preserved when available and direct links have wallet/history fallbacks.
2. **Given** loading, error, pending, paid and disabled-action examples, **When** used at 320 logical pixels wide and with a screen reader, **Then** amounts and actions are readable, controls/states have accessible names, and meaning does not depend on color alone.
3. **Given** hold, TWO_WAY return, ONE_WAY payment/earning, fee, bonus, material, refund, penalty and adjustment entries, **When** displayed, **Then** their recorded meanings and separate balance effects remain distinct and Session completion is never described as settlement.

### Edge Cases

- QR/providerStatus or forged, repeated, out-of-order or post-logout legacy return information cannot override a fresh owner-authorized payment read.
- Creation may time out before a payment identifier is received. Without an agreed way to reconcile or safely replay the same intent, show unknown outcome and block automatic resubmission.
- Logout clears private runtime data but retains only encrypted unresolved correlation for the same owner after reauthentication; account B must not read or enumerate A's record. Detected corruption/read failure blocks creation. Undetectable total record loss remains an explicit BE/operator decision; storage alone cannot promise restart recovery. No record TTL or new intent is inferred.
- A payment may succeed after the user leaves QR or stops waiting. Subsequent reads may show success; the approved 60-minute server quote TTL must not be restarted or converted into a client-decided financial status.
- Network recovery and foreground resume refresh reads only. Automatic checking is bounded, pauses in the background and stops on departure, session end or a confirmed terminal status.
- A confirmed successful payment may coexist with temporarily stale/unavailable wallet/history views. Keep those outcomes separate; never invent a corresponding ledger row or balance.
- A hold may move Credit between Available and Held without changing total ownership. A fee entry may have separate recorded deltas. Do not interpret every `amount` as a signed Available-balance delta.
- Fractional Credit, large values, equal timestamps, newly arriving entries and unfamiliar types/statuses must not cause precision loss, unstable order, duplicates or false financial labels.
- Operational create/query/receipts/atomic posting and backend worker recovery now exist. Real mobile continuation stays unavailable until actual-contract integration, GAP-06 retention/mobile correlation, QR-01 and approved operational evidence are complete.
- Missing, unauthorized or preview-only related records do not receive real financial identifiers or fabricated links.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Financial views MUST require the authenticated owner. Logout/account switch MUST clear financial views, drafts, QR and checking state and ignore results from earlier sessions. Only encrypted unresolved recovery correlation may remain, bound to its owner and accessible again only after that owner reauthenticates; another account MUST NOT read or enumerate it. Record cleanup remains subject to the confirmed recovery policy. (US1.5, US3.6, US4.7)
- **FR-002**: Wallet MUST show separate confirmed Available/Held Credit exactly to two decimal places; unavailable data MUST NOT be displayed as zero. (US1.1–3)
- **FR-003**: Home and own Profile MUST open the same wallet. Any Home balance presented as real MUST use the same authoritative account data, never a new/returning-user sample. Back MUST preserve origin when possible, with wallet/history fallbacks. (US1.1/4; shared scenario 1)
- **FR-004**: Financial reads MUST distinguish loading, confirmed empty/zero, stale refresh, inaccessible and unavailable/error states, with applicable retries and no fixture fallback. (US1.2–4, US3.4/6/7, US4.6)
- **FR-005**: Top-up MUST validate integer VND using the approved 1,000–2,000,000 VND range and 1,000-VND steps, then use the confirmed Payment quote. Public policyVersion/quoteId fields MUST NOT be invented. Presets MUST NOT be inferred from the preview. (US2.1/2/6)
- **FR-006**: Before creation, the user MUST review VND amount, payOS, standard 1,000 VND per Credit rate and estimated/confirmed Credit; backend conversion and quote remain final. (US2.1)
- **FR-007**: The user MUST explicitly confirm before creation. A confirmed owner payment identity MUST be established before QR presentation or status association. QR data MUST be encoded/rendered locally without normalization, remote QR service, hosted checkout, browser/WebView navigation or arbitrary URL/image interpretation. No provider secrets/card credentials enter mobile. (US2.3/6)
- **FR-008**: One top-up intent MUST NOT create parallel attempts through repeated taps. Ambiguous retries MUST use confirmed recovery/deduplication behavior; absent that mechanism, automatic resubmission MUST remain blocked. (US2.3/4)
- **FR-009**: A known payment identity MUST survive QR preparation/render failures and screen navigation in the active session. Reopening status MUST reauthorize/reread it; process-restart recovery requires an agreed mechanism. QR failure MUST NOT create another payment. (US2.4/5, US3.6)
- **FR-010**: QR/providerStatus, redirect claims, timers, screen closure and local calculations MUST NOT mark payments paid/failed/expired, create top-up entries, cancel the payment or change balances. (US2.5, US3.1/2/5)
- **FR-011**: Payment views MUST distinguish backend `CREATED`, `PENDING`, `PAID`, `FAILED`, `EXPIRED`, `REFUNDED`, `REVIEW` and unknown/unavailable outcomes. REVIEW MUST remain neutral without invented reason or financial action. Payment and ledger statuses MUST remain separate. (US3.2/3/5/7, US4.4)
- **FR-012**: Following the user's2026-10-18 UX revision, ordinary unresolved payment views MUST update through automatic owner GET reads rather than a manual Check again/Retry button. Reads MUST have a finite documented request budget, pause in the background and stop on departure, session end, owner denial or a confirmed terminal state. Exhaustion MUST NOT imply failure/expiry. Automatic reads MUST NOT create/replay a payment, bind an unknown key by amount or use an unrelated policy blocker as that key's identity. (US3.2/7; edge cases)
- **FR-013**: Verified success MUST trigger authoritative wallet/history refreshes. A failed refresh MUST NOT reverse success, increment balances locally or repeat creation. (US3.3/4)
- **FR-014**: Failed, expired and refunded payment views MUST explain the confirmed outcome and allow return to wallet/history. A new top-up MUST always be a separate explicit intent. (US3.5, US2.4)
- **FR-015**: History MUST preserve server descending ledger-sequence snapshot order, opaque continuation cursors and identity-based duplicate prevention. A refresh MUST start cursor-free and replace/rebuild the chain rather than mix a new first page with old continuations. (US4.1)
- **FR-016**: History MUST use supported type/referenceType criteria with filter-specific query identity and cursor reset. It MUST NOT send an unsupported status filter or label a partial-page local filter as complete. (US4.2)
- **FR-017**: Rows MUST show recorded Credit amount/direction, type, status and timestamp. Details MUST add identity and any supplied authorized reference, separate balance effects/post-entry balances and reversal context without deriving universal balance effects from `amount`. (US4.1/3/5)
- **FR-018**: Ledger statuses are `PENDING`, `SUCCESS`, `FAILED`, `REVERSED`. History MUST be owner-read-only, retain original entries and show unfamiliar types/statuses neutrally without financial reinterpretation. (US4.4/5; edge cases)
- **FR-019**: Explanations MUST distinguish TWO_WAY `PATH_RETURN` to the original holder, ONE_WAY `TEACHING_PAYMENT`/`TEACHING_EARNING`, fees, holds/releases, refunds, bonuses, penalties, adjustments and material movements. Session completion MUST NOT imply settlement; amounts MUST be displayed as recorded. (Shared scenario 3; SRS FR-CR-03..07)
- **FR-020**: Related-record navigation MUST use only authorized, supported destinations; missing or preview-only destinations MUST NOT receive real financial identifiers. (US4.3/7; edge cases)
- **FR-021**: Amounts MUST preserve exact confirmed values with explicit VND/Credit units. Mobile MUST NOT invent rounding policy, reconstruct a wallet from partial history or calculate authoritative settlement. (US1.1, US2.1, US4.3; edge cases)
- **FR-022**: This feature MUST NOT introduce withdrawal, cash-out, arbitrary peer transfers, history editing, manual settlement, refund requests or administrative adjustment actions. Existing refund/adjustment results may appear read-only. (US3.5, US4.5; SRS FR-CR-08/09)
- **FR-023**: Screens MUST provide readable Vietnamese labels, accessible control/state names, usable Back/retry actions and status meaning independent of color on mobile and web preview. (Shared scenarios 1/2)
- **FR-024**: Preview/test fixtures MUST remain explicitly isolated and labeled. Real entry points/status links MUST NOT present sample balances, success or references as account data. (US1.3, US2.6, US3.1, US4.7)
- **FR-025**: Missing capabilities and unresolved policies MUST remain visible dependencies. Affected real operations MUST show unavailable behavior, and fixture evidence MUST NOT count as real-backend/gateway or native-device acceptance. (US1.3, US2.6, US3.7, US4.6)

### Key Entities _(include if feature involves data)_

- **Wallet snapshot**: One owner's confirmed Available/Held Credit and any provided freshness/version indicator. Optional purchased/bonus breakdowns do not imply withdrawable balances.
- **Top-up intent**: Chosen VND amount, supported method and reviewed conversion before a payment exists; distinct from a ledger entry.
- **Payment**: Owner-authorized identity, VND amount, confirmed Credit/rate, method and backend verification status. Return information is not proof of payment.
- **Credit transaction**: Immutable owner entry with identity, type, amount, status, time, recorded balance effects and optional authorized reference/reversal relationship.
- **Financial operation**: Recorded top-up, hold, settlement, material purchase, refund or adjustment explaining one or more ledger entries, without mobile reconstruction of financial outcomes.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: In zero, positive, fractional and large-value acceptance examples, 100% of displayed wallet values match confirmed owner amounts to two decimal places; no unavailable wallet becomes zero/sample data.
- **SC-002**: With approved rules loaded, a user can enter a valid amount, review and explicitly continue toward the in-app QR payment within 60 seconds, excluding server preparation, network and verification waits.
- **SC-003**: QR/providerStatus, forged/legacy links and delayed/repeated observations produce zero false success displays or locally credited balances; all seven defined payment states including REVIEW remain distinguishable.
- **SC-004**: Repeated taps, interrupted creation, reconnect, checks and foreground resume cause zero unintended new payment intents or local double credits; ambiguous creation is reconciled or explicitly blocked until recoverable.
- **SC-005**: With at least 200 entries across multiple pages, each loaded entry appears once in the agreed order; every offered filter returns only matching records and details match the selected entry.
- **SC-006**: All account-switch, inaccessible-record and read-failure acceptance scenarios show zero other-owner/sample financial records and provide the applicable retry or safe return action.
- **SC-007**: All four journeys have separately recorded web-preview, Android and iOS acceptance results. At 320 logical pixels wide, amounts/statuses/actions remain readable and operable; web fixtures alone do not establish native or real-payment acceptance.

## Assumptions

- Scope is the authenticated user's wallet, top-up, payment status and read-only history in `apps/mobile`. The Home balance and own-Profile wallet entry are included to prevent contradictory financial data/navigation; other Home/Profile features are outside scope.
- Current SRS V1.6 is authoritative: FR-CR-01..09, BR-25..27, CR-001..010, PAY-001..005, UC-19 and AC-11. [contracts.md](contracts.md) records source evidence, missing capabilities and unresolved rules separately from behavioral requirements.
- Existing authentication, Vietnamese presentation, navigation and app-wide connection behavior are reused. Financial data is private; recovery refreshes reads only.
- Owner wallet/history reads are unchanged from baseline17e3ac1; P2/P3 and Payment I1/I2 have L/C/W evidence, while deployed/native acceptance remains separate. D2's native-first storage/logout design is approved, but GAP-06 still lacks BE retention/replay and total-loss guarantees; D2 approval does not close it.
- payOS QR-only, amount/step policy and60-minute immutable server quote TTL are settled. Create returns confirmed quote/nullable QR projection; no standalone quote API exists. D3 selects local QR tooling and D4 selects a two-device QA workflow; implementation/security/import/byte/rendered-pixel/native/channel evidence remains open. Mobile does not derive expiry from its clock or add a return/cancel flow. Native-first creation excludes web create until separately designed; web owner reads/status and isolated preview remain supported. User reports the acceptance environment already exists; actual binding/runbook and results are unverified in this documentation-only session.
- History contains records actually supplied by the backend. Type/referenceType filters are included in this replan; status/date/search, a unified payment-attempt list, export and held-allocation drill-down remain outside scope. A pending/failed payment need not have a ledger row.
- Backend verification, webhook deduplication, atomic top-up, hold/release/settlement, refunds and administration are dependencies, not implementation authorized by this mobile feature. No backend files may be modified.
- Existing P1..P5 scoped evidence remains in validation; updating this specification does not rerun tests or close financial acceptance. Usability/performance targets and real-backend/gateway/native outcomes require separately recorded validation. A minimal owner payment-discovery read may support recovery; it is not a unified payment/ledger feed or automatic lost-intent matching.
