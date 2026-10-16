# Validation — Credit & Payment

Date: 2026-10-15. **Initial implementation verified; full feature Pending.** Spec baseline commit `e5dd088`; implementation working tree chưa commit/push/deploy.

## Planning và quyết định

Đã đọc repository/API guidance, local speckit-specify/plan/tasks/implement skills, constitution v1.2.0, SRS V1.6 và source tại baseline `2f73c3c`. Bộ spec có research/data model/contracts/policy/quickstart; pointer và AGENTS trỏ spec009. Commit spec chạy lint-staged và commitlint thành công.

User đổi provider sang **payOS** ngày 2026-10-15, thay SePay. Giữ floor phí4% và net phần còn lại; nạp1.000..2.000.000 VND, step1.000, TTL60 phút; nguồn Credit có thể tiêu, BONUS trước rồi FIFO các nguồn còn lại, hoàn đúng nguồn. Contract hiện hành ở contracts/gateway.md; không dùng merchant credentials hoặc gateway thật. Các kết quả SePay bên dưới là lịch sử, không được coi là payOS proof.

Checklist implementation còn mở đã được công khai trước khi User yêu cầu “Commit lại spec và bắt đầu implement”. Tiếp tục initial tranche theo authorization đó; không tự bật policy/provider hoặc đổi runtime Pending thành Pass.

## Source thực hiện

- `GET /api/v1/me/wallet`, history/detail own-only; virtual zero không tặng Credit hoặc tạo ví ngầm; owner repository có zero upsert cho future writes.
- Exact bigint hundredths parser/formatter, signed delta formatting, VND conversion, fee conservation; dùng lại cho LearningPath/Proposal và settlement HTTP.
- Per-wallet entry sequence cấp dưới wallet row lock, signed cursor bind owner/filter/watermark; append mới không chen vào snapshot history.
- Additive financial migration: preflight zero-origin ledger/history order/Held allocations, nonnegative/bounds, immutable ledger, zero-wallet backfill. Không rescale/auto-repair dữ liệu cũ.
- Pure payOS adapter thay SePay: server-only signed REST request preparation, signed checkout response quote/origin verification và webhook HMAC toàn bộ data trước strip PII. Chưa có REST transport hoặc operational Payment API.
- Disabled capability config và approved top-up quote policy. Provenance lots/spend/refund allocations chưa implement; source fields chưa expose như counters.

## Verification tranche ban đầu đã pass (lịch sử trước đổi provider)

| Evidence                                                    | Kết quả                                                                                                                                                        |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API `check-types`                                           | Pass; Prisma generate + TypeScript noEmit                                                                                                                      |
| API `build`                                                 | Pass; final full Nest build trước test imports                                                                                                                 |
| API `lint` + focused final changed TypeScript lint          | Pass, 0 warnings                                                                                                                                               |
| Prisma runtime validate                                     | Pass                                                                                                                                                           |
| Exact money/cursor/SePay policy+adapter + sonar regressions | 14/14 Node tests, 0 skipped                                                                                                                                    |
| Credit PostgreSQL suite                                     | 6/6 gồm parent: zero init concurrency, concurrent commit order, rollback balances/operation/entry/sequence, nonnegative/append-only, opening-balance preflight |
| Credit HTTP/OpenAPI suite                                   | 6/6 gồm parent: actual CreditModule DI/OpenAPI, zero read, append-vs-cursor watermark, exact money/ownership/invalid query, revocation                         |
| Config/log privacy/local S3/ClamAV/SMTP regressions         | 8/8                                                                                                                                                            |
| Connections policy/bootstrap regression                     | 4/4; IdentityModule stub bổ sung IdentityConfig export tương ứng module thật                                                                                   |
| Total distinct final Node test cases                        | **38 passed**, 0 skipped (bao gồm parent cases của Node runner)                                                                                                |

PostgreSQL dùng harness tạo fresh `skills_test_<UUID>` schema rồi drop schema và legacy sibling trong finally; không apply migration hoặc seed vào application schema. HTTP settlement test dùng fake domain result **chỉ để kiểm transport BigInt serialization**, không chứng minh settlement owner business flow. Pure SePay tests không là sandbox/merchant proof.

