# Nạp Credit bằng QR payOS

Ngày cập nhật: 2026-10-19. Phạm vi: backend `services/api`.
Code có API/Swagger, transport payOS, lưu đơn/biên nhận, posting TOP_UP,
nguồn Credit, recovery và event SSE. Web/mobile cần tích hợp UI riêng.
Kiểm thử provider giả lập không thay thế giao dịch thật với merchant.

## Luồng xử lý

1. FE gọi `POST /api/v1/payments` bằng access token và `Idempotency-Key`.
2. BE kiểm danh tính còn hiệu lực, số tiền và nguồn Credit của ví. PostgreSQL
   lưu Payment, quote, policy version, expiry, return/cancel URLs và orderCode
   duy nhất trước khi gọi payOS. Cùng actor/key/body trả lại đơn cũ; đổi body
   với key cũ trả 409. Payment giữ key digest/fingerprint riêng, không TTL.
   Mất riêng mapping HTTP vẫn replay cùng Payment và phục hồi mapping.
   Key mới bị chặn nếu owner còn CREATED/PENDING/REVIEW hoặc Payment payOS legacy
   thiếu identity tạo đơn. Chỉ đổi số tiền bằng key mới sau khi đơn cũ được giải quyết.
3. BE gọi REST payOS ngoài database transaction; xác minh chữ ký response và
   đối chiếu orderCode/số tiền/currency. FE chỉ nhận chuỗi `qrCode` để render QR.
   Không nhận hosted checkout URL, credentials, signature hay return/cancel URL.
4. Người dùng quét QR và chuyển khoản. Việc hiển thị QR hoặc đóng màn hình không
   được coi là đã nạp và không tự hủy đơn.
5. payOS gửi webhook. BE kiểm HMAC trên toàn bộ `data` trước khi lọc dữ liệu cá
   nhân. Đối chiếu merchant, orderCode, paymentLinkId, số tiền và thời điểm chuyển.
6. Một transaction PostgreSQL lưu receipt, TOP_UP operation, ledger, purchased
   lot, cập nhật ví/Payment PAID, ghi audit và user events/outbox. Nếu bất kỳ bước
   nào lỗi thì rollback toàn bộ; callback nhận lỗi để nhà cung cấp retry.
7. FE nhận `payment.updated` và `wallet.updated` trên SSE hiện có rồi gọi lại
   detail/wallet. Webhook trùng đã xác minh trả 200, không cộng thêm Credit.

Không có API client tự đánh dấu đã trả tiền. Backend không gọi provider từ GET.

## API và payload

Các route xuất hiện trong Swagger tag `payments`, kể cả khi provider đang tắt.
Swagger chỉ được bật khi `NODE_ENV` khác `production`; kiểm đúng môi trường.

| API | Xác thực | Mục đích |
| --- | --- | --- |
| `POST /api/v1/payments` | Bearer + Idempotency-Key | Tạo đơn own; 201 mới, 200 replay |
| `POST /api/v1/payments/{paymentId}/cancel` | Bearer + Idempotency-Key | Không body; hủy own CREATED/PENDING sau signed provider confirmation |
| `GET /api/v1/payments?limit=20&status=PENDING` | Bearer | Liệt kê own theo cursor |
| `GET /api/v1/payments/{id}` | Bearer | Trạng thái/quote/QR còn hiệu lực |
| `GET /api/v1/payments/creation-policy` | Bearer | Khả năng tạo mới và own blocking ID; không gọi provider |
| `POST /api/v1/payments/webhooks/payos` | Chữ ký payOS | Callback công khai của provider |
| `GET /api/v1/me/wallet` | Bearer | Available/Held và walletVersion |
| `GET /api/v1/events` | Bearer | SSE dùng chung, hỗ trợ replay |

Create body:

```json
{"paymentAmountVnd":"100000","gateway":"PAYOS"}
```

Không truyền `userId`, `creditAmount`, `status`, `rate`, return/cancel URL từ FE.
Chính sách đã chốt: 1.000–2.000.000 VND, bước 1.000 VND, TTL 60 phút;
1.000 VND = 1 Credit. 100.000 VND trả `creditAmount: "100.00"`. VND và Credit
là string; bên trong BE Credit dùng bigint hundredths, 100 units = 1 Credit.
Nạp tiền không áp dụng phí settlement 4% của Learning Path.

