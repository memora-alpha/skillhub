# Wallet Payment và Credit

## Phạm vi nhánh và nguồn

Người dùng xác nhận Wallet/Payment đang được phát triển ở nhánh khác. Tên nhánh/commit và mức hoàn thành chưa được cung cấp. Phần source mô tả dưới đây chỉ thuộc checkout migration; thiếu spec006/API adapter tại đây không phải lỗi hay backlog cần triển khai lại. Source/tasks/evidence của luồng tích hợp thuộc nhánh đang làm, sẽ đối chiếu khi có yêu cầu tích hợp/review.

Working tree HEAD ed5a17dd9f1a6d5e45e1b6af33b17dd4518b46fd: [backend HTTP009](../../../../services/api/specs/009-credit-payment/contracts/http.md), [WalletController](../../../../services/api/src/modules/credit/presentation/http/wallet.controller.ts), [Wallet DTOs](../../../../services/api/src/modules/credit/presentation/http/wallet.responses.ts), [PaymentsController](../../../../services/api/src/modules/payments/presentation/http/payments.controller.ts), [Payment DTOs](../../../../services/api/src/modules/payments/presentation/http/payments.dto.ts), [recovery operations](../../../../services/api/docs/payment-recovery-operations.vi.md). Backend đã có source route; chưa xác minh deployment/provider.

Mobile chỉ có [wallet screens](../../src/features/wallet/screens.tsx) và [fixtures](../../src/features/wallet/fixtures.ts). Wallet/history là dữ liệu mẫu; amount/state route params chỉ điều khiển preview. Chưa có API adapter, QR renderer, durable payment claim hoặc native-only create capability trong checkout này. .specify selector cũ trỏ specs/006-wallet-payment-history nhưng thư mục không tồn tại; normal-payment-integration.md và validation006 cũng không tìm thấy. Đây là khác biệt phạm vi checkout đã được người dùng giải thích, không phải khoảng trống triển khai cần xử lý ở nhánh này. Không ghi “Confirm disabled” như mô tả Normal Payment runtime có thật.

## Contract backend để tích hợp sau, base /api/v1

Tất cả self routes Bearer/live authorization, owner scope; không gọi webhook từ app.

| Method/path                     | Input                                                    | Output chính                                                                                                                                           |
| ------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| GET /me/wallet                  | Owner                                                    | availableCredit,heldCredit exact strings và walletVersion; virtual zero version0 cho absent-wallet hợp lệ                                              |
| GET /me/wallet/transactions     | type?,referenceType?,cursor,limit                        | Own ledger page, stable high-water sequence snapshot                                                                                                   |
| GET /me/wallet/transactions/:id | Own UUID                                                 | id,operationId,type,amount,availableDelta,heldDelta,availableAfter,heldAfter,referenceType,referenceId,status,createdAt,reversesTransactionId nullable |
| GET /payments/creation-policy   | Owner,no-store                                           | canCreate,reasonCode,existingPaymentId; snapshot, POST recheck                                                                                         |
| POST /payments                  | Idempotency-Key; {paymentAmountVnd:string,gateway:PAYOS} | 201 fresh/200 replay, PaymentResponse                                                                                                                  |
| GET /payments                   | status?,cursor,limit                                     | Own payment page                                                                                                                                       |
| GET /payments/:id               | Own UUID,no-store                                        | Quote/status/checkout/version/recovery projection                                                                                                      |

Policy source [top-up-policy](../../../../services/api/src/modules/payments/domain/top-up-policy.ts) hiện yêu cầu VND1_000–2_000_000, bước1_000; đây là policy snapshot backend2026-10-15-v1, không min/max SRS cố định. PaymentStatus trong backend schema: CREATED/PENDING/PAID/FAILED/EXPIRED/REFUNDED/REVIEW; Ledger status PENDING/SUCCESS/FAILED/REVERSED.

Payment fields: id,status,paymentAmountVnd,currency:VND,creditAmount,conversionRateVndPerCredit,gateway,createdAt,expiresAt nullable,paidAt nullable,version,recoveryRequired,recoveryReason,checkout nullable. Checkout là paymentLinkId/qrCode/orderCode string/providerStatus; qrCode là payload render trong app, không hosted checkout URL. CREATED/checkout:null là preparation chưa xong, không tự PENDING/terminal. Expiry immutable quote60 phút theo backend contract, không kéo dài bằng retry; không áp thành polling budget UI.

Money decimal strings đúng2 số cho Credit; VND integer string; amount ledger là magnitude không âm, signed movement nằm deltas. Limit1–100/default20; cursor opaque owner/filter, ledger watermark/sequence; payments orderCode high-water giảm dần không hứa snapshot status bất biến. Nonowner404,403 permission,400 format/precision/amount,409 conflict/unresolved/reconciliation,429 rate,503 provider/policy/storage/gate.

Provider/policy errors gồm PAYMENT_PROVIDER_UNAVAILABLE/PAYMENT_POLICY_UNAVAILABLE. Recovery2026-10-18: owner có CREATED/PENDING/REVIEW hoặc legacy thiếu identity thì không tạo mới;409 PAYMENT_UNRESOLVED/PAYMENT_RECONCILIATION_REQUIRED có details.existingPaymentId. POST có thể503 PAYMENT_CREATION_PAUSED/PAYMENT_CHANNEL_RECONCILIATION_REQUIRED. Reason recovery: PAYMENT_REVIEW_REQUIRED/PAYMENT_CHANNEL_UNAVAILABLE/PAYMENT_CHECKOUT_MISSING. QR bị suppress khi disabled/paused/channel mismatch; không suy terminal từ checkout null hoặc QR mất.

