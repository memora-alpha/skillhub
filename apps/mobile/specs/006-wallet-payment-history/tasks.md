# Tasks: Wallet, payment status and transaction history

**Feature**: `apps/mobile/specs/006-wallet-payment-history`\
**Ngày**: 2026-10-16 | **Baseline BE**: `17e3ac1f38df1b645bd5f103a7111eae00f5e0b4`\
**Nhánh giữ nguyên**: `feat/mobile-wallet-payment-history`\
**Input**: [spec](spec.md), [plan](plan.md), [research](research.md), [data-model](data-model.md), [contracts checkpoint](contracts.md), [wallet HTTP](contracts/wallet-http.md), [integration gates](contracts/integration-gates.md), [recovery](contracts/payment-recovery.md), [UI flows](contracts/ui-flows.md), [validation matrix](validation-matrix.md), [quickstart](quickstart.md), [requirements checklist](checklists/requirements.md), [planning checklist](checklists/planning.md).

**Trạng thái (2026-10-17)**: T001..T041 và T044..T051 hoàn tất theo scope; P4/P5 chỉ preparation, chưa phải financial acceptance. [Validation](validation.md) ghi P5:22 test US3 độc lập,86 focused/382 regression tests và8 nhóm quan sát web tổng hợp. Normal status/Confirm và mọi Payment capability vẫn unavailable; Wallet/history/P4 behavior giữ nguyên. T042/T043/T052..T062 vẫn unchecked; QR-01/create/query/posting/recovery và API thật/payOS/Android/iOS acceptance chưa đóng. Không sửa backend/dependency/shared parser, không stage/commit/push; branch/index được giữ. Chưa triển khai hoặc tick T053+ hay kiểm thử phối hợp T055.

## Quy ước và giới hạn thực thi

- Mọi đường dẫn trong task tính từ root monorepo; Spec Kit scripts chạy tại `apps/mobile`. Đường dẫn mới là dự kiến, không phải tuyên bố file/source đã tồn tại.
- Format: `- [ ] Tnnn [P?] [US?] mô tả — file cụ thể`. Phụ thuộc, điều kiện bắt đầu, kiểm chứng và lớp bằng chứng là một phần bắt buộc của task.
- **READY**: source contract/foundation đủ để bắt đầu sau phụ thuộc. **PREP**: chỉ UI/local model/test preparation; production payment unavailable. **BLOCKED**: chờ actual contract/QR-01/channel, không tự bỏ qua gate. **GATED**: chờ môi trường/thiết bị/test data; source merge không đóng acceptance.
- **[P]** chỉ cho task khác file, có thể chạy đồng thời với task độc lập khác khi các phụ thuộc của chính nó đã xong. Các task cùng file, kể cả khác story, phải serialize; không dùng thứ tự ID để ngầm cho phép sửa song song. Không có chỉ thị spawn agent.
- ID tuần tự theo thứ tự thực thi được người dùng ưu tiên: foundation → US1 (plan P2) → US4 (plan P3) → US2 (plan P4 prep) → US3 (plan P5 prep) → evidence (plan P6). Giữ priority gốc US1/2/3=P1, US4=P2 trong spec; thứ tự thực hiện US4 trước payment là chỉ dẫn ưu tiên mới của người dùng. `Phase` dưới đây là nhóm tasks, khác `P1..P6` của plan.
- Viết các test yêu cầu trước phần implementation tương ứng và quan sát đỏ rồi xanh. Với test bị chặn bởi contract/renderer, ghi BLOCKED và tiền điều kiện thay vì dựng fake implementation cho xanh.
- US2/3 không chứa task triển khai `api/payment-api.ts`, `schemas/payment-contracts.ts`, `hooks/use-create-payment.ts`, `hooks/use-payment-status.ts`, transport/live payment activation, encoder dependency hoặc backend code. T042/T043/T052/T058 chỉ review/ghi bằng chứng khi gate đủ; để tích hợp operational payment cần cập nhật plan/tasks và phạm vi riêng sau actual source.
- Backend là nơi duy nhất xác minh/post Credit. QR/providerStatus/redirect/clock/close không tạo kết quả; no cash-out/withdrawal/admin/refund execution/settlement tại client. Không gửi payment mới khi lần trước còn UNKNOWN_OUTCOME.
- L=pure model; C=HTTP fixture theo confirmed contract; W=browser/isolated UI; A=real owner API; G=approved payOS channel + owning backend posting proof; NA=Android; NI=iOS; DOC=document review. Payment hiện chỉ L/W preparation, C/A/G chưa có hợp đồng thực tế. NA/NI riêng, không thay bằng web/export/source check.

## Bằng chứng contract và gate dùng chung

| Capability / gap            | Nền tảng đã có                                                                                                                                                 | Task được phép chuẩn bị / tích hợp                                       | Điều kiện dừng                                                                                                                            |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| GAP-01 wallet               | Owner GET đã implement/wire tại `services/api/src/modules/credit/presentation/http/wallet.controller.ts:33`, `credit.module.ts:24`; absent wallet virtual zero | T012..T020, A tại T057                                                   | DTO/source drift, invalid projection, deployed migration/config chưa xác nhận không được claim A                                          |
| GAP-02 list/detail          | Controller:48/59; `wallet.dto.ts:18`; `list-credit-transactions.use-case.ts:19`; `prisma-wallet.repository.ts:54`; `ledger-cursor.ts:31`                       | T021..T032; limit20 trong mobile max50, BE max100                        | No status/date/search; no cursor decode/TTL, timestamp sort, mixed chain hoặc shared parser widening                                      |
| GAP-03 payOS                | Pure descriptor `services/api/src/modules/payments/application/contracts/payment-gateway.ts:22`, pure signer/adapter `infrastructure/payos-gateway.ts:138`     | T033..T041 model/UI/test; T042 QR evidence; T043 contract review BLOCKED | Chưa có create/public owner QR projection/transport/orchestration; no proposed API treated live                                           |
| GAP-04 policy               | `services/api/src/modules/payments/domain/top-up-policy.ts:5`: version2026-10-15-v1,1000..2000000/step1000 VND,1000VND/CR,server quote60m                      | T034/T036 approved policy, estimate/re-review                            | Public persisted quote/readiness/expiry chưa có; không mở lại settled policy, không client expiry/reset TTL                               |
| GAP-05 outcome/posting      | Pure provider verification không phải owner payment query/receipt/atomic posting                                                                               | T044..T051 models; T052/T058 BLOCKED                                     | Thiếu implemented owner API/freshness/expiry/verified posting; providerStatus PAID không thay Payment PAID                                |
| GAP-06 idempotency/recovery | Generic keys chưa là payment reserve/replay/lost-ID/restart contract                                                                                           | T033..T035/T039/T051; T043/T052 BLOCKED                                  | Không new key/body/amount matching, no offline/401/reconnect create replay, no invented durable journal                                   |
| GAP-07 reversal             | Supplied nullable reversal/ref/deltas từ ledger mapper `services/api/src/modules/credit/application/services/ledger-entry.mapper.ts:4`                         | T022/T027/T029 supplied facts                                            | Refund/partial/cash semantics và execution không suy ra từ enum                                                                           |
| GAP-08 related reference    | operation referenceType/referenceId từ mapper ở trên                                                                                                           | T026/T029 plain safe fields                                              | Destination ownership/existence và Held allocations chưa chứng minh; không real IDs→sample routes                                         |
| QR-01                       | `apps/mobile/package.json`: SVG renderer15.15.4, chưa encoder                                                                                                  | T037 shell, T038 test specification, T042 blocked evidence               | Vetted local encoder/version/license/SDK/native/web + independent decode + scan usability chưa đủ; không cài/viết encoder trong scope này |

Các source con của credit/payments trong bảng được mở rộng từ directory ghi đầy đủ ở cùng hàng. [wallet-http](contracts/wallet-http.md) và [research E01..E19](research.md) chứa anchor/envelope chi tiết; không dùng tài liệu spec009 Payment HTTP proposal để thay source. Migration/deployment do owning backend cung cấp, không chạy migration hoặc seed backend từ mobile task.

## Phase 1 — Setup: baseline và fixture an toàn (plan P1)

**Mục tiêu**: Khóa evidence boundary và datasets trước source.\
**Bắt đầu**: Active feature đúng 006, giữ changes đang staged.\
**Hoàn thành**: T001..T003 có fixture provenance, không financial egress. Không initialization project/library mới.

- [x] T001 Chốt baseline và capability manifest cho lần triển khai — `apps/mobile/specs/006-wallet-payment-history/contracts/integration-gates.md`, `apps/mobile/specs/006-wallet-payment-history/contracts/wallet-http.md`.

  - **Phụ thuộc**: Không.
  - **Bắt đầu / gate**: **READY**. Đọc root/mobile AGENTS, README, constitution, docs mobile và toàn bộ artifact; HEAD/contract đối chiếu 17e3ac1.
  - **Kiểm chứng / hoàn thành**: Ghi SHA/DTO/deployment riêng; GAP-01/02 sẵn source, GAP-03/05/06 còn thiếu; không biến proposed Payment routes thành capability; giữ branch/index và không đụng backend.
  - **Bằng chứng**: DOC. Task chỉ hoàn tất khi kết quả này đã quan sát; không dùng số task để thay acceptance.

- [x] T002 [P] Chuẩn bị bộ dữ liệu model tổng hợp có provenance — `apps/mobile/tests/fixtures/wallet-model.ts`.

  - **Phụ thuộc**: T001.
  - **Bắt đầu / gate**: **READY**. Dùng các giá trị an toàn trong validation-matrix; chưa kết nối API/provider.
  - **Kiểm chứng / hoàn thành**: Có A/B/Z, zero/fraction/large/malformed, sáu Payment states và unknown, QR synthetic, các loại ledger/reversal; payment fixture ghi rõ local model, không đặt nó thành DTO/HTTP fixture; không chứa payload thật.
  - **Bằng chứng**: L. Task chỉ hoàn tất khi kết quả này đã quan sát; không dùng số task để thay acceptance.

- [x] T003 [P] Chuẩn bị fixture HTTP chỉ cho ba owner read đã xác nhận — `apps/mobile/tests/fixtures/wallet-api.ts`.

  - **Phụ thuộc**: T001.
  - **Bắt đầu / gate**: **READY**. Đọc wallet-http.md và mẫu loopback learning-requests hiện có.
  - **Kiểm chứng / hoàn thành**: Envelope/wallet/list/detail đúng source, 200+ UUID/limit20/timestamp ties/server-order riêng, chain watermark, append sau trang đầu, denied/invalid cursor/deferred lỗi; parser max50 vẫn nguyên; không dựng payment endpoint giả.
  - **Bằng chứng**: C. Task chỉ hoàn tất khi kết quả này đã quan sát; không dùng số task để thay acceptance.

## Phase 2 — Foundation dùng chung (plan P1)

**Mục tiêu**: Exact money, owner-generation isolation, read-state, preview và Back.\
**Bắt đầu**: Setup xong; từng test có deps như ghi dưới.\
**Hoàn thành**: T004..T011 xanh phần foundation, gồm Home balance unavailable và focused lint/type/structure checks; session switch/denial/fixture isolation không được miễn trừ. Payment vẫn unavailable.\
**Independent test**: A request resolve sau logout/loginB không đổi B; unavailable không zero; preview không gửi financial request.

- [x] T004 [P] Viết kiểm thử precision và rejection trước utility — `apps/mobile/tests/wallet-money.test.ts`.

  - **Phụ thuộc**: T002, T003.
  - **Bắt đầu / gate**: **READY**. Test dùng public behavior dự kiến, node:test/tsx sẵn có; xác nhận đỏ vì utility chưa có.
  - **Kiểm chứng / hoàn thành**: V03: 0.00/0.01/12.34/9007199254740993.01, signed deltas/negative zero, malformed/extra precision/Number, VND exponent/fraction; exact equality, không /100 hay áp top-up bounds lên ledger.
  - **Bằng chứng**: L,C. Task chỉ hoàn tất khi kết quả này đã quan sát; không dùng số task để thay acceptance.

- [x] T005 Tạo kiểu tiền và utility định dạng chính xác bằng chuỗi — `apps/mobile/src/features/wallet/types/wallet.ts`, `apps/mobile/src/features/wallet/utils/amount.ts`, `apps/mobile/src/features/wallet/types/payment.ts`.

  - **Phụ thuộc**: T004.
  - **Bắt đầu / gate**: **READY**. Đã có test đỏ; không thêm money package hoặc import backend.
  - **Ràng buộc từ data-model (nguyên văn)**: Canonical nonnegative decimal text with exactly two fractional digits, e.g. `0.00`, `12.34`; Canonical signed decimal text, e.g. `-12.34`, `0.00`, `12.34`; No decimal VND, sign, exponent or Number coercion.
  - **Kiểm chứng / hoàn thành**: T004 xanh; giữ magnitude, signed delta và VND riêng, explicit CR/VND, không Number/parseFloat/round/truncate; estimated conversion có provenance. Shared payment types chỉ local intent/observation interfaces dùng độc lập bởi US2 và US3, không phải wire schema.
  - **Bằng chứng**: L. Task chỉ hoàn tất khi kết quả này đã quan sát; không dùng số task để thay acceptance.

