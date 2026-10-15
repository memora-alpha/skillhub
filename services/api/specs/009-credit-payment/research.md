# Phase 0 Research — Credit & Payment

Date: 2026-10-15. Baseline Git `2f73c3c` trên local `dev`, working tree sạch trước planning; branch mới `feat/credit-payment`. Không fetch, migrate hoặc kiểm tra production trong lần này. Spec Kit 0.9.0 ở `services/api`; research agent `credit_audit` thực hiện source audit read-only theo skill speckit-plan.

## 1. Nguồn và trạng thái thực tế

SRS hiện hành: `docs/SRS_SkillHub_V1.6_VietLai_DongBoNghiepVu.docx`, đọc XML paragraphs/tables theo thứ tự document. Đối chiếu FR-CR-01..09, 10.3, CR-001..010, PAY-001..005, 18.19/18.20/18.40/18.41. Không sửa/render tài liệu Word trong lần plan này; không đánh giá layout. `docs/SOURCE_OF_TRUTH.md` xác nhận 1.6 ưu tiên hơn model v3.

| Evidence tại baseline (relative to services/api)                               | Kết luận                                                                                                                  |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `src/modules/credit/credit-ledger.service.ts:20–125`                           | Hold đã có wallet locks, operation, ledger, allocation; tái sử dụng                                                       |
| `src/modules/credit/credit-ledger.service.ts:128–395`                          | Settlement policy/snapshot, sorted wallet locks, ledger, Path completion, outbox đã có; không viết lại từ đầu             |
| `src/modules/learning-paths/learning-paths.service.ts:21–28,611–755`           | Parser hundredths và final-lock workflow/fee snapshot có source                                                           |
| `src/modules/learning-sessions/learning-sessions.service.ts:158–233`           | Caller lấy path lock, kiểm tra Session/dispute và replay; không kết luận double-settlement chỉ từ service thiếu path lock |
| `src/modules/reports/reports.service.ts:131–200,263–287,357–420`               | Path lock và settlement block đã có; resolve hiện không thực thi refund/penalty; 48h source cần xác nhận policy           |
| `prisma/schema.prisma:777–862,1314–1354`                                       | Wallet/ledger/allocation/Payment/fee/operation đã có; chưa Payment→TOP_UP FK                                              |
| `src/modules/credit/credit.module.ts`                                          | Chỉ reader/service exports, không controller; không có module payments trong source                                       |
| Search `src/modules/auth`, `users`, `credit`                                   | Không thấy wallet create/upsert hoặc purchased/bonus writer; cần wallet lifecycle/backfill                                |
| `src/modules/credit/seed-fee-policies.ts:3–33`                                 | Approved baseline 96/4, DOWN precision 2; giữ behavior, không tự duyệt policy khác                                        |
| `test/sonar-remediation.test.mjs:9–155`                                        | Mock settlement/replay/policy tests có; chưa chứng minh financial concurrency trên DB thật                                |
| `src/shared/http/response.ts:42–61`; Session service/controller                | Envelope không chuyển BigInt; cần HTTP DTO test, không dựa vào mock-only result                                           |
| `prisma/migrations/20261007000000_runtime_v3/migration.sql`                    | Bảng tài chính/FK/index có; cần additive invariant/append-only migration, preflight; không rewrite migration cũ           |
| `src/shared/authorization/permission.catalog.ts:110–118`; audit action catalog | `credit:adjust`, `credit:reverse:settlement`, CREDIT_ADJUST/CREDIT_REVERSE có nền tảng; không chứng minh use case đã có   |

Tất cả mô tả trên là static source evidence; không tuyên bố migration đã deploy, test đã chạy hoặc tiền được cộng đúng trên production.

## 2. Exact monetary representation

**Decision**: Giữ BigInt hundredths (1 Credit = 100 units), VND integer. HTTP Credit là decimal string đúng 2 chữ số; VND integer string. Shared parser/formatter trong owner Credit, không dùng Number/toFixed cho arithmetic. Nhận VND, tính `creditUnits = paymentAmountVnd × 100 / rateSnapshot`; reject khi phần dư khác 0 hoặc vượt miền giá trị. Với rate 1000, số tiền phải chia hết 10 VND để biểu diễn chính xác; G02 có thể giới hạn bước tiền chặt hơn, không suy ra SRS bắt buộc bội 1000.

**Rationale**: Phù hợp constitution integer và source hiện có, bảo toàn 96/4 và số lớn; không cần migrate toàn bộ financial schema sang Decimal.

**Alternatives considered**: Float bị loại; Decimal DB là phương án SRS cho phép nhưng gây đổi representation/callers không cần thiết. Whole Credit integer không đáp ứng fee precision.

## 3. Ledger ownership và conservation

**Decision**: Credit là owner duy nhất viết Wallet/Operation/Transaction/Allocation. Reuse explicit TransactionContext; không nested transaction. Payment owned bởi payments; path/session/report gọi typed Credit contracts trong cùng PG transaction. Ledger thành công append-only. `amount` nonnegative magnitude, `availableDelta`/`heldDelta` signed là nguồn tính biến động; `entryNo` ổn định theo operation. Fee row thuộc ví payer nhưng phần ra khỏi tổng ví là platform fee sink, không cộng lại vào ví User.

Wallet equation: số dư tại watermark = opening có chứng từ + tổng ledger deltas đến watermark. Tổng user delta theo operation: Hold/Release = 0; TOP_UP = external credited amount; settlement = −platform fee; adjustment = explicit system issuance/burn. ONE_WAY chỉ chuyển nội bộ phần net, không tính TEACHING_PAYMENT magnitude lần nữa vào tổng. Platform fee tổng hợp từ fee rows, không tạo fake User/platform wallet hay tự thêm ledger thứ hai gây double count.

