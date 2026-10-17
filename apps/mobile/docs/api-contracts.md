# Chỉ dẫn API contracts mobile

Liên kết tương thích được giữ nguyên. Contract hiện hành có một nơi sở hữu tại [contracts/README](contracts/README.md): [auth/account](contracts/auth-account.md), [profile/avatar](contracts/profile.md), [skills/evidence](contracts/skills-evidence.md), [learning requests](contracts/learning-requests.md), [wallet/payments](contracts/wallet-payments.md).

Checkpoint trước migration nằm tại [bản lưu lịch sử](archive/api-contracts-before-migration.md). Không dùng checkpoint cũ thay source hoặc status hiện hành. HTTP/session rules thuộc [API guide](guides/api-client.md) và [state/session](guides/state-and-session.md).

## Payment status preparation checkpoint — 2026-10-17

Spec006 P5 implements injected local owner-observation/related-refresh models
and labeled preview only. Normal status is unavailable and ignores URL outcome,
amount and provider claims. There is no Payment endpoint/DTO/HTTP hook, freshness
ordering or restart/lost-ID recovery contract. Conflicting models retain the
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
there is no Payment endpoint/DTO/adapter or durable recovery implementation.
Replay opt-out is tested with an in-memory adapter at the existing `/me` read
path, without Payment traffic. Synthetic preview models cannot access account
queries. QR rendering/independent decode remain BLOCKED by QR-01; passing
model/web checks does not establish API/payOS/Android/iOS acceptance.
