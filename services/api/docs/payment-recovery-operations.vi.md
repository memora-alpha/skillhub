# Payment recovery và vận hành đối soát

Cập nhật 2026-10-18. Backend-only; mobile/web phải tích hợp contract riêng.
Không thực hiện chuyển tiền, tự restore Payment, tự gán receipt hoặc sửa ledger.

## Identity, replay và đơn chưa giải quyết

Foundation giữ mapping `(owner, payment:create, SHA256(key))` → fingerprint/body
và Payment ID, không TTL. Payment giữ `creation_key_digest` và
`creation_fingerprint` với unique `(user_id, creation_key_digest)`; trigger ngăn
đổi identity/owner, xóa Payment có identity hoặc TRUNCATE bảng payments.
Không lưu raw key. Trigger không bảo vệ trước restore backup hoặc người có quyền
thay schema/disable trigger; cần quản lý quyền DB và backup ngoài ứng dụng.

Create/replay luôn kiểm danh tính hiện hành. Khi mapping HTTP mất nhưng Payment
còn identity, cùng owner/key/body trả 200 cùng ID và phục hồi mapping atomically.
Khác body vẫn 409. Replay không gia hạn expiry hoặc tạo orderCode mới. Mapping
còn nhưng Payment mất trả 409 `PAYMENT_RECONCILIATION_REQUIRED`.

Key mới chỉ được reserve nếu owner không có CREATED/PENDING/REVIEW và không có
Payment payOS legacy thiếu identity tạo đơn, kể cả legacy PAID. Kiểm trong
transaction serializable sau live actor/user lock; request bị chặn rollback
cả claim idempotency. Không dùng cùng số tiền/thời điểm để đoán cùng intent.
Review/timeout/mất QR/404/lịch sử trống không chứng minh chưa chuyển khoản.

Migration `20261018000000_payment_recovery_guards` backfill identity từ mapping
completed còn giữ và đúng owner. Mapping mơ hồ khiến migration dừng; không chọn
một key tùy ý. Payment đã mất mapping trước migration không tự suy ra key.
Giữ các bản ghi legacy thiếu identity để đối soát; không xóa để mở chặn.

Lần rollout đầu: binary cũ chưa hiểu creation pause. Khóa chính xác
`POST /api/v1/payments` tại ingress trước migration, giữ route webhook hoạt động.
Backup, migrate, deploy toàn bộ instances, xác minh creation-policy/paused rồi
mới bỏ khóa ingress. Không chạy mixed binary/channel hoặc rollback về binary cũ
khi create đang mở, vì code cũ không thực thi các guard này. Không chỉ thêm env
vào binary cũ rồi coi đã khóa được create.

## Contract cho mobile

`GET /api/v1/payments/creation-policy` có auth, no-store, không gọi payOS:

```json
{"canCreate":false,"reasonCode":"PAYMENT_UNRESOLVED","existingPaymentId":"<own-payment-uuid>"}
```

Đây là snapshot tư vấn; POST luôn kiểm lại. Global operational gate không trả ID
của owner khác. Các kết quả:

| reasonCode | POST mới | Mobile |
| --- | --- | --- |
| null | Có thể 201 | Giữ key/body trước khi gửi; cùng intent giữ nguyên key |
| PAYMENT_UNRESOLVED | 409 | GET existingPaymentId, giữ chặn đơn mới |
| PAYMENT_RECONCILIATION_REQUIRED | 409 | Yêu cầu hỗ trợ; không tự đổi key |
| PAYMENT_CREATION_PAUSED | 503 | Hiển thị đang tạm dừng tạo đơn/đối soát |
| PAYMENT_CHANNEL_RECONCILIATION_REQUIRED | 503 | Đợi operator giải quyết channel cũ |
| PAYMENT_PROVIDER_UNAVAILABLE | 503 | Provider tắt/không khả dụng; không suy ra đơn cũ thất bại |

409 recovery có `details.existingPaymentId` chỉ của owner. Payment projection có
`recoveryRequired` và nullable `recoveryReason`: PAYMENT_REVIEW_REQUIRED,
PAYMENT_CHANNEL_UNAVAILABLE hoặc PAYMENT_CHECKOUT_MISSING. Không trả lastError
nội bộ/credential. QR chỉ hiển thị khi provider bật, creation không paused,
checkout đúng channel hiện tại và PENDING/READY chưa hết hạn.

Khi mất dữ liệu app: đăng nhập đúng account, đọc tất cả trang GET /payments,
hydrate bằng GET detail. Không chọn đơn chỉ dựa vào cùng số tiền, không tự POST
key mới sau transport timeout; không dùng local timeout làm kết quả terminal.
Không có danh sách/đơn sau restore không cho phép kết luận an toàn để tạo lại.
Code mobile trong checkout hiện tại vẫn là UI mẫu; chưa tích hợp contract này.

## Khóa create và phục hồi database

`PAYMENTS_ENABLED=true` cùng `PAYMENT_CREATION_PAUSED=true` chặn fresh create,
giữ đọc, webhook đã xác minh, worker và safe replay. Mapping mất riêng vẫn được
khôi phục nếu Payment identity còn. QR bị ẩn để không khởi tạo chuyển khoản mới;
QR đã chụp/lưu bên ngoài vẫn có thể được thanh toán.
`PAYMENTS_ENABLED=false` dừng cả provider handling; không dùng để drain.

