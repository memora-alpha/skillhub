# Data Model — Credit & Payment

Date: 2026-10-15. Proposed additions, chưa thay Prisma/SQL. Giữ BigInt hundredths; VND BigInt nguyên. Runtime additions phải qua generator/runtime-support và additive migration, không sửa riêng generated schema hoặc historical catalog.

## Entities và ownership

| Entity                       | Owner         | Existing / proposed                                                                                                                                                                                                                                                     |
| ---------------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CreditWallet                 | credit        | Existing user/balances/version; thêm `lastEntrySequence` BigInt cho watermark. Available/Held >=0, version tăng khi biến động                                                                                                                                           |
| CreditOperation              | credit        | Existing type/reference/key/status; thêm immutable command digest/policy snapshot/correlation khi cần. Permanent business identity độc lập HTTP TTL                                                                                                                     |
| CreditTransaction            | credit        | Existing magnitude/signed deltas/after/operation/entryNo/reverses link; thêm `entrySequence`, unique(userId,entrySequence). SUCCESS append-only                                                                                                                         |
| HeldCreditAllocation         | credit        | Existing path/version/holder/beneficiary/purpose/amount/remaining/status; amount>0 và 0<=remaining<=amount. G05/G08 cho partial release/relock                                                                                                                          |
| FeePolicyVersion             | credit policy | Existing APPROVED/effective/calc/rounding; 400 bps, floor fee; snapshot không đổi lịch sử                                                                                                                                                                               |
| Payment                      | payments      | Existing owner/gateway/ref/provider txn/VND/Credit/rate/status; thêm version, quote digest, nonsecret merchant identity, expires/verified/paid/updated timestamps, unique nullable `topUpOperationId` FK và private checkout projection. Order ref bắt buộc với đơn mới |
| PaymentCheckoutIntent        | payments      | One per Payment: immutable invoice/descriptor-input digest; PREPARING/READY/ISSUED/REVIEW, lease/retry; ISSUED chỉ là form đã trả cho client, không chứng minh gateway order tồn tại                                                                                    |
| PaymentGatewayReceipt        | payments      | Gateway/environment/merchant/eventKey/business digest/delivery digest/claimed transaction+ref, verified evidence tối thiểu, RECEIVED/PROCESSING/PROCESSED/REJECTED/REVIEW, lease/retry/timestamps/paymentId nullable; unique(gateway,environment,merchant,eventKey)     |
| PaymentReconciliationFinding | payments      | Dedupe finding key/category/refs/evidence digest, OPEN/RESOLVED/timestamps/audit ref; không tự thay wallet                                                                                                                                                              |

Quote snapshot: VND/currency/creditUnits/conversionRate/gateway/merchant/ref/config version. Checkout URL/token chỉ expose cho owner theo provider contract, không đưa vào audit/event/log. Payment thêm provider environment/merchant/order_id/order UUID; provider transaction UUID và external transaction_id được lưu tách biệt. Unique transaction phải scoped gateway+environment+merchant; migration không cho collision hoặc cùng giao dịch post hai lần. Không thay transaction uniqueness bằng event identity. Nhiều receipt cùng provider transaction vẫn chỉ một posting; cùng eventKey khác business digest không overwrite evidence cũ; delivery timestamp khác không phải business conflict.

## Monetary invariants

- `creditUnits = VND×100/rate`; positive, chia hết, trong BigInt DB và business limits. Rate1000 nghĩa bước biểu diễn tối thiểu 10 VND; G02 có thể quy định bước chặt hơn, không tự coi bội1000 là bắt buộc.
- HTTP Credit `100.00`, VND `100000`, đều string. Parse/format bằng integer; không Number/toFixed cho arithmetic.
- Mỗi mutation có signed Available/Held deltas và after; wallet cuối bằng entry cuối. Sequence mỗi ví cấp dưới lock; nhiều entry trong cùng operation có thứ tự xác định.
- `fee=floor(grossUnits×400/10000)`, `net=gross−fee`. TWO_WAY tính riêng mỗi holder; không làm tròn hai chân độc lập.
- Sum user deltas: Hold/Release=0; TOP_UP=external issuance; settlement=−platform fee; adjustment=explicit issuance/burn. ONE_WAY net nội bộ triệt tiêu. Fee row là sink evidence, không fake User nền tảng và không double count magnitude.
- Wallet = opening có chứng từ + summed deltas tại watermark. Held = tổng allocation remaining đã commit. Không thêm `Available+Held=purchased+bonus` trước G03.
- PAID liên kết đúng một TOP_UP operation có cùng Payment/user/amount/evidence; commit atomically. Pending/failed receipts không tạo TOP_UP.