- [x] T006 [P] Viết kiểm thử owner-generation, hủy request và cleanup trước runtime — `apps/mobile/tests/wallet-runtime.test.ts`.

  - **Phụ thuộc**: T002, T003.
  - **Bắt đầu / gate**: **READY**. Dùng deferred promises/HTTP fake, kể cả abort không có tác dụng.
  - **Kiểm chứng / hoàn thành**: V01/V02/V06: A→logout→B, A success/error/401 trễ không sửa B; denied rồi lỗi không phục hồi cache; cancel forwards signal, chỉ xóa wallet keys, reconnect không gọi mutation; test đỏ trước T008/T009.
  - **Bằng chứng**: L,C. Task chỉ hoàn tất khi kết quả này đã quan sát; không dùng số task để thay acceptance.

- [x] T007 [P] Viết kiểm thử Back và ranh giới preview/live trước route wiring — `apps/mobile/tests/wallet-navigation.test.ts`.

  - **Phụ thuộc**: T002.
  - **Bắt đầu / gate**: **READY**. Kiểm tra sáu route và Home/Profile mapping hiện có; test không cần Payment API.
  - **Kiểm chứng / hoàn thành**: V24/V26: Home/Profile/direct fallbacks, giữ selection/draft hợp lệ; sample IDs/state URL không thành real outcome, host preview có label và không egress; route removal không quyết định tiền.
  - **Bằng chứng**: L,W. Task chỉ hoàn tất khi kết quả này đã quan sát; không dùng số task để thay acceptance.

- [x] T008 Tạo runtime WalletProvider theo owner/generation và key factory — `apps/mobile/src/features/wallet/context/WalletProvider.tsx`, `apps/mobile/src/features/wallet/utils/wallet-query-keys.ts`, `apps/mobile/src/providers/AppProviders.tsx`.

  - **Phụ thuộc**: T005, T006.
  - **Bắt đầu / gate**: **READY**. T006 đỏ; reuse auth client/query, lifetime phủ Home và sáu wallet route.
  - **Ràng buộc từ data-model (nguyên văn)**: Requires same owner/generation and ready/authenticated state before and after async work.; AbortSignals forwarded through adapter/client; cancellation does not replace validity guards.; Synchronously invalidate runtime, detach listeners, abort observers, clear drafts/intents, cancel and remove wallet-scope queries.
  - **Kiểm chứng / hoàn thành**: T006 session cases xanh: đổi scope che dữ liệu ngay, cancel/remove đúng prefix, detach listener, clear draft/intent/QR, capture/check current scope hai phía await; không dựa vào account cache cleanup.
  - **Bằng chứng**: L,C. Task chỉ hoàn tất khi kết quả này đã quan sát; không dùng số task để thay acceptance.

- [x] T009 Tạo access/read-state projection dùng chung và capability tách biệt — `apps/mobile/src/features/wallet/utils/read-access.ts`, `apps/mobile/src/features/wallet/components/financial-read-state.tsx`.

  - **Phụ thuộc**: T008.
  - **Bắt đầu / gate**: **READY**. Wallet/list/detail readiness độc lập; payment operations false đến khi có implemented contract, không probe endpoint đoán.
  - **Ràng buộc từ data-model (nguyên văn)**: A disabled query with no data is unavailable/prerequisite-waiting, not automatically loading or empty. A later transport error must not restore a projection already denied by a 403/404 observation.
  - **Kiểm chứng / hoàn thành**: V02/V04/V06: unavailable/loading/ready/refreshing/refresh-error/initial-error/denied/session-ended khác nhau; lỗi transient không hồi sinh denied; existing ConnectionGate chặn touch/a11y; retry GET hợp lệ, giữ cache cùng owner có stale notice.
  - **Bằng chứng**: L,W. Task chỉ hoàn tất khi kết quả này đã quan sát; không dùng số task để thay acceptance.

- [x] T010 Cô lập gallery và sample notice khỏi tài khoản thật — `apps/mobile/src/features/wallet/preview/screens.tsx`, `apps/mobile/src/features/wallet/preview/fixtures.ts`, `apps/mobile/src/features/wallet/fixtures.ts`, `apps/mobile/src/app/ui/wallet-preview.tsx`, `apps/mobile/src/features/ui-preview/screens.tsx`, `apps/mobile/src/features/product-shell/context.tsx`, `apps/mobile/src/features/auth/components/AuthNavigator.tsx`.

  - **Phụ thuộc**: T007, T008, T009.
  - **Bắt đầu / gate**: **READY**. Kiểm tra vị trí AuthNavigator thực tế trước sửa; preview injection không dùng live Wallet client; UiPreviewProvider có live RequestsProvider nên chưa đủ isolation.
  - **Kiểm chứng / hoàn thành**: V26: gallery/sample tx-topup và state=success vào labeled preview hoặc unavailable; traffic preview không gọi financial API/provider, không ghi real cache; normal flow không import fallback fixture; không tích hợp notification API.
  - **Bằng chứng**: L,W. Task chỉ hoàn tất khi kết quả này đã quan sát; không dùng số task để thay acceptance.

- [x] T011 Tạo Back helper, public exports và financial entry unavailable trên Wallet/Home — `apps/mobile/src/features/wallet/hooks/use-wallet-back.ts`, `apps/mobile/src/features/wallet/index.ts`, `apps/mobile/src/features/wallet/screens.tsx`, `apps/mobile/src/features/wallet/components/home-wallet-balance.tsx`, `apps/mobile/src/features/home/components/HomeContent.tsx`, `apps/mobile/src/features/home/screens/HomeScreen.tsx`.

  - **Phụ thuộc**: T007, T008, T009, T010.
  - **Bắt đầu / gate**: **READY**. Giữ sáu screen export và route hiện có; chưa tích hợp owner-read API. Home dùng public Wallet consumer tối thiểu, mặc định unavailable tới T016.
  - **Kiểm chứng / hoàn thành**: T007 navigation nền xanh; public provider + balance boundary tối thiểu, không export mutable intent; cả sáu screen thật dùng unavailable scaffold cho capability chưa tích hợp. Home không còn lấy summary.credit/isNew để hiển thị 0/180 CR; hiện số dư unavailable có tên truy cập và vẫn mở đúng Wallet, giữ các Home mock ngoài tài chính. Không còn sample financial content trên normal entry points sau foundation; preview giữ sample đã cô lập. Direct fallback không loop/external URL; route không chứa model/HTTP; source chia đúng boundary, theme/a11y hiện có. Chạy ba test foundation wallet-money/wallet-runtime/wallet-navigation cùng mobile lint/check-types/check-structure theo quickstart; không đòi wallet-payment-intent.test.ts ở P1.
  - **Bằng chứng**: L,W. Task chỉ hoàn tất khi kết quả này đã quan sát; không dùng số task để thay acceptance.

## Phase 3 — US1: số dư Wallet và Home (spec priority P1; plan P2; MVP)

**Mục tiêu**: Đọc Available/Held chính xác, zero đúng từ backend và Home cùng projection.\
**Independent test**: Chỉ wallet owner GET fixture/real read khi môi trường đủ; Home/Profile→Wallet→Back, virtual zero/error/stale/A→B, không cần history/payment.\
**Tests trước source**: T012; foundation tests đã có.\
**Stop**: Bất kỳ precision loss, other-owner disclosure, denied resurrection hoặc fake zero chặn increment. Source integration có thể hoàn tất trước A/native acceptance.

- [x] T012 [P] [US1] Viết contract tests owner wallet và virtual zero trước adapter — `apps/mobile/tests/wallet-contract.test.ts`.

  - **Phụ thuộc**: T011, T003.
  - **Bắt đầu / gate**: **READY**. Fixture đúng wallet-http 17e3ac1; test đỏ phần wallet trước T014/T015.
  - **Kiểm chứng / hoàn thành**: V01..V05: data chỉ availableCredit/heldCredit/walletVersion, no required owner/asOf; confirmed absent-row zero version0; error/malformed/disabled không zero; signal, 401 scope guard, 403 eviction; test parser không scale lần hai.
  - **Bằng chứng**: C,L. Task chỉ hoàn tất khi kết quả này đã quan sát; không dùng số task để thay acceptance.

- [x] T013 [US1] Tạo schema WalletSnapshot theo public projection — `apps/mobile/src/features/wallet/schemas/wallet-contracts.ts`.

  - **Phụ thuộc**: T012.
  - **Bắt đầu / gate**: **READY**. Chỉ ba fields source-backed, kiểu tiền T005; không áp top-up max lên số dư.
  - **Ràng buộc từ data-model (nguyên văn)**: Actual wallet fields are `availableCredit`, `heldCredit` (nonnegative two-decimal Credit strings), and `walletVersion` (number). No universal divide-by-100 conversion.
  - **Kiểm chứng / hoàn thành**: Reject malformed/precision và walletVersion không hợp lệ theo contract; accept zero/fraction/large; không bắt ownerId/timestamp/purchased/bonus, không tự bù missing fields thành zero.
  - **Bằng chứng**: C. Task chỉ hoàn tất khi kết quả này đã quan sát; không dùng số task để thay acceptance.

- [x] T014 [US1] Tạo GET wallet adapter bằng shared authenticated client — `apps/mobile/src/features/wallet/api/wallet-api.ts`.

  - **Phụ thuộc**: T013.
  - **Bắt đầu / gate**: **READY**. API base đã chứa /api/v1 theo cấu hình hiện có; GAP-01 source ready.
  - **Kiểm chứng / hoàn thành**: GET /me/wallet, không owner query/body/idempotency mutation key; validate projection, forward AbortSignal, safe AppError và guard scope; T012 adapter cases xanh; không tạo HTTP client mới.
  - **Bằng chứng**: C. Task chỉ hoàn tất khi kết quả này đã quan sát; không dùng số task để thay acceptance.

- [x] T015 [US1] Tạo shared wallet query/hook và xử lý refresh — `apps/mobile/src/features/wallet/hooks/use-wallet.ts`.

  - **Phụ thuộc**: T014, T009.
  - **Bắt đầu / gate**: **READY**. Reuse runtime owner/generation, QueryProvider và connection handling; capability configured.
  - **Kiểm chứng / hoàn thành**: Home/overview dùng một key/projection; dedupe reads, stale snapshot giữ khi transient, denied eviction, reconnect/focus GET đúng scope; initial-disabled khác loading; T006/T012 xanh phần wallet.
  - **Bằng chứng**: L,C. Task chỉ hoàn tất khi kết quả này đã quan sát; không dùng số task để thay acceptance.

- [x] T016 [US1] Tạo wallet balances và nối Home consumer foundation vào shared read với exact units — `apps/mobile/src/features/wallet/components/wallet-balances.tsx`, `apps/mobile/src/features/wallet/components/home-wallet-balance.tsx`.

  - **Phụ thuộc**: T015.
  - **Bắt đầu / gate**: **READY**. Reuse amount và financial-read-state; không suy ra breakdown/total/Held allocations.
  - **Kiểm chứng / hoàn thành**: Available/Held tách biệt, 0 chỉ từ snapshot, unit CR rõ; stale/error/loading/unavailable có copy VN/a11y không dựa màu, long amount ở 320px không mất digits; V03/V04/V29.
  - **Bằng chứng**: L,W. Task chỉ hoàn tất khi kết quả này đã quan sát; không dùng số task để thay acceptance.

- [x] T017 [US1] Thay Wallet overview sample bằng owner read và wire route — `apps/mobile/src/features/wallet/views/wallet-screen.tsx`, `apps/mobile/src/features/wallet/screens.tsx`, `apps/mobile/src/features/wallet/index.ts`, `apps/mobile/src/app/wallet/index.tsx`.

  - **Phụ thuộc**: T016, T011.
  - **Bắt đầu / gate**: **READY**. Top-up/history là destination riêng capability-aware; Profile mapping đã có.
  - **Kiểm chứng / hoàn thành**: Overview load/refresh/retry/zero/denied đúng; Back Home/Profile/direct theo helper; không link sample Held path, không withdrawal; route chỉ export/wire screen; V04/V24/V30.
  - **Bằng chứng**: C,W. Task chỉ hoàn tất khi kết quả này đã quan sát; không dùng số task để thay acceptance.

