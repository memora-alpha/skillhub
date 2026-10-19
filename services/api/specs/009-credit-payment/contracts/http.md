# HTTP Contracts — Credit & Payment API

Updated: 2026-10-17. Self wallet/payment routes và payOS webhook đã có source/Swagger. Admin routes bên dưới vẫn là thiết kế chưa mở. Base `/api/v1`; reuse identity guards, live authorization và Swagger DTOs. Xem [hướng dẫn runtime](../../../docs/payos-qr-payments.vi.md) và [validation](../validation.md).

## Shared rules

- Standard envelope: `{success:true,message,data,meta?}`; error `{success:false,message,statusCode,details?}`. Pagination nằm `meta.pagination`.
- Credit là signed/unsigned decimal string đúng 2 chữ số tùy field, VND là positive integer string; không JSON BigInt hoặc JS Number money. UTC ISO timestamps, UUID identifiers.
- Mutations từ client bắt buộc `Idempotency-Key` theo foundation constraints. Scope actor+operation, digest gồm body canonical. Replay kiểm quyền hiện tại rồi trả resource/result cũ; cùng key khác body 409. Domain posting identity không hết hạn theo HTTP TTL.
- Cursor opaque, bind owner/filters/direction; limit 1..100 (default20, technical bound). Ledger cursor chứa high-water sequence từ trang đầu và last sequence; chỉ đọc entries <=watermark để concurrent append không đổi snapshot. Payment pages dùng high-water persisted orderCode/last orderCode, giảm dần; không hứa snapshot trạng thái bất biến.
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

| Method / path                       | Contract                                                                                                        |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| POST `/payments`                    | Body `{paymentAmountVnd:"100000",gateway:"PAYOS"}`; không nhận creditAmount/userId/status/rate/return URL tùy ý |
| POST `/payments/{paymentId}/cancel` | Bearer + Idempotency-Key; no body; cancel own unpaid order, return 200 PaymentResponse                          |
| GET `/payments`                     | Own payments, optional status/cursor/limit                                                                      |
| GET `/payments/{paymentId}`         | Own safe status/quote/checkout projection; không gọi gateway chỉ vì client polling                              |

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

## Hủy yêu cầu nạp — 2026-10-19

`POST /payments/{paymentId}/cancel` cho owner của đơn CREATED/PENDING. Gửi
`Authorization: Bearer <token>` và `Idempotency-Key`, không cần body. Trả200
envelope chuẩn với PaymentResponse, status CANCELLED và checkout:null sau khi
xác minh signed payOS cancellation; nếu provider đã EXPIRED thì trả EXPIRED.
Đơn CANCELLED/EXPIRED gọi lại an toàn, không gọi provider hay phát event lần hai.
Key bind paymentId; tái sử dụng key cho đơn khác trả409. Replay luôn kiểm live auth
và trạng thái hiện tại; mapping HTTP không là bằng chứng đã hủy ở provider.

Checkout lease đang được worker giữ trả409 PAYMENT_CHECKOUT_BUSY; FE đọc lại
detail và retry cùng key. PAID trả409 PAYMENT_ALREADY_PAID, REVIEW trả409
PAYMENT_REVIEW_REQUIRED; terminal khác trả409 PAYMENT_CANNOT_CANCEL.
Nonowner/missing trả404. Disabled/channel khác trả503; thiếu checkout trả409
PAYMENT_RECONCILIATION_REQUIRED. Pause creation vẫn cho phép hủy.

Timeout/non-success/invalid evidence trả503 PAYMENT_CANCELLATION_UNCONFIRMED,
không xác nhận hủy. CREATED chưa có provider order cũng không được suy ra đã hủy
từ not-found; FE retry cùng key sau khi đọc detail. Recovery lookup cùng orderCode
phục hồi CANCELLED nếu provider đã hủy trước khi response bị mất hoặc API crash.
Nếu provider trả bằng chứng đã PAID thì reconcile theo receipt pipeline một lần,
rồi từ chối hủy. Partial/missing/tampered evidence vào REVIEW, không cấp Credit.
Biên nhận mới sau CANCELLED vào REVIEW với reason PAYMENT_CANCELLED; không tự
cộng Credit/hoàn tiền. PAID không bị hủy/downgrade khi callback chạy đồng thời.
Status/QR/version và payment.updated commit cùng PostgreSQL transaction;
không provider I/O trong transaction và không thay đổi wallet khi hủy thành công.

Migration `20261019010000_payment_cancellation` thêm PaymentStatus.CANCELLED;
FE cần nhận status mới qua read/list/cancel/SSE và bỏ QR khi terminal.

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

### Recovery hardening — 2026-10-18

`GET /payments/creation-policy` trả `{canCreate,reasonCode,existingPaymentId}`,
authenticated/no-store; existing ID chỉ của owner, global gate trả null. Đây là
snapshot; POST kiểm lại trong serializable transaction/live user lock. Một owner
chỉ có thể tạo mới khi không còn CREATED/PENDING/REVIEW và không có payOS legacy
thiếu creation identity, kể cả legacy PAID. 409 PAYMENT_UNRESOLVED hoặc
PAYMENT_RECONCILIATION_REQUIRED có `details.existingPaymentId`.

Payment persist SHA256(key)/canonical fingerprint với owner-unique index. Mất
riêng mapping HTTP thì POST phục hồi mapping, trả200 cùng Payment/orderCode;
khác body vẫn409. Mapping còn nhưng resource mất trả409 reconciliation, không
tạo lại. Restore mất cả hai chưa có automatic recovery; không coi404 là safe retry.

Payment projection thêm `recoveryRequired:boolean`, `recoveryReason:string|null`.
Reasons: PAYMENT_REVIEW_REQUIRED, PAYMENT_CHANNEL_UNAVAILABLE,
PAYMENT_CHECKOUT_MISSING. QR bị ẩn khi disabled, paused hoặc khác channel hiện tại.
POST mới trả503 PAYMENT_CREATION_PAUSED hoặc
PAYMENT_CHANNEL_RECONCILIATION_REQUIRED khi operational gate đóng; safe replay
resource cũ vẫn200 khi provider enabled. Pause không dừng webhook/worker.
Không có public API repair/approve replacement cho REVIEW. Xem
[operations contract](../../../docs/payment-recovery-operations.vi.md).

400 invalid format/precision/amount; 401 missing/expired/revoked identity; 403 missing permission; 404 nonowner resource; 409 idempotency conflict/stale wallet/insufficient funds/invalid transition; 429 configured limits; 503 unavailable provider/policy/storage. Reuse existing error names khi có; alias `INSUFFICIENT_AVAILABLE_CREDIT` hiện tại nếu chuẩn hóa `INSUFFICIENT_CREDIT` phải test affected callers và ghi compatibility.

SSE dùng `/api/v1/events` hiện có. Event projections chỉ refs `{walletUserId,operationId}` hoặc `{paymentId,status,version}`, không checkout URL, raw webhook hoặc số tiền. Event types/dedupe phải register trong application-events/outbox bridge khi implement; HTTP hydrate là source status. SSE delivery không là bằng chứng Payment thành công.