Row SQL checks bảo vệ nonnegative balances/positive magnitude/allocation bounds/unique identities; cross-row tổng phải qua owner tx và reconciliation. Append-only guards bảo vệ successful ledger/immutable quote/posting identity. Không blanket sign rule làm sai HOLD hoặc zero fee.

## Payment transitions

| From            | To       | Điều kiện                                                                                         |
| --------------- | -------- | ------------------------------------------------------------------------------------------------- |
| CREATED         | PENDING  | Provider order xác định; CAS không ghi đè PAID callback đến sớm                                   |
| CREATED/PENDING | PAID     | Verified matched success + atomic TOP_UP                                                          |
| CREATED/PENDING | FAILED   | Definitive failure, chưa posted; timeout không phải failure                                       |
| CREATED/PENDING | EXPIRED  | Server/provider expiry policy G02, chưa posted; local TTL không tự vô hiệu signed form tại SePay  |
| FAILED/EXPIRED  | PAID     | Chỉ trusted lookup/reconciliation + approved late-success mapping; trước đó REVIEW, không tự cộng |
| PAID            | PAID     | Valid replay; stale failure/expiry không downgrade                                                |
| PAID            | REFUNDED | Không active MVP; G06 và compensating ledger, không chỉ đổi enum                                  |

Receipt/intent trạng thái kỹ thuật khác Payment business status. REVIEW ở receipt/finding, không tự thêm vào Payment enum. SePay checkout là signed form, không REST create. UNKNOWN provider state được lookup/reconcile; không tự tạo invoice khác hoặc coi form ISSUED là provider PENDING.

## Financial transitions

- `ensureWallet`: zero only/idempotent; không monetary entry. Historical nonzero thiếu lịch sử bị G10 chặn.
- TOP_UP: matched evidence→lock/create wallet→operation/entry→wallet→Payment PAID/link/receipt PROCESSED + audit/outbox cùng tx.
- HOLD: owner prerequisites→locked path version→sorted wallets→Available−amount/Held+amount + ACTIVE allocations; rollback toàn owner workflow khi fail.
- SETTLEMENT: path lock + all sessions/dispute gate→full active allocations→entries/consumed allocations/Path COMPLETED snapshot; replay dùng settled snapshot.
- RELEASE: approved allocation/version/amount/policy/ref→remaining−amount, Held−amount/Available+amount; reject stale/over-release/settled, không đánh dấu terminal khi remaining>0.
- ADJUSTMENT: live `credit:adjust`, expectedWalletVersion, signed Available delta/reason/ref→nonnegative wallet + ledger/audit. Không đụng Held.
- REVERSAL: append compensations liên kết originals sau policy; không sửa SUCCESS cũ sang REVERSED. REVERSED có thể là public projection từ compensation. Gateway refund/material reversal chưa active.

## Migration/preflight

1. Inventory balances/ledger/allocations/payment/fee snapshots/FKs; detect negative/duplicates/unlinked/unknown units. Không xóa/rescale tự động.
2. Controlled write window/locks khi backfill/checks; không cho financial writes chen vào sequence allocation.
3. Backfill per-user sequence từ lịch sử chứng minh được; timestamp/UUID chỉ là tie-break kỹ thuật khi after/delta còn khớp. Không reconstruct được thì manual G10, không bịa opening/after/history.
4. Link legacy PAID với operation bằng verified reference rõ; ambiguity chặn. Row PAID không tự chứng minh callback verified.
5. Add fields/checks/indexes/append-only guards sau preflight; preserve originals; rebuild schema generator và check không mất module khác.
6. Consistent snapshot reconciliation: wallet/sequence/deltas, Held/allocations, Payment/TOP_UP, fees/settlement snapshot; report findings, không auto-repair.

Allocation unique(pathId,userId) giữ tới G08. Không xóa allocation cũ để relock hoặc reset settled history; mở multiple versions cần lifecycle/migration riêng và stale-release tests.