- [x] T018 [US1] Hoàn thiện Home với public Wallet consumer đã nối authoritative read — `apps/mobile/src/features/home/components/HomeContent.tsx`, `apps/mobile/src/features/home/screens/HomeScreen.tsx`, `apps/mobile/src/features/wallet/index.ts`.

  - **Phụ thuộc**: T017.
  - **Bắt đầu / gate**: **READY**. Home đã bỏ số dư sample tại T011; T016 nối consumer vào use-wallet. Chỉ lấy public export; giữ mock learning content ngoài phạm vi.
  - **Kiểm chứng / hoàn thành**: V05: Home và wallet match exact accepted snapshot, isNew không chọn 0/180 CR; refresh lỗi cùng stale indication; Profile shortcut vẫn /wallet và Back hoạt động; không sửa unrelated Home/profile behavior.
  - **Bằng chứng**: C,W. Task chỉ hoàn tất khi kết quả này đã quan sát; không dùng số task để thay acceptance.

- [x] T019 [US1] Hoàn tất kiểm thử wallet/Home races và regression theo session — `apps/mobile/tests/wallet-runtime.test.ts`, `apps/mobile/tests/wallet-contract.test.ts`, `apps/mobile/tests/wallet-navigation.test.ts`.

  - **Phụ thuộc**: T018.
  - **Bắt đầu / gate**: **READY**. Có implementation owner read; chỉ loopback/model, không gọi deployed API.
  - **Kiểm chứng / hoàn thành**: V01..V06/V24: delayed A, auth hydration, denied→error, cancellation ineffective, refresh overlap, offline/read-only recovery, Home coherence; request counts và zero fake-zero; phân biệt L/C với A chưa chạy.
  - **Bằng chứng**: L,C. Task chỉ hoàn tất khi kết quả này đã quan sát; không dùng số task để thay acceptance.

- [x] T020 [US1] Ghi checkpoint nghiệm thu độc lập wallet/Home — `apps/mobile/specs/006-wallet-payment-history/validation.md`.

  - **Phụ thuộc**: T019.
  - **Bắt đầu / gate**: **READY**. Tập test US1 qua; có log an toàn và contract SHA.
  - **Kiểm chứng / hoàn thành**: Ghi command/dataset/expected/observed/layer/evidence SC-001/SC-006; không tự đánh A/NA/NI pass. MVP owner wallet đọc thật cần checkpoint wallet của T053/T054/T056/T057; mỗi checkpoint này chỉ cần US1 và môi trường tương ứng, không yêu cầu T031/US4. Checkpoint history và platform còn pending được ghi riêng; không tick task đa capability khi chưa đủ toàn bộ scope.
  - **Bằng chứng**: DOC,L,C. Task chỉ hoàn tất khi kết quả này đã quan sát; không dùng số task để thay acceptance.

## Phase 4 — US4: lịch sử và chi tiết (spec priority P2; plan P3; ưu tiên sau US1)

**Mục tiêu**: Ledger read-only, pagination20, filters và snapshot consistency theo source.\
**Independent test**: >=200 rows, timestamp ties/server sequence riêng, append sau page1, filter đổi khi pending page, lỗi later-page/invalid cursor, owner detail404; không cần top-up hoặc Wallet GET implementation.\
**Tests trước source**: T021.\
**Stop**: Shared parser không bị nới, mọi page20; no status query/filter cục bộ, no mixed watermark chain, no amount→universal sign hoặc unauthorized reference.

- [x] T021 [P] [US4] Viết contract/history tests trước ledger implementation — `apps/mobile/tests/wallet-history.test.ts`.

  - **Phụ thuộc**: T011, T003.
  - **Bắt đầu / gate**: **READY**. Bộ 200+ entries limit20 có ties, overlap, append, filter race; không phụ thuộc US1 API/UI.
  - **Kiểm chứng / hoàn thành**: V19..V23 tests đỏ: raw query exact20/type/referenceType/cursor only, preserve server order/dedupe, snapshot refresh chain replacement, late filter pages, failed page retry, detail denial/reference restrictions.
  - **Bằng chứng**: L,C. Task chỉ hoàn tất khi kết quả này đã quan sát; không dùng số task để thay acceptance.

- [x] T022 [US4] Tạo ledger types và strict schema theo source — `apps/mobile/src/features/wallet/types/transaction.ts`, `apps/mobile/src/features/wallet/schemas/transaction-contracts.ts`.

  - **Phụ thuộc**: T021.
  - **Bắt đầu / gate**: **READY**. wallet-http enum/fields và T005 money; unknown codes giữ neutral presentation.
  - **Ràng buộc từ data-model (nguyên văn)**: The actual owner ledger projection supplies `id`, `operationId`, `type`, nonnegative magnitude `amount`, signed `availableDelta`/`heldDelta`, `availableAfter`/`heldAfter`, `status`, `referenceType`, `referenceId`, nullable `reversesTransactionId` and `createdAt`. All five Credit fields are two-decimal strings, already in Credit. An operation/reference/reversal identifier is context, not permission to navigate. Known ledger states: `PENDING`, `SUCCESS`, `FAILED`, `REVERSED`.
  - **Kiểm chứng / hoàn thành**: Validate UUID/id/operationId/reversal nullable/date, positive amount vs signed deltas, nonnegative post-balances, unknown enum xử lý neutral, malformed structural/money reject; không đòi description/after/response owner/entrySequence.
  - **Bằng chứng**: C,L. Task chỉ hoàn tất khi kết quả này đã quan sát; không dùng số task để thay acceptance.

- [x] T023 [US4] Tạo list/detail adapters và pagination compatibility — `apps/mobile/src/features/wallet/api/transaction-api.ts`.

  - **Phụ thuộc**: T022.
  - **Bắt đầu / gate**: **READY**. Reuse shared requestPage/parser max50 và authenticated client; source BE max100 không đổi parser.
  - **Kiểm chứng / hoàn thành**: GET /me/wallet/transactions với limit=20 mọi trang và optional exact cursor/type/referenceType, detail /:id UUID; validate row + meta consistency, forward signals/scope; không status/date/search/userId hoặc mutation; T021 contract phần adapter xanh.
  - **Bằng chứng**: C. Task chỉ hoàn tất khi kết quả này đã quan sát; không dùng số task để thay acceptance.

- [x] T024 [US4] Tạo selection và snapshot-chain reducer/key utilities — `apps/mobile/src/features/wallet/utils/history-query.ts`.

  - **Phụ thuộc**: T023.
  - **Bắt đầu / gate**: **READY**. Opaque tokens không decode/build/TTL; key factory T008 có owner/generation.
  - **Ràng buộc từ data-model (nguyên văn)**: Query identity includes owner, generation, optional `type`/`referenceType` filters and page-chain identity.; Explicitly request mobile `limit=20` for every page.; Never append old-watermark continuations to a refreshed first page.
  - **Kiểm chứng / hoàn thành**: Key gồm type/referenceType/chain; giữ returned order, ID dedupe không giả cursor progress; first-page refresh thành công replace toàn chain, old pages không gắn watermark mới; invalid cursor explicit restart, không auto loop; T021 reducer xanh.
  - **Bằng chứng**: L,C. Task chỉ hoàn tất khi kết quả này đã quan sát; không dùng số task để thay acceptance.

- [x] T025 [US4] Tạo paginated history hook với race/later-page recovery — `apps/mobile/src/features/wallet/hooks/use-transactions.ts`.

  - **Phụ thuộc**: T024, T009.
  - **Bắt đầu / gate**: **READY**. T021 có deferred filter/page promises; filter UI chỉ supported codes.
  - **Kiểm chứng / hoàn thành**: Single load-more, filter reset cursor-free, refresh không mix old continuation, late chain/session reject; page error giữ trước, invalid cursor offer fresh start và no loop; reconnect chỉ active read; V19/V20/V23 xanh.
  - **Bằng chứng**: L,C. Task chỉ hoàn tất khi kết quả này đã quan sát; không dùng số task để thay acceptance.

- [x] T026 [P] [US4] Tạo detail hook và privacy sau denial — `apps/mobile/src/features/wallet/hooks/use-transaction.ts`.

  - **Phụ thuộc**: T023, T009.
  - **Bắt đầu / gate**: **READY**. Validate route UUID trước request, owner guard; độc lập use-transactions.
  - **Kiểm chứng / hoàn thành**: 400 malformed no live request; 403/404 evict/hide detail, cached list không fallback hồi sinh; late old session/error không lộ; safe return history và reference context chỉ supplied; V01/V02/V23.
  - **Bằng chứng**: L,C. Task chỉ hoàn tất khi kết quả này đã quan sát; không dùng số task để thay acceptance.

- [x] T027 [P] [US4] Tạo transaction row và giải thích recorded movement — `apps/mobile/src/features/wallet/components/transaction-row.tsx`.

  - **Phụ thuộc**: T022, T005.
  - **Bắt đầu / gate**: **READY**. Không suy ra sign từ amount; source type/status vocabulary tách Payment.
  - **Kiểm chứng / hoàn thành**: V21/V22: magnitude + Available/Held deltas/post-balances giữ meaning; HOLD/RELEASE/PATH_RETURN/TWO_WAY/ONE_WAY/fees/material/bonus/penalty/refund/adjustment distinct; unknown neutral; không settlement/page-sum/double fee; a11y amount/time/status.
  - **Bằng chứng**: L,W. Task chỉ hoàn tất khi kết quả này đã quan sát; không dùng số task để thay acceptance.

- [x] T028 [US4] Tạo virtualized history và type/referenceType filters — `apps/mobile/src/features/wallet/views/transactions-screen.tsx`, `apps/mobile/src/app/wallet/history.tsx`.

  - **Phụ thuộc**: T025, T027.
  - **Bắt đầu / gate**: **READY**. Feature-owned FlatList trong existing shell, không nested scrolling FeaturePage; kiểm tra @expo/ui trước control mới.
  - **Kiểm chứng / hoàn thành**: Loading/empty/filtered-empty/unavailable/initial/page-error/stale/denied riêng; clear filter và refresh new chain, accessible load more/retry/Back; status chỉ display, no partial-page status filter; 200 entries usable/once-per-ID.
  - **Bằng chứng**: C,W. Task chỉ hoàn tất khi kết quả này đã quan sát; không dùng số task để thay acceptance.

- [x] T029 [US4] Tạo detail read-only và tham chiếu an toàn — `apps/mobile/src/features/wallet/views/transaction-detail-screen.tsx`, `apps/mobile/src/app/wallet/transactions/[id].tsx`.

  - **Phụ thuộc**: T026, T027.
  - **Bắt đầu / gate**: **READY**. GAP-07/08 chỉ fields; related destination chưa chứng minh giữ text không link.
  - **Kiểm chứng / hoàn thành**: Hiện actual identity/operation/type/status/time/5 amount fields/ref/reversesTransactionId nullable; không fabricate title, cash/refund amount, Held allocation hoặc sample route; preserve original, long ID wrap, correct history Back; V02/V21..V24/V30.
  - **Bằng chứng**: C,W. Task chỉ hoàn tất khi kết quả này đã quan sát; không dùng số task để thay acceptance.

- [x] T030 [US4] Wire public screens và kiểm tra Home/Profile→history navigation — `apps/mobile/src/features/wallet/screens.tsx`, `apps/mobile/src/features/wallet/index.ts`, `apps/mobile/tests/wallet-navigation.test.ts`.

  - **Phụ thuộc**: T028, T029, T011.
  - **Bắt đầu / gate**: **READY**. Nếu US1 đã sửa same files, hoàn tất T018/T019 trước khi edit; nếu US1 chưa chạy giữ tương thích exported boundary.
  - **Kiểm chứng / hoàn thành**: Normal routes bind live/unavailable only, preview sample không thành detail thật; selection/back còn hợp lệ qua detail; US4 chạy độc lập không cần US2/3 hoặc US1 GET implementation; V24/V26.
  - **Bằng chứng**: L,W. Task chỉ hoàn tất khi kết quả này đã quan sát; không dùng số task để thay acceptance.

- [x] T031 [US4] Hoàn tất race/contract tests 200-entry snapshot history — `apps/mobile/tests/wallet-history.test.ts`, `apps/mobile/tests/wallet-contract.test.ts`, `apps/mobile/tests/wallet-runtime.test.ts`.

  - **Phụ thuộc**: T030.
  - **Bắt đầu / gate**: **READY**. Nếu T019 chạy cùng lúc cần nối sau T019 vì chung tests; fixtures source-contract, không backend proof.
  - **Kiểm chứng / hoàn thành**: V01/V02/V03/V19..V23 đủ cases: mixed filter cursor400, append không hiện chain cũ, explicit refresh rebuild, failed refresh giữ stale chain, UUID404, denied cache, untouched max50 parser; no timestamp re-sort, no sample fallback.
  - **Bằng chứng**: L,C. Task chỉ hoàn tất khi kết quả này đã quan sát; không dùng số task để thay acceptance.