Lần đầu sandbox chặn loopback bằng EACCES; rerun real PG/HTTP/local mock servers ngoài sandbox đã pass. Lỗi fixture revoke thiếu revokedReason đã sửa theo sessions_valid constraint. Connections bootstrap mock thiếu IdentityConfig export đã sửa; không bỏ guard hoặc nới production DI. Build đầu bị dừng khi không thấy tiến triển; final build completed exit0 trước final suites.

## Application structure refactor (2026-10-15)

Theo yêu cầu User, Credit tách application thành contracts/ports/services/use-cases theo auth/users: ba read use cases thay WalletService; WalletRepository port bind với PrismaWalletRepository trong infrastructure/persistence; ledger/reader chuyển vào services, fee seed vào application. Cập nhật controller, DI, LearningPath/LearningSession callers, configuration seed và test imports. Ledger class body đối chiếu baseline giống nhau sau chuẩn hóa whitespace. Payment checkout/event contracts và gateway port nằm trong application, SePay adapter triển khai port; không thêm operational payment flow.

Sau refactor: API check-types/build/lint pass; focused Prettier và git diff --check pass. Chạy lại **30/30 Node cases**, 0 skipped: 18 money/cursor/SePay/settlement/Connections regression và 12 HTTP/PostgreSQL (gồm parent cases). HTTP dùng CreditModule thật để kiểm use cases + repository DI; PostgreSQL vẫn dùng schema test cô lập. Các kết quả 38 cases phía trên thuộc tranche implementation ban đầu; lần refactor không chạy lại 8 config/provider cases vì phần đó không thay đổi.

## Provider amendment: payOS (2026-10-15)

Thay SePay adapter/config/tests bằng payOS, giữ application contracts/ports và chính sách Credit. prepareCheckout tạo server-only REST payload, không client-submit form; verifyCheckoutResponse kiểm toàn bộ data signature rồi match quote/currency/origin; verifyWebhook kiểm HMAC trước strip PII và normalize channel/orderCode/paymentLinkId/reference. Không thêm REST transport, receipts/posting route hoặc sửa application DB/env thật. Không gọi gateway hay đăng ký webhook.

Golden webhook dùng vector/checksum công khai từ docs payOS, không merchant secret. Test mới đã phát hiện URL refine ném Invalid URL cho chuỗi rỗng; thêm URL.canParse guard ở config và checkout response, giữ lỗi theo field/contract. Lịch sử SePay bên trên không phải payOS proof.

Final sau sửa: full API lint/check-types/build pass; focused Prettier và git diff --check pass. **25/25 Node cases pass, 0 skipped**: 7 payOS protocol/config/policy cases + 18 money/cursor/settlement/Connections/config/log-privacy regressions. Không chạy lại PostgreSQL suite vì lần này không đổi financial persistence/writer; kết quả PG trước đó giữ lịch sử riêng. Không có live payOS/channel/create/lookup/posting proof; provider mặc định disabled, T014..T018 còn Pending.

## Merge compatibility with dev (2026-10-16)

Integrated `dev` at `92c923e` into Credit & Payment at `a03ffdf` locally, without
committing, pushing, deploying, or applying migrations to the application schema.

- Preserved WalletPort/PathSettlementPort/CreditAdjustmentPort bindings alongside
  wallet read use cases, repository, signed cursors, and HTTP endpoints.
- Updated adapter, PathHoldInput, and learning-platform test imports after the
  Credit application directory refactor. LearningPath keeps dev's validation,
  configuration, finalization idempotency, and atomic Hold/session behavior.
- Reused the exact Credit money helpers. Settlement responses are formatted by
  the service once; the controller forwards the result. The HTTP regression now
  exercises the real service/controller pair with a stored bigint settlement.
- Real PostgreSQL validation exposed a Conversation fixture missing requestId
  and a production nested ScheduleVersion create supplying pathId already
  inherited from its composite parent relation. Corrected both, and aligned the
  fake database's composite relation with Prisma.
- Extended the module bootstrap regression to verify wallet routes, shared ledger
  adapter bindings, the unavailable adjustment adapter, and the required
  Idempotency-Key header on finalize.

