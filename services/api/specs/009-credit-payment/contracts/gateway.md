# Gateway Contract — payOS

Updated: 2026-10-17. User đổi provider từ SePay sang **payOS**. Quy tắc phí, hạn mức và provenance giữ nguyên. Adapter/REST transport, durable checkout/receipt, posting và lookup recovery đã có source + local tests. Merchant thật chưa kiểm chứng; xem [runtime guide](../../../docs/payos-qr-payments.vi.md) và [validation](../validation.md).

## REST checkout và identity

[API chính thức](https://payos.vn/docs/api/): server gọi `POST https://api-merchant.payos.vn/v2/payment-requests` với `x-client-id` và `x-api-key`. Không gửi credential hoặc signed create payload xuống client. Adapter `prepareCheckout` trả server-only request; transport sẽ chạy sau khi commit immutable quote/intent, ngoài PostgreSQL transaction. Response hợp lệ được `verifyCheckoutResponse` kiểm chữ ký toàn bộ data, orderCode, amount, currency và QR trước khi lưu QR projection cho owner.

User amendment 2026-10-16: **chỉ dùng QR payOS**. `qrCode` là chuỗi dữ liệu để client render QR trực tiếp trong SkillHub, không phải URL ảnh hay URL checkout để mở bằng trình duyệt/WebView. Projection chỉ có `{paymentLinkId,qrCode,orderCode,providerStatus}`; không trả `method`, `url` hoặc `checkoutUrl`. Hosted checkout metadata, nếu có, vẫn thuộc payload được kiểm chữ ký rồi bị loại khỏi projection. QR flow không phụ thuộc giá trị hay sự có mặt của `checkoutUrl`.

`orderCode` là positive safe integer ở provider boundary, canonical decimal string trong application. Reserve cấp bằng PostgreSQL identity, persist một lần và dùng lại khi retry; không dùng Date.now hoặc cắt UUID để giả định uniqueness. Không dùng chung merchant cho các database độc lập. VND dùng bigint ở domain, chỉ đổi sang JSON integer sau kiểm bounds 1.000–2.000.000/bước1.000. `expiredAt` là Unix seconds Int32 từ expiry đã lưu, tối đa một giờ; không cấp lại TTL khi retry.

Create signature dùng năm fields theo thứ tự alphabet: amount, cancelUrl, description, orderCode, returnUrl; nối key=value bằng &, HMAC-SHA256 hex với checksum key. Description cố định SH CREDIT. expiredAt gửi kèm nhưng không thuộc năm fields ký. payOS vẫn bắt buộc returnUrl/cancelUrl dù SkillHub chỉ dùng QR: giữ cấu hình HTTPS server-side để tạo request và chữ ký hợp lệ; không dùng chúng để điều hướng trong QR flow hoặc quyết định PAID. Không cần xây trang return/cancel cho trải nghiệm QR này. Docs hiện liệt kê production host; không invent sandbox host/flag.

## Webhook authentication

[Chữ ký payment-request/webhook](https://payos.vn/docs/tich-hop-webhook/kiem-tra-du-lieu-voi-signature/) khác payout encoding. Verify toàn bộ data trước strip PII: sort code-unit keys, raw scalar values, null và chuỗi null/undefined thành rỗng, HMAC-SHA256 hex constant-time compare. Create/webhook giữ flat schema. Lookup hỗ trợ array các object scalar, sort keys từng object trước JSON serialization theo provider; vẫn reject nested shapes chưa hỗ trợ. Không dùng shared-secret header hoặc ký riêng whitelist bỏ mất fields.

Chuẩn hóa gateway/channel/orderCode/paymentLinkId/reference/amount/currency/signed code/transactionDateTime. Signed success code00 + VND chỉ là candidate PAID; posting còn phải match stored quote/link/channel/exact amount. Envelope code/success không nằm trong chữ ký data: chỉ dùng để fail closed, không thay signed code. Reference là provider transaction identity, eventKey scope PAYOS+channel+reference; cùng identity khác business digest vào REVIEW. Không post bằng eventKey đơn thuần hoặc delivery timestamp. Không lưu account/customer metadata sau verification.

[Webhook contract](https://payos.vn/docs/du-lieu-tra-ve/webhook/) nhận 2xx ACK. Proposed route `/api/v1/payments/webhooks/payos`; ACK200 sau durable receipt hoặc transaction commit. Invalid signature401, malformed400, persistence failure5xx. Unknown quote/mismatch/partial/overpaid/late/sample webhook lưu REVIEW, không cấp Credit hoặc auto-refund. Confirmation có sample transaction: không special-case orderCode123 thành paid hay bỏ toàn bộ event123; chỉ matched reserved business identity mới được post.

## Lookup và recovery

API `GET /v2/payment-requests/{id}` nhận orderCode hoặc paymentLinkId; future transport dùng stored identity và credential cùng channel, verify provider evidence trước reconcile. Timeout/duplicate create cần lookup cùng orderCode trước retry, không cấp mã mới. Local expiry không chứng minh không thu tiền. Callback tới sớm không bị preparation CAS ghi đè PAID. Transaction reference uniqueness và receipt recovery phải có DB proof; adapter digest không thay thế guarantees này.

## Config và verification

PAYMENTS_ENABLED=false mặc định. Enabled yêu cầu PAYOS_CLIENT_ID, PAYOS_API_KEY, PAYOS_CHECKSUM_KEY, HTTPS PAYOS_RETURN_URL và PAYOS_CANCEL_URL. Không log headers/signatures/raw payload/checkout URL. Không sửa env thật, đăng ký webhook hoặc gọi gateway thật trong lần chuyển provider.

Tests phải kiểm golden webhook vector chính thức, create canonical fields/expiry/safe integers, signed response quote/QR matching, projection không chứa hosted URL, tampered data/PII/missing signature, duplicate identity/digest và unknown outcomes. Full create→lookup→webhook→durable receipt→one TOP_UP, partial/late/crash recovery và channel readiness vẫn là activation gates trong tasks/validation. Trạng thái UI lấy từ Payment API/SSE/polling đã xác thực; đóng màn hình QR không tự hủy hay chứng minh chưa trả tiền. Không thêm cancel endpoint/policy khi chưa có yêu cầu nghiệp vụ riêng.