- [x] T032 [US4] Ghi checkpoint độc lập history/detail và SC-005 — `apps/mobile/specs/006-wallet-payment-history/validation.md`.

  - **Phụ thuộc**: T031.
  - **Bắt đầu / gate**: **READY**. Serialize sau mọi task đang ghi validation.md; test evidence L/C có dataset>=200.
  - **Kiểm chứng / hoàn thành**: Record limit20, enum filters AND, order/tie/append/watermark/cursor errors và exact detail; A/NA/NI còn pending tới tasks lớp tương ứng; không yêu cầu payment API để hoàn thành source integration.
  - **Bằng chứng**: DOC,L,C. Task chỉ hoàn tất khi kết quả này đã quan sát; không dùng số task để thay acceptance.

## Phase 5 — US2: chuẩn bị top-up và QR (spec priority P1; plan P4 PREP)

**Mục tiêu**: Approved-policy amount/review, immutable local intent và QR states chuẩn bị được độc lập; giữ real Confirm off.\
**Independent test**: Model-only explicit confirmation → one intent, uncertain dispatch → unknown khóa submit, known model ID không mất vì QR error/Back; preview labeled/no egress. Không cần live create endpoint.\
**Tests trước model/UI**: T033; transport seam T039 không là Payment wire-contract test.\
**Stop**: Live create/query/posting/recovery thiếu hoặc QR-01 chưa đủ. Task chuẩn bị hoàn tất không làm US2 production-complete.

- [x] T033 [P] [US2] Viết policy/intent tests trước top-up model — `apps/mobile/tests/wallet-payment-intent.test.ts`.

  - **Phụ thuộc**: T011, T002.
  - **Bắt đầu / gate**: **PREP**. Chỉ local model dispatch spy, không Payment HTTP fixture/endpoint.
  - **Kiểm chứng / hoàn thành**: V07..V13/V25 đỏ: bounds1000/2000000 step1000,999/1001/2001000 invalid, quote mismatch/re-review, double taps/remount, timeout/malformed/abort unknown, known-ID QR failure, reauth/restart remains gated.
  - **Bằng chứng**: L. Task chỉ hoàn tất khi kết quả này đã quan sát; không dùng số task để thay acceptance.

- [x] T034 [US2] Tạo top-up draft/immutable intent model với approved policy provenance — `apps/mobile/src/features/wallet/types/payment.ts`, `apps/mobile/src/features/wallet/utils/payment-intent.ts`.

  - **Phụ thuộc**: T033, T005.
  - **Bắt đầu / gate**: **PREP**. Pure local models không wire DTO; approved payOS policy2026-10-15-v1,1000VND/CR; không import BE helper.
  - **Ràng buộc từ data-model (nguyên văn)**: Runtime claims synchronously before the first await, independent of screen pending rendering.; Store only a confirmed, contract-validated identity associated with this intent/current owner.; No timeout, abort, remount or reconnect transition goes directly from UNKNOWN to a new CREATING intent.
  - **Kiểm chứng / hoàn thành**: Exact canonical integer VND1000..2000000 step1000, estimates distinct confirmed; sync claim before await/frozen snapshot, CREATING/CREATED_WITH_ID/REJECTED_WITH_NO_CREATION/UNKNOWN_OUTCOME theo model; timeout/remount không unlock unknown, known PENDING không bị áp universal ban.
  - **Bằng chứng**: L. Task chỉ hoàn tất khi kết quả này đã quan sát; không dùng số task để thay acceptance.

- [x] T035 [US2] Kết nối model intent vào session runtime bằng injected inert boundary — `apps/mobile/src/features/wallet/context/WalletProvider.tsx`, `apps/mobile/tests/wallet-runtime.test.ts`.

  - **Phụ thuộc**: T034, T008.
  - **Bắt đầu / gate**: **PREP**. Sau T019/T031 nếu đang sửa runtime tests; không instantiate payment API/hook/mutation live.
  - **Kiểm chứng / hoàn thành**: Remount giữ one unresolved intent, edits không đổi frozen snapshot; cleanup owner/end clears QR/private data, late result no B effect; offline/foreground không create; process kill không hứa memory recovery; V01/V06/V08/V13/V25 L xanh.
  - **Bằng chứng**: L. Task chỉ hoàn tất khi kết quả này đã quan sát; không dùng số task để thay acceptance.

- [x] T036 [US2] Tạo amount/review UI có Confirm thật unavailable — `apps/mobile/src/features/wallet/views/topup-screen.tsx`.

  - **Phụ thuộc**: T035, T009.
  - **Bắt đầu / gate**: **PREP**. RHF/Zod/controlled input + theme/Button/FormNotice sẵn; approved policy không đồng nghĩa create ready.
  - **Kiểm chứng / hoàn thành**: V07: preserve input + errors, payOS fixed, no inferred presets, VND/rate/estimated CR rõ, quote model change cần re-review; product copy VN không lộ GAP IDs; normal Confirm disabled/unavailable, fixture confirm chỉ trong injected preview model.
  - **Bằng chứng**: L,W. Task chỉ hoàn tất khi kết quả này đã quan sát; không dùng số task để thay acceptance.

- [x] T037 [P] [US2] Tạo QR presentation model/component shell không encoder/live payment — `apps/mobile/src/features/wallet/components/payment-qr.tsx`, `apps/mobile/src/features/wallet/views/payment-screen.tsx`.

  - **Phụ thuộc**: T034, T009.
  - **Bắt đầu / gate**: **PREP**. Chỉ preparing/unavailable/ready-model/render-error presentation; qrCode synthetic ở preview; QR-01 chưa đóng.
  - **Ràng buộc từ data-model (nguyên văn)**: Model QR preparation/unavailable, ready and local rendering error independently from payment outcome.; No QR encoder is currently declared/installed.
  - **Kiểm chứng / hoàn thành**: V12 model: giữ known model ID qua retry render/close, status access riêng; không gọi Image/SvgXml/HTML/Linking/WebView/remote QR, không normalize/log/persist payload; chưa render QR decodable khi encoder chưa vetted; raw descriptor không wire DTO.
  - **Bằng chứng**: L,W. Task chỉ hoàn tất khi kết quả này đã quan sát; không dùng số task để thay acceptance.

- [x] T038 [US2] Chuẩn bị test specification QR-01 và independent decoder fixtures — `apps/mobile/tests/wallet-qr.test.ts`, `apps/mobile/specs/006-wallet-payment-history/contracts/qr-validation.md`.

  - **Phụ thuộc**: T037.
  - **Bắt đầu / gate**: **PREP**. Chỉ test skeleton/data/assertion contract; không cài encoder, không tự viết encoder; synthetic payload an toàn.
  - **Kiểm chứng / hoàn thành**: Ghi encoder version/license/SDK/web/native cần duyệt; test plan exact decoded payload, unicode/raw whitespace, long/dense, quiet zone/contrast/integer modules320px, failure retains ID/no egress; renderer-dependent tests BLOCKED rõ, không fake green test/skipped=pass.
  - **Bằng chứng**: L,DOC. Task chỉ hoàn tất khi kết quả này đã quan sát; không dùng số task để thay acceptance.

- [x] T039 [P] [US2] Chuẩn bị transport replay/failure tests với injected dispatch — `apps/mobile/tests/wallet-payment-transport.test.ts`.

  - **Phụ thuộc**: T035.
  - **Bắt đầu / gate**: **PREP**. Reuse shared HTTP client test seam, không thay global client; không giả URL/payload Payment; model callable ghi capture options.
  - **Kiểm chứng / hoàn thành**: V09/V10/V11: spy yêu cầu retry:false + replayAfterRenewal:false và immutable snapshot; test shared renewal behavior qua existing harness không real endpoint; 2xx malformed/409/5xx429 uncertain giữ unknown, chỉ injected proven-no-create cho sửa review; Payment C vẫn BLOCKED.
  - **Bằng chứng**: L. Task chỉ hoàn tất khi kết quả này đã quan sát; không dùng số task để thay acceptance.

- [x] T040 [US2] Wire top-up/payment routes với unavailable production và explicit preview — `apps/mobile/src/features/wallet/screens.tsx`, `apps/mobile/src/features/wallet/index.ts`, `apps/mobile/src/features/wallet/preview/screens.tsx`, `apps/mobile/src/app/wallet/topup.tsx`, `apps/mobile/src/app/wallet/payment.tsx`, `apps/mobile/tests/wallet-navigation.test.ts`.

  - **Phụ thuộc**: T036, T037, T010.
  - **Bắt đầu / gate**: **PREP**. Giữ public exports T011; nếu US4 đã sửa T030, serialize edits cùng file, không tạo logic dependency. Không Payment adapter/schema creation.
  - **Kiểm chứng / hoàn thành**: V24/V26: thin routes, retained draft/session known model ID, guarded route removal, Back không cancel/fail, preview label/model no live egress; live create/QR continuation remains unavailable; no return/cancel route/bank scanner/save-share.
  - **Bằng chứng**: L,W. Task chỉ hoàn tất khi kết quả này đã quan sát; không dùng số task để thay acceptance.

- [x] T041 [US2] Hoàn tất kiểm thử preparation với request/intent counters — `apps/mobile/tests/wallet-payment-intent.test.ts`, `apps/mobile/tests/wallet-payment-transport.test.ts`, `apps/mobile/tests/wallet-navigation.test.ts`.

  - **Phụ thuộc**: T038, T039, T040.
  - **Bắt đầu / gate**: **PREP**. Chạy L/W preparation; encoder asserts chưa đạt QR-01 và C/A/G payment không được đánh pass.
  - **Kiểm chứng / hoàn thành**: V07..V13/V25/V26 model expectations xanh không fresh key on unknown, no amount matching, explicit confirmation before identity; counters logical intents khác HTTP/create và postings; SC-002 timing chỉ prep proxy, SC-004 backend half còn blocked.
  - **Bằng chứng**: L,W. Task chỉ hoàn tất khi kết quả này đã quan sát; không dùng số task để thay acceptance.

- [ ] T042 [US2] Ghi kết quả gate QR-01 khi có renderer/decoder được xác nhận — `apps/mobile/specs/006-wallet-payment-history/contracts/qr-validation.md`, `apps/mobile/specs/006-wallet-payment-history/validation.md`.

  - **Phụ thuộc**: T038, T041.
  - **Bắt đầu / gate**: **BLOCKED: QR-01**. BLOCKED QR-01: cần vetted encoder/version/license/native-web decision, renderer implementation riêng được review và independent decoder; task này chỉ ghi/đánh giá bằng chứng, không install/implement encoder.
  - **Kiểm chứng / hoàn thành**: Chỉ khi exact synthetic payload decode thành công và layout/no-egress đã quan sát mới đóng phần renderer; thiếu giữ blocked. Same-device scan workflow quyết định rõ; không tự thêm deep link/save/share; không gọi model placeholder là QR acceptance.
  - **Bằng chứng**: DOC,W,NA,NI. Task chỉ hoàn tất khi kết quả này đã quan sát; không dùng số task để thay acceptance.

- [ ] T043 [US2] Lập biên bản đánh giá contract/activation cho create, posting và recovery — `apps/mobile/specs/006-wallet-payment-history/contracts/integration-gates.md`, `apps/mobile/specs/006-wallet-payment-history/contracts/payment-recovery.md`, `apps/mobile/specs/006-wallet-payment-history/contracts.md`.

  - **Phụ thuộc**: T041.
  - **Bắt đầu / gate**: **BLOCKED: Payment create/query/posting/recovery**. BLOCKED GAP-03/04/05/06: thực tế chưa có operational create/quote/query/posting/recovery; chỉ mở review sau BE cung cấp source/DTO/evidence mới, không thực hiện BE/mobile payment adapter.
  - **Kiểm chứng / hoàn thành**: Record actual endpoints/errors/owner/quote+expiry/idempotency scope+fingerprint+replay/retention/lost-ID/restart/verified atomic posting evidence; proposed remains proposed, T042/G proof còn bắt buộc; cần replan/tasks revision riêng trước live activation; không tự enable Confirm.
  - **Bằng chứng**: DOC. Task chỉ hoàn tất khi kết quả này đã quan sát; không dùng số task để thay acceptance.

## Phase 6 — US3: chuẩn bị payment status/recovery (spec priority P1; plan P5 PREP)