Response dùng envelope chuẩn `{success,message,data}`. Ví dụ `data`:

```json
{
  "id":"<payment-uuid>",
  "gateway":"PAYOS",
  "status":"PENDING",
  "paymentAmountVnd":"100000",
  "currency":"VND",
  "creditAmount":"100.00",
  "conversionRateVndPerCredit":1000,
  "createdAt":"2026-10-17T01:00:00.000Z",
  "expiresAt":"2026-10-17T02:00:00.000Z",
  "paidAt":null,
  "version":2,
  "checkout":{
    "paymentLinkId":"<provider-link-id>",
    "orderCode":"1000000000",
    "providerStatus":"PENDING",
    "qrCode":"<EMV-QR-payload>"
  }
}
```

`checkout:null` khi đang chuẩn bị, đã hết hạn, đã trả tiền hoặc cần REVIEW.
`CREATED` chưa có nghĩa provider đã tạo thành công. `PENDING` có nghĩa đã có
response/lookup được xác minh. QR chỉ xuất hiện ở đơn PENDING/READY chưa hết hạn.
Payment GET/create trả `Cache-Control: no-store`. Không ghi QR vào analytics/log.
Cursor bind owner/status, giữ high-water orderCode và thứ tự giảm dần; đơn mới
không chen vào trang sau. Trạng thái đơn vẫn có thể thay đổi giữa các trang.
Đọc đơn người khác trả 404, token bị thu hồi không được replay hoặc đọc tiếp.

## FE và SSE

Hủy: gọi `POST /api/v1/payments/{paymentId}/cancel` không body. Trả200
PaymentResponse với CANCELLED/checkout:null (hoặc EXPIRED nếu provider đã hết hạn).
Gọi lại đơn CANCELLED an toàn. 409 PAYMENT_ALREADY_PAID/PAYMENT_REVIEW_REQUIRED:
đọc detail và theo trạng thái backend; không hiển thị hủy thành công.
409 PAYMENT_CHECKOUT_BUSY hoặc503 PAYMENT_CANCELLATION_UNCONFIRMED: đọc lại
detail rồi retry cùng Idempotency-Key; timeout không là bằng chứng đã hủy.
Sau hủy thành công có payment.updated; GET creation-policy trước khi tạo đơn mới.
Biên nhận chuyển tiền mới sau CANCELLED đi REVIEW, không tự cộng/hoàn tiền.
Deploy phải migrate `20261019010000_payment_cancellation` trước khi chạy code;
client cần xử lý thêm status CANCELLED. Merchant cancel thật vẫn cần kiểm chứng.

Render dữ liệu `checkout.qrCode` bằng QR renderer của client; không coi chuỗi này
là URL ảnh, không mở checkout của payOS. Nếu mất kết nối, dùng GET detail để
hydrate trạng thái. Polling GET không tạo lại QR hay gọi provider.

SSE payload chỉ chứa refs:

```text
event: payment.updated
data: ... payload:{"paymentId":"<uuid>","status":"PAID","version":"3"} ...

event: wallet.updated
data: ... payload:{"walletUserId":"<uuid>","operationId":"<uuid>"} ...
```

Envelope SSE cụ thể giữ nguyên contract Application Events. Khi nhận payment
event, GET detail; khi nhận wallet event, GET wallet/history. Chỉ user sở hữu mới
được nhận event tương ứng. Dùng SSE client hỗ trợ Authorization header; không
đưa access token vào query URL. Redis chỉ đánh thức stream; PostgreSQL giữ
delivery/replay, heartbeat vẫn đọc được event nếu wakeup bị mất. Không suy ra số
dư bằng cách cộng một event vào state cũ vì event/reconnect có thể lặp.

## Cấu hình server

Khai báo mẫu trong `services/api/.env.example`. Local đọc env của API; production
đặt các biến tương ứng tại cấu hình application/container trong Coolify. Đừng
copy credential thật vào file tracked hoặc FE. Lấy credential từ đúng kênh
thanh toán payOS do nhóm sở hữu; mỗi môi trường dùng merchant/channel riêng.