Backend lưu SHA256(key)/canonical fingerprint owner-unique; mapping HTTP mất riêng có thể replay phục hồi cùng Payment/orderCode. Mapping còn nhưng resource mất => reconciliation409; mất cả hai chưa có automatic recovery,404 không đủ safe replacement. Safe replay vẫn kiểm live quyền/provider policy. Không client mark-paid/confirm-payment/reconcile/repair API. Provider webhook verified/idempotent chỉ backend post Credit; REVIEW không auto refund/downgrade PAID.

SSE backend dùng /events, refs walletUserId/operationId hoặc paymentId/status/version, không raw webhook/QR/số tiền; register/delivery semantics cần đối chiếu khi tích hợp. Mobile chưa có subscription Wallet. HTTP hydrate là nguồn status, SSE không chứng minh paid.

## Quy chuẩn cho thay đổi mới, chưa phải implementation mobile

Durable claim/runtime, native-only create/web restrictions và total-loss support boundary nêu dưới là yêu cầu cần đối chiếu quyết định gốc trước triển khai; hồ sơ006 thuộc công việc nhánh khác, chưa được review trong checkout này nên không kết luận chiến lược hoặc source complete của nhánh đó.

1. Số dư và ledger là projection server. Missing/malformed/error không trở thành số dư zero; absent-wallet hợp lệ chỉ hiển thị virtual zero khi contract xác nhận.
2. Giữ exact decimal strings và đơn vị VND/Credit. Số ước tính được gắn nhãn; không hiển thị như quote đã được backend xác nhận.
3. Một ý định tạo payment có idempotency identity/body ổn định. Timeout/unknown outcome không được coi là chắc chắn chưa tạo.
4. Durable claim/correlation phải được xác minh trước khi dispatch theo runtime được chốt trước triển khai. Storage hỏng/không đọc được không tự mở quyền tạo intent khác.
5. Replay phải rõ ràng, đúng key/body/environment/owner và policy; không tạo payment lúc mount, back, focus, reconnect hoặc background/foreground.
6. Payment ID biết được có thể có read/status flow độc lập theo contract. Không bắt mọi read phải truy cập durable create store nếu thiết kế hiện tại đã tách.
7. Validate owner/resource identity và version. Response cùng version, QR bị suppress hoặc checkout null không được suy ra terminal state ngoài contract.
8. QR chỉ là payload thanh toán để hiển thị. QR render được hoặc decode được không chứng minh merchant nhận tiền, callback đúng hoặc ledger đã posted.
9. `PAID`, `REVIEW`, expired QR, expiry timestamp và gateway status có semantics khác nhau; giữ state machine đang có. Không đổi terminal/precedence rules theo tên trạng thái suy đoán.
10. PAID đã xác nhận không bị hạ xuống failed vì refresh Wallet/History lỗi. Related reads có trạng thái retry/refresh riêng, không cộng tiền phía client.
11. Auto-read/polling là read hữu hạn theo policy giao diện hiện hành, dừng đúng lifecycle/denial/final/budget. Không coi cadence của UI là SLA hoặc thời hạn giao dịch do gateway cam kết.
12. Native/web capability khác nhau phải thể hiện rõ. Không tạo web create bằng RAM/localStorage fallback để vượt hạn chế native-only nếu quyết định có nguồn yêu cầu hạn chế đó. Trong checkout này chưa xác minh quyết định/runtime native-only.
13. Total-loss/recovery support boundary giữ theo quyết định hiện hành; không sinh replacement key khi chưa xác định intent cũ đã giải quyết an toàn.
14. Ledger append-only, Hold, Release và settlement thuộc backend. Mobile chỉ gọi command được contract cho phép; không sửa số dư, ghi ledger hoặc suy luận settle theo số buổi hiển thị.
15. Withdrawal/cash-out ngoài phạm vi SRS hiện hành theo source-of-truth. Không đưa thêm UI rút tiền hoặc subscription từ dự án tham khảo.

Ma trận kiểm chứng bắt buộc khi work có thay đổi payment/recovery:

| Nhóm                  | Ca cần xét theo phạm vi                                                                              |
| --------------------- | ---------------------------------------------------------------------------------------------------- |
| Input/quote           | Giá trị hợp lệ/không hợp lệ, đơn vị, estimate và server quote                                        |
| Duplicate/concurrency | Double tap, request đang chạy, response muộn, cùng intent/key                                        |
| Unknown/recovery      | Timeout sau dispatch, mất ID, restore, storage lỗi, unresolved intent                                |
| Lifecycle             | Back, blur/focus, app background/resume, logout/account switch, process restart nếu có durable state |
| Projection            | CREATED/PENDING/PAID/REVIEW và state khác theo contract, version/order/QR suppression                |
| Privacy               | Wrong owner, 403/404, cache eviction, stale session                                                  |
| Integration           | API thật/deployment, merchant/provider và native persistence, phân biệt từng mức bằng chứng          |

Chỉ thực hiện giao dịch thật, dùng tài khoản thật hoặc thay đổi dữ liệu tài chính khi được cho phép cụ thể. Việc viết tests/fixture và xem source không tự cấp quyền đó.

## Tiếp tục và verification

[Plan Wallet](../work/phase-03-wallet-topup/plan.md) và [status Wallet](../work/phase-03-wallet-topup/status.md) chỉ ghi ranh giới công việc ở nhánh khác; tasks và acceptance triển khai thuộc hồ sơ của nhánh đó. QR decode ảnh render chỉ chứng minh renderer; chưa có bằng chứng mobile deployed API/payOS merchant/native SecureStore/process termination. Domain rules/settlement tại [domain-rules](../domain-rules.md), lifecycle chung tại [state/session](../guides/state-and-session.md). Không tạo intent hoặc giao dịch thật trong migration.