Verification: API lint, typecheck, build, and focused Prettier checks passed.
73 regression cases passed (learning-platform phases 1-4, audit, path reads,
bigint responses, Credit money/cursor, payOS, Connections bootstrap/policies,
and Sonar regressions). After the scheduling correction, all 45 affected
learning-platform/audit cases passed again. PostgreSQL wallet persistence and
HTTP suites passed 12 cases; the real finalize rollback/retry case also passed:
**86 distinct cases passed, 0 skipped**. Database tests created and dropped UUID
test schemas; their transactions did not modify application data. Earlier failed
runs identified the fixture and nested-create problems described above.
The finalize harness also cleans its legacy migration sibling schema. Diff
whitespace validation against dev passes; the full merge diff against the PR
head retains dev's existing trailing blank line in the push-token migration.
That published migration was kept unchanged to preserve its checksum.

These checks establish local merge compatibility for the tested scope. The
production rollout, real provider delivery, payment posting, and adjustment
implementation gates below remain pending.

## QR-only payOS amendment (2026-10-16)

User yêu cầu chỉ dùng QR payOS. `CheckoutDescriptor` hiện chỉ trả
`{paymentLinkId,qrCode,orderCode,providerStatus}` sau khi kiểm chữ ký toàn bộ
provider data và đối chiếu quote/currency/status/QR. Không trả method, hosted
checkout URL hoặc return/cancel URLs cho client. Hosted metadata, nếu có, vẫn
được authenticate trước khi bị loại khỏi projection; không còn phụ thuộc sự có
mặt hoặc giá trị của checkoutUrl để dùng QR. qrCode là chuỗi để render QR tại
client, không phải URL ảnh.

API payOS vẫn yêu cầu returnUrl/cancelUrl trong signed create request. Giữ hai
HTTPS env fields server-side và bổ sung chú thích .env.example; QR flow không
điều hướng qua chúng và không cần triển khai trang return/cancel. Spec, plan,
policy, research, tasks, data model, HTTP/gateway contracts và quickstart đã
đồng bộ. Không sửa frontend, env thật, SQL/migration, merchant config hoặc bật
payment. Tạo đơn/transport, status routes, durable webhook/posting và frontend
QR/status rendering vẫn chưa triển khai; các task tương ứng giữ Pending.

Verification: API lint, Prisma generate + TypeScript check, Nest build, focused
Prettier và git diff --check pass. **22/22 Node cases pass, 0 skipped**: 8 payOS
protocol/config/policy cases (gồm QR-only projection, missing/invalid QR,
tampering QR/hosted metadata và loại URL sau signature verification), 4 Credit
money/cursor, 4 environment/log privacy và 6 Sonar/settlement regressions.
Không chạy lại PostgreSQL vì không đổi financial persistence, schema hay ledger
writer. Không có provider/channel/live-payment proof hoặc deployment mới.

## Full feature/release matrix

| Phạm vi còn lại                                                                                | Trạng thái / giới hạn                                                          |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| US1 benchmark/load và exhaustive valid/ambiguous legacy backfill fixtures                      | Pending; current migration fresh schema + rejected unexplained balance đã kiểm |
| Provenance source lots + BONUS-first/FIFO + refund-origin allocation                           | Pending T014..; User policy đã chốt, source cũ chưa theo dõi lots              |
| Payment quote/create/query API, durable receipts/posting, TOP_UP+wallet+audit/outbox atomicity | Pending T014..T017                                                             |
| Idempotent payment transaction reuse, out-of-order/crash/recovery/lookup                       | Pending; adapter digest test không thay real posting proof                     |
| Hold/settlement owner races, source-aware writes, Path completion ownership refactor           | Pending T019..T020; existing mock regression vẫn pass                          |
| Approved release/refund/penalty/relock/dispute policy                                          | Pending G05/G06/G08/G09; không public arbitrary transfers/cash-out             |
| Admin adjustment/reversal/full reconciliation                                                  | Pending T022..T024; current preflight chỉ detect/no repair                     |
| Notification/SSE committed events, retry/recovery/load                                         | Pending T027                                                                   |
| payOS channel/production signing, create/lookup/retry/sample/partial/late proof                | Pending; không đăng ký/cấu hình merchant hoặc thực hiện giao dịch thật         |
| Deployment/migration/grants/live SHA/readiness/backlog/actual callback                         | Pending; không deploy/push                                                     |

## Limits

Đã bắt đầu implementation, chưa hoàn tất toàn spec009. Code hiện có không nhận/cộng tiền từ webhook và không tự bật bonus, refund, material sales hoặc cash-out. Migration dừng khi lịch sử thiếu opening provenance; operator phải đối soát, không đoán nguồn tiền. Mọi task chưa làm trong tasks.md giữ unchecked.
