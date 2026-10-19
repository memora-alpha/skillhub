# Chỉ dẫn API contracts mobile

Liên kết tương thích được giữ nguyên. Contract hiện hành có một nơi sở hữu tại [contracts/README](contracts/README.md): [auth/account](contracts/auth-account.md), [profile/avatar](contracts/profile.md), [skills/evidence](contracts/skills-evidence.md), [learning requests](contracts/learning-requests.md), [wallet/payments](contracts/wallet-payments.md).

Checkpoint trước migration nằm tại [bản lưu lịch sử](archive/api-contracts-before-migration.md). Không dùng checkpoint cũ thay source hoặc status hiện hành. HTTP/session rules thuộc [API guide](guides/api-client.md) và [state/session](guides/state-and-session.md).

**Current Wallet/Payment source checkpoint — 2026-10-19:** Ordinary native Top-up/Payment routes now bind the shared authenticated client, durable recovery store, explicit create/same-key replay, QR presentation and bounded foreground status reads. Independent owner status reads are enabled on native/web; web create/recovery remains unavailable. Navigation and lifecycle do not create/replay payments. Confirmed PAID results refresh Wallet/History separately without client crediting. See [ordinary native integration](../specs/006-wallet-payment-history/contracts/normal-payment-integration.md) and [validation](../specs/006-wallet-payment-history/validation.md). Deployment/API/payOS and native-device acceptance remain unverified. Older checkpoints below describe their historical scope, not the current capability flags.

**Historical QA checkpoint — 2026-10-18, BE7fc0f83 / HEAD5101aea + working tree:** Spec006 now integrates required payment recovery metadata, owner policy/status reads and native store/explicit create/replay/review/QR/status through a private QA entry. Normal Payment/Confirm stays disabled. Source/fixture/web and JS bundle checks are recorded in spec006/validation; actual deployment/API/payOS/Android/iOS acceptance remains unverified. Earlier source-missing notes are historical; no proposed API is treated as implemented.

**Historical Wallet/Payment replan — 2026-10-18:** Source7fc0f83/HEAD5101aea now implements authenticated GET /payments/creation-policy, Payment creation-identity fallback, pause/channel/REVIEW guards and required recoveryRequired/recoveryReason DTO fields. See [source/contract audit](../specs/006-wallet-payment-history/contracts/backend-review-7fc0f83.md). D1 source-sync is cleared with explicit unsupported total-loss/support boundary. Mobile owner status/list transport and QR preview exist, but recovery fields are not yet projected and native durable create/store/QA binding remain pending; normal Payment/Confirm stay off. Older checkpoints below retain historical scope. No date filter, backend mutation or activation is added.

## Payment backend contract replan — 2026-10-17

At checkout `4121c3f`, backend Payment `081b3d2` (merge `f80ef7a`) adds authenticated
POST/list/detail `/api/v1/payments`, persisted quote/nullable raw QR, REVIEW/numeric
version, retained same-key/body replay, signed receipts and atomic TOP_UP posting.
Actual request/response and source anchors are in
[spec006 Payment HTTP](../specs/006-wallet-payment-history/contracts/payment-http.md).
There is no standalone quote/policy or GET-by-key endpoint. Same-version checkout
may become null due to server read-time expiry; it does not establish EXPIRED.

Current mobile Payment is still preparation only, with every Payment capability
and real Confirm/status unavailable. New wire integration must add REVIEW and
version-aware observation, independent known-ID reads and recovery/QR gates.
GAP-06 retention/lost-correlation/mobile restart policy and QR-01 renderer/decoder
remain open. Source/mocked-provider evidence does not establish deployed API,
merchant or native acceptance. Existing Wallet/history contracts are unchanged.

## Historical Payment status preparation checkpoint — 2026-10-17

Spec006 P5 implements injected local owner-observation/related-refresh models
and labeled preview only. Normal status is unavailable and ignores URL outcome,
amount and provider claims. At the old17e3ac1 baseline no operational Payment
endpoint/freshness contract existed; mobile still has no live Payment DTO/HTTP
hook. These local preparation models retain the
previous result stale; denial evicts it; PAID survives independent refresh errors.
Owner reads/P4 remain unchanged and all Payment capabilities stay off.
Source/model/web checks are separate from actual API/payOS/native acceptance;
see [validation](../specs/006-wallet-payment-history/validation.md).

## Wallet/History checkpoint — 2026-10-17

Spec006 P2 integrates authenticated `GET /me/wallet` through the existing client.
The strict projection is `availableCredit`, `heldCredit` (exact two-decimal Credit
strings, already CR) and safe nonnegative integer `walletVersion`. Successful
authorized absent-wallet reads may return virtualzero; missing/malformed/error
responses never supply a zero fallback. Home and overview share one owner/session
query;403/404 evicts the money, and hidden screens do not keep financial reads
active behind preview. Other Home learning content retains its existing mocks.
P3 also integrates owner History/detail GETs. List sendslimit20 with only
type/referenceType/cursor, retaining returned order and rebuilding snapshot
continuations on refresh. Shared page parser stays max50. Detail validates UUID
and returned identity; all five monetary strings remain exact.403/404 evicts
private projections, with no cached-list detail fallback or inferred related
destination. The three confirmed read capabilities are enabled on focused
current-owner screens; all Payment operations remain unavailable. Source/fixture/web checks do not establish
deployed migration/API, payOS or native acceptance; see
[spec006 validation](../specs/006-wallet-payment-history/validation.md).

P4 adds only approved-policy amount/review and session-owned inert intent/QR
presentation models. Normal Confirm and all Payment capabilities stay off;
there is no mobile live Payment DTO/adapter or durable correlation implementation.
Replay opt-out is tested with an in-memory adapter at the existing `/me` read
path, without Payment traffic. Synthetic preview models cannot access account
queries. QR rendering/independent decode remain BLOCKED by QR-01; passing
model/web checks does not establish API/payOS/Android/iOS acceptance.