**Mục tiêu**: Owner observation models, manual-check lifecycle và independent refresh UI; live status unavailable.\
**Independent test**: Inject sáu owner observation models/unknown và known model ID trực tiếp; forged providerStatus/URL không có financial effect, delayed ticket/denial/A→B, PAID với từng refresh lỗi riêng. Không cần US2 create/QR.\
**Tests trước model/UI**: T044.\
**Stop**: Không đoán Payment identity/DTO/endpoint/freshness hoặc polling/restart policy. US3 live chưa hoàn tất khi chỉ model xanh.

- [x] T044 [P] [US3] Viết outcome/lifecycle tests trước payment observation model — `apps/mobile/tests/wallet-payment-status.test.ts`.

  - **Phụ thuộc**: T011, T002.
  - **Bắt đầu / gate**: **PREP**. Local owner-authorized observation model injection; chưa khẳng định live DTO.
  - **Kiểm chứng / hoàn thành**: V14..V18/V22 đỏ: all6states+unknown, forged query/providerStatus/close/timer no paid, wrong ID/owner/session, out-of-order tickets/conflicting observations, PAID with independently failed related refresh.
  - **Bằng chứng**: L. Task chỉ hoàn tất khi kết quả này đã quan sát; không dùng số task để thay acceptance.

- [x] T045 [US3] Tạo observation/outcome mapper tách QR và ledger — `apps/mobile/src/features/wallet/utils/payment-outcome.ts`, `apps/mobile/src/features/wallet/types/payment.ts`.

  - **Phụ thuộc**: T044.
  - **Bắt đầu / gate**: **PREP**. Shared local types đã có tại T005; nếu US2 đang sửa types/payment.ts thì serialize edits, không cần US2 hoàn thành. Model-only, không wire DTO.
  - **Ràng buộc từ data-model (nguyên văn)**: Requested identity must match the returned projection and authenticated owner; reject mismatches. Use confirmed snapshot, not route amount. Do not silently reinterpret a changed quote. `CREATED`, `PENDING`, `PAID`, `FAILED`, `EXPIRED`, `REFUNDED`, or neutral unknown/unavailable if unfamiliar. Wallet/history refresh results are separate fields from payment status; `PAID` is not overwritten by refresh failure.
  - **Kiểm chứng / hoàn thành**: Six backend model states và unknown VN copy khác ledger; no client transition enum ranking, preserve previous confirmed stale on conflict, no client expiry/TTL reset; denied hides data; T044 projection xanh.
  - **Bằng chứng**: L. Task chỉ hoàn tất khi kết quả này đã quan sát; không dùng số task để thay acceptance.

- [x] T046 [P] [US3] Chuẩn bị observer controller model và lifecycle test seam — `apps/mobile/src/features/wallet/utils/payment-observer.ts`, `apps/mobile/tests/wallet-payment-observer.test.ts`.

  - **Phụ thuộc**: T045, T008.
  - **Bắt đầu / gate**: **PREP**. Injected reader mặc định unavailable, chỉ local model; không tạo use-payment-status HTTP hook/schema, không SSE/poll interval.
  - **Kiểm chứng / hoàn thành**: V01/V02/V13/V15/V17/V18: validate model association, coalesce manual check/per-ID ticket, signal+epoch guard, detach blur/background/session; focus chỉ known-ID read sau gate; no schedule/rate/expiry invented, wrong/preview ID không dispatch live.
  - **Bằng chứng**: L. Task chỉ hoàn tất khi kết quả này đã quan sát; không dùng số task để thay acceptance.

- [x] T047 [P] [US3] Chuẩn bị independent PAID-related refresh coordinator bằng injected reads — `apps/mobile/src/features/wallet/utils/payment-refresh.ts`, `apps/mobile/tests/wallet-payment-refresh.test.ts`.

  - **Phụ thuộc**: T045.
  - **Bắt đầu / gate**: **PREP**. Chỉ local model dependencies, wallet/history functions injected nên không cần US1/US4 implementation.
  - **Kiểm chứng / hoàn thành**: V16: PAID immutable qua wallet-fails/history-ok và inverse/stale; Promise outcomes riêng, retry reads only, no +Credit/fakeTOP_UP/create; future source APIs sau gate mới bind; T044 paired cases xanh.
  - **Bằng chứng**: L. Task chỉ hoàn tất khi kết quả này đã quan sát; không dùng số task để thay acceptance.

- [x] T048 [US3] Tạo status panel và screen UI model với unavailable live mode — `apps/mobile/src/features/wallet/components/payment-status-panel.tsx`, `apps/mobile/src/features/wallet/views/payment-status-screen.tsx`.

  - **Phụ thuộc**: T046, T047, T009.
  - **Bắt đầu / gate**: **PREP**. Actual owner Payment API thiếu; preview labeled injects models, live không reads guessed endpoints.
  - **Kiểm chứng / hoàn thành**: All states+unknown/denied/read-error/render-error-copy VN, Check again chỉ configured model reader/live gate, failed/expired/refunded safe Back/history; new topup luôn explicit intent; PAID giữ success + refresh notice; no cancel/refund/admin action.
  - **Bằng chứng**: L,W. Task chỉ hoàn tất khi kết quả này đã quan sát; không dùng số task để thay acceptance.

- [x] T049 [US3] Wire status thin route và reject legacy outcome/sample claims — `apps/mobile/src/features/wallet/screens.tsx`, `apps/mobile/src/features/wallet/index.ts`, `apps/mobile/src/features/wallet/preview/screens.tsx`, `apps/mobile/src/app/wallet/payment-status.tsx`, `apps/mobile/tests/wallet-navigation.test.ts`.

  - **Phụ thuộc**: T048.
  - **Bắt đầu / gate**: **PREP**. Public exports/preview host foundation đủ để chạy US3 độc lập; serialize T040 nếu cùng sửa shared files. Payment public identity validation thật vẫn blocked.
  - **Kiểm chứng / hoàn thành**: V14/V15/V24/V26: ignore state=success/amount/providerStatus, sample IDs không live request; no mock paid on normal route, safe fallback wallet/history; route không lookup latest by amount, no mobile return/cancel route.
  - **Bằng chứng**: L,W. Task chỉ hoàn tất khi kết quả này đã quan sát; không dùng số task để thay acceptance.

- [x] T050 [US3] Hoàn tất races/outcome tests và status independence — `apps/mobile/tests/wallet-payment-status.test.ts`, `apps/mobile/tests/wallet-payment-observer.test.ts`, `apps/mobile/tests/wallet-payment-refresh.test.ts`, `apps/mobile/tests/wallet-runtime.test.ts`.

  - **Phụ thuộc**: T049.
  - **Bắt đầu / gate**: **PREP**. Model injection, request counters và deferred ordering; dùng session scope T008 cùng fake owner observations/readers, không yêu cầu intent coordinator của US2. Serialize nếu T031/T035 đang ghi common runtime tests; đây chỉ là file lock.
  - **Kiểm chứng / hoàn thành**: V01/V02/V14..V18/V22: superseded response ignored, unfamiliar state neutral, conflicting observation not guessed, no old A toast/nav/session-expiry, PAID read failure separated, ledger REVERSED vs Payment REFUNDED read-only. Toàn bộ status/session suite chạy độc lập khi T033..T041 chưa được triển khai; kiểm thử phối hợp intent và status thuộc T055 sau cả T041/T050. Không C/A/G claim.
  - **Bằng chứng**: L,W. Task chỉ hoàn tất khi kết quả này đã quan sát; không dùng số task để thay acceptance.

- [x] T051 [US3] Chuẩn bị owner reauth/restart recovery test cases không storage giả — `apps/mobile/tests/wallet-payment-recovery.test.ts`, `apps/mobile/specs/006-wallet-payment-history/contracts/payment-recovery.md`.

  - **Phụ thuộc**: T050.
  - **Bắt đầu / gate**: **PREP**. GAP-06 chưa có agreed mechanism; chỉ model/acceptance test data, không durable journal/credential store/cache hoặc guessed lookup.
  - **Kiểm chứng / hoàn thành**: V13/V25: known-ID vs lost-ID, relogin A/B and kill; show blocked unresolved with no fresh submit/new key/bodymatching; future contract-dependent C/A/G/NA/NI cases record BLOCKED, memory remount không được gọi restart recovery.
  - **Bằng chứng**: L,DOC. Task chỉ hoàn tất khi kết quả này đã quan sát; không dùng số task để thay acceptance.

- [ ] T052 [US3] Đánh giá hợp đồng owner Payment query/observations khi BE cung cấp — `apps/mobile/specs/006-wallet-payment-history/contracts/integration-gates.md`, `apps/mobile/specs/006-wallet-payment-history/data-model.md`, `apps/mobile/specs/006-wallet-payment-history/validation-matrix.md`.

  - **Phụ thuộc**: T051.
  - **Bắt đầu / gate**: **BLOCKED: Payment query/posting/recovery**. BLOCKED GAP-05/06: owner query/DTO/freshness/authoritative expiry/recovery chưa implement; nếu có source mới chỉ docs review, không tạo live adapter.
  - **Kiểm chứng / hoàn thành**: Ghi actual identity validation/ownership/errors/status/version ordering/quote/QR readiness và no-creation/recovery semantics; manual check baseline; polling chỉ sau approved finite budget. Không đóng bởi pure providerStatus/signature model; cần replan/task approval riêng cho operational integration.
  - **Bằng chứng**: DOC. Task chỉ hoàn tất khi kết quả này đã quan sát; không dùng số task để thay acceptance.

## Phase 7 — Polish, checks và bằng chứng theo lớp (plan P6)

**Mục tiêu**: Kết quả có thể audit, source-read increment độc lập, payment/channel/native đúng gate.\
**Bắt đầu**: Chỉ capability có source và môi trường tương ứng; T053/T054/T056/T057 đọc thật không chờ Payment gate đóng.\
**Hoàn thành**: Evidence ghi expected/observed/pass/fail/blocked và safe path, không lấy fixture/source làm G/native. Không có câu lệnh triển khai hoặc test tài chính tự chạy bởi lệnh tasks.

- [ ] T053 Tạo tracked browser harness chỉ model và confirmed wallet-read fixture — `apps/mobile/scripts/wallet-browser-validation.mjs`.

  - **Phụ thuộc**: T011.
  - **Bắt đầu / gate**: **READY**. Có isolated preview/live-unavailable boundary và fixture source-backed; browser runtime/module cung cấp rõ, không auto-install. Harness có thể chuẩn bị trước story; chạy wallet scope sau T019, history scope sau T031, payment-model scope sau T041/T050, không ép scope này chờ scope khác.
  - **Kiểm chứng / hoàn thành**: CLI explicit --url/--mode/--scope/--contract/--browser-module/--output; mode model hoặc http-fixture và scope wallet, history hoặc payment-model được chọn rõ. App+fixture loopback only, egress fail, request/intent counters và artifacts an toàn; http-fixture chỉ wallet/history với --contract 17e3ac1, payment-model chỉ mode model. Harness core và wallet scope phải chạy được khi US4/US2/US3 chưa có; scenario chưa có UI hoặc sai cặp mode/scope phải fail/blocked rõ, không fake pass. Không implicit .env production config hoặc hardcoded browser module path.
  - **Bằng chứng**: W. Task chỉ hoàn tất khi kết quả này đã quan sát; không dùng số task để thay acceptance.

- [ ] T054 Chạy web read scenarios và ghi evidence 320/375/430 — `apps/mobile/specs/006-wallet-payment-history/validation.md`.

  - **Phụ thuộc**: T053.
  - **Bắt đầu / gate**: **READY**. Chạy checkpoint wallet sau T019 với A/B/Z/virtual absent-wallet/offline fixtures; checkpoint history sau T031 với 200+ entries. Browser available hoặc manual scripted cùng scope/case; không cần history dataset/UI cho checkpoint wallet.
  - **Kiểm chứng / hoàn thành**: Record riêng T054.wallet cho V01..V06 và phần wallet của V24/V26/V29: exact units, Home coherent, stale/denial/Back/large-text/keyboard/a11y. T054.history cho V01/V02/V03/V19..V24/V26/V29 theo scope history: type/referenceType AND, chain refresh, readonly/detail. Wallet W có thể PASS khi history NOT_RUN; không claim toàn V24/V29 đã pass chỉ từ subset. Chỉ tick toàn T054 khi cả hai read scopes đạt; checkpoint wallet vẫn được dùng cho nghiệm thu MVP. W không thay A/native; failures stop scope bị ảnh hưởng.
  - **Bằng chứng**: W. Task chỉ hoàn tất khi kết quả này đã quan sát; không dùng số task để thay acceptance.