Pause là cấu hình hạ tầng bên ngoài DB restore. Phải áp dụng cho mọi API instance
và restart/reload; không tự bật khi DB bị restore. Runbook:

1. Operator phụ trách triển khai bật pause trước restore, xác minh creation-policy
   trả paused ở mọi instance, giữ đúng credential/channel đang phục vụ đơn cũ.
2. Backup DB hiện tại và giữ chứng từ/provider export ngoài DB; ghi backup point,
   khoảng thời gian có nguy cơ mất dữ liệu, merchant/channel và incident ID.
3. Restore khi vẫn paused. Đối chiếu provider export với Payment/checkout,
   mapping, receipts/findings, TOP_UP/ledger/lots, wallet, audit và outbox.
4. Kiểm sequence orderCode với cả mã đã cấp bên provider sau backup. Khôi phục
   sequence theo tập mã đã đối chiếu; không chỉ dựa vào MAX trong DB vừa restore.
5. Dùng report bên dưới để phát hiện chênh lệch; dữ liệu còn trong DB không chứng
   minh toàn bộ giao dịch bên ngoài đã được tìm thấy. Giữ mọi case chưa rõ ở
   trạng thái chặn. Lưu report/chứng từ và người xác nhận trong incident.
6. Chỉ mở pause sau khi người chịu trách nhiệm vận hành xác nhận hoàn tất phạm vi
   restore; GET creation-policy vẫn chặn từng owner nếu REVIEW/legacy chưa rõ.

**Chưa hỗ trợ** tự khám phá/tái tạo Payment và mapping đã mất toàn bộ, import
provider export, reassign receipt, audited financial repair hoặc public/admin API
cho phép thay thế một đơn REVIEW. Không đánh PAID hay sửa số dư thủ công.
Không có workflow trong sản phẩm để xác nhận một case REVIEW đã được giải quyết;
case cần xử lý tài chính phải giữ chặn và phát triển instruction/audit riêng.

## Đổi channel

Không đổi cấu hình channel khi còn CREATED/PENDING/REVIEW của channel cũ.
Bật pause trên mọi instance và drain/đối soát bằng credential cũ trước.
Nếu đổi nhầm, BE chặn toàn bộ fresh create với
PAYMENT_CHANNEL_RECONCILIATION_REQUIRED, ẩn QR cũ và giữ đọc đơn.
Worker bỏ qua channel cũ; webhook chỉ xác minh bằng checksum hiện tại.
Quay lại credential/channel cũ khi cần tiếp tục xử lý, trong khi pause vẫn bật.
Không sửa field channel của checkout, không reset sequence, không chạy các
instance với channel khác nhau. Chỉ mở channel mới sau kiểm chứng riêng.

**Chưa hỗ trợ** phục vụ nhiều channel/credential cũ đồng thời hoặc tự migrate
đơn sang channel mới. Đơn PAID vẫn được giữ; callback cũ sau đổi channel có thể
không xác minh được bằng checksum mới, cần lưu khả năng đối soát phía merchant.

## Công cụ read-only và trách nhiệm hỗ trợ

Sau build, dùng tài khoản DB được cấp quyền đọc (operator tự quản lý env):

```powershell
pnpm --filter api payments:report --user-id <uuid> --limit 20
pnpm --filter api payments:report --payment-id <uuid> --lookup-provider
pnpm --filter api payments:report --order-code <decimal-order-code>
pnpm --filter api payments:report --transaction-id <bank-reference>
```

Chọn đúng một selector. Limit 1..100, report báo truncated; không coi report bị
cắt là toàn bộ lịch sử. Snapshot PostgreSQL chạy READ ONLY; lookup provider tùy
chọn chạy ngoài transaction, chỉ bằng stored quote và đúng channel hiện tại.
Lookup đã xác minh phản ánh thời điểm lookup sau snapshot, không phải cùng
snapshot với DB. Report không ghi receipt/posting, không repair hoặc cho phép
tạo đơn thay thế. Không xuất QR, raw provider payload, credential hoặc key digest.

Report gồm Payment/order/link, receipt reference/reason, TOP_UP links và findings
mapping/identity/ledger/lots. Không có Payment thì `missingPayment:true`; không
lookup bằng quote tự dựng. Order/giao dịch chỉ tồn tại bên payOS phải đối chiếu
trên merchant/export: **chưa hỗ trợ phục hồi bằng CLI này**. CLI không thực hiện
full wallet conservation audit hoặc thay thế reconciliation T023 của toàn Credit.

Khi mất mọi ID, hỗ trợ tiếp nhận account SkillHub, môi trường, số tiền, thời điểm,
mã giao dịch ngân hàng, biên lai/nội dung chuyển khoản; orderCode/paymentLinkId
nếu còn. Không yêu cầu password, OTP hoặc credential payOS. Account/time/amount
chỉ hỗ trợ tìm kiếm, không đủ để tự gán quyền sở hữu giao dịch.

Trách nhiệm: người hỗ trợ tiếp nhận evidence; operator có quyền merchant và DB
đối chiếu; người chịu trách nhiệm vận hành xác nhận incident trước mở global
pause. Team phải chỉ định tên/người thay thế trong hồ sơ vận hành trước activation.
Repository không tự gán Staff/Admin quyền repair và hiện chưa có workflow duyệt
cho từng owner được tạo lại sau REVIEW. Những case này tiếp tục **chưa hỗ trợ**.
