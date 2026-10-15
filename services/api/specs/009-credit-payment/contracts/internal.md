# Internal Owner Contracts — proposed

Date: 2026-10-15. Signatures định hướng; existing Hold/settle signatures được migrate có compatibility tests, không giả định ports mới đã có source.

## Transaction và ownership

Caller transaction runner sở hữu tx; Credit methods nhận `TransactionContext`, không nested runner/commit hoặc external I/O. Payments chỉ sửa Payment/intents/receipts; Credit chỉ sửa financial records. Path/session/report owners quyết định eligibility/confirmation/dispute; không bypass qua viết Wallet trực tiếp.

Financial input dùng exact bigint hundredths và immutable instruction digest, business reference/policy version/correlation. Result là operation ID/typed bigint domain amounts; HTTP owner serialize qua money DTO. Không đưa transport DTO/string→Number vào ledger arithmetic.

| Port                                   | Input / guarantees                                                                                                                                                                                                                        |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ensureWallet(tx,userId)`              | User tồn tại; zero upsert idempotent, không issue Credit; acquire wallet lock sau insert                                                                                                                                                  |
| `readWallet / listLedger`              | Live self/admin access ở use case; consistent safe projections/opaque sequence cursor                                                                                                                                                     |
| `topUp(tx,verifiedPaymentInstruction)` | Payment ID/user/units/provider txn/evidence digest; natural key `payment-topup:{paymentId}` và bound digest; một permanent operation; caller ghi PAID/link/receipt cùng tx                                                                |
| `holdPath(tx,input)`                   | Existing path/version/exchange/participants/amounts; owner đã lock+confirm required plans/schedules. Validate matching immutable snapshot, not-null distinct participants/beneficiary và positive amounts; stale/mismatched replay reject |
| `settlePath(tx,input)`                 | Existing signature plus explicit owner eligibility contract. Path lock, all Session complete, disputes allowed, locked version/fee snapshot checked in caller; exactly-once snapshot replay                                               |
| `releaseAllocation(tx,instruction)`    | Approved decision ID/allocation/pathVersion/units/policy/ref; caller giữ path/report locks; remaining check under lock, no arbitrary penalty rate                                                                                         |
| `adjustAvailable(tx,instruction)`      | Live permission, expectedWalletVersion, signed delta/reason/ref; nonnegative resulting Available, Held unchanged; atomic audit                                                                                                            |
| `reconcile(readSnapshot,scope)`        | Bounded read-only consistent snapshot; findings + watermarks, no wallet writes                                                                                                                                                            |

`verifiedPaymentInstruction` chỉ được tạo sau verifier/matching; branded type giúp boundary nhưng không thay runtime guards hoặc DB checks. TopUp kiểm permanent payment operation/digest under lock; existing operation must match exact user/amount/evidence. Không cho truyền FREE-form TOP_UP từ public route.

## Lock/replay protocol

1. Discover refs không lock để xác định đầy đủ users/resources; transaction re-read sau locks. Follow existing owner lock prefix trước sorted Wallet IDs; allocations deterministic ID order. Event-feed counters last.
2. Payment posting receipt→Payment→Wallet, không lấy Path sau Wallet. Multi-wallet operations always sort code-unit IDs, không locale-based ordering/digest.
3. HTTP idempotency: live auth callback→lookup body digest→replay hoặc apply. Domain operation dedupe không phụ thuộc request key; payment/event business identity cũng unique ở DB.
4. Giữ operation+entries+wallet+allocation+business state+audit/outbox trong cùng tx. Audit/outbox failure rollback financial outcome. Không gọi gateway/email/Redis để quyết định commit.
5. Retry chỉ DB conflict theo TransactionRunner (existing bounded attempts); provider retries là state machine ngoài tx. Không replay random side effects trong retry closure.

Per-wallet sequence allocated dưới wallet lock cho từng ledger entry; after values nối tiếp entries, version tăng một lần mỗi mutation batch của ví. Source existing entryNo ordering được giữ hoặc migrate có behavioral checks. Domain operation result snapshot trả lại y hệt khi retry, không tính lại từ fee policy mới.

## Owner integrations và gates

- **learning-paths/scheduling**: giữ final lock atomically all required plans/schedules + wallet hold + Session creation; thiếu ví/số dư rollback mọi state. Không Hold từ Proposal accept.
- **learning-sessions**: giữ path FOR UPDATE, all sessions + reports gate trước settlement. Fix bigint response DTO; no per-session settlement. Guard conditions phải được tested ở owner, không suy từ Ledger unit test.
- **Path completion ownership**: source CreditLedgerService hiện tự update LearningPath/snapshot và emit learning-path.settled. Refactor thành Credit trả immutable monetary result, Path owner `applySettlementResult(tx,lockedVersion,result)` ghi completion/snapshot và business event cùng transaction. Reuse existing snapshot replay qua owner; không bỏ atomicity hoặc tạm cho hai nơi cùng ghi Path.
- **reports**: existing block/resolve chỉ xử lý dispute state. Future financial resolution instruction cần case version/policy/cause/amounts và shared tx cho decision+Credit+audit; không auto release sau reject/resolve nếu policy chưa có. G05/G09.
- **reviews/bonus**: không gọi reward mặc định. Nếu G04 đóng: unique claim(User,Path,rewardType,policyVersion) và confirmed eligibility trong tx; không tạo enum là đủ.
- **notifications/application-events**: append committed owner refs với dedupe operation/payment+version; Outbox consumers persist delivery receipt. Redis/SSE wakeup failure retry không rollback posted money hoặc tạo duplicate inbox.
- **identity/RBAC/config/audit**: reuse live permissions, existing credit:adjust/action policies; seed new read grants Admin-only; enabled provider env bắt buộc validate, secrets ở env. No automatic top-up limits/refund policy invented.
- **materials**: chưa implement; material purchase chỉ dùng owner contract riêng khi có approved fee/entitlement transaction, không mượn final path settlement.

## Recovery/observability

Workers claim durable rows bằng bounded lease/CAS, scan due work; queue loss không mất receipt/checkout intent. SePay prepareCheckout tạo signed form descriptor sau reserve tx, không remote REST-create; IPN SECRET_KEY auth và merchant/env binding theo gateway.md. Track attempts/nextAttempt/lastErrorCode an toàn; exhausted/unrecoverable items chuyển REVIEW/manual action, không xóa. Operator replay bắt đầu từ stored authenticated evidence, rechecks posting state/business digest, luôn idempotent.

Metrics: pending/unknown age, receipt failures/replay/conflict, post lag, lock retries, reconciliation differences; structured logs refs/status/correlation, không secret/raw body/checkout token. Reconciliation lấy consistent snapshot để không báo giả khi có commit giữa hai truy vấn. Payment mismatch được report riêng khỏi successful ledger.