- [ ] T055 Chạy web model-only payment preparation và ghi phần acceptance bị chặn — `apps/mobile/specs/006-wallet-payment-history/validation.md`.

  - **Phụ thuộc**: T053, T041, T050.
  - **Bắt đầu / gate**: **READY**. Synthetic payment models no real channel/HTTP; renderer absent vẫn blocked QR; không yêu cầu T042 hoặc read story hoàn tất để test unavailable/error UI. Intent-only/status-only checks vẫn chạy tại T041/T050 độc lập; task này dành cho phối hợp cả hai.
  - **Kiểm chứng / hoàn thành**: V07..V18/V22/V25/V26/V29 UI/model counters và all6states, gồm known model ID từ intent sang status, navigation/remount/logout và refresh injection; no QR/providerStatus/URL false success. SC-002 measured preparation proxy tách decoded QR/full acceptance BLOCKED; SC-003/004 backend portions pending, no skipped=pass.
  - **Bằng chứng**: L,W. Task chỉ hoàn tất khi kết quả này đã quan sát; không dùng số task để thay acceptance.

- [ ] T056 Chạy mobile source checks và regression theo quickstart — `apps/mobile/specs/006-wallet-payment-history/validation.md`, `apps/mobile/specs/006-wallet-payment-history/quickstart.md`.

  - **Phụ thuộc**: T011.
  - **Bắt đầu / gate**: **READY**. Foundation checks đã qua ở T011. Sau T019 chạy T056.wallet; sau T031 chạy T056.history; nếu chỉ một story tồn tại, chạy đầy đủ source checks của checkout hiện tại và focused tests có file thuộc story đó. Source preparation sau T041 hoặc T050 cũng chạy bộ kiểm tra P4 hoặc P5 tương ứng trong quickstart mà không chờ read stories. Không cần web browser hoặc story kia để chạy source checks.
  - **Kiểm chứng / hoàn thành**: Với mỗi source revision/capability đã triển khai, chạy focused L/C tests rồi mobile lint/check-types/check-structure và suite liên quan HTTP/session/pagination/connection/learning/profile; record SHA/source revision và scope. Khi T041/T050 hay thay đổi source khác tới sau, kiểm tra lại phần bị ảnh hưởng và required checks trên revision mới; kết quả cũ không nghiệm thu source mới. Parsermax50/consumer khác không thay; exportweb nếu cần chỉ build proof. T056.wallet có thể hoàn tất riêng cho MVP trước US4; không tick toàn read scope khi history chưa triển khai.
  - **Bằng chứng**: L,C,W. Task chỉ hoàn tất khi kết quả này đã quan sát; không dùng số task để thay acceptance.

- [ ] T057 Nghiệm thu real wallet/history reads và source/deployment compatibility — `apps/mobile/specs/006-wallet-payment-history/validation.md`.

  - **Phụ thuộc**: T011.
  - **Bắt đầu / gate**: **GATED: read environment**. Mỗi checkpoint cần approved API, matching BE/source contract SHA, migration readiness được BE xác nhận và T056 tương ứng còn hợp lệ trên source hiện tại. T057.wallet chỉ cần T019 + T054.wallet + T056.wallet và A/B/Z/absent-wallet; không cần T031 hoặc 200 history records. T057.history cần T031 + T054.history + T056.history cùng 200 safe records/owner-denial/reference datasets. Thiếu môi trường của scope nào chỉ chặn scope đó; không migrate/seed sửa BE.
  - **Kiểm chứng / hoàn thành**: Record V27.wallet: actual DTO/exact zero-version0/no grant hoặc init, ownership/session behavior và Home refresh. V27.history: wrong-owner UUID404, limit20/no unsupported query, type/referenceType/snapshot-chain/newappend proof; dùng approved backend-owned fixture activity/evidence cho append nếu cần, không tạo ledger từ mobile. T057.wallet PASS cho phép nghiệm thu Wallet thật khi history NOT_RUN; chỉ tick toàn T057 khi cả hai read scopes đạt. Payment status subset vẫn BLOCKED, không dùng wallet/history A để đóng Payment gate.
  - **Bằng chứng**: A. Task chỉ hoàn tất khi kết quả này đã quan sát; không dùng số task để thay acceptance.

- [ ] T058 Ghi phán định payOS channel và atomic-posting/recovery evidence — `apps/mobile/specs/006-wallet-payment-history/validation.md`, `apps/mobile/specs/006-wallet-payment-history/contracts/integration-gates.md`.

  - **Phụ thuộc**: T043, T052, T042, T056, T055.
  - **Bắt đầu / gate**: **BLOCKED: Payment APIs/posting/recovery + QR-01 + channel**. BLOCKED G: operational payment integration chưa được phép trong task set này; cần kế hoạch/tasks bổ sung sau actual APIs, approved channel/test credentials và owning BE evidence; không dùng production money hoặc guessed sandbox host.
  - **Kiểm chứng / hoàn thành**: V28 + V09/V13/V14/V16/V25: record one verified TOP_UP, callback duplicates/out-of-order/crash atomicity and same-intent/lost-ID/restart. UI counters không thay backend proof; chỉ evidence review/acceptance sau scope revision, không sửa backend/enable live ở đây.
  - **Bằng chứng**: G,DOC. Task chỉ hoàn tất khi kết quả này đã quan sát; không dùng số task để thay acceptance.

- [ ] T059 Nghiệm thu Android riêng cho reads/preparation và giữ payment acceptance có điều kiện — `apps/mobile/specs/006-wallet-payment-history/validation.md`.

  - **Phụ thuộc**: T056.
  - **Bắt đầu / gate**: **GATED: Android; payment subset BLOCKED**. GATED NA: Android device/dev client phù hợp và approved fixture/read env. Wallet subset cần T019/T056.wallet, history subset cần T031/T056.history; preparation subset cần T041 cho intent/QR shell hoặc T050 cho status, kiểm thử phối hợp cần cả hai. Không ép wallet subset chờ history/payment prep. Payment/QR operational subset chỉ sau T058 và bổ sung scope.
  - **Kiểm chứng / hoàn thành**: V01/V06/V08/V12..V14/V17/V24/V25/V29/V30 chia record wallet/history/intent-model/status-model: exact amounts/large text/screen reader/hardwareBack/keyboard/background/network/session. Thiếu source/model/environment thì subset NOT_RUN/BLOCKED, không tick toàn T059 từ wallet-only. QR decode+restart real nếu thiếu giữ blocked; web/bundle không thay NA.
  - **Bằng chứng**: NA. Task chỉ hoàn tất khi kết quả này đã quan sát; không dùng số task để thay acceptance.

- [ ] T060 Nghiệm thu iOS riêng cho reads/preparation và giữ payment acceptance có điều kiện — `apps/mobile/specs/006-wallet-payment-history/validation.md`.

  - **Phụ thuộc**: T056.
  - **Bắt đầu / gate**: **GATED: iOS; payment subset BLOCKED**. GATED NI: iOS device/dev client/simulator hợp lệ do người dùng cung cấp; Windows không tự có local iOS sim, không tự thuê remote service. Wallet subset cần T019/T056.wallet, history subset cần T031/T056.history; intent/QR model cần T041, status model cần T050, kiểm thử phối hợp cần cả hai. Không ép wallet subset chờ history/payment prep. Payment operational subset cần T058/scope bổ sung.
  - **Kiểm chứng / hoàn thành**: Cùng V01/V06/V08/V12..V14/V17/V24/V25/V29/V30 theo từng subset với iOS Back/gesture/keyboard/accessibility/resume; kết quả NI riêng và pending/blocked nếu thiếu source/môi trường. Không tick toàn T060 từ wallet-only, không copy NA/W hoặc decode chưa chạy.
  - **Bằng chứng**: NI. Task chỉ hoàn tất khi kết quả này đã quan sát; không dùng số task để thay acceptance.

- [ ] T061 Rà soát scope, hành vi tài chính và đồng bộ acceptance traceability — `apps/mobile/specs/006-wallet-payment-history/validation.md`, `apps/mobile/specs/006-wallet-payment-history/validation-matrix.md`, `apps/mobile/specs/006-wallet-payment-history/contracts/integration-gates.md`.

  - **Phụ thuộc**: T056.
  - **Bắt đầu / gate**: **READY**. Review sau source checks của increment hiện có; với wallet-only dùng T056.wallet, không cần full read-scope T056. Thu thập checkpoint T057/T059/T060 theo khả năng đã chạy; scope/thiết bị/channel còn thiếu ghi NOT_RUN/BLOCKED, không dùng nó để chặn việc lập báo cáo trung thực. Serialize validation.md.
  - **Kiểm chứng / hoàn thành**: V30: không cashout/transfer/refundexec/admin/historyedit/local settlement/credit; FR25/SC7/V30 mỗi ô có observed/blocked layer và source version. Không đánh US2/3 complete hoặc SC002/003/004/007 full khi chỉ fixture/prep; API đề xuất vẫn labeled.
  - **Bằng chứng**: DOC,L,W. Task chỉ hoàn tất khi kết quả này đã quan sát; không dùng số task để thay acceptance.

- [ ] T062 Ghi bàn giao MVP/read increment và các gate còn mở — `apps/mobile/specs/006-wallet-payment-history/tasks.md`, `apps/mobile/specs/006-wallet-payment-history/quickstart.md`, `apps/mobile/specs/006-wallet-payment-history/validation.md`.

  - **Phụ thuộc**: T061.
  - **Bắt đầu / gate**: **READY**. Chỉ tick task thực sự đạt verification; tiền điều kiện external thiếu vẫn unchecked + blocked, không commit/stage tự động.
  - **Kiểm chứng / hoàn thành**: Bàn giao increment hiện có theo checkpoint: Wallet A chỉ được claim nếu T057.wallet đạt, History A chỉ khi T057.history đạt; nếu mới fixture phải ghi đúng lớp. Report cả NA/NI/payment/history còn pending, không chờ full platform/channel để báo cáo Wallet increment và không claim full release hoặc SC-007. US2/3 preparation không phải release payment; còn gate/owner/next-contract decisions kèm bằng chứng; branch/index/authorized scope bảo toàn, không tự chạy implement/provider.
  - **Bằng chứng**: DOC. Task chỉ hoàn tất khi kết quả này đã quan sát; không dùng số task để thay acceptance.

## Truy vết US và checkpoint độc lập

| Story                             | Tasks      | Số task | Checkpoint được làm ngay sau foundation             | Phần chưa được claim                                                   |
| --------------------------------- | ---------- | ------- | --------------------------------------------------- | ---------------------------------------------------------------------- |
| US1 P1                            | T012..T020 | 9       | Wallet/Home L/C và UI thật owner read; MVP          | A cần T057.wallet; NA/NI Wallet subsets của T059/T060                  |
| US4 P2, ưu tiên thực hiện thứ hai | T021..T032 | 12      | 200-entry list/detail/filters/snapshot L/C/W        | A cần T057.history; optional related destinations vẫn gated            |
| US2 P1                            | T033..T043 | 11      | T033..T041 PREP L/W, single intent/unavailable live | T042 QR-01; T043 actual APIs/posting/recovery; no financial activation |
| US3 P1                            | T044..T052 | 9       | T044..T051 PREP L/W, inject observation trực tiếp   | T052 owner API/freshness/recovery; live reads/success proof chưa có    |
| Setup/foundation                  | T001..T011 | 11      | Exact money/session/preview/Back                    | Không chứng minh real payment                                          |
| Cross-cut/evidence                | T053..T062 | 10      | Browser/checks/read evidence theo prerequisite      | G/NA/NI không thay bằng fixture                                        |

## Truy vết đủ 25 FR tới implementation/preparation và verification

Các task preparation trong bảng không thỏa FR tài chính ở production cho đến khi phần actual contract/acceptance đạt. Ca V cụ thể xem bảng 30 ca bên dưới và expected result đầy đủ trong [validation-matrix](validation-matrix.md).

