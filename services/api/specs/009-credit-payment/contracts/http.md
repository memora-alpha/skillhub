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
| POST `/payments`            | Body `{paymentAmountVnd:"100000",gateway:"PAYOS"}`; không nhận creditAmount/userId/status/rate/return URL tùy ý |
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
  "gateway": "PAYOS",
  "checkout": null,
  "expiresAt": null,
  "createdAt": "2026-10-15T00:00:00.000Z"
}
```

payOS checkout chỉ dùng QR: `{paymentLinkId,qrCode,orderCode,providerStatus}` sau server-side REST create và verify signed response theo [gateway contract](gateway.md). `qrCode` là dữ liệu QR để render trực tiếp trong SkillHub, không phải ảnh/URL; không điều hướng sang checkout payOS. `orderCode` là string trong public projection. Không trả hosted checkout URL, server-only create payload/signature/headers hoặc return/cancel URLs. Checkout:null nghĩa chưa hoàn tất preparation; status chưa PENDING chỉ vì đã queue. Owner GET dùng Cache-Control:no-store; không log QR. Expiry theo immutable quote 60 phút, không tự gia hạn khi retry. UI kiểm trạng thái từ backend bằng GET/SSE/polling; QR hay việc đóng màn hình không cấp Credit hoặc tự hủy đơn. Disabled/missing provider policy trả503 `PAYMENT_PROVIDER_UNAVAILABLE`/`PAYMENT_POLICY_UNAVAILABLE`.

## Provider callback

`POST /payments/webhooks/payos` nhận JSON `{code,desc,success,data,signature}`. Không dùng IdentityGuard; verify HMAC-SHA256 hex toàn bộ data bằng checksum key trước strip/matching. Channel bind qua credential cấu hình. Source: [payOS signature](https://payos.vn/docs/tich-hop-webhook/kiem-tra-du-lieu-voi-signature/).

ACK HTTP200 `{success:true}` sau receipt bền hoặc posting commit; không thêm standard API envelope. Malformed/missing signature400, sai chữ ký401, persistence unavailable5xx. Valid mismatch/unknown quote/sample/partial/late payment lưu REVIEW rồi ACK200; không auto-refund hoặc downgrade PAID. Reverify duplicate và return200 không post lại. ACK không thay receipt recovery hoặc lookup; không giả định retry schedule chưa được chứng minh. Dedupe PAYOS+channel+reference; business digest chỉ chứa normalized signed evidence, không delivery metadata.

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