**Rationale**: Khớp source delta entries; dễ đối soát mà không thay mô hình accounting toàn sản phẩm. Bổ sung fee/account model nếu nghiệp vụ kế toán mới yêu cầu sẽ cần spec riêng.

**Alternatives considered**: Các module tự update wallet vi phạm ownership. Generic public transfer endpoint làm rộng scope. Purchased/bonus sum làm tổng ví không đúng khi có earnings/fees; để G03 trước các chức năng phân nguồn.

## 4. Wallet initialization/migration

**Decision**: `ensureWallet(tx,userId)` chỉ tạo ví 0, idempotent; kết hợp các owner writes cần ví và controlled backfill cho Users hiện có. Không cần sửa registration trong MVP; self read có thể trả virtual zero nếu không có ví và không có history. FK, constraints và row lock sau insert; không tự tạo khi existing financial history thiếu wallet/sai opening.

**Rationale**: Giải quyết user cũ/mới, không tặng Credit ngầm hoặc coupling auth với tài chính. Không thêm audit/ledger cho zero creation vì không biến động Credit; migration/backfill có operator report.

**Alternatives considered**: Registration-only bỏ sót Users cũ; seed fake balance để chạy integration không dùng trong application schema.

## 5. Payment orchestration và authenticity

**Decision (user confirmed 2026-10-15)**: SePay, floor phí 4%/net=gross−fee. Theo tài liệu chính thức, dùng hosted one-time checkout/IPN; port là prepareCheckout chứ không REST createOrder. Reserve Payment/invoice/quote trước, server ký descriptor POST form, client submit gateway. REST dùng lookup ngoài PG transaction, không gọi checkout/init như JSON API. Merchant/sandbox/runtime và G02/G03 vẫn gate.

IPN SePay xác thực X-Secret-Key với auth type SECRET_KEY; checkout ký HMAC khác boundary. Match invoice/VND/amount/order+transaction outcomes; merchant bind bằng credential/env. Receipt dedupe theo canonical business evidence, không gồm timestamp biến đổi; domain transaction/posting dedupe độc lập HTTP TTL. HTTP200 sau durable receipt, worker recovery tới atomic TOP_UP; không lưu raw card/customer payload. [Provider contract và nguồn](contracts/gateway.md).

**Rationale**: Không mở transaction khi gọi gateway; bảo toàn kết quả lúc crash/duplicate/out-of-order. SePay IPN không có eventId riêng trong payload đã đọc, nên derive identity từ merchant/env/type/transaction UUID; không nhầm checkout HMAC với IPN shared secret. Contract lookup REST order_id và SDK invoice có khác biệt, cần kiểm sandbox.

**Alternatives considered**: Webhook biến động số dư là lựa chọn SePay khác, chưa dùng trong baseline hosted checkout. JSON REST-create không phù hợp checkout form protocol. Cộng theo redirect/unverified callback, Redis-only dedupe hoặc provider I/O trong PG tx bị loại. Minimal Node crypto+HTTP giữ exact strings; chưa thêm SDK do doc/repo khác endpoint sandbox và lookup argument cần sandbox kiểm chứng.

## 6. State/recovery

**Decision**: Tách business Payment status khỏi orchestration/receipt status. PAID không bị hạ bởi failure/expiry đến muộn. Success sau FAILED/EXPIRED vào đối soát, chưa tự post cho đến khi adapter/policy xác nhận thu thật hợp lệ. Đơn pending không tự coi thất bại vì timeout. REFUNDED giữ enum tương thích nhưng không có runtime transition mới trước G06.

**Rationale**: SRS có enum nhưng không quy định mọi transition provider; giữ bằng chứng, không tự giải quyết late payment bằng policy mới.

**Alternatives considered**: Last event wins làm mất PAID; bỏ webhook trễ có nguy cơ mất quyền lợi; tự refund mở scope ngoài sản phẩm.

## 7. Locking, audit, permissions và delivery

**Decision**: Giữ path lock ở owner trước allocation/wallet; sorted wallet IDs cho mọi operation. Payment flow chỉ Payment→Wallet, không lấy Path sau Wallet. HTTP idempotency authorization replay kiểm tra live access; worker nạp verified payment không đánh mất entitlement chỉ vì user bị khóa sau trả tiền. Admin mới có quyền đọc rộng; Staff gate G07. Credit audit cùng transaction cho action nhạy cảm, reuse existing catalog/extend allowlist phù hợp. Outbox→notification owner→SSE reference events; không đưa gateway payload, secret, số thẻ hoặc URL nhạy cảm vào event/log.

**Rationale**: Tránh cycles và mất audit; compatibility với SSE thay vì thêm socket. Quarantine invalid/mismatched events không chứa thông tin bí mật trong log.

**Alternatives considered**: Publish trước commit có thể thông báo tiền chưa tồn tại; background-only audit mất bằng chứng khi crash; role string thay permission hiện hành không đủ.

## Phase 0 result

Provider SePay và floor phí đã được User xác nhận. Research official checkout/flow/IPN/REST detail/sandbox/SDK ngày 2026-10-15 được ghi tại [contracts/gateway.md](contracts/gateway.md). Blueprint đã cụ thể hóa; merchant setup, signing/lookup/re-submit behavior và full runtime evidence còn Pending cùng các business gates khác. Không giả định provider idempotency/retry schedule chưa được tài liệu cam kết.