| FR     | Tasks cụ thể                                                | Cases                           |
| ------ | ----------------------------------------------------------- | ------------------------------- |
| FR-001 | T006,T008,T009,T015,T025,T026,T035,T046,T050,T051           | V01,V02,V15,V25                 |
| FR-002 | T004,T005,T012,T013,T014,T016,T057                          | V03,V04,V27                     |
| FR-003 | T007,T011,T017,T018,T019,T054,T059,T060                     | V04,V05,V24,V29                 |
| FR-004 | T009,T015,T016,T025,T026,T028,T048,T054                     | V02,V04,V05,V06,V16,V19         |
| FR-005 | T004,T033,T034,T036,T041                                    | V03,V07                         |
| FR-006 | T034,T036,T041,T042,T055                                    | V07,V29                         |
| FR-007 | T033,T034,T037,T038,T040,T042,T043,T058                     | V07,V08,V12,V15,V28             |
| FR-008 | T033,T034,T035,T039,T041,T043,T051,T058                     | V08,V09,V10,V11,V13,V25         |
| FR-009 | T008,T035,T037,T040,T046,T051,T052                          | V01,V12,V13,V15,V25             |
| FR-010 | T034,T037,T039,T044,T045,T049,T050                          | V09,V12,V14,V17                 |
| FR-011 | T022,T027,T044,T045,T048,T050,T052                          | V14,V15,V16,V17,V18,V22         |
| FR-012 | T046,T048,T050,T052                                         | V06,V13,V17,V18                 |
| FR-013 | T015,T018,T044,T047,T048,T050                               | V05,V16                         |
| FR-014 | T034,T036,T045,T048,T051                                    | V11,V12,V17,V22,V25             |
| FR-015 | T021,T023,T024,T025,T028,T031,T057                          | V19,V23,V27                     |
| FR-016 | T021,T023,T024,T025,T028,T031,T057                          | V20,V23,V27                     |
| FR-017 | T005,T022,T026,T027,T029,T031,T057                          | V03,V21,V22,V23,V27             |
| FR-018 | T009,T022,T026,T027,T029,T045,T050,T061                     | V02,V18,V21,V22,V30             |
| FR-019 | T027,T029,T031,T061                                         | V21,V22,V30                     |
| FR-020 | T007,T010,T026,T029,T030,T049,T054                          | V15,V23,V24,V26                 |
| FR-021 | T004,T005,T013,T022,T027,T034,T047                          | V03,V07,V16,V21                 |
| FR-022 | T017,T029,T040,T048,T054,T055,T061                          | V22,V26,V30                     |
| FR-023 | T007,T009,T016,T028,T036,T048,T054,T055,T059,T060           | V04,V07,V17,V24,V29             |
| FR-024 | T002,T003,T007,T010,T011,T017,T030,T040,T049,T053           | V04,V14,V15,V26                 |
| FR-025 | T001,T009,T038,T042,T043,T052,T057,T058,T059,T060,T061,T062 | V04,V07,V15,V26,V27,V28,V29,V30 |

## Truy vết đủ 7 SC và điều kiện được kết luận

| SC     | Tasks cụ thể                                                          | Cases                           | Phép đo / giới hạn bằng chứng                                                                                                                    |
| ------ | --------------------------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| SC-001 | T004,T005,T012,T016,T018,T019,T020,T054,T057                          | V03,V04,V05,V27                 | 100% exact matches; L/C/W hiện chuẩn bị được, A cần approved reads; error/unavailable không zero.                                                |
| SC-002 | T033,T036,T038,T041,T042,T055,T059,T060                               | V07,V12,V29                     | Đo <=60s valid input→review→explicit QR continuation trừ external waits; prep timing chỉ proxy, full blocked QR-01/public payment/scan workflow. |
| SC-003 | T044,T045,T046,T048,T049,T050,T052,T055,T058                          | V14,V15,V16,V17,V18,V28         | Zero false paid/local credit, sáu states; model counts không thay owner Payment API/G verification.                                              |
| SC-004 | T033,T034,T035,T039,T041,T051,T043,T058                               | V08,V09,V10,V11,V12,V13,V25,V28 | Tách intent/dispatch/backend posting counts; 0 unintended duplicate; server posting/restart còn blocked.                                         |
| SC-005 | T021,T024,T025,T026,T028,T029,T031,T032,T054,T057                     | V19,V20,V21,V22,V23,V27         | 200+ records, page20, once per ID/server sequence, type/ref filters và detail exact; real cursor proof A riêng.                                  |
| SC-006 | T006,T007,T008,T009,T019,T026,T030,T046,T049,T050,T054,T057,T059,T060 | V01,V02,V04,V15,V26,V27         | 0 cross-owner/sample/denied-cache leak; L/C/W + real owner404 + native/session cases riêng.                                                      |
| SC-007 | T038,T042,T054,T055,T059,T060,T061                                    | V24,V29,V30                     | 4 journeys/320px có W/NA/NI records riêng; native/full QR chưa chạy phải pending/blocked.                                                        |

## Truy vết đủ 30 ca: tiền điều kiện, task tạo kiểm thử và acceptance

Đây là kế hoạch kiểm chứng, không là kết quả đã chạy. Mỗi acceptance row sau này phải ghi case/layer, SHA+contract, môi trường/dataset an toàn, steps/command, expected/observed, pass/fail/blocked, evidence path. Test tổng hợp phải bám expected cases gốc, không chỉ assert implementation internals.

| Case | Tiền điều kiện / dữ liệu                                                   | Task logic/contract/test preparation | Task chạy/ghi acceptance | Kết quả mong đợi / gate                                                                                                               |
| ---- | -------------------------------------------------------------------------- | ------------------------------------ | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| V01  | A/B, promises resolve/reject sau logout→B                                  | T006,T008,T019,T031,T035,T046,T050   | T054,T057,T059,T060      | A old projection/toast/navigation/replay/expiry không ảnh hưởng B; L/C read + L payment, A/NA/NI gated.                               |
| V02  | Cached detail→403/404→network error                                        | T006,T009,T012,T026,T031,T046,T050   | T054,T057                | Evict projection, không resurrect từ stale list/cache; Payment C/A blocked T052.                                                      |
| V03  | 0.00/.01/12.34/9007199254740993.01, invalid precision/deltas               | T004,T005,T012,T013,T022,T031        | T054                     | Exact strings/units/no Number hoặc /100; L/C/W.                                                                                       |
| V04  | Unavailable/hydrating/loading/error/authorized no-wallet Z                 | T006,T009,T011,T012,T015,T017,T019   | T054,T057                | Home unavailable ngay foundation, chỉ successful absent-wallet zero/version0; không bonus/init/fake zero; A prerequisite T057.wallet. |
| V05  | Home/Wallet shared read, stale/error/overlap                               | T015,T016,T018,T019                  | T054,T057                | Một projection coherent; refresh chỉ read, stale rõ; L/C/W/A.                                                                         |
| V06  | Offline/reconnect read + unknown intent                                    | T006,T009,T019,T035,T046             | T054,T055,T059,T060      | Gate block interaction, active read recovery, không creation replay/clear unknown; native riêng.                                      |
| V07  | 1000/2000000 valid;999/1001/2001000 + invalid VND/quote changed            | T004,T033,T034,T036,T041             | T055                     | Preserve draft/re-review, no rounding/no live create; L/W prep, payment C blocked T043.                                               |
| V08  | Same-tick confirms + remount second caller                                 | T033,T034,T035,T041                  | T055,T059,T060           | One sync claim/model dispatch, no new keys; L/W+native prep, real count awaits G T058.                                                |
| V09  | Timeout/disconnect/abort/malformed2xx sau model dispatch, lost ID          | T033,T034,T039,T041,T051             | T055,T058                | Unknown frozen intent, no fresh submit; L/W prep, C/A/G blocked actual recovery.                                                      |
| V10  | 401 rồi renewal thành công ở shared HTTP seam                              | T039,T041                            | T055                     | Explicit replayAfterRenewal:false, retry:false không thay thế nhau; L seam trước, actual Payment C blocked.                           |
| V11  | Proven-no-create vs409/5xx/429 ambiguous                                   | T033,T034,T039,T041                  | T055,T058                | Chỉ accepted no-create cho sửa/review; không generic status→new-key; C/A semantics blocked T043.                                      |
| V12  | Known model ID, QR preparing/ready/error/close; synthetic exact payload    | T033,T037,T038,T041,T044             | T042,T055,T058,T059,T060 | ID/status access còn, no new create; shell L/W sẵn, independent decode/usable QR blocked QR-01.                                       |
| V13  | Active/unknown→Back/remount/background/resume/process kill                 | T033,T035,T041,T046,T051             | T055,T058,T059,T060      | Remount giữ lock, no auto create; durable recovery C/G/native blocked GAP-06.                                                         |
| V14  | Forged state/providerStatus/QR close/repeated legacy link                  | T044,T045,T049,T050                  | T055,T058,T059,T060      | Zero false result/balance/TOP_UP; model L/W sẵn, C/G awaits owner API.                                                                |
| V15  | Missing/malformed/wrong model ID/owner/preview ID                          | T007,T010,T044,T046,T049,T050        | T055,T057                | No invalid live request/private detail; real payment ID schema/C/A blocked T052; wallet/detail A T057 riêng.                          |
| V16  | PAID model + wallet fails/history succeeds rồi inverse/stale               | T044,T047,T048,T050                  | T055,T058                | Outcome và each refresh result riêng; retry reads only, no local credit; A/G payment blocked.                                         |
| V17  | CREATED/PENDING manual double check + blur/background/optional budget      | T044,T046,T048,T050                  | T055,T059,T060           | Coalesce/check cleanup, no timerexpiry; no polling configured; C awaits contract, optional schedule tests only after approved budget. |
| V18  | Reverse response order + unknown/conflicting model observations            | T044,T045,T046,T050                  | T055,T058                | Superseded ticket rejected, unknown neutral, stale conflict not invented transition; Payment C/A blocked.                             |
| V19  | 200+uuid/page20/equal timestamps/overlap/newappend/later-page error        | T003,T021,T023,T024,T025,T028,T031   | T054,T057                | Server order+watermark, once-per-ID, prior pages retained; parser max50 unchanged, BE max100 not advertised.                          |
| V20  | type/referenceType AND changed while page/refresh pending                  | T003,T021,T023,T024,T025,T028,T031   | T054,T057                | Filter-specific keys/cursor-free reset, reject old chain; no status/local partial filter.                                             |
| V21  | HOLD/RELEASE/fees/teaching/material/bonus/penalty                          | T002,T022,T027,T029,T031             | T054,T057                | Magnitude vs separate deltas/post-balances exact; no balance/page sums/settlement/double fee.                                         |
| V22  | Ledger REVERSED vs Payment REFUNDED, nullable context                      | T002,T022,T027,T029,T044,T045,T050   | T054,T055,T057           | Original readonly, no inferred payout/partial refund/admin; A payment subset blocked.                                                 |
| V23  | Invalid cursor + append refresh + denied/missing/sample destination        | T003,T021,T024,T025,T026,T029,T031   | T054,T057                | Explicit cursor-free new chain/no mixing/timestamp tie sort; safe references only.                                                    |
| V24  | Home/Profile/direct→all screens→Back/native removal                        | T007,T011,T017,T019,T030,T040,T049   | T054,T055,T059,T060      | Origin/fallback/selection/draft retained; no financial effect or duplicate screen; NA/NI separately.                                  |
| V25  | Reauth/restart known ID or unknown lost ID; A/B                            | T033,T035,T041,T051                  | T055,T058,T059,T060      | No amount/body matching/new key/B leak; L blocked-state behavior != actual GAP-06 recovery.                                           |
| V26  | Gallery/sample notice/state URL→preview or normal route                    | T007,T010,T011,T030,T040,T049,T053   | T054,T055                | Label/inert injected model/no production egress/cache; Home/normal routes không sample financial success; L/W.                        |
| V27  | Approved A/B/Z+absent-wallet cho Wallet; thêm 200 safe records cho History | T012,T021,T031                       | T057                     | V27.wallet và V27.history ghi riêng; exact zero/read semantics và owner404/filter20/snapshot tương ứng; A only, Payment blocked T052. |
| V28  | Approved payOS channel + operational APIs/recovery + owning BE proof       | T038,T043,T051,T052                  | T058                     | One verified atomic TOP_UP with duplicate/out-of-order/crash/lost-response proof; G BLOCKED, not fixture/source.                      |
| V29  | 320/375/430, large text/screenreader/keyboard/nativeBack/QR                | T009,T016,T028,T029,T036,T038,T048   | T042,T054,T055,T059,T060 | Readable exact money/actions + QR quiet zone/contrast/module decode when QR-01 closed; W/NA/NI distinct.                              |
| V30  | Final action/copy/source scope + unrelated regression                      | T017,T027,T029,T040,T048             | T056,T059,T060,T061      | No cashout/admin/peertransfer/historyedit/refundexec/local settlement; preserve HTTP/profile/learning consumers.                      |

## Dependency graph và thứ tự thực thi

Dependency ID tại từng task là bắt buộc. Nhánh graph dưới mô tả logic, không cho phép bỏ prerequisite hoặc cùng lúc ghi chung file.