| Biến | Giá trị / nguồn |
| --- | --- |
| `PAYMENTS_ENABLED` | Mặc định `false`; `true` mới cho phép tạo/xử lý provider |
| `PAYMENT_CREATION_PAUSED` | Mặc định `false`; `true` chặn đơn mới, ẩn QR; giữ webhook/recovery và replay đúng đơn |
| `PAYOS_CLIENT_ID` | Client ID từ payOS; snapshot vào đơn để bind merchant |
| `PAYOS_API_KEY` | API key từ payOS; header server-to-server |
| `PAYOS_CHECKSUM_KEY` | Checksum key từ payOS; ký request/verify callback/response |
| `PAYOS_RETURN_URL` | HTTPS hợp lệ do nhóm quản lý; bắt buộc trong create/signature |
| `PAYOS_CANCEL_URL` | HTTPS hợp lệ do nhóm quản lý; bắt buộc trong create/signature |

QR flow không điều hướng qua return/cancel. Có thể dùng endpoint HTTPS hiện có
như `https://<api-domain>/api/health` cho cả hai nếu không có trang FE tương ứng.
Không để rỗng khi bật payment; config sẽ từ chối startup. Không dùng URL có
userinfo/hash. Đây không phải webhook URL và không phải bằng chứng đã thanh toán.

URL webhook đăng ký trong payOS:

```text
https://<api-domain>/api/v1/payments/webhooks/payos
```

Reverse proxy phải chuyển POST/JSON nguyên vẹn đến API, không yêu cầu bearer
login. Callback vẫn qua shared request throttle; theo dõi 429 để tránh chặn
delivery provider trong đợt burst. Invalid schema/signature nhận 400/401.
payOS sample có chữ ký hợp lệ nhưng không có đơn tương ứng được lưu REVIEW và
ACK 200 `{success:true}`; không cộng tiền. Không thêm envelope ứng dụng vào ACK.

## Migration và triển khai

1. Backup database và triển khai theo release pipeline hiện có. Giữ nguyên
   checksum migration đã áp dụng; additive migration mới là
   `20261017000000_payos_payments`.
2. Chạy migration trước khi restart code mới (pipeline `db:release`/`db:deploy`
   theo deployment guide). Không chạy `prisma migrate dev` trên production.
3. Migration thêm checkout/receipt/finding, lots/lot holds, digest và cờ provenance.
   Chỉ ví rỗng mới được tự đánh dấu có provenance. Ví cũ có tiền giữ untracked;
   API tạo đơn trả 409 `CREDIT_PROVENANCE_REVIEW_REQUIRED` cho đến khi có backfill
   nguồn tiền được đối soát. Không dựng opening balance hoặc tự chia purchased/bonus.
4. Kiểm tra Swagger có các payment routes và database version đúng. Default
   disabled trả 503 `PAYMENT_PROVIDER_UNAVAILABLE` khi tạo đơn; đọc own vẫn được.
5. Sau kiểm thử merchant, bật biến môi trường, restart và xác minh readiness.
   Khi đổi channel cần drain/đối soát đơn cũ trước: worker chỉ xử lý đúng channel
   hiện tại. Giữ database/sequence qua các lần deploy; không chia một merchant
   cho các database độc lập vì có thể trùng orderCode phía provider.
6. Kiểm một giao dịch thật với số tiền được duyệt: QR, callback, PAID, một TOP_UP,
   một purchased lot, audit, wallet SSE/history; replay webhook không tăng số dư.
   Đối chiếu SHA triển khai. Các test local không chứng minh bước này đã thành công.

## Recovery và đối soát

Worker tự quét bảng checkout mỗi 15 giây, batch tối đa 20; row có lease token
30 giây để các API instance không tạo trùng. Bình thường lookup lại mỗi 60 giây.
HTTP payOS timeout 4 giây, response tối đa 128 KiB, không theo redirect. Retry lỗi
có backoff tối đa 5 phút, sau 6 lần lỗi liên tiếp chuyển REVIEW. Lease hết hạn
cho phép instance khác tiếp tục sau crash.

