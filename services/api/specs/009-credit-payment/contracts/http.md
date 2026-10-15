# HTTP Contracts — proposed Credit & Payment API

Date: 2026-10-15. Đây là thiết kế, routes chưa tồn tại. Base `/api/v1`; reuse identity guards, live authorization và Swagger DTOs.

## Shared rules

- Standard envelope: `{success:true,message,data,meta?}`; error `{success:false,message,statusCode,details?}`. Pagination nằm `meta.pagination`.
- Credit là signed/unsigned decimal string đúng 2 chữ số tùy field, VND là positive integer string; không JSON BigInt hoặc JS Number money. UTC ISO timestamps, UUID identifiers.
- Mutations từ client bắt buộc `Idempotency-Key` theo foundation constraints. Scope actor+operation, digest gồm body canonical. Replay kiểm quyền hiện tại rồi trả resource/result cũ; cùng key khác body 409. Domain posting identity không hết hạn theo HTTP TTL.
- Cursor opaque, bind owner/filters/direction; limit 1..100 (default20, technical bound). Ledger cursor chứa high-water sequence từ trang đầu và last sequence; chỉ đọc entries <=watermark để concurrent append không đổi snapshot. Payment pages keyset createdAt/id, không hứa snapshot trạng thái bất biến.
- Không expose raw receipts/secret/merchant credential/card info hoặc toàn bộ Prisma row. Nonowner resource trả404; quyền admin thiếu trả403. Các DTO cụ thể cần OpenAPI và HTTP tests khi implement.

## Self wallet/history

| Method / path                                 | Contract                                                                                              |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| GET `/me/wallet`                              | Available/Held, walletVersion; virtual zero cho User chưa có ví/history; không implicitly grant bonus |
| GET `/me/wallet/transactions`                 | Cursor, limit, optional type/referenceType; stable ledger sequence snapshot; own-only                 |
| GET `/me/wallet/transactions/{transactionId}` | Own ledger row + safe operation reference/compensation relationship                                   |

Wallet data example:

```json
{ "availableCredit": "100.00", "heldCredit": "20.00", "walletVersion": 3 }
```

Transaction projection: `id`, `operationId`, `type`, `amount`, `availableDelta`, `heldDelta`, `availableAfter`, `heldAfter`, `referenceType`, `referenceId`, `status`, `createdAt`, nullable `reversesTransactionId`. Deltas có thể âm; amount nonnegative magnitude; không suy ra signed movement từ amount. Không trả purchased/bonus trước G03. Zero virtual wallet version0 có thể đổi khi ví vật lý được tạo; mutation luôn recheck version dưới lock.

## Self payments

| Method / path               | Contract                                                                                                        |
| --------------------------- | --------------------------------------------------------------------------------------------------------------- |
| POST `/payments`            | Body `{paymentAmountVnd:"100000",gateway:"SEPAY"}`; không nhận creditAmount/userId/status/rate/return URL tùy ý |
| GET `/payments`             | Own payments, optional status/cursor/limit                                                                      |
| GET `/payments/{paymentId}` | Own safe status/quote/checkout projection; không gọi gateway chỉ vì client polling                              |

Create reserve lần đầu trả201, replay200; resource `CREATED` với checkout nullable nếu external create còn xử lý. Status đơn là business status, không gán PENDING chỉ vì queue accepted. Projection:

```json
{
  "id": "<uuid>",
  "status": "CREATED",
  "paymentAmountVnd": "100000",
  "currency": "VND",
  "creditAmount": "100.00",
  "conversionRateVndPerCredit": 1000,
  "gateway": "SEPAY",
  "checkout": null,
  "expiresAt": null,
  "createdAt": "2026-10-15T00:00:00.000Z"
}
```