T053/T054/T056/T057/T059/T060 quản lý nhiều capability. Hậu tố `.wallet`/`.history` là **checkpoint bằng chứng của cùng task**, không phải task ID mới. Phụ thuộc downstream đối với một increment được đáp ứng bằng checkpoint tương ứng đã PASS trên source revision hiện tại; không đòi tick toàn task đa capability. Điều kiện bắt đầu tại từng task vẫn bắt buộc. Checkbox của task đa capability giữ unchecked nếu còn scope bắt buộc chưa đạt; báo cáo có thể dùng checkpoint Wallet đã đạt và ghi History NOT_RUN. Không dùng cách này để bỏ một gate tài chính hoặc đánh toàn case V/SC đã pass từ subset.

| Checkpoint               | Điều kiện Wallet                                             | Điều kiện History                                                    | Điều kiện không được suy diễn                                                                    |
| ------------------------ | ------------------------------------------------------------ | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| T053 harness/scenario    | Core sau T011; scenario sau T019                             | Cùng core; scenario sau T031                                         | Chưa có UI phải báo missing prerequisite                                                         |
| T054 web read            | T053.wallet + T019; A/B/Z/absent-wallet/offline fixtures     | T053.history + T031; 200+ ledger fixtures                            | Scope còn thiếu không PASS; W không thành A/native                                               |
| T056 source checks       | T019 + focused Wallet tests và required checks hiện tại      | T031 + focused History tests và required checks hiện tại             | Không chờ browser/story kia; source đổi phải kiểm tra lại                                        |
| T057 actual reads        | T019 + T054.wallet + T056.wallet + approved read environment | T031 + T054.history + T056.history + approved 200-record environment | Wallet không cần 200 history records; A không đóng Payment gate                                  |
| T059/T060 native read    | T019 + T056.wallet + device/env tương ứng                    | T031 + T056.history + device/env tương ứng                           | Intent-model cần T041, status-model cần T050; full QR/recovery vẫn chờ T058/scope bổ sung        |
| T061/T062 review/handoff | T056.wallet và kết quả/blocked state của từng lớp            | T056.history và kết quả/blocked state của từng lớp                   | Report được partial increment; claim Wallet A chỉ với T057.wallet PASS, không claim full release |

```text
T001
  +-- T002 (local model fixtures)
  +-- T003 (confirmed wallet HTTP fixtures)
        |
T004..T011 (money + owner runtime + truthful reads + preview + Back)
        |
        +-- US1 T012..T020 ------> wallet/Home MVP
        +-- US4 T021..T032 ------> independent ledger increment
        +-- US2 T033..T041 ------> preparation only
        |         +-- T042 -----x QR-01 / renderer-decode evidence
        |         +-- T043 -----x actual create/query/posting/recovery
        +-- US3 T044..T051 ------> independent observation preparation
                  +-- T052 -----x owner Payment API/freshness/recovery

T011 -> T053 harness core (independent scenario scopes)
US1 T019 -> T054.wallet + T056.wallet -> T057.wallet (approved A environment)
US4 T031 -> T054.history + T056.history -> T057.history (approved A environment)
US2 T041 + US3 T050 + T053 -> T055 combined model web evidence (no financial proof)
T042+T043+T052+scope revision+T055/T056 -> T058 G evidence (BLOCKED)
T056.wallet or T056.history -> T059/T060 corresponding read scope (device gated)
T056.current-increment + observed/blocked outcomes -> T061/T062 honest handoff
```

- Foundation cần hoàn tất trước production story work. Test/data setup ở phase đầu có thể chạy theo deps.
- US1/US4 không cần nhau về nghiệp vụ hay Payment; nếu thực hiện US4 trước, nó dùng shared shell/runtime và own list/detail adapter. Ưu tiên người dùng vẫn là US1 rồi US4.
- US2/US3 chỉ phụ thuộc foundation về logic; shared `types/payment.ts` là local type boundary tại T005, không ép US3 phải tạo payment/QR trước. T046/T047/T050 dùng injected model readers/session scope nên không đòi US1/US4 hoặc US2 đã được tích hợp. T050 không phụ thuộc T035; T055 mới là kiểm thử phối hợp sau T041 và T050.
- T030/T040/T049 và T011/T017/T018 cùng public exports/screens/preview/navigation-test files: serialize mọi edits theo thứ tự được chọn, giữ public contract. T011 tạo Home consumer unavailable, T016 nối read, T018 hoàn thiện Home; serialize các file Home/consumer dùng chung. T019/T031/T035/T050 chung runtime/contract tests cũng serialize. Metadata ở task ghi trường hợp điều phối, không biến resource lock thành product dependency.
- T020/T032/T042/T054..T062 ghi chung `validation.md`; chạy từng writer, chỉ append observed record. T043/T051/T052/T058/T061 ghi shared contracts: serialize. Không đánh [P] các writer này.
- T042/T043/T052 không đóng chỉ bởi hoàn tất tasks chuẩn bị. T058 không được chạy từ set tasks hiện tại để triển khai live payment; cần actual APIs, approved scope/tasks bổ sung, channel/backend proof và renderer evidence.
- GATED task chưa có môi trường giữ unchecked/blocked; final handoff báo các checkpoint độc lập và blocker, không giả prerequisite task đã hoàn tất. T061/T062 là review/handoff của increment thực sự có; hoàn tất báo cáo không đồng nghĩa full acceptance. Full SC-007/release vẫn cần đủ lớp/nền tảng, phần payment tiếp tục chờ contract/channel/QR gates.

## Cơ hội chạy song song theo từng story

Không tự khởi tạo agent/worker. Ví dụ dưới chỉ dùng khi có nhân lực/điều phối được cho phép; mỗi cặp phải xong deps và không giữ cùng file.

| Nhóm             | Ví dụ task chạy song song an toàn                                     | Điểm serialize                                                               |
| ---------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Setup/foundation | T002 với T003 sau T001; T004 với T006 với T007 sau datasets tương ứng | T005/T008/T009/T010/T011 đi theo deps                                        |
| US1              | T012 wallet contract test với T021 history test sau foundation        | Trong US1 adapter→hook→UI→Home tuần tự; không gán P để bỏ test-before-source |
| US4              | T026 detail hook với T027 row presentation sau T023/T022              | List/detail screens xong trước T030 exports và T031 tests chung              |
| US2 prep         | T037 QR shell với T039 transport-seam tests sau T035/T034             | T040 exports/navigation serialize; QR encoding thật vẫn blocked              |
| US3 prep         | T046 observer model với T047 refresh model sau T045                   | T048/T049 wiring sau cả hai; type/public file edits chờ writer khác          |

## Chiến lược MVP và nghiệm thu từng increment

1. **MVP US1**: T001..T020 gồm Home unavailable tại foundation; T053.wallet/T054.wallet/T056.wallet và T057.wallet khi read environment đủ, native wallet subset nếu có device. Không cần chạy T021..T052, tạo 200-entry history dataset trên API thật hoặc tick full cross-capability tasks để nghiệm thu Wallet thật. Setup T003 vẫn chuẩn bị ledger fixture tổng hợp cho lần tích hợp History sau. MVP chỉ demo real data sau confirmed reads, no successful read thì unavailable.
2. **History increment US4**: T021..T032 cùng T053.history/T054.history/T056.history/T057.history; source/read acceptance cũng chạy được nếu US1 chưa triển khai. Không chờ payOS orchestration. Checkpoint buộc >=200 entries/page20/filter/append snapshot consistency.
3. **Preparation US2/US3**: T033..T041 và T044..T051 độc lập sau foundation; T050 status/session tests không cần T035. T055 ghi kiểm thử phối hợp model/web sau cả hai. Production screens giữ capability-unavailable; không tick cả story/FR financial acceptance từ fixture.
4. **Gate review riêng**: T042 QR-01, T043/T052 actual Payment source/contracts/recovery, T058 approved channel+owning BE proof. Ghi open question theo actual DTO mới, không dự đoán payload. Không có task hiện tại authorize BE write hoặc live adapter implementation.
5. **Platform và handoff**: T059/T060 ghi Android/iOS riêng cho phần thực sự chạy; T061/T062 đối chiếu layer của từng FR/SC/V. Thiếu device/API/channel ghi blocked với owner/prerequisite, không silently thay bằng screenshots fixture.
6. Mọi precision loss, false paid, cross-owner leak, denied resurrection, unintended new intent hoặc duplicate posting làm dừng acceptance bị ảnh hưởng; giữ evidence độc lập còn đúng.

## Quyết định/bằng chứng còn chờ

| Gate / chủ sở hữu quyết định                | Cần cung cấp                                                                                                     | Mobile giữ ở trạng thái nào                                                            |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Actual Payment contract / owning BE         | Implemented create/quote/owner query + source DTO/errors/identity/QR câreadiness/quote snapshot+expiry/freshness | Không payment-api/schema/hook live, no Confirm dispatch                                |
| GAP-06 / BE + product recovery policy       | Payment key scope/body fingerprint/replay/conflict/retention, lost-ID lookup, restart/reauth correlation         | Frozen UNKNOWN_OUTCOME, no same-body matching/fresh key or invented storage            |
| GAP-05 / BE financial owner                 | Verified receipt, atomic PAID/TOP_UP/wallet/audit/outbox, duplicate/out-of-order/crash/late/partial evidence     | Candidate providerStatus không thành Payment status/credit                             |
| QR-01 / mobile dependency review            | Vetted encoder/license/version/SDK/native-web, independent exact decode, dense/layout/quiet zone evidence        | Shell/model/test prep; không dependency install hoặc encoder implementation ở đây      |
| Supported scan workflow / product + QA      | Cách thanh toán QR hợp lệ, cả giới hạn same-device; không implicit save/share/scanner/bank link                  | Không hứa flow chưa hỗ trợ; full SC-002/G chưa đạt                                     |
| Read deployment / owning BE + QA            | Matching SHA, migration/config ready và A/B/Z/absent-wallet/200 safe entries                                     | L/C/W đủ source test, A blocked nếu thiếu environment; không apply migration từ mobile |
| Provider/channel / authorized owner         | Approved test/channel credentials và BE proof, không đoán sandbox host/production transfer                       | G blocked; rendered QR/model không close gate                                          |
| Android / iOS / QA                          | Device/dev client/environment cho từng nền tảng, evidence riêng                                                  | NA và NI pending độc lập, Windows/web/export không thay iOS                            |
| Optional related navigation / feature owner | Real destination/identity/permission, held allocation API nếu mở scope sau                                       | Display raw supplied context, không sample deep link/Held drill-down                   |
| Optional automatic checks / API + product   | Nếu đề xuất sau: exact cadence/budget/backoff/rate limits và freshness semantics                                 | Manual model check baseline, không SSE/timed polling/client expiry                     |

## Kiểm tra chất lượng task list

- 62 checklist task, IDs T001..T062; Setup/foundation11, US1=9, US4=12, US2=11, US3=9, cross-cut10.49 task T001..T041/T044..T051 đã tick theo tiêu chí; P4/P5 chỉ preparation.13 task T042/T043/T052..T062 còn unchecked.
- Tất cả có đường dẫn file cụ thể, phụ thuộc/entry/verify/evidence. File thực tế và helper tách nhỏ của P1..P5 được ghi trong validation; paths phase sau vẫn là change map. Đủ25 FR,7 SC,30 case rows; tick increment không thay acceptance đầy đủ của các hàng này.
- 15 task có [P] sau khi điều kiện của chúng đáp ứng; ví dụ theo story ở trên. Các task bị chặn không được đổi thành READY vì model tests xanh.
- T042/T043/T052/T058 BLOCKED; T057/T059/T060 environment GATED. T033..T041/T044..T051 PREP. Các READY source tasks vẫn cần invocation triển khai sau.
- Hook check tại mobile Spec Kit root: `.specify/extensions.yml` không tồn tại ở lần sinh này, không before/after_tasks hook để chạy.
- Remediation I1/I2/C1/I3: giữ62 IDs; Wallet/History có checkpoints W/checks/A/native độc lập, T050 bỏ phụ thuộc US2, Home unavailable thuộc T011 và quickstart chỉ chạy file đã được tạo ở giai đoạn tương ứng. Dependency/checkpoint của T012+ giữ nguyên sau P1.
- Kết quả P1/P2/P3 ở validation; P3 bổ sung V19..V23 và History/detail subset V01/V02/V03/V24/V26/V29. Không tick task cross-capability/phase sau hoặc đóng toàn V/FR/SC từ subset này. A/G/NA/NI và T053+ vẫn NOT_RUN; format/link/index checks không thay financial acceptance.
- `.specify/extensions.yml` vẫn không tồn tại khi kết thúc P5 preparation, nên không có after_implement hook. T038 chỉ hoàn tất specification/model tests; QR-01 renderer/decoder vẫn BLOCKED. T044..T051 độc lập với US2 intent; memory-remount không là restart recovery. T042/T043/T052..T062 chưa thực hiện, không skipped-as-PASS.