Tạo provider timeout: giữ nguyên quote/orderCode/expiry/URLs; tra cứu trước khi
retry cùng orderCode, không tạo mã mới cho một Payment. Lookup PAID chỉ được post
khi có một giao dịch đúng toàn bộ số tiền, đúng link và thời điểm. Partial,
multiple, late hoặc thiếu evidence vào REVIEW. Thời gian payOS không có timezone
được hiểu là Asia/Ho_Chi_Minh (+07:00), lưu UTC. Chuyển đúng hạn nhưng webhook đến
muộn vẫn được nhận theo timestamp giao dịch đã ký.

Nếu provider đã tạo đơn nhưng response QR bị mất và lookup không cung cấp QR,
đơn chuyển REVIEW `PAYMENT_QR_UNAVAILABLE`; không tự dựng QR từ dữ liệu ngân hàng.
FE phải chặn tạo đơn mới và yêu cầu đối soát. Đơn REVIEW không tự phát Credit,
kể cả khi có webhook hợp lệ đến sau đó; không coi mất QR là bằng chứng chưa trả tiền.
Giao dịch thực sự đã đến cần operator đối chiếu, không sửa ledger cũ hoặc gọi
endpoint giả confirm-paid. Các policy refund/compensation chưa chốt vẫn đóng.

Tra cứu read-only bằng công cụ database được cấp quyền:

```sql
SELECT p.payment_id,p.status,c.order_code,c.state,c.last_error,c.attempts,c.next_attempt_at
FROM payments p JOIN payos_checkouts c USING(payment_id)
WHERE p.status='REVIEW' OR c.lease_until < CURRENT_TIMESTAMP
ORDER BY c.next_attempt_at LIMIT 100;

SELECT id,payment_id,state,reason,conflict,created_at
FROM payment_receipts WHERE state='REVIEW' OR conflict
ORDER BY created_at DESC LIMIT 100;
```

Receipt gốc giữ normalized evidence, không account/name/description. Finding
xung đột giữ digest/evidence mới mà không ghi đè receipt. PAID không bị downgrade
hoặc cộng lại khi có callback khác. Unmatched receipts vẫn được giữ để đối soát;
không tự gán một receipt cũ cho Payment mới.

Source lots theo BONUS-first rồi FIFO cho nguồn còn lại. Hold lưu từng lot;
settlement TWO_WAY hoàn đúng lot và tiêu thụ phí; ONE_WAY tiêu thụ lot người học,
tạo EARNED lot cho người dạy. Những ví legacy untracked vẫn dùng luồng Path cũ;
không được coi là đã backfill provenance. Chưa mở bonus program, cash-out, refund,
admin adjustment hoặc tự sửa số dư trong phạm vi Payment này.

## Kiểm thử và troubleshooting

[Runbook restore/channel và hỗ trợ mất định danh](payment-recovery-operations.vi.md)
quy định khóa create riêng, contract cho mobile, công cụ report read-only và
những thao tác chưa hỗ trợ. Không đổi channel khi còn đơn chưa đối soát.

Từ root sau khi cài dependencies:

```powershell
pnpm --filter api check-types
pnpm --filter api lint
pnpm --filter api build
pnpm --filter api test:payments
pnpm --filter api test:payments:integration
```

Integration đọc `TEST_DATABASE_URL` hoặc `DATABASE_URL` của môi trường test,
tạo/drop schema UUID riêng và mock HTTP payOS; không chuyển tiền hoặc đổi dữ
liệu ứng dụng. Không dùng kết quả này để đóng gate merchant/production.

- Không thấy Swagger payment: code chạy có thể là SHA cũ; kiểm build/deploy mới
  có PaymentsModule, refresh trang và kiểm OpenAPI của đúng môi trường.
- 503 khi tạo: kiểm enabled/credentials và startup config; không gửi secret vào log.
- CREATED/checkout:null: kiểm lease/nextAttemptAt/lastError, outbound TLS/network;
  worker tự recovery, không tạo liên tục bằng key khác để che lỗi.
- PENDING không cập nhật ví: kiểm callback URL/log 400/401/429/5xx, receipt và
  signed lookup; chuyển khoản sai số tiền không được tự nạp.
- REVIEW: đối chiếu reason, quote, timestamp, receipt/findings và provider record.
  Không thay amount hoặc chuyển status PAID thủ công.
- FE không thấy event: kiểm bearer SSE/reconnect/replay, proxy buffering và
  heartbeat; GET payment/wallet vẫn là nguồn trạng thái hiện tại.
