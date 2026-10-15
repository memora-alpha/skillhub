# Gateway Contract — SePay

Date: 2026-10-15. User chọn **SePay**, xác nhận floor phí 4% và người nhận lấy remainder. Provider decision đã đóng; credentials, policy G02/G03 và sandbox/runtime vẫn Pending.

## Integration design và nguồn chính thức

Thiết kế chọn Cổng thanh toán SePay one-time hosted checkout/IPN, baseline `BANK_TRANSFER`. User chọn nhà cung cấp; cách tích hợp/phương thức trên là lựa chọn kỹ thuật, không phải yêu cầu User mở thêm CARD/NAPAS/recurring. Webhook biến động số dư là sản phẩm khác, không trộn auth/payload của hai sản phẩm. [Overview](https://developer.sepay.vn/vi/cong-thanh-toan/gioi-thieu), [one-time flow](https://developer.sepay.vn/vi/cong-thanh-toan/luong-thanh-toan).

| Boundary                                  | Contract                                                                                                                         |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `prepareCheckout(quote,externalOrderRef)` | Backend lưu Payment/quote trước, tạo descriptor form đã ký; không REST-create order hoặc trả URL GET giả                         |
| Checkout                                  | Client POST descriptor tới SePay, gateway redirect người dùng; backend không claim order provider đã tạo chỉ vì form đã chuẩn bị |
| `verifyIpn(request,merchantBinding)`      | Xác thực IPN secret theo môi trường/merchant trước durable receipt hoặc thay business state                                      |
| `lookupOrder(providerOrderId)`            | REST server-to-server; match invoice, amount, currency, status/transactions                                                      |
| `acknowledge(result)`                     | HTTP200 `{"success":true}` sau durable acceptance; bad auth401, transient persistence failure5xx                                 |

Không có refund/void/cancel operation trong baseline. Không claim exactly-once create/re-submit hoặc provider retry schedule khi docs chưa cam kết.

## Checkout descriptor/signing

[Form contract](https://developer.sepay.vn/vi/cong-thanh-toan/API/don-hang/form-thanh-toan): endpoint submit form, không JSON REST. Signing HMAC-SHA256, binary digest→Base64; canonical text nối các field hiện diện dạng `name=value` bằng dấu phẩy. Thứ tự:

`order_amount, merchant, currency, operation, order_description, order_invoice_number, customer_id, payment_method, success_url, error_url, cancel_url`.

Không sort alphabet hoặc ký JSON. `operation=PURCHASE`, `currency=VND`, invoice unique từ Payment, amount integer VND string; approved redirect URLs do server cấu hình. Omit optional field phải khớp canonicalization. Không dùng custom_data để chọn wallet/amount. Descriptor `{method:"POST",action,fields:[{name,value}]}` giữ thứ tự và chứa signature, không secret; coi là dữ liệu nhạy cảm, no-store, không log/SSE. Backend scope chỉ chuẩn bị DTO, chưa sửa frontend.

## Môi trường và API lookup

[Sandbox](https://developer.sepay.vn/vi/cong-thanh-toan/sandbox) tách credentials và dữ liệu; định tuyến cố định theo env, không nhận host từ client.

| Environment | Checkout form action                            | REST base                        |
| ----------- | ----------------------------------------------- | -------------------------------- |
| sandbox     | `https://pay-sandbox.sepay.vn/v1/checkout/init` | `https://pgapi-sandbox.sepay.vn` |
| production  | `https://pay.sepay.vn/v1/checkout/init`         | `https://pgapi.sepay.vn`         |

[REST authentication](https://developer.sepay.vn/vi/cong-thanh-toan/API/tong-quan): Basic Auth merchant ID/secret over HTTPS, chỉ server-side.

[Order detail](https://developer.sepay.vn/vi/cong-thanh-toan/API/don-hang/chi-tiet-don-hang): `GET /v1/order/detail/{order_id}`. Lưu riêng provider order_id, order UUID và local invoice; không truyền nhầm Payment UUID/invoice vào path. CAPTURED là paid, AUTHENTICATION_NOT_NEEDED là pending, CANCELLED là cancelled. Mapping còn phải đối chiếu exact invoice/VND/amount/approved PAYMENT; không chỉ tin status.

[SDK Node](https://developer.sepay.vn/vi/cong-thanh-toan/sdk/nodejs) mô tả retrieve với invoice, khác REST docs path order_id; [repo chính thức](https://github.com/sepayvn/sepay-pg-node) cũng có URL sandbox cũ khác Developer Portal. Chọn REST + Node crypto exact strings, chưa thêm SDK. Nếu chưa biết order_id, cần bounded order search với exact invoice và xác nhận sandbox; không suy keyword search là unique match. 404/timeout không chứng minh chưa thu tiền hoặc cho phép tạo invoice mới.

## IPN authentication và posting

[IPN docs](https://developer.sepay.vn/vi/cong-thanh-toan/IPN): POST JSON tới HTTPS công khai, auth type SECRET_KEY gửi `X-Secret-Key`; IPN không được mô tả là chữ ký HMAC của body. Require cấu hình auth này, constant-time secret compare, redaction. Merchant/environment bind qua endpoint/config/credential; không require một field merchant vốn không có trong payload mẫu. Secret signing checkout và IPN có vai trò riêng, không giả định cùng giá trị.

Adapter chỉ chọn các fields cần thiết: notification_type, order identifiers/invoice/status/amount/currency và transaction identifiers/type/status/amount/currency. Bỏ customer/card/browser metadata khỏi stored evidence/log. Parse amount dạng `100000.00` sang VND integer exact, reject fractional VND; không float.

Posting cho ORDER_PAID với CAPTURED và APPROVED PAYMENT khớp quote. TRANSACTION_VOID → durable REVIEW, không auto đảo Credit. Unknown status/type hoặc mismatches → REVIEW, không cấp tiền.

Dedupe key nội bộ gồm environment+merchant+notification_type+transaction UUID; provider transaction business key riêng chống một giao dịch nạp hai Payment. Lưu transaction.id và transaction.transaction_id riêng, kiểm bất biến ở sandbox trước chọn field gatewayTransactionId cuối cùng. Canonical business digest chứa identities/amount/currency/outcomes, bỏ timestamp/metadata delivery; resend đổi timestamp không tự thành conflict. Có thể lưu digest body từng delivery riêng, không lưu raw PII payload.

HTTP200 ACK sau receipt bền; worker post atomically Payment PAID + TOP_UP + wallet + processed receipt/audit/outbox. Bad auth401, durable storage unavailable5xx; REVIEW accepted200 để tránh poison retry. Worker/reconciliation chịu trách nhiệm phục hồi; provider retry timing/retention chưa được docs trên xác định.

## Proposed configuration và activation tests

Tên env là thiết kế repo, không phải tên chuẩn của SePay: `PAYMENTS_ENABLED`, `SEPAY_ENV`, `SEPAY_MERCHANT_ID`, `SEPAY_MERCHANT_SECRET_KEY`, `SEPAY_IPN_SECRET_KEY`, approved success/error/cancel URLs. Enabled requires values/env consistency; secrets chỉ env; giới hạn tiền/TTL vẫn G02, không invent.

- Golden checkout signature: optional fields, field order, Unicode/escaping và exact integer VND; submit sandbox thành công, không lẫn GET/JSON init.
- IPN SECRET_KEY đúng/sai/thiếu, transaction/order mismatch, duplicate cùng business digest nhưng timestamp khác, callback trước người dùng return.
- CAPTURED→one TOP_UP; receipt/DB/crash-before-ACK recovery; TRANSACTION_VOID và late/unknown status giữ REVIEW.
- Lookup exact invoice/order_id mapping, transaction UUID vs transaction_id, re-submit cùng invoice và retry behavior; chưa chứng minh thì manual REVIEW, không invoice mới tự động.
- Không chạy giao dịch thật/merchant setup/sandbox trong lần sửa plan; tests/runtime còn Pending.