SePay checkout là descriptor `{method:"POST",action,fields:[{name,value}]}` do backend ký từ quote đã lưu, server-controlled redirect URLs, fields giữ đúng thứ tự theo [gateway contract](gateway.md). Ví dụ checkout:null là response trước preparation, không giả định có checkout URL GET từ REST-create. GET status có thể trả prepared descriptor cho owner với Cache-Control:no-store; không log signature. TTL theo G02; local expiry không tự vô hiệu form phía SePay. Query amount/state từ Payment authority; không cộng theo client success URL. Disabled/missing provider policy trả503 `PAYMENT_PROVIDER_UNAVAILABLE`/`PAYMENT_POLICY_UNAVAILABLE`, không tạo đơn giả.

## Provider callback

`POST /payments/webhooks/sepay` nhận IPN JSON của SePay Payment Gateway. Không dùng IdentityGuard; require X-Secret-Key từ auth type SECRET_KEY đã cấu hình, bind endpoint/credential với merchant/environment. Checkout HMAC và IPN authentication là hai boundary khác nhau; IPN không tự có HMAC body signature. Source: [SePay IPN](https://developer.sepay.vn/vi/cong-thanh-toan/IPN).

ACK HTTP200 `{success:true}` sau receipt bền hoặc posting commit; không thêm standard API envelope. Sai/thiếu secret401, persistence unavailable5xx. Valid mismatch/unknown order/TRANSACTION_VOID lưu REVIEW rồi ACK200; không auto-refund hoặc downgrade PAID. Reverify duplicate và return200 không post lại. SePay docs không chốt retry schedule/retention, không lấy ACK thành bảo đảm gateway retry. Canonical business digest bỏ delivery timestamp để valid resend không bị báo conflict giả.

Không có endpoint client `mark-paid`, `confirm-payment` hoặc callback bypass chỉ cho Admin. Verify/reconcile chạy server-side với permission/operator contract riêng.

## Admin baseline

| Method / path                                     | Permission / behavior                                                                                                                                                                                   |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET `/admin/credit/wallets/{userId}`              | New `credit:read:any`; safe wallet projection                                                                                                                                                           |
| GET `/admin/credit/transactions`                  | New `credit:read:any`; required owner/filter bounds, stable per-wallet cursor khi userId được chọn                                                                                                      |
| POST `/admin/credit/wallets/{userId}/adjustments` | Existing `credit:adjust`; body `{availableDelta:"-1.00",expectedWalletVersion:3,reasonCode:"<allowed>",reasonText:"<required by reason policy>",referenceType:"SYSTEM",referenceId:"<case-or-ticket>"}` |
| GET `/admin/payments`                             | New `payment:read:any`, safe paginated status/reconciliation projection                                                                                                                                 |

Adjustment trả operation/ref/new version và balance projection; zero delta, stale version hoặc insufficient Available bị từ chối. Same-key replay diễn ra trước expectedVersion check của lần apply mới, sau live access check, nên không fail vì chính lần đầu đã tăng version. Reason dùng catalog/rules hiện có; phải bổ sung action metadata validation cho fields mới. New permissions chỉ seed Admin; Staff không được mở ngầm. Broad admin multiwallet pagination có contract riêng trước khi mở, không giả định per-wallet sequence là global cursor.

Reconciliation thực thi qua bounded operator command/job, report read-only; không mở public reconcile/retry/refund API trong baseline. Hold/Release/settlement chỉ qua owner workflow đã có; không public arbitrary transfer/withdrawal/bonus/refund endpoints.

## Errors và committed delivery

400 invalid format/precision/amount; 401 missing/expired/revoked identity; 403 missing permission; 404 nonowner resource; 409 idempotency conflict/stale wallet/insufficient funds/invalid transition; 429 configured limits; 503 unavailable provider/policy/storage. Reuse existing error names khi có; alias `INSUFFICIENT_AVAILABLE_CREDIT` hiện tại nếu chuẩn hóa `INSUFFICIENT_CREDIT` phải test affected callers và ghi compatibility.

SSE dùng `/api/v1/events` hiện có. Event projections chỉ refs `{walletUserId,operationId}` hoặc `{paymentId,status,version}`, không checkout URL, raw webhook hoặc số tiền. Event types/dedupe phải register trong application-events/outbox bridge khi implement; HTTP hydrate là source status. SSE delivery không là bằng chứng Payment thành công.
