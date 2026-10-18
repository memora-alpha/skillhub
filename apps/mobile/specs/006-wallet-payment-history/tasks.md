# Tasks: Wallet, payment status and transaction history

**D1 receipt — 2026-10-18:** [BE decision/local-source delta](contracts/d1-backend-confirmation.md) records T079 confirmation evidence; no task is completed by this receipt. D1 policy is CONFIRMED_WITH_LIMITATIONS; newly declared fallback identity/creation-policy/pause/REVIEW behavior still requires SOURCE_SYNC_REQUIRED, and unsupported total-loss/owner clearance must remain fail-closed. Keep original T079/T080 criteria and dependencies until verified/remediated; historical “await D1” means these remaining gates rather than an unanswered BE question. All100 IDs/68 checked and task blocks below are preserved. No new tasks or implementation are generated.

**QR implementation checkpoint — T089..T093**: Hoàn tất5 tasks theo scope DOC/L/renderer/W; tổng100 IDs,68 completed,32 unchecked. New encoder/geometry, SVG render boundary, scoped observation→QR projection và private synthetic preview đã có source. Tests RED trước source/harness;15 focused QR tests và431 full regression, lint/types/structure532, web/Android/iOS Metro JS exports/source-map audit đạt. W8 nhóm/16 actual SVG screenshot decodes, zero financial preview HTTP/remote egress. T094.qr record riêng, parent unchecked. Native/Hermes/device/bank-scan/API/payOS NOT_RUN; QR-01/T042/D1/create/Confirm vẫn gated. Không stage/commit/push hoặc tự chạy lệnh tiếp theo. Chi tiết và giới hạn ở [validation](validation.md).

**Historical approved-scope tasks update — 2026-10-17**: Giữ100 IDs/63 completed/37 unchecked; không task nào được tick trong lượt này. Đồng bộ T080/T082 D2 native-first store, T085 QA-host/entry đã duyệt và T089..T093 QR tooling/test/import/pixel workflow; T079/T096 cập nhật D1/binding đúng source. Không hỏi lại D2/D3/workflow D4. READY DOC tiếp theo là T089; T090→T091→T092→T093 theo deps, độc lập T079/T080/create/G. T080.design có thể chuẩn bị, nhưng full T080 và T081..T088 vẫn BLOCKED D1. Môi trường user-confirmed available, actual binding/build/channel/data và A/G/NA/NI evidence chưa kiểm chứng. QR selection approval không phải security/import/pixel/native PASS. Chỉ tài liệu thay đổi, không install/source/flag/BE/Git index. Xem [validation](validation.md) cho preservation và [decision record](contracts/completion-proposal.md).

**Historical clarify-only checkpoint — 2026-10-17**: [D1..D4 record/source audit](contracts/completion-proposal.md) records D2 native-first SecureStore/logout, D3 QR tools/mobile-package/root-lockfile scope and D4 two-device QA-entry design approved. User confirms environment exists; binding/results remain unverified. D1 BE exceptions/total-loss remains BLOCKED; source foundation R-07 already specifies no automatic TTL. Later tasks should apply accepted T080/T085/T089/T091 scope and unlock independent QR work where its original prerequisites are actually met, without asking approvals again. This clarify invocation changes no task block/ID/dependency/criterion/checkbox:100 IDs,63 complete; T079/T080/T089 remain unchecked, no test/install/source/activation.

**I2 batch checkpoint — 2026-10-17 (hiện hành)**: Hoàn tất T067..T075 và T077 trong phạm vi L/C/W; tổng100 task,63 completed,37 unchecked. Owner detail, scoped query lifecycle, PAID-dependent reads, list transport và status UI seam đã có source/test. T076 NOT_SELECTED; T078/T095 chờ approved A environment. T079..T093 và T096..T099 còn gate nêu trong validation. T094.status/T100.status có record riêng, parent task vẫn unchecked. Payment/Confirm thật chưa bật; không stage/commit/push. Các checkpoint và số lượng bên dưới là lịch sử tại từng invocation.

**Historical I1 implementation checkpoint — 2026-10-17**: T063..T066 đã hoàn tất schema/contract fixture và observation reducer theo actual Payment DTO; chỉ L/C/model, chưa adapter/hook/activation. **Tổng100 task:53 completed,47 unchecked**;49 completion cũ và62 ID gốc giữ nguyên.18 test mới,104 Wallet regression và400 full mobile regression đạt; source checks đạt, xem [validation](validation.md). T067..T100 chưa triển khai; GAP-06/QR-01 và mọi gate tài chính giữ nguyên, Payment/Confirm vẫn tắt. Các số liệu task generation bên dưới là lịch sử trước increment này.

**Tasks update — 2026-10-17 (hiện hành)**: Giữ62 IDs T001..T062 và nguyên49 task blocks đã hoàn tất; bổ sung38 task unchecked T063..T100 từ plan I1..I6. **Tổng100 task:49 completed,51 unchecked**. Phần task gốc bên dưới giữ lịch sử baseline17e3ac1/preparation; phần “Integration task extension” ở cuối là actual-contract work tại4121c3f (BE081b3d2/f80ef7a). Ưu tiên I1/schema rồi US3 owner reads độc lập create/QR. GAP-06 và QR-01 vẫn chặn phần liên quan; current Payment/source/flags/Git index không thay đổi. Không thực thi task hoặc tự chạy lệnh Spec Kit tiếp theo.

**Historical replan checkpoint (2026-10-17)**: BE Payment `081b3d2`/merge `f80ef7a`, checkout `4121c3f`, so với baseline `17e3ac1`. [Payment HTTP](contracts/payment-http.md) xác nhận create/list/detail, persisted quote/QR, signed receipts và atomic posting đã có source. GAP-06 chỉ partial: còn retention/lost-correlation/mobile restart policy; QR-01 vẫn BLOCKED. T043/T052 đã có source để review, nhưng chưa được tick hoặc coi là activation PASS. Các ghi chú “chưa có API” và sáu-state preparation bên trong49 task hoàn tất là **lịch sử scope tại17e3ac1**, không phải inventory BE hiện tại. Giữ nguyên toàn bộ49 task completion/tiêu chí cũ; REVIEW/version/QR-null và wire integration là công việc mới trong [plan I1..I6](plan.md), cần invocation tasks riêng. Không thêm ID task hoặc triển khai từ replan này.

**Feature**: `apps/mobile/specs/006-wallet-payment-history`\
**Ngày task gốc**: 2026-10-16 | **Baseline BE gốc**: `17e3ac1f38df1b645bd5f103a7111eae00f5e0b4`\
**Nhánh giữ nguyên**: `feat/mobile-wallet-payment-history`\
**Input**: [spec](spec.md), [plan](plan.md), [research](research.md), [data-model](data-model.md), [contracts checkpoint](contracts.md), [wallet HTTP](contracts/wallet-http.md), [integration gates](contracts/integration-gates.md), [recovery](contracts/payment-recovery.md), [UI flows](contracts/ui-flows.md), [validation matrix](validation-matrix.md), [quickstart](quickstart.md), [requirements checklist](checklists/requirements.md), [planning checklist](checklists/planning.md).

**Trạng thái (2026-10-17)**: T001..T041 và T044..T051 hoàn tất theo scope; P4/P5 chỉ preparation, chưa phải financial acceptance. [Validation](validation.md) ghi P5:22 test US3 độc lập,86 focused/382 regression tests và8 nhóm quan sát web tổng hợp. Normal status/Confirm và mọi Payment capability vẫn unavailable; Wallet/history/P4 behavior giữ nguyên. T042/T043/T052..T062 vẫn unchecked; QR-01/recovery policy và API thật/payOS/Android/iOS acceptance chưa đóng. Source create/query/posting hiện đã có theo replan checkpoint phía trên. Không sửa backend/dependency/shared parser, không stage/commit/push; branch/index được giữ. Chưa triển khai hoặc tick T053+ hay kiểm thử phối hợp T055.

## Quy ước và giới hạn thực thi

- Mọi đường dẫn trong task tính từ root monorepo; Spec Kit scripts chạy tại `apps/mobile`. Đường dẫn mới là dự kiến, không phải tuyên bố file/source đã tồn tại.
- Format: `- [ ] Tnnn [P?] [US?] mô tả — file cụ thể`. Phụ thuộc, điều kiện bắt đầu, kiểm chứng và lớp bằng chứng là một phần bắt buộc của task.
- **READY**: source contract/foundation đủ để bắt đầu sau phụ thuộc. **PREP**: chỉ UI/local model/test preparation; production payment unavailable. **BLOCKED**: chờ actual contract/QR-01/channel, không tự bỏ qua gate. **GATED**: chờ môi trường/thiết bị/test data; source merge không đóng acceptance.
- **[P]** chỉ cho task khác file, có thể chạy đồng thời với task độc lập khác khi các phụ thuộc của chính nó đã xong. Các task cùng file, kể cả khác story, phải serialize; không dùng thứ tự ID để ngầm cho phép sửa song song. Không có chỉ thị spawn agent.
- ID tuần tự theo thứ tự thực thi được người dùng ưu tiên: foundation → US1 (plan P2) → US4 (plan P3) → US2 (plan P4 prep) → US3 (plan P5 prep) → evidence (plan P6). Giữ priority gốc US1/2/3=P1, US4=P2 trong spec; thứ tự thực hiện US4 trước payment là chỉ dẫn ưu tiên mới của người dùng. `Phase` dưới đây là nhóm tasks, khác `P1..P6` của plan.
- Viết các test yêu cầu trước phần implementation tương ứng và quan sát đỏ rồi xanh. Với test bị chặn bởi contract/renderer, ghi BLOCKED và tiền điều kiện thay vì dựng fake implementation cho xanh.
- US2/3 không chứa task triển khai `api/payment-api.ts`, `schemas/payment-contracts.ts`, `hooks/use-create-payment.ts`, `hooks/use-payment-status.ts`, transport/live payment activation, encoder dependency hoặc backend code. T042/T043/T052/T058 chỉ review/ghi bằng chứng khi gate đủ; để tích hợp operational payment cần cập nhật plan/tasks và phạm vi riêng sau actual source.
- Backend là nơi duy nhất xác minh/post Credit. QR/providerStatus/redirect/clock/close không tạo kết quả; no cash-out/withdrawal/admin/refund execution/settlement tại client. Không gửi payment mới khi lần trước còn UNKNOWN_OUTCOME.
- L=pure model; C=HTTP fixture theo confirmed contract; W=browser/isolated UI; A=real owner API; G=approved payOS channel + owning backend posting proof; NA=Android; NI=iOS; DOC=document review. Mobile Payment hiện chỉ L/W preparation; actual BE contract nay đã có, nhưng Payment C adapters/tests và A/G chưa được thực hiện. NA/NI riêng, không thay bằng web/export/source check.

## Bằng chứng contract và gate dùng chung

| Capability / gap            | Nền tảng đã có                                                                                                                                                                    | Task được phép chuẩn bị / tích hợp                                                                                  | Điều kiện dừng                                                                                                                            |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| GAP-01 wallet               | Owner GET đã implement/wire tại `services/api/src/modules/credit/presentation/http/wallet.controller.ts:33`, `credit.module.ts:24`; absent wallet virtual zero                    | T012..T020, A tại T057                                                                                              | DTO/source drift, invalid projection, deployed migration/config chưa xác nhận không được claim A                                          |
| GAP-02 list/detail          | Controller:48/59; `wallet.dto.ts:18`; `list-credit-transactions.use-case.ts:19`; `prisma-wallet.repository.ts:54`; `ledger-cursor.ts:31`                                          | T021..T032; limit20 trong mobile max50, BE max100                                                                   | No status/date/search; no cursor decode/TTL, timestamp sort, mixed chain hoặc shared parser widening                                      |
| GAP-03 payOS                | Actual POST/list/detail + persisted QR projection: `services/api/src/modules/payments/presentation/http/payments.controller.ts:60–105`; [payment-http](contracts/payment-http.md) | T033..T041 remain historical PREP; T043 source review ready, unchecked; proposed I1/I4/I5 integration not generated | GAP-06 retention/mobile correlation, QR-01 and operational evidence; no automatic activation                                              |
| GAP-04 policy               | Same bounds/step/rate/TTL; create persists quote: `services/api/src/modules/payments/application/use-cases/create-payment.use-case.ts:35–79`                                      | Historical P4 estimate/review retained; new mapping uses returned confirmed quote                                   | No public quoteId/policyVersion/quote API; no client expiry/reset TTL                                                                     |
| GAP-05 outcome/posting      | Owner GET/version/REVIEW and signed atomic posting now implemented; [payment-http](contracts/payment-http.md)                                                                     | T044..T051 remain PREP; T052 source review ready, unchecked; I1/I2 proposed                                         | Mobile actual schema/observer/read integration and A/G evidence missing; source availability is not acceptance                            |
| GAP-06 idempotency/recovery | Durable owner/key/body same-ID replay + backend worker recovery; known-ID owner GET                                                                                               | T033..T035/T039/T051 preparation retained; future I3 decisions before real create                                   | No retention SLA/GET-by-key/approved durable client correlation. Lost-key/body/ID restart BLOCKED; no new key or auto-match               |
| GAP-07 reversal             | Supplied nullable reversal/ref/deltas từ ledger mapper `services/api/src/modules/credit/application/services/ledger-entry.mapper.ts:4`                                            | T022/T027/T029 supplied facts                                                                                       | Refund/partial/cash semantics và execution không suy ra từ enum                                                                           |
| GAP-08 related reference    | operation referenceType/referenceId từ mapper ở trên                                                                                                                              | T026/T029 plain safe fields                                                                                         | Destination ownership/existence và Held allocations chưa chứng minh; không real IDs→sample routes                                         |
| QR-01                       | `apps/mobile/package.json`: SVG renderer15.15.4, chưa encoder                                                                                                                     | T037 shell, T038 test specification, T042 blocked evidence                                                          | Vetted local encoder/version/license/SDK/native/web + independent decode + scan usability chưa đủ; không cài/viết encoder trong scope này |

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
  - **Bắt đầu / gate**: **SOURCE REVIEW READY; activation GATED**. BE mới đã cung cấp create/quote projection/query/posting và retained-key replay. Review actual DTO/source theo payment-http; GAP-06 retention/mobile lost-correlation và QR-01/channel còn mở. Task chỉ docs review, không thực hiện BE/mobile adapter; giữ unchecked cho đến invocation/review riêng đủ tiêu chí.
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
  - **Bắt đầu / gate**: **SOURCE REVIEW READY; recovery/activation GATED**. Owner query/DTO/numeric version/server QR suppression/REVIEW/atomic posting đã implement. Review source mới theo payment-http; GAP-06 retention/mobile restart còn thiếu. Chỉ docs review, không live adapter và không tự tick task từ replan.
  - **Kiểm chứng / hoàn thành**: Ghi actual identity validation/ownership/errors/status/version ordering/quote/QR readiness và no-creation/recovery semantics; manual check baseline; polling chỉ sau approved finite budget. Không đóng bởi pure providerStatus/signature model; cần replan/task approval riêng cho operational integration.
  - **Bằng chứng**: DOC. Task chỉ hoàn tất khi kết quả này đã quan sát; không dùng số task để thay acceptance.

## Phase 7 — Polish, checks và bằng chứng theo lớp (plan P6)

**Mục tiêu**: Kết quả có thể audit, source-read increment độc lập, payment/channel/native đúng gate.\
**Bắt đầu**: Chỉ capability có source và môi trường tương ứng; T053/T054/T056/T057 đọc thật không chờ Payment gate đóng.\
**Hoàn thành**: Evidence ghi expected/observed/pass/fail/blocked và safe path, không lấy fixture/source làm G/native. Không có câu lệnh triển khai hoặc test tài chính tự chạy bởi lệnh tasks.

- [ ] T053 Tạo tracked browser harness chỉ model và confirmed wallet-read fixture — `apps/mobile/scripts/wallet-browser-validation.mjs`.

  - **Phụ thuộc**: T011.
  - **Bắt đầu / gate**: **READY**. Có isolated preview/live-unavailable boundary và fixture source-backed; browser runtime/module cung cấp rõ, không auto-install. Harness có thể chuẩn bị trước story; chạy wallet scope sau T019, history scope sau T031, payment-model scope sau T041/T050, không ép scope này chờ scope khác.
  - **Kiểm chứng / hoàn thành**: CLI explicit --url/--mode/--scope/--contract/--browser-module/--output; mode model hoặc http-fixture và scope wallet, history hoặc payment-model được chọn rõ. App+fixture loopback only, egress fail, request/intent counters và artifacts an toàn; http-fixture chỉ wallet/history với --contract 4121c3f (wire unchanged từ17e3ac1), payment-model chỉ mode model. Harness core và wallet scope phải chạy được khi US4/US2/US3 chưa có; scenario chưa có UI hoặc sai cặp mode/scope phải fail/blocked rõ, không fake pass. Không implicit .env production config hoặc hardcoded browser module path.
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

| Story                             | Tasks      | Số task | Checkpoint được làm ngay sau foundation             | Phần chưa được claim                                                                 |
| --------------------------------- | ---------- | ------- | --------------------------------------------------- | ------------------------------------------------------------------------------------ |
| US1 P1                            | T012..T020 | 9       | Wallet/Home L/C và UI thật owner read; MVP          | A cần T057.wallet; NA/NI Wallet subsets của T059/T060                                |
| US4 P2, ưu tiên thực hiện thứ hai | T021..T032 | 12      | 200-entry list/detail/filters/snapshot L/C/W        | A cần T057.history; optional related destinations vẫn gated                          |
| US2 P1                            | T033..T043 | 11      | T033..T041 PREP L/W, single intent/unavailable live | T042 QR-01; T043 actual contract review + GAP-06/QR/channel; no financial activation |
| US3 P1                            | T044..T052 | 9       | T044..T051 PREP L/W, inject observation trực tiếp   | T052 actual DTO/version review; new live adapter/evidence pending                    |
| Setup/foundation                  | T001..T011 | 11      | Exact money/session/preview/Back                    | Không chứng minh real payment                                                        |
| Cross-cut/evidence                | T053..T062 | 10      | Browser/checks/read evidence theo prerequisite      | G/NA/NI không thay bằng fixture                                                      |

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

| SC     | Tasks cụ thể                                                          | Cases                           | Phép đo / giới hạn bằng chứng                                                                                                                                 |
| ------ | --------------------------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SC-001 | T004,T005,T012,T016,T018,T019,T020,T054,T057                          | V03,V04,V05,V27                 | 100% exact matches; L/C/W hiện chuẩn bị được, A cần approved reads; error/unavailable không zero.                                                             |
| SC-002 | T033,T036,T038,T041,T042,T055,T059,T060                               | V07,V12,V29                     | Đo <=60s valid input→review→explicit QR continuation trừ external waits; prep timing chỉ proxy, full blocked QR-01/mobile integration/recovery/scan workflow. |
| SC-003 | T044,T045,T046,T048,T049,T050,T052,T055,T058                          | V14,V15,V16,V17,V18,V28         | Zero false paid/local credit, bảy states incl REVIEW;49 task preparation cũ chỉ chứng minh sáu states, cần I1/I2/new tasks; không thay API/G verification.    |
| SC-004 | T033,T034,T035,T039,T041,T051,T043,T058                               | V08,V09,V10,V11,V12,V13,V25,V28 | Tách intent/dispatch/backend posting counts; 0 unintended duplicate; server posting source đã có; deployed posting/mobile restart evidence còn gated.         |
| SC-005 | T021,T024,T025,T026,T028,T029,T031,T032,T054,T057                     | V19,V20,V21,V22,V23,V27         | 200+ records, page20, once per ID/server sequence, type/ref filters và detail exact; real cursor proof A riêng.                                               |
| SC-006 | T006,T007,T008,T009,T019,T026,T030,T046,T049,T050,T054,T057,T059,T060 | V01,V02,V04,V15,V26,V27         | 0 cross-owner/sample/denied-cache leak; L/C/W + real owner404 + native/session cases riêng.                                                                   |
| SC-007 | T038,T042,T054,T055,T059,T060,T061                                    | V24,V29,V30                     | 4 journeys/320px có W/NA/NI records riêng; native/full QR chưa chạy phải pending/blocked.                                                                     |

## Truy vết đủ 30 ca: tiền điều kiện, task tạo kiểm thử và acceptance

Đây là kế hoạch kiểm chứng, không là kết quả đã chạy. Mỗi acceptance row sau này phải ghi case/layer, SHA+contract, môi trường/dataset an toàn, steps/command, expected/observed, pass/fail/blocked, evidence path. Test tổng hợp phải bám expected cases gốc, không chỉ assert implementation internals.

| Case | Tiền điều kiện / dữ liệu                                                   | Task logic/contract/test preparation | Task chạy/ghi acceptance | Kết quả mong đợi / gate                                                                                                               |
| ---- | -------------------------------------------------------------------------- | ------------------------------------ | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| V01  | A/B, promises resolve/reject sau logout→B                                  | T006,T008,T019,T031,T035,T046,T050   | T054,T057,T059,T060      | A old projection/toast/navigation/replay/expiry không ảnh hưởng B; L/C read + L payment, A/NA/NI gated.                               |
| V02  | Cached detail→403/404→network error                                        | T006,T009,T012,T026,T031,T046,T050   | T054,T057                | Evict projection, không resurrect từ stale list/cache; Payment C/A mobile integration/evidence pending T052/new tasks.                |
| V03  | 0.00/.01/12.34/9007199254740993.01, invalid precision/deltas               | T004,T005,T012,T013,T022,T031        | T054                     | Exact strings/units/no Number hoặc /100; L/C/W.                                                                                       |
| V04  | Unavailable/hydrating/loading/error/authorized no-wallet Z                 | T006,T009,T011,T012,T015,T017,T019   | T054,T057                | Home unavailable ngay foundation, chỉ successful absent-wallet zero/version0; không bonus/init/fake zero; A prerequisite T057.wallet. |
| V05  | Home/Wallet shared read, stale/error/overlap                               | T015,T016,T018,T019                  | T054,T057                | Một projection coherent; refresh chỉ read, stale rõ; L/C/W/A.                                                                         |
| V06  | Offline/reconnect read + unknown intent                                    | T006,T009,T019,T035,T046             | T054,T055,T059,T060      | Gate block interaction, active read recovery, không creation replay/clear unknown; native riêng.                                      |
| V07  | 1000/2000000 valid;999/1001/2001000 + invalid VND/quote changed            | T004,T033,T034,T036,T041             | T055                     | Preserve draft/re-review, no rounding/no live create; L/W prep, payment C mobile integration pending T043/new tasks.                  |
| V08  | Same-tick confirms + remount second caller                                 | T033,T034,T035,T041                  | T055,T059,T060           | One sync claim/model dispatch, no new keys; L/W+native prep, real count awaits G T058.                                                |
| V09  | Timeout/disconnect/abort/malformed2xx sau model dispatch, lost ID          | T033,T034,T039,T041,T051             | T055,T058                | Unknown frozen intent, no fresh submit; L/W prep, C/A/G blocked actual recovery.                                                      |
| V10  | 401 rồi renewal thành công ở shared HTTP seam                              | T039,T041                            | T055                     | Explicit replayAfterRenewal:false, retry:false không thay thế nhau; L seam trước, actual Payment C blocked.                           |
| V11  | Proven-no-create vs409/5xx/429 ambiguous                                   | T033,T034,T039,T041                  | T055,T058                | Chỉ accepted no-create cho sửa/review; không generic status→new-key; C/A integration/evidence gated T043/new tasks, contract đã có.   |
| V12  | Known model ID, QR preparing/ready/error/close; synthetic exact payload    | T033,T037,T038,T041,T044             | T042,T055,T058,T059,T060 | ID/status access còn, no new create; shell L/W sẵn, independent decode/usable QR blocked QR-01.                                       |
| V13  | Active/unknown→Back/remount/background/resume/process kill                 | T033,T035,T041,T046,T051             | T055,T058,T059,T060      | Remount giữ lock, no auto create; durable recovery C/G/native blocked GAP-06.                                                         |
| V14  | Forged state/providerStatus/QR close/repeated legacy link                  | T044,T045,T049,T050                  | T055,T058,T059,T060      | Zero false result/balance/TOP_UP; model L/W sẵn, C/G awaits mobile actual-contract integration/approved channel.                      |
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
        |         +-- T043 -----x activation: GAP-06 / QR / operational evidence
        +-- US3 T044..T051 ------> independent observation preparation
                  +-- T052 -----x integration review: actual DTO/version + recovery policy

T011 -> T053 harness core (independent scenario scopes)
US1 T019 -> T054.wallet + T056.wallet -> T057.wallet (approved A environment)
US4 T031 -> T054.history + T056.history -> T057.history (approved A environment)
US2 T041 + US3 T050 + T053 -> T055 combined model web evidence (no financial proof)
T042+T043+T052+new integration tasks+GAP-06+scope revision+T055/T056 -> T058 G evidence (GATED)
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

| Gate / chủ sở hữu quyết định                 | Cần cung cấp                                                                                                     | Mobile giữ ở trạng thái nào                                                                              |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Actual Payment contract / owning BE + mobile | Source now available in payment-http; review DTO/null/version/REVIEW and implement under new tasks               | Payment flags remain off; T043/T052 unchecked                                                            |
| GAP-06 / BE + product recovery policy        | Retention/replay horizon, lost-correlation support, mobile persistence/security/logout/relogin policy            | Retained same-key/body semantics known, but UNKNOWN_OUTCOME cannot be bypassed or replayed automatically |
| GAP-05 / BE financial owner                  | Source atomic posting is implemented; approved deployment/channel duplicate/late/crash/rollback evidence remains | Owner read integration can proceed independently; no QR/providerStatus or fixture-as-merchant success    |
| QR-01 / mobile dependency review             | Vetted encoder/license/version/SDK/native-web, independent exact decode, dense/layout/quiet zone evidence        | Shell/model/test prep; không dependency install hoặc encoder implementation ở đây                        |
| Supported scan workflow / product + QA       | Cách thanh toán QR hợp lệ, cả giới hạn same-device; không implicit save/share/scanner/bank link                  | Không hứa flow chưa hỗ trợ; full SC-002/G chưa đạt                                                       |
| Read deployment / owning BE + QA             | Matching SHA, migration/config ready và A/B/Z/absent-wallet/200 safe entries                                     | L/C/W đủ source test, A blocked nếu thiếu environment; không apply migration từ mobile                   |
| Provider/channel / authorized owner          | Approved test/channel credentials và BE proof, không đoán sandbox host/production transfer                       | G blocked; rendered QR/model không close gate                                                            |
| Android / iOS / QA                           | Device/dev client/environment cho từng nền tảng, evidence riêng                                                  | NA và NI pending độc lập, Windows/web/export không thay iOS                                              |
| Optional related navigation / feature owner  | Real destination/identity/permission, held allocation API nếu mở scope sau                                       | Display raw supplied context, không sample deep link/Held drill-down                                     |
| Optional automatic checks / API + product    | Nếu đề xuất sau: exact cadence/budget/backoff/rate limits và freshness semantics                                 | Manual model check baseline, không SSE/timed polling/client expiry                                       |

## Kiểm tra chất lượng task list

- 62 checklist task, IDs T001..T062; Setup/foundation11, US1=9, US4=12, US2=11, US3=9, cross-cut10.49 task T001..T041/T044..T051 đã tick theo tiêu chí; P4/P5 chỉ preparation.13 task T042/T043/T052..T062 còn unchecked.
- Tất cả có đường dẫn file cụ thể, phụ thuộc/entry/verify/evidence. File thực tế và helper tách nhỏ của P1..P5 được ghi trong validation; paths phase sau vẫn là change map. Đủ25 FR,7 SC,30 case rows; tick increment không thay acceptance đầy đủ của các hàng này.
- 15 task có [P] sau khi điều kiện của chúng đáp ứng; ví dụ theo story ở trên. Các task bị chặn không được đổi thành READY vì model tests xanh.
- T042 QR-01 BLOCKED; T043/T052 SOURCE REVIEW READY nhưng unchecked; T058 GAP-06/QR/channel GATED; T057/T059/T060 environment GATED. T033..T041/T044..T051 PREP. Các READY source tasks vẫn cần invocation triển khai sau.
- Hook check tại mobile Spec Kit root: `.specify/extensions.yml` không tồn tại ở lần sinh này, không before/after_tasks hook để chạy.
- Remediation I1/I2/C1/I3: giữ62 IDs; Wallet/History có checkpoints W/checks/A/native độc lập, T050 bỏ phụ thuộc US2, Home unavailable thuộc T011 và quickstart chỉ chạy file đã được tạo ở giai đoạn tương ứng. Dependency/checkpoint của T012+ giữ nguyên sau P1.
- Kết quả P1/P2/P3 ở validation; P3 bổ sung V19..V23 và History/detail subset V01/V02/V03/V24/V26/V29. Không tick task cross-capability/phase sau hoặc đóng toàn V/FR/SC từ subset này. A/G/NA/NI và T053+ vẫn NOT_RUN; format/link/index checks không thay financial acceptance.
- `.specify/extensions.yml` vẫn không tồn tại khi kết thúc P5 preparation, nên không có after_implement hook. T038 chỉ hoàn tất specification/model tests; QR-01 renderer/decoder vẫn BLOCKED. T044..T051 độc lập với US2 intent; memory-remount không là restart recovery. T042/T043/T052..T062 chưa thực hiện, không skipped-as-PASS.

## Integration task extension — hiện hành sau backend Payment replan

**Baseline**:4121c3f / BE081b3d2 (merge f80ef7a), so với17e3ac1. Các path dưới tính từ monorepo root. T063..T100 là **38 task mới, toàn bộ unchecked/NOT_RUN**. T001..T062 và49 completed task blocks được giữ nguyên; các giới hạn “chưa có API/không có live adapter task” trong phần lịch sử chỉ áp dụng62 task gốc, không phủ định actual contract hoặc extension này.

**Quy tắc mới**: Các task READY vẫn cần invocation triển khai riêng; đây chỉ là cập nhật tài liệu. No backend/API/provider calls, source/dependency/config edits hoặc Payment activation trong invocation hiện tại. P1..P5 xanh không tự chứng minh REVIEW/version/new wire; test-first tiếp tục bắt buộc. Mỗi task dẫn FR/SC/V và evidence layer; conditional tasks không tự đóng vì đã ghi câu hỏi.

**Phạm vi activation tương lai**: T078 chỉ là gate cho owner GET/status read, chờ approved A read environment; không cấp quyền quote/create/recovery. T079..T088 create/recovery BLOCKED GAP-06; T089..T093 renderer/decoder GATED QR-01. Normal real Confirm và mutation flags vẫn off; operational financial activation không nằm trong hành động của lệnh tasks hoặc biên bản readiness. Không chọn phương án store/encoder hoặc payload mới thay quyết định chưa có.

## Phase 8 — Payment integration foundation (I1, T063..T066)

**Mục tiêu**: Actual DTO/schema và observation reducer tách model preparation; không endpoint mutation, activation hoặc encoder.\
**Bắt đầu / stop**: P1..P5 đã ghi evidence; source payment-http được review; tất cả task mới unchecked.\
**Independent test / done**: Schema/observation tests synthetic chạy không HTTP thật, US2 intent hoặc QR renderer. Checkpoint chỉ L/C/model.

- [x] T063 Viết contract tests và fixture HTTP tổng hợp theo Payment DTO thực tế — `apps/mobile/tests/wallet-payment-contract.test.ts`, `apps/mobile/tests/fixtures/payment-api.ts`.

  - **Phụ thuộc**: T011, T051. **Gói plan**: I1.
  - **Bắt đầu / gate**: READY — source contract tại4121c3f đã có; đọc payment-http, không gọi API/provider. Test trước schema, loopback127.0.0.1 và fake credentials.
  - **Kiểm chứng / hoàn thành**: Khóa flat success/error/list envelopes; UUID/target,7states+unknown, exact VND/Credit, numeric rate/version, ISO/null dates, checkout null/descriptor; malformed/missing fields bị từ chối. Fixture không thêm owner/scope/payment/quoteId/policyVersion/as-of. Chứng kiến đỏ vì parser chưa có; không tạo fake parser để xanh. Giữ QR synthetic, log/counter không chứa payload riêng tư.
  - **Bằng chứng / truy vết**: C/DOC. FR-001/004/006/011/021/024/025; SC-003/006; V01/V02/V03/V07/V12/V14/V15/V18/V26.

- [x] T064 Tạo schema và kiểu Payment wire riêng với model preparation — `apps/mobile/src/features/wallet/schemas/payment-contracts.ts`, `apps/mobile/src/features/wallet/types/payment.ts`.

  - **Phụ thuộc**: T063. **Gói plan**: I1.
  - **Bắt đầu / gate**: READY sau contract tests; chỉ parse/map, không HTTP hoặc capability activation.
  - **Kiểm chứng / hoàn thành**: Trích ràng buộc data-model: “Actual flat fields: id, gateway, status, paymentAmountVnd, currency, creditAmount, conversionRateVndPerCredit, createdAt, expiresAt, paidAt, version, checkout.” Và “DTO has no response owner, nested scope/payment, policyVersion, quoteId, as-of or review reason.” UUID; exact positive integer VND/two-decimal Credit; safe positive integer rate/version; required nullable ISO expiresAt/paidAt và checkout; non-null checkout chỉ hợp lệ với status PENDING, không dùng client clock để tái quyết định server expiry. Non-null descriptor có providerStatus:PENDING, paymentLinkId string, orderCode digit string, raw qrCode giữ nguyên. REVIEW và neutral unknown; gateway lạ chỉ read-only. T063 parser cases xanh; không dùng local quote/scope như wire DTO.
  - **Bằng chứng / truy vết**: L/C. FR-001/004/006/011/021/024/025; SC-003/006; V01/V03/V07/V12/V14/V15/V18/V26.

- [x] T065 Viết tests cho observation có version và QR suppression — `apps/mobile/tests/wallet-payment-observation.test.ts`.

  - **Phụ thuộc**: T064. **Gói plan**: I1.
  - **Bắt đầu / gate**: READY; live-observation model tách injected preparation cũ và không import intent US2.
  - **Kiểm chứng / hoàn thành**: Đỏ trước reducer: first read từ ID/session không có draft/expected amount; wrongID/scope/immutable quote; higher/lower/equal version, reverse tickets, equal-version QR→null rồi stale QR, newer EXPIRED→PAID, REVIEW/unknown. Quy tắc: “Request ticket/scope checks precede version comparison.” PAID không thay đổi bởi refresh/QR/providerStatus; không dùng enum rank/client clock.
  - **Bằng chứng / truy vết**: L. FR-001/009/010/011/012/021; SC-003/006; V01/V02/V12/V14/V15/V17/V18/V22.

- [x] T066 Tạo live observation reducer và bổ sung REVIEW mà giữ preparation seam — `apps/mobile/src/features/wallet/utils/payment-observation.ts`, `apps/mobile/src/features/wallet/utils/payment-outcome.ts`, `apps/mobile/src/features/wallet/types/payment.ts`.

  - **Phụ thuộc**: T065. **Gói plan**: I1.
  - **Bắt đầu / gate**: READY; serialize type/outcome edits sau T064. No reader/create/QR encoder.
  - **Kiểm chứng / hoàn thành**: Trích data-model: “Numeric version orders same-payment persisted observations; higher accepted, lower ignored, equal conflicts stale.” “Immutable ID/amount/Credit/rate/currency conflicts never authorize replacement creation.” “Accept checkout:null suppression without changing status; retain a per-session/payment no-restore guard against late equal/lower QR.” Chỉ newer valid projection thay guard; không countdown, so version giữa payment/wallet, suy ra terminal rank hoặc yêu cầu US2 quote. REVIEW copy trung lập, không reviewReason tự chế. T065 và preparation regressions xanh, normal flags vẫn off.
  - **Bằng chứng / truy vết**: L. FR-001/004/009/010/011/012/021/024; SC-003/006; V01/V02/V12/V14/V15/V17/V18/V22/V26.

## Phase 9 — US3: owner Payment reads và independent refresh (I2, spec priority P1)

**Mục tiêu**: Known-ID manual status đọc đúng owner,7states/version/QR-null và PAID-dependent reads; optional discovery tách ledger.\
**Bắt đầu / stop**: I1 và test-first ở mỗi phần; known-ID scope không chờ US2, GAP-06, QR-01, T076 hoặc merchant test.\
**Independent test / done**: C/W dùng ID+session trực tiếp, GET counters/no POST, owner/session races, stale/denied, version và refresh từng phần. Read activation T078 chờ approved A environment; actual A tại T095.

- [x] T067 [US3] Viết owner GET, query-key và lifecycle contract tests trước adapter/hook — `apps/mobile/tests/wallet-payment-read.test.ts`, `apps/mobile/tests/fixtures/payment-api.ts`.

  - **Phụ thuộc**: T066. **Gói plan**: I2.
  - **Bắt đầu / gate**: READY; dùng actual GET contract và fixture T063; status phải khởi tạo được không có US2 intent/draft/amount.
  - **Kiểm chứng / hoàn thành**: Đỏ cho shared authenticated GET /payments/:id, UUID validation/response ID match, captured owner/generation, forwarded signal, coalesced manual read, stale/error/404-denial rồi late/network response, A→B/logout, blur/background. Không gọi create/webhook/provider, không dựa route state/amount/providerStatus hoặc expectation quote cũ; no-POST counter bắt buộc.
  - **Bằng chứng / truy vết**: L/C. FR-001/004/009/010/011/012/023/024/025; SC-003/006; V01/V02/V06/V14/V15/V17/V18/V26.

- [x] T068 [US3] Tích hợp owner Payment detail GET qua shared HTTP — `apps/mobile/src/features/wallet/api/payment-api.ts`.

  - **Phụ thuộc**: T067, T064. **Gói plan**: I2.
  - **Bắt đầu / gate**: READY; chỉ GET/detail và parse actual envelope, không POST/schema phỏng đoán.
  - **Kiểm chứng / hoàn thành**: GET owner đúng UUID; không owner query/body; chuẩn hóa scoped errors bằng shared parser, forward AbortSignal nguyên vẹn. Validate ID/schema trước publish; capture owner/session ở caller, không giả owner trong response. Source có thể đọc khi provider creation disabled. Invalid/denied không trở thành unpaid, zero hoặc fixture. Detail adapter subset T067 xanh; các observer/key assertions còn đỏ phải ghi đúng, không claim toàn file xanh sớm.
  - **Bằng chứng / truy vết**: C. FR-001/004/009/010/011/021/025; SC-003/006; V01/V02/V03/V14/V15/V18/V27.

- [x] T069 [US3] Tạo Payment query identity tách Wallet/ledger — `apps/mobile/src/features/wallet/utils/payment-query-keys.ts`.

  - **Phụ thuộc**: T067. **Gói plan**: I2.
  - **Bắt đầu / gate**: READY; dùng scope P1 và test file T067; không sửa shared parser/transaction keys.
  - **Kiểm chứng / hoàn thành**: Trích data-model: “Query identity includes feature, owner/generation, resource and applicable filters/chain/ID.” Detail theo scope+UUID; list theo scope+status+local chain. Không cho key UI/provider/amount thay owner identity; session/new chain không tái dùng old cache. Các key assertions T067 xanh, không mark full observer coverage cho đến T070.
  - **Bằng chứng / truy vết**: L. FR-001/004/009/012/024; SC-006; V01/V02/V15/V18/V20/V25.

- [x] T070 [US3] Nối observer lifecycle và known-ID status hook độc lập US2 — `apps/mobile/src/features/wallet/utils/payment-observer.ts`, `apps/mobile/src/features/wallet/hooks/use-payment-status.ts`.

  - **Phụ thuộc**: T066, T068, T069. **Gói plan**: I2.
  - **Bắt đầu / gate**: READY; không dependency T079..T093, intent coordinator, create API hoặc QR renderer; reader mặc định unavailable khi capability off.
  - **Kiểm chứng / hoàn thành**: Validate request UUID/current scope, lấy quote từ authorized response đầu tiên, dùng live reducer T066. Coalesce Check again, ticket trước/ sau await, forward signal, cleanup blur/background/logout/session switch, denial eviction không resurrect cache kể cả cancellation reversion. Reconnect/foreground chỉ active GET theo connection handling; không tự tạo polling/SSE hoặc replay mutation. T067 full và T065 xanh; US3 tests chạy riêng không import US2 intent.
  - **Bằng chứng / truy vết**: L/C. FR-001/004/009/010/011/012/023/024/025; SC-003/006; V01/V02/V06/V13/V14/V15/V17/V18/V25/V26.

- [x] T071 [P] [US3] Viết tests bind PAID với independent Wallet/History reads — `apps/mobile/tests/wallet-payment-read-refresh.test.ts`.

  - **Phụ thuộc**: T070, T019, T031. **Gói plan**: I2.
  - **Bắt đầu / gate**: READY; test trước binding; hai owner-read đã implement, fixture synthetic hoặc injected authoritative reads, không create.
  - **Kiểm chứng / hoàn thành**: PAID với Wallet fail/History success, ngược lại, cả hai fail, stale refresh và session change/late response. Refresh đang chạy được coalesce theo identity, phiên mới không dùng cache cũ; retry chỉ GET. Backend PAID nguyên vẹn, không local amount increment/TOP_UP, không walletVersion so với paymentVersion hoặc cộng lịch sử để tính wallet. L/C counters tách payment read với dependent reads.
  - **Bằng chứng / truy vết**: L/C. FR-001/003/004/010/013/021; SC-001/003/006; V01/V02/V05/V06/V16/V18.

- [x] T072 [P] [US3] Nối refresh coordinator với owner-read hooks/cache hiện có — `apps/mobile/src/features/wallet/hooks/use-payment-read-refresh.ts`, `apps/mobile/src/features/wallet/utils/payment-refresh.ts`.

  - **Phụ thuộc**: T071, T070. **Gói plan**: I2.
  - **Bắt đầu / gate**: READY; giữ P2/P3 GET contracts, Home projection và full-chain refresh semantics; serialize nếu helper hiện có đang được sửa.
  - **Kiểm chứng / hoàn thành**: Mỗi kết quả Payment/Wallet/History giữ trạng thái riêng. Refresh theo cùng scope, signal và identity; only accepted PAID observations trigger related reads, repeated checks không thành uncontrolled read storm. Cả hai refresh lỗi vẫn PAID; retry chỉ đọc lại phần cần thiết và thể hiện stale/unavailable. Không sửa ledger entries/amount, synthesize TOP_UP hoặc reset existing query identity. T071 xanh và Wallet/History regression không drift.
  - **Bằng chứng / truy vết**: L/C. FR-001/003/004/010/013/021/023; SC-001/003/006; V01/V02/V05/V06/V16/V18.

- [x] T073 [P] [US3] Viết Payment list/cursor tests tách ledger history — `apps/mobile/tests/wallet-payments-list.test.ts`.

  - **Phụ thuộc**: T070. **Gói plan**: I2.
  - **Bắt đầu / gate**: READY cho actual list contract; file riêng, fixture controls từ T063 không sửa đồng thời với writer T067.
  - **Kiểm chứng / hoàn thành**: Đỏ trước list implementation: mỗi page20; chỉ status/cursor/limit; stable orderCode-desc order, opaque owner/status cursor, filter/refresh reset, append exclusion, mutable status membership, dedupe/loadmore/later-page error/invalid cursor/session races. Nhiều orders cùng amount và Payment legacy không checkout: list absence không chứng minh no-creation, không match amount/time. Không type/referenceType/date/search hoặc widening parsermax50.
  - **Bằng chứng / truy vết**: L/C. FR-001/004/009/011/012/020/024/025; SC-005/006; V01/V02/V18/V20/V23/V25/V27.

- [x] T074 [P] [US3] Tích hợp owner Payment list adapter và scoped chain hook — `apps/mobile/src/features/wallet/api/payment-api.ts`, `apps/mobile/src/features/wallet/hooks/use-payments.ts`.

  - **Phụ thuộc**: T073, T068, T069. **Gói plan**: I2.
  - **Bắt đầu / gate**: READY; source GET list đã có, chưa tạo route/feed mới. Serialize mọi writer payment-api.ts với T068/T083.
  - **Kiểm chứng / hoàn thành**: T073 xanh; explicit20 mọi page trong sharedmax50, status filter riêng, signed cursor opaque và giữ server order. Refresh/status đổi bắt đầu chain mới, late continuation không nhập chain khác; later-page error giữ đúng snapshot hiển thị. Cursor invalid có restart, denial evicts mọi owned list chain. Status watermark không khóa membership; list chỉ discovery, không ledger reconstruction/auto-correlation.
  - **Bằng chứng / truy vết**: L/C. FR-001/004/009/011/012/020/024/025; SC-005/006; V01/V02/V18/V20/V23/V25/V27.

- [x] T075 [US3] Nối status panel/view và public boundary bằng read-only capability seam — `apps/mobile/src/features/wallet/components/payment-status-panel.tsx`, `apps/mobile/src/features/wallet/views/payment-status-screen.tsx`, `apps/mobile/src/features/wallet/views/payment-screen.tsx`, `apps/mobile/src/features/wallet/index.ts`, `apps/mobile/src/features/wallet/screens.tsx`, `apps/mobile/src/features/wallet/preview/status.tsx`, `apps/mobile/tests/wallet-payment-status-ui.test.ts`.

  - **Phụ thuộc**: T070, T072. **Gói plan**: I2.
  - **Bắt đầu / gate**: READY sau independent observer/refresh; viết behavior tests trước UI tương ứng. Không cần T074/T076, US2 draft, QR encoder hoặc GAP-06 quyết định.
  - **Kiểm chứng / hoàn thành**: Đủ loading/unavailable/CREATED/PENDING/PAID/FAILED/EXPIRED/REFUNDED/REVIEW/unknown/error/denied/stale, Check again/Back, dependent-refresh errors tách status. Validate UUID trong feature; URL amount/state/providerStatus không authority. Giữ6 route mỏng, accessibility320/large text và preparation labels/preview no-egress. Khi flag off normal screens unavailable; controlled read-only fixture host tách preview model khỏi real cache. Thêm REVIEW không đổi nghĩa fixture cũ, QR shell không giả scannable. UI behavioral tests và US3 regression xanh.
  - **Bằng chứng / truy vết**: L/C/W. FR-001/004/009/010/011/012/013/014/020/023/024/025; SC-003/006/007; V01/V02/V12/V14/V15/V16/V17/V18/V22/V24/V26/V29/V30.

- [ ] T076 [US3] Chuẩn bị discovery panel tối thiểu với lựa chọn ID tường minh nếu được chốt phạm vi — `apps/mobile/src/features/wallet/components/payment-discovery.tsx`, `apps/mobile/src/features/wallet/views/payment-status-screen.tsx`, `apps/mobile/tests/wallet-payment-discovery.test.ts`.

  - **Phụ thuộc**: T074, T075. **Gói plan**: I2.
  - **Bắt đầu / gate**: GATED — Product xác nhận minimal owner discovery trong existing status screen; không thêm route hoặc unified payment/ledger feed. Không chọn scope thì giữ NOT_SELECTED/unchecked, không chặn known-ID T077/T078.
  - **Kiểm chứng / hoàn thành**: Test behavior trước UI: chỉ click tìm payment mới gọi owner list; explicit select→owner detail GET, no amount/time/status auto-match, no list absence→new-create. Chỉ status filter source-backed và20/page, page errors/retry/empty/Back/accessibility, no unauthorized reference navigation. Không mượn ledger type/referenceType cursor; invalid route ID không tự GET detail. Test/fixture W không phải mất-ID recovery thật.
  - **Bằng chứng / truy vết**: L/C/W. FR-001/004/009/020/023/024/025; SC-005/006/007; V01/V02/V15/V18/V23/V24/V25/V26/V27/V29.

- [x] T077 [US3] Ghi checkpoint độc lập cho actual-contract owner status và refresh — `apps/mobile/specs/006-wallet-payment-history/validation.md`, `apps/mobile/specs/006-wallet-payment-history/quickstart.md`.

  - **Phụ thuộc**: T075, T070, T072. **Gói plan**: I2.
  - **Bắt đầu / gate**: READY khi source tương ứng đã tồn tại. T074/T076 optional, T079..T093/create/QR/harness T053 không phải prerequisite cho known-ID scope.
  - **Kiểm chứng / hoàn thành**: Chạy actual schema/observation/read/read-refresh/UI tests + foundation/Wallet/History/P4/P5 regression, mobile lint/check-types/check-structure. W kiểm7states/version/QR-null, coalescing, account switch/denial/PAID refresh failure và thin-route/Back tại320/375/430; controlled read-only fixture, zero POST/provider/remote QR. T077 chỉ sở hữu status L/C/W+checks; optional discovery phải đạt task/checkpoint riêng, không chặn hoặc được pass nhờ T077. Hoàn tất khi full status subset qua trên cùng revision; A/G/NA/NI vẫn NOT_RUN. Không tick T053+/T052 từ record này.
  - **Bằng chứng / truy vết**: L/C/W/DOC. FR-001/003/004/009/010/011/012/013/014/021/023/024/025; SC-001/003/006/007; V01/V02/V03/V05/V06/V12/V14/V15/V16/V17/V18/V22/V24/V26/V29/V30.

- [ ] T078 [US3] Chốt gate nối owner status thật độc lập với các capability mutation — `apps/mobile/src/features/wallet/context/WalletProvider.tsx`, `apps/mobile/src/features/wallet/context/wallet-runtime.ts`, `apps/mobile/src/features/wallet/types/wallet.ts`, `apps/mobile/tests/wallet-payment-read.test.ts`, `apps/mobile/specs/006-wallet-payment-history/contracts/integration-gates.md`, `apps/mobile/specs/006-wallet-payment-history/validation.md`.

  - **Phụ thuộc**: T077. **Gói plan**: I2.
  - **Bắt đầu / gate**: GATED: approved A read environment — matching deployed BE/migration/auth, known owner/other-owner UUIDs và latest C/W/source checks. Chỉ thực hiện trong invocation triển khai read-only sau này; task generation không sửa flag.
  - **Kiểm chứng / hoàn thành**: Nếu đủ gate, nối riêng owner-status read capability qua shared runtime; list capability chỉ nếu T074/T076 và scope discovery đủ điều kiện. Quote/create/recovery/Confirm thật vẫn off, no implicit global payment=true. Khi môi trường/capability chưa xác nhận vẫn unavailable, ghi BLOCKED thay hardcode ready. Check owner reads ngay cả provider creation disabled; code không phụ thuộc US2/QR/GAP-06, không tự thêm SSE/polling. Sau thay đổi runtime chạy lại affected checks/C/W, actual A outcome ghi T095; bật read flag không có nghĩa financial/native acceptance.
  - **Bằng chứng / truy vết**: C/W/DOC; A tại T095. FR-001/004/009/011/012/024/025; SC-003/006; V01/V02/V14/V15/V17/V18/V26/V27.

## Phase 10 — US2: quyết định recovery/correlation trước create (I3)

**Mục tiêu**: Chốt D1 operational retention/lost-correlation; D2 native-first financial SecureStore/logout đã duyệt, chưa implement store.\
**Bắt đầu / stop**: GAP-06 PARTIAL; thiếu quyết định thì BLOCKED. Owner status I2 vẫn tiếp tục độc lập.\
**Independent test / done**: Biên bản source-backed/testable policy, không tự bịa lookup/horizon hoặc coi memory remount là restart recovery.

- [ ] T079 [US2] Hoàn tất xác nhận BE còn thiếu cho retention/replay và mất correlation — `apps/mobile/specs/006-wallet-payment-history/contracts/payment-recovery.md`, `apps/mobile/specs/006-wallet-payment-history/contracts/integration-gates.md`, `apps/mobile/specs/006-wallet-payment-history/contracts/completion-proposal.md`.

  - **Phụ thuộc**: T063, T051. **Gói plan**: I3.
  - **Bắt đầu / gate**: BLOCKED D1/GAP-06. Đã có source-backed foundation spec005 R-07 no automatic TTL và replay khi mapping còn; không yêu cầu người dùng chọn lại D2/D3/D4. Task chỉ DOC, không gửi tin cho BE owner, sửa BE hoặc dựng API.
  - **Kiểm chứng / hoàn thành**: Ghi owner/date/source/decision xác nhận deployment tuân thủ no automatic TTL, exceptions/manual prune/restore/channel và các điều kiện cho phép same-key/body replay; không bắt buộc bịa một số giờ/ngày hay coi no-TTL là bảo đảm vĩnh viễn. Xác định xử lý provider disabled/401/revoked identity và khi mất key/body/ID/toàn bộ record; cần authoritative operator/backend oracle cho phép tạo mới. Không GET-by-key hiện có, list/manual selection/amount-time không chứng minh no-creation. Phân biệt HTTP mapping với permanent posting identity; webhook dedupe sau xóa mapping không chứng minh POST replay sau prune. Thiếu cam kết hoặc oracle còn BLOCKED; không tick vì đã chuẩn bị phiếu.
  - **Bằng chứng / truy vết**: DOC. FR-001/008/009/025; SC-004/006; V09/V10/V11/V13/V25.

- [ ] T080 [US2] Hoàn thiện contract correlation theo D2 native-first đã duyệt, giữ phần phụ thuộc D1 — `apps/mobile/specs/006-wallet-payment-history/contracts/payment-recovery.md`, `apps/mobile/specs/006-wallet-payment-history/data-model.md`, `apps/mobile/specs/006-wallet-payment-history/plan.md`, `apps/mobile/specs/006-wallet-payment-history/contracts/completion-proposal.md`.

  - **Phụ thuộc**: T079. **Gói plan**: I3.
  - **Bắt đầu / gate**: D2 DESIGN_APPROVED; có thể chuẩn bị DOC subset T080.design ngay, nhưng full T080 BLOCKED cho đến T079. Đã chọn SecureStore tài chính riêng; không hỏi lại storage/native-first/logout và không chọn store mới. Subset không tick parent hoặc mở T081.
  - **Kiểm chứng / hoàn thành**: Đồng bộ minimal formatVersion/environment/owner/key/canonical two-field body/local intent/dispatch marker/optional payment UUID; session generation RAM-only. Chốt separate financial namespace/service dùng SecureStore hiện có, WHEN_UNLOCKED_THIS_DEVICE_ONLY, single native JS writer + synchronous claim; write/read-back marker DISPATCH_MAY_HAVE_OCCURRED trước POST nhưng không gọi là atomic storage+network/CAS/fsync. Encrypted unresolved record giữ qua logout, reauthenticate đúng A mới đọc; clear RAM/cache/draft/QR ngay, B không enumerate/đọc A, late responses không ghi record. No QR/provider payload/balance/history/credential storage, no auth-token-store reuse. Native-first: web store phải unavailable cho create, không memory/plaintext fallback; web reads/status/preview vẫn hoạt động. Budget<2KiB là thiết kế, không API/SLA; corruption/read failure blocks create, undetectable total loss không thể tự phân biệt fresh install. T079 phải chốt điều kiện replay/cleanup/resolved deletion/total-loss oracle, không tự TTL. Map measurable kill-before/after dispatch, failed ID write, A→B→A và uninstall/lost-device limits. Chỉ tick full task khi T079 và toàn contract đủ, không từ design approval.
  - **Bằng chứng / truy vết**: DOC. FR-001/008/009/021/024/025; SC-004/006; V01/V09/V10/V11/V13/V25/V26.

## Phase 11 — US2: create/replay integration sau GAP-06 (I4, spec priority P1)

**Mục tiêu**: Durable claim/key/body, explicit POST và review/result UI theo actual contract, backend giữ quyền verify/posting.\
**Bắt đầu / stop**: T079/T080 phải hoàn tất trước tests/store/create; future modules/platform adapters là proposed targets sau approved design, không installed dependency trong lệnh tasks.\
**Independent test / done**: C/W prove exact body/key, sync claim/retained-ID replay/current projection,401 opt-out/timeout/409/503/provenance và durable boundary simulation. Normal financial Confirm vẫn off; A/G/native ở I6.

- [ ] T081 [US2] Viết create/replay và durable-correlation boundary tests theo policy đã chốt — `apps/mobile/tests/wallet-payment-create.test.ts`, `apps/mobile/tests/wallet-payment-durable-recovery.test.ts`, `apps/mobile/tests/fixtures/payment-api.ts`.

  - **Phụ thuộc**: T080, T064, T070. **Gói plan**: I4.
  - **Bắt đầu / gate**: BLOCKED GAP-06 cho đến T079/T080 hoàn tất; test trước POST/store/coordinator. Serialization fixture với T063/T067, không sửa live backend.
  - **Kiểm chứng / hoàn thành**: Đỏ cho exact2-field body/PAYOS, visible ASCII key1..128, immutable owner/key/body trước await,201/200 same-ID current projection, changed body409, malformed/lost/abort/timeout after commit, provider-disabled503 before replay và named provenance409. replayAfterRenewal:false + retry:false, same-tick/remount multi-caller; replay rõ ràng cùng key/body chỉ trong horizon đã chốt. Durability tests mô phỏng write/claim/crash/loss/logout A/B theo approved boundary; incomplete/lost store blocks dispatch, không new-key/amount matching. Fixture chỉ actual API shapes và synthetic local policy record, không invent server retention/lookup.
  - **Bằng chứng / truy vết**: L/C. FR-001/005/006/007/008/009/010/021/024/025; SC-002/003/004/006; V01/V03/V07/V08/V09/V10/V11/V12/V13/V15/V25/V26.

- [ ] T082 [US2] Tạo native financial SecureStore boundary và web-create unavailable theo D2/D1 — `apps/mobile/src/features/wallet/utils/payment-recovery-record.ts`, `apps/mobile/src/features/wallet/storage/payment-correlation-store.ts`, `apps/mobile/src/features/wallet/storage/payment-correlation-store.native.ts`, `apps/mobile/src/features/wallet/storage/payment-correlation-store.web.ts`.

  - **Phụ thuộc**: T081, T080. **Gói plan**: I4.
  - **Bắt đầu / gate**: BLOCKED D1/GAP-06 dù D2 store choice đã được duyệt; chỉ implementation sau full T079/T080 và red T081. Dùng SecureStore đã cài/plugin hiện có, không thêm storage dependency hoặc sửa auth-token store.
  - **Kiểm chứng / hoàn thành**: Validate/freeze minimal record theo T080, cryptographically random stable key theo runtime hiện có và captured owner/environment. Single-writer claim trước await; durable write/read-back conservative dispatch marker trước network, storage read/write/corrupt/loss errors block create. Không hứa transaction/CAS/fsync/power-loss. Failed ID write sau valid response giữ known-ID RAM/read path, không biến Payment failed hoặc POST mới. Retain encrypted unresolved A correlation qua logout theo D2/D1, clear private runtime/QR/cache và ngăn B truy cập; reauth A mới resume known-ID GET. Web implementation trả create unavailable, không memory/localStorage/plaintext dispatch. Cleanup theo policy T079, không local TTL; không tự replay hoặc persist raw QR/provider/credential/balance/history. T081 storage cases xanh; simulated boundary khác actual device kill/restart.
  - **Bằng chứng / truy vết**: L/C; native tại T098/T099. FR-001/008/009/021/024/025; SC-004/006; V01/V09/V10/V11/V13/V25/V26.

- [ ] T083 [US2] Thêm explicit create/same-intent replay qua shared HTTP adapter — `apps/mobile/src/features/wallet/api/payment-api.ts`.

  - **Phụ thuộc**: T081, T068. **Gói plan**: I4.
  - **Bắt đầu / gate**: BLOCKED GAP-06 — phải có T079/T080 accepted policy; serialize với list adapter T074 nếu được triển khai. Không gọi gateway trực tiếp.
  - **Kiểm chứng / hoàn thành**: POST /payments đúng body và Idempotency-Key từ frozen intent, shared authenticated client, AbortSignal, replayAfterRenewal:false, no mutation retry. Parse201/200 current Payment projection không bắt buộc PENDING/QR, không reset quote TTL. GET detail vẫn independent; không auto replay403/401/timeout/reconnect/foreground. Generic409/429/5xx/protocol/503 không proof earlier no-create; plain English message không tự thành uppercase code. T081 adapter subset và existing transport/session tests xanh.
  - **Bằng chứng / truy vết**: C. FR-001/006/007/008/009/010/021/025; SC-003/004/006; V01/V03/V07/V08/V09/V10/V11/V12/V15/V25.

- [ ] T084 [US2] Nối immutable intent với durable claim/key và known-ID recovery — `apps/mobile/src/features/wallet/utils/payment-intent.ts`, `apps/mobile/src/features/wallet/utils/payment-intent-result.ts`, `apps/mobile/src/features/wallet/context/payment-preparation.ts`, `apps/mobile/src/features/wallet/context/WalletProvider.tsx`.

  - **Phụ thuộc**: T082, T083, T066. **Gói plan**: I4.
  - **Bắt đầu / gate**: BLOCKED GAP-06; owner reads T070 đã có. Serialize runtime edits với T078. Chưa bật Confirm/create flags.
  - **Kiểm chứng / hoàn thành**: Trích data-model: “Intent must retain reviewed immutable body, stable idempotency key, scope, dispatch/outcome and optional confirmed ID.” “No new key/body on reconnect, foreground, auth renewal or unproven failure.” Một synchronous claim nhiều caller/remount trước await, durable record trước dispatch; known-ID đọc lại, unknown không new intent. Explicit approved replay cùng body/key, current returned state/ID/quote được validate; no-create proven chỉ cho sửa khi không còn prior unknown. Session cleanup/old response guards giữ nguyên, không replay create khi relogin/reconnect. Tests T081 core green; local model-intent-N không trở thành HTTP key.
  - **Bằng chứng / truy vết**: L/C. FR-001/007/008/009/010/021/024/025; SC-003/004/006; V01/V08/V09/V10/V11/V12/V13/V15/V25/V26.

- [ ] T085 [US2] Nối review/create-result và QA host riêng theo workflow hai thiết bị đã duyệt — `apps/mobile/src/features/wallet/components/topup-form.tsx`, `apps/mobile/src/features/wallet/utils/topup-policy.ts`, `apps/mobile/src/features/wallet/views/topup-screen.tsx`, `apps/mobile/src/features/wallet/views/payment-screen.tsx`, `apps/mobile/src/features/wallet/qa/payment-qa-host.tsx`, `apps/mobile/tests/wallet-payment-create-ui.test.ts`, `apps/mobile/tests/wallet-payment-qa-host.test.ts`, `apps/mobile/specs/006-wallet-payment-history/quickstart.md`.

  - **Phụ thuộc**: T084, T075. **Gói plan**: I4.
  - **Bắt đầu / gate**: BLOCKED D1/GAP-06; D4 QA-host/entry scope đã duyệt, không hỏi lại. Viết UI/QA-host tests trước source tương ứng. No dependency encoder bắt buộc; QR shell/null vẫn phải hoạt động. Normal Payment/Confirm defaults off; QA binding không phải quyền chạy tiền thật.
  - **Kiểm chứng / hoàn thành**: Review integer VND1000..2000000/step1000, estimate1000VND/Credit khác server quote sau POST; no invented quoteId/policyVersion/expiry. CREATED/PENDING/PAID/REVIEW/null QR giữ same ID; quote conflict read/review cùng ID, no recreate; draft/Back/error/provenance và UNKNOWN lock rõ. Native-first true creation chỉ qua approved QA-build host dùng shared authenticated client/runtime được inject đúng owner/environment, explicit actions và approved build/env scope; không auth secret trong UI/config. Production hoặc preview host phải fail closed/no financial egress, không public route mới hay sửa main entry/production flags. QA-host tests dùng inert boundaries, chứng minh wrong owner/environment/build/preview không dispatch, same-intent replay chỉ theo D1; không gọi real API/provider trong tests. Labeled preview vẫn cache riêng/zero financial egress; synthetic data không sang account. Quickstart ghi file/binding owner và điều kiện actual QA build/entry/invocation; không bịa command/build đã có. Nếu binding không thực thi được thì ghi BLOCKED phần QA/full T085, không tick parent từ UI subset hoặc dùng normal disabled Confirm để pass T096/native financial. Existing status độc lập create/QR; không yêu cầu T091/T093 để test UI shell.
  - **Bằng chứng / truy vết**: L/C/W; DOC cho planned QA binding, không A/G. FR-005/006/007/008/009/010/014/021/023/024/025; SC-002/003/004/006/007; V07/V08/V09/V10/V11/V12/V13/V15/V24/V25/V26/V29/V30.

- [ ] T086 [US2] Ghi create integration checkpoint bằng actual-contract fixtures — `apps/mobile/specs/006-wallet-payment-history/validation.md`, `apps/mobile/specs/006-wallet-payment-history/quickstart.md`.

  - **Phụ thuộc**: T085, T081. **Gói plan**: I4.
  - **Bắt đầu / gate**: BLOCKED GAP-06; chỉ L/C/W với synthetic loopback và shared transport, không real money/payOS request.
  - **Kiểm chứng / hoàn thành**: Chạy create/schema/observation/read/durable-boundary/UI và affected P1..P5 regression, mobile lint/types/structure. W đo taps/remount/request/key counters, review estimate vs confirmed fields, UNKNOWN lock, provenance/config/body-conflict copy, Back và identity continuity. Normal production Confirm/create flags vẫn off; fixture host không real egress/cache. Ghi partials chính xác: QR shell không encode/decode, process-boundary simulations không device restart, C/W không A/G. Task hoàn tất khi full integration subset được yêu cầu đã qua, không tick T042/T043/T052/T053+/financial FR vì subset.
  - **Bằng chứng / truy vết**: L/C/W/DOC. FR-001/005/006/007/008/009/010/014/021/023/024/025; SC-002/003/004/006/007; V01/V03/V07/V08/V09/V10/V11/V12/V13/V15/V24/V25/V26/V29/V30.

- [ ] T087 [US2] Kiểm chứng recovery boundary qua interruption và reauth theo approved policy — `apps/mobile/tests/wallet-payment-durable-recovery.test.ts`, `apps/mobile/specs/006-wallet-payment-history/contracts/payment-recovery.md`, `apps/mobile/specs/006-wallet-payment-history/validation.md`.

  - **Phụ thuộc**: T082, T084, T086. **Gói plan**: I4.
  - **Bắt đầu / gate**: BLOCKED GAP-06; chỉ thực thi cases/horizon/correlation đã được T079/T080 xác nhận, không guessed lookup. Test red bổ sung trước sửa behavior nếu cần.
  - **Kiểm chứng / hoàn thành**: Bao phủ write-before-dispatch, abort/commit-before-response, known-ID/lost-ID còn key/body, mất toàn bộ record, corrupted/expired-retention record, A logout→B→A, no automatic replay và no fresh key. Counter logical intent khác HTTP replay khác backend posting. T081 simulations chạy lại độc lập; khi chưa có actual process kill/relogin/API evidence ghi BLOCKED ở lớp đó, không gọi memory remount hoặc test giả lập là restart recovery PASS. No full SC-004 hoặc durable acceptance chỉ từ unit/storage tests.
  - **Bằng chứng / truy vết**: L/C/DOC; A/G/NA/NI riêng. FR-001/008/009/010/024/025; SC-004/006; V01/V06/V09/V10/V11/V13/V25/V26.

- [ ] T088 [US2] Chốt create readiness và activation stop gate — `apps/mobile/specs/006-wallet-payment-history/contracts/integration-gates.md`, `apps/mobile/specs/006-wallet-payment-history/contracts/payment-recovery.md`, `apps/mobile/specs/006-wallet-payment-history/validation.md`.

  - **Phụ thuộc**: T086, T087. **Gói plan**: I4.
  - **Bắt đầu / gate**: GATED GAP-06/QR-01/environment — task này ghi gate, không bật Payment hoặc real Confirm. Không xem documentation decision là actual durable/native evidence.
  - **Kiểm chứng / hoàn thành**: Đối chiếu actual quote/create/query/posting với client implementation, approved retention/store và các recovery tests; ghi nguồn/revision, source+C/W đã chứng minh và từng gate A/G/QR/native còn mở. Task chỉ hoàn tất biên bản DOC khi đầy đủ mục/stop conditions, không phải closure của activation: create vẫn off. Full financial readiness phải chờ T093/T096/T097/applicable T098/T099 và toàn prerequisite T042/T043/T052/T058 cũ. Known-ID T078 không chờ task này. Không tick các gate khác, tự bật Confirm hoặc lấy C/W thay durable/native evidence.
  - **Bằng chứng / truy vết**: DOC; tổng hợp A/G/NA/NI. FR-007/008/009/010/022/024/025; SC-002/003/004/006/007; V08/V09/V10/V11/V12/V13/V14/V25/V27/V28/V29/V30.

## Phase 12 — US2: local QR renderer và independent decoding (I5)

**Mục tiêu**: Đúng raw payload bytes và supported scan behavior; no remote QR/browser/provider API từ mobile.\
**Bắt đầu / stop**: T089 READY DOC với D3/D4 đã duyệt → T090 red tests → T091 scoped install/import/renderer → T092 decoder provenance → T093 actual W pixels. Không dependency T079/T080/create/live binding; user approval không thay security/import/native/channel proof.\
**Independent test / done**: Decode actual pixels independently, Unicode/dense/layout/version/owner/render-error/no-egress. W subset không đóng full QR-01/native/channel hoặc T042.

- [x] T089 [US2] Ghi review QR tooling/workflow đã duyệt và phân bổ kiểm chứng đúng giai đoạn — `apps/mobile/specs/006-wallet-payment-history/contracts/qr-validation.md`, `apps/mobile/specs/006-wallet-payment-history/plan.md`, `apps/mobile/specs/006-wallet-payment-history/contracts/completion-proposal.md`, `apps/mobile/specs/006-wallet-payment-history/quickstart.md`.

  - **Phụ thuộc**: T064, T038. **Gói plan**: I5.
  - **Bắt đầu / gate**: READY DOC: prerequisites đã hoàn tất; D3 tools/dependency scope và D4 two-device workflow đã duyệt. Không chờ T079/T080/create/QA live binding/payOS hoặc chọn lại encoder. Lệnh tasks hiện tại không thực hiện review/install/task này.
  - **Kiểm chứng / hoàn thành**: Ghi source/date/user approval qrcode@1.5.4 MIT runtime matrix + existing react-native-svg15.15.4; jsqr@1.4.0 Apache-2.0 và pngjs@7.0.0 MIT dev-only, @types/qrcode@1.5.6 MIT khi cần cho adapter. Review primary pinned metadata/license/maintenance/import entry/known limitations; không security-clearance từ README, exact resolved graph/advisory/import checks bắt buộc T091 trước sử dụng. qrcode có transitives, core là internal entry/TextEncoder/ECI risk, không blanket SDK57/native/web certification; ghi approved test strategy/stop rule thay giả runtime PASS ở DOC. Raw UTF-8/no normalization, reject ill-formed UTF-16, EC-M/auto-fit/black-white/no logo/quiet zone>=4/integer module geometry; parser BE1..4096 characters không bảo đảm capacity, overflow giữ ID. Workflow hai thiết bị/QA entry, không same-device save/share/scanner/deep-link/hosted flow. Ghi QR-D1/D2 design review, planned actual bytes/pixels ở T090..T093 và native/channel ở T097..T099. Full T089 chỉ khi review/provenance/risks/test plan đủ; không tick ở task generation hoặc đóng T042/QR-01 từ approval. Nếu primary metadata/license không khớp thì dừng phần affected, không tự đổi package.
  - **Bằng chứng / truy vết**: DOC. FR-007/009/010/023/024/025; SC-002/003/007; V12/V14/V24/V26/V28/V29.

- [x] T090 [US2] Viết QR renderer/decoder tests đỏ trước implementation, độc lập create/recovery — `apps/mobile/tests/wallet-qr-renderer.test.ts`, `apps/mobile/tests/fixtures/wallet-qr-payloads.ts`.

  - **Phụ thuộc**: T089, T066. **Gói plan**: I5.
  - **Bắt đầu / gate**: READY_AFTER_T089; T066 hoàn tất. Synthetic known-ID owner projection, không intent/store/create/financial API/real QR. Tooling chọn rồi nhưng chưa installed; missing implementation/import có thể là observed red, không tạo fake parser/encoder để xanh.
  - **Kiểm chứng / hoàn thành**: Viết test oracle độc lập bằng jsqr cho generated fixture pixels; raw ASCII/spaces/CRLF/Vietnamese/combining/Euro/emoji, invalid UTF-16/dense/over-capacity giữ ID, quiet zone/integer geometry/no normalize. Lower/equal-version QR-null latch, late QR và owner/session replacement; render failure/retry/close/status/Back no new create/status mutation/egress/log/storage. Encoder matrix/path rasterization trong L chỉ chứng minh encoder/geometry; actual mounted app pixels phải chụp/decode ở T092/T093, Android/iOS ở T098/T099. Không gọi pure raster là rendered-app evidence hoặc coi native/channel/unavailable assertions là skipped PASS. Record đỏ và producer/expected evidence của từng assertion; task test-first không cần các assertion native/W đã xanh để mở T091.
  - **Bằng chứng / truy vết**: L/C synthetic test specification; rendered W/NA/NI chưa chạy. FR-001/007/009/010/021/023/024/025; SC-002/003/006/007; V01/V03/V12/V14/V18/V24/V26/V29.

- [x] T091 [US2] Cài đúng tooling đã duyệt và tạo local QR encoder adapter/renderer — `apps/mobile/src/features/wallet/utils/payment-qr-encoder.ts`, `apps/mobile/src/features/wallet/components/payment-qr.tsx`, `apps/mobile/src/features/wallet/components/payment-qr-canvas.tsx`, `apps/mobile/src/features/wallet/utils/payment-qr-model.ts`, `apps/mobile/src/features/wallet/types/qrcode-core.d.ts`, `apps/mobile/src/features/wallet/preview/qr-host.ts`, `apps/mobile/src/features/wallet/preview/qr.tsx`, `apps/mobile/src/features/wallet/preview/preparation.tsx`, `apps/mobile/src/features/wallet/preview/screens.tsx`, `apps/mobile/src/features/wallet/preview/navigation.ts`, `apps/mobile/tests/wallet-qr-renderer.test.ts`, `apps/mobile/package.json`, `pnpm-lock.yaml`.

  - **Phụ thuộc**: T090, T089. **Gói plan**: I5.
  - **Bắt đầu / gate**: READY_AFTER_T090 red và full T089 DOC. Scope D3 đã duyệt cho lượt implementation được yêu cầu sau; không hỏi lại một approval install riêng cho cùng package/lockfile scope. Không cài gì trong lệnh tasks này; không chờ D1/create/merchant/native environment.
  - **Kiểm chứng / hoàn thành**: Pin qrcode1.5.4 runtime; jsqr1.4.0/pngjs7.0.0 dev/test only; optional @types/qrcode1.5.6 nếu cần, existing SVG15.15.4/Expo57/RN0.86.3/React19.2.3 không nâng. Install từ root pnpm workspace, chỉ mobile package/root lockfile expected resolution; kiểm release integrity/licenses/advisories/resolved graph trước sử dụng, không chạy automatic audit fix. Đánh giá ảnh hưởng consumers nếu root graph đổi; unexpected shared/tooling/runtime change thì dừng affected scope, không tự rộng phạm vi. Adapter bọc reviewed qrcode matrix entry, không handwritten encoder/remote QR service; Smoke web runtime/import/TextEncoder và Metro Android/iOS dependency graph/bundle trong source checkpoint; không silent polyfill/node-only deps trong app. Thiếu required source/web/Metro smoke thì T091 BLOCKED; không bắt device, live account/channel hoặc Hermes device execution trước synthetic W. Hermes/native runtime/device proof vẫn NOT_RUN tại T098/T099, không suy ra từ Metro build/export. UTF-8 raw/no trim/normalize/CRC rewrite, invalid UTF-16 reject, EC-M/auto-fit/quiet zone>=4/integer modules/contrast/no logo; capacity failure giữ ID/status/retry/Back. Chuỗi4096 ký tự BE chấp nhận vẫn có thể không fit; không truncate/new Payment. T090 runnable L cases xanh và dependency graph dev-only decoder không vào runtime bundle; W actual pixels ở T093, native/channel evidence riêng. Null/suppressed/old-owner QR không render lại; no financial capability/Confirm switch, no egress/payload logs.
  - **Bằng chứng / truy vết**: L/renderer fixture/import/build evidence theo runtime; W tại T093, native acceptance riêng. FR-001/007/009/010/023/024/025; SC-002/003/006/007; V01/V12/V14/V18/V24/V26/V29.

- [x] T092 [US2] Hoàn tất independent pixel-decode harness và provenance/no-egress assertions — `apps/mobile/tests/wallet-qr-renderer.test.ts`, `apps/mobile/scripts/wallet-qr-validation.mjs`, `apps/mobile/specs/006-wallet-payment-history/contracts/qr-validation.md`, `apps/mobile/specs/006-wallet-payment-history/quickstart.md`.

  - **Phụ thuộc**: T091, T090. **Gói plan**: I5.
  - **Bắt đầu / gate**: READY_AFTER_T091; chỉ synthetic decoder harness, không US2 create/D1/live QA binding/G. Nếu source/web/Metro import prerequisite T091 còn thiếu phải ghi rõ, không bypass task-level deps bằng một subset; actual native/Hermes device evidence vẫn tách T098/T099.
  - **Kiểm chứng / hoàn thành**: Dùng jsqr1.4.0 decode RGBA, pngjs7.0.0 đọc screenshot PNG; compare binaryData với UTF-8 input và decoded string. CLI/harness nhận actual output path + synthetic expected fixture ID, không nhận/log live QR hoặc gọi encoder để dựng expected pixels thay screenshot. Ghi producer/runtime/build/revision/dimensions/density, phân loại L matrix-raster riêng với W/NA/NI screenshot thực tế. Chụp mounted app SVG ở T093 rồi chạy decoder trên pixels đó, không so model field với chính nó; missing input/decoder/case fail rõ, không skip=PASS. Bao phủ quiet-zone/bytes/capacity và owner/version/QR-null/failure/no-egress trong tests; log riêng rows chưa có pixel/native/channel evidence. Không thay thế T053 harness hoặc tick T042 từ L subset.
  - **Bằng chứng / truy vết**: L/renderer fixture/DOC; actual W pixels tại T093. FR-001/007/009/010/023/024/025; SC-002/003/006/007; V01/V12/V14/V18/V24/V26/V29.

- [x] T093 [US2] Ghi actual rendered-QR web checkpoint độc lập và giữ native/channel gates — `apps/mobile/specs/006-wallet-payment-history/contracts/qr-validation.md`, `apps/mobile/specs/006-wallet-payment-history/validation.md`, `apps/mobile/specs/006-wallet-payment-history/quickstart.md`.

  - **Phụ thuộc**: T092. **Gói plan**: I5.
  - **Bắt đầu / gate**: READY_AFTER_T092; W synthetic known-ID projection/controlled reader, không real payment/client/intent/store hoặc D1. Không dùng approved QA financial host để gọi API trong preview; isolated preview chỉ dùng inert fixture.
  - **Kiểm chứng / hoàn thành**: Tại320/375/430 và large text: chụp mounted app SVG actual screenshot, chạy T092 pngjs→RGBA→jsqr, compare raw bytes/string, quiet zone/integer geometry, readable exact amounts/state/actions/Back. Render retry/close/error/capacity không tạo payment; version/QR-null không revive, A→B/denial cleanup và no-egress/log/cache leakage. Ghi command/producer/build/revision/expected/observed từng QR-D/R/U row. Không có browser/capture/fixture thì BLOCKED W, không thay bằng export/Node raster hoặc tick parent từ subset. D4 two-device workflow được duyệt nhưng bank-scan chưa thử: G tại T097, Android/iOS T098/T099, T042 còn full prerequisite. W source completion không đóng full QR-01/financial acceptance.
  - **Bằng chứng / truy vết**: Renderer fixture/W/DOC. FR-001/007/009/010/023/024/025; SC-002/003/006/007; V01/V12/V14/V18/V24/V26/V28/V29.

## Phase 13 — Integration checks, real API, channel và platforms (I6)

**Mục tiêu**: Bằng chứng có scope/revision/prerequisite; giữ nguyên độc lập Wallet/Home, History/detail và owner status.\
**Bắt đầu / stop**: Các task GATED chỉ khi đúng environment. Không tự migrate/seed/write BE, đọc credentials hoặc gọi financial API từ task-generation.\
**Independent test / done**: Source/L/C/W/A/G/NA/NI record riêng; named subsets không làm task cross-scope PASS. Old prerequisites không được bỏ qua.

- [ ] T094 Chạy source checks và regression theo integration scope/revision — `apps/mobile/specs/006-wallet-payment-history/quickstart.md`, `apps/mobile/specs/006-wallet-payment-history/validation.md`.

  - **Phụ thuộc**: T077. **Gói plan**: I6.
  - **Bắt đầu / gate**: READY theo named scope, không yêu cầu create/QR để chạy status. T094.status sau T077; T094.discovery sau T074/T076 nếu scope chọn; T094.create sau T086/T087; T094.qr sau T093.
  - **Kiểm chứng / hoàn thành**: Dùng hoặc chạy focused tests chỉ file đã tồn tại theo scope, foundation/Wallet/History/P4/P5 và affected HTTP/auth/connection regression, mobile lint/check-types/check-structure; export nếu có chỉ build proof. Có thể dẫn lại observed checks cùng revision/scope, chỉ rerun khi source/dependency/runtime change hoặc failure/concern mới; kết quả cũ không nghiệm thu revision mới. Ghi pass/fail/blocked riêng; không tick toàn T094 từ status subset khi create/QR còn thiếu. T056 cũ có yêu cầu riêng, không tự tick từ record này.
  - **Bằng chứng / truy vết**: L/C/renderer fixture/W/DOC. US1..4; FR-001..025; SC-001..007; V01..V30 theo scope.

- [ ] T095 Nghiệm thu A cho known-ID owner status và optional discovery GET — `apps/mobile/specs/006-wallet-payment-history/validation.md`, `apps/mobile/specs/006-wallet-payment-history/contracts/integration-gates.md`.

  - **Phụ thuộc**: T078. **Gói plan**: I6.
  - **Bắt đầu / gate**: GATED A environment — matching source/migrations/config, approved safe A/B owner UUIDs, một known-ID PAID cùng Wallet/History snapshots do BE cung cấp, và T094.status valid ở latest revision. Dùng payment đã có; không yêu cầu mobile create/GAP-06/QR. Discovery cần T074/T076/T094.discovery nếu scope đã được chọn.
  - **Kiểm chứng / hoàn thành**: A.status: actual DTO/exact units, wrong-owner404/denial eviction, provider creation disabled vẫn GET được, ID-only bootstrap và current version/manual check. Với known-ID PAID, quan sát GET /me/wallet và GET /me/wallet/transactions qua shared owner reads; Home/Wallet cùng hiển thị đúng snapshot Wallet backend, History cập nhật theo response/chain hiện hành. So với dữ liệu backend cung cấp, không tự cộng Credit, dựng TOP_UP hoặc suy ra balance từ Payment/history. Ghi request counters, accepted payment identity/version và kết quả từng dependent read. Chỉ dùng trạng thái backend-owner có sẵn hoặc proof/controlled changes được BE cung cấp, không mobile viết ledger/webhook/mark-paid. A.discovery riêng nếu chọn:20/status/cursor/order/owner-bound/filter reset và mutable membership; no absence→no-create. V16/A.refresh-success bắt buộc cho phần PAID refresh; thiếu PAID/snapshot/data thì ghi BLOCKED cho phần đó. V16/A.refresh-fault chỉ có bằng chứng A khi BE cung cấp lỗi có kiểm soát: PAID giữ nguyên, Wallet/History freshness/error riêng và retry chỉ GET. Nếu chỉ fixture/interception/injected failure thì ghi C/W, A.fault BLOCKED/NOT_RUN; không pass toàn V16/A hoặc parent task từ subset. Record A vs fixture, no G claim; thiếu data/state không giả lập rồi báo A PASS. T095.status có thể nghiệm thu độc lập, toàn task chỉ khi toàn selected scope đủ.
  - **Bằng chứng / truy vết**: A/DOC. US3 và US1/4 refresh; FR-001/003/004/009/010/011/012/013/014/020/021/023/024/025; SC-001/003/005/006; V01/V02/V03/V05/V06/V14/V15/V16/V17/V18/V22/V23/V24/V25/V27.

- [ ] T096 Nghiệm thu actual API create/replay/recovery trong môi trường được phép — `apps/mobile/specs/006-wallet-payment-history/quickstart.md`, `apps/mobile/specs/006-wallet-payment-history/validation.md`, `apps/mobile/specs/006-wallet-payment-history/contracts/payment-recovery.md`.

  - **Phụ thuộc**: T086, T087, T079, T080. **Gói plan**: I6.
  - **Bắt đầu / gate**: GATED A/G operational scope — approved safe backend-owned environment/channel/provider mode, matching deployment/provenance/migrations và T094.create current; runbook mục 6.1 quickstart phải đầy đủ và được duyệt trước bất kỳ call tài chính. Không tự POST payment từ documentation. Không phụ thuộc T088 readiness closure để tránh cycle; test không tự bật normal Confirm.
  - **Kiểm chứng / hoàn thành**: Mobile/QA sở hữu và hoàn tất runbook mục 6.1 quickstart: build/source, actual existing QA entry/invocation, owner/session auth, approved environment/channel/dataset, allowed actions, counters/evidence và stop conditions; BE cung cấp readiness/dữ liệu/channel, không secrets trong docs. Chỉ khi có binding thực thi được mới chạy exact body/key:201/200 same ID với newer current status,409 changed-body, named provenance/config failures, commit-before-response interruption và known/lost-ID theo accepted horizon. D4/T085 đã duyệt phạm vi QA host/entry: kiểm producer T085 và actual build/entry/invocation trong runbook, không hỏi lại approval thiết kế. Nếu binding chưa implement/thực thi được thì BLOCKED phần chạy; sửa source chỉ trong scope implementation T085 được yêu cầu, không tự code/bật production Confirm từ task nghiệm thu. Môi trường đã được người dùng xác nhận có; kiểm actual binding/deployment/channel/data/quyền thử thay vì coi môi trường chưa tồn tại. Chỉ thực hiện financial operations trong explicitly approved QA run; nếu provider thật thì cần channel authorization/readiness như T097, không giả định sandbox host. Counter intent/HTTP replay/backend posting riêng; không amount/time matching/newkey trên uncertainty. A khi API thật nhưng provider stubbed phải ghi rõ, không G; memory/simulated crash không chứng minh native process recovery. T043/T052 full criteria vẫn giữ nguyên.
  - **Bằng chứng / truy vết**: A; G chỉ khi approved và được chứng minh. US2/3; FR-001/005/006/007/008/009/010/014/021/024/025; SC-002/003/004/006; V01/V03/V07/V08/V09/V10/V11/V12/V13/V15/V25/V27/V28.

- [ ] T097 Thu thập payOS channel và backend-owned atomic posting evidence — `apps/mobile/specs/006-wallet-payment-history/validation.md`, `apps/mobile/specs/006-wallet-payment-history/contracts/qr-validation.md`, `apps/mobile/specs/006-wallet-payment-history/contracts/integration-gates.md`.

  - **Phụ thuộc**: T096, T093. **Gói plan**: I6.
  - **Bắt đầu / gate**: GATED G — approved channel/merchant test mode/credentials owned by BE, locally decoded renderer và approved supported scan workflow, GAP-06 policy resolved, T094.create/T094.qr current và runbook T096/mục 6.1 quickstart được duyệt cho channel scope. Không chọn provider host/production-money test hoặc tự invoke webhook.
  - **Kiểm chứng / hoàn thành**: Verified payment outcome theo owner GET, one TOP_UP/lot/walletVersion/PAID/audit/event và duplicate/out-of-order/late/mismatch/crash/rollback evidence từ owning BE. QR decode, PAID screen hoặc BE mocked-provider116-case report không thay channel proof. Test scope phải được cho phép riêng, giữ known ID/recovery, no local credit/settlement. Nếu chỉ backend/channel proof hoặc controlled QA flow thì ghi đúng phạm vi, không full mobile/native release. T058 và T042 cũ chỉ đóng sau toàn original prerequisites/evidence, không được bypass vì T097 có subset G.
  - **Bằng chứng / truy vết**: G/DOC. US2/3 và US1/4 reads; FR-007/008/009/010/011/013/014/021/022/024/025; SC-001/002/003/004/006/007; V08/V09/V10/V11/V12/V13/V14/V16/V18/V22/V25/V27/V28/V29/V30.

- [ ] T098 Nghiệm thu Android theo status/QR/create-recovery checkpoints riêng — `apps/mobile/specs/006-wallet-payment-history/validation.md`, `apps/mobile/specs/006-wallet-payment-history/contracts/qr-validation.md`, `apps/mobile/specs/006-wallet-payment-history/contracts/payment-recovery.md`.

  - **Phụ thuộc**: T077. **Gói plan**: I6.
  - **Bắt đầu / gate**: GATED NA device — T098.status sau T078/T094.status với approved API hoặc fixture layer được nêu rõ; T098.qr sau T093/T094.qr; T098.financial sau T096/T097 và binding Android thực thi được trong runbook T096/mục 6.1 quickstart; thiếu entry/build/invocation đã duyệt thì financial BLOCKED. Không tự bật capability ngoài scope. Không chờ QR/create để chạy status subset.
  - **Kiểm chứng / hoàn thành**: Device/build/source/runtime cụ thể; Back, screen reader/large text/keyboard320width, offline/reconnect, blur/background/session replacement/manual check và stale/version cases. QR: actual renderer independent decode/scan, no hidden/old-owner QR; financial: actual app kill/relaunch/reauth A/B, known/lost-ID/horizon theo policy, no duplicate create; record native fixture vs real A/G. Unavailable normal Confirm chỉ chứng minh disabled behavior, không financial/native top-up PASS. Subset status/QR không tick toàn T098 hoặc T059; phần blocked có prerequisite rõ, no memory-remount-as-kill.
  - **Bằng chứng / truy vết**: NA; L/C/A/G phân lớp. US1..4; FR-001..025 theo journey; SC-001..007; V01/V02/V03/V05/V06/V08/V09/V10/V12/V13/V14/V15/V16/V17/V18/V19/V20/V21/V22/V23/V24/V25/V26/V27/V28/V29/V30.

- [ ] T099 Nghiệm thu iOS theo status/QR/create-recovery checkpoints riêng — `apps/mobile/specs/006-wallet-payment-history/validation.md`, `apps/mobile/specs/006-wallet-payment-history/contracts/qr-validation.md`, `apps/mobile/specs/006-wallet-payment-history/contracts/payment-recovery.md`.

  - **Phụ thuộc**: T077. **Gói plan**: I6.
  - **Bắt đầu / gate**: GATED NI device — T099.status sau T078/T094.status; T099.qr sau T093/T094.qr; T099.financial sau T096/T097 và binding iOS thực thi được trong runbook T096/mục 6.1 quickstart; thiếu entry/build/invocation đã duyệt thì financial BLOCKED. Cần device/simulator/dev client iOS thật phù hợp; Windows/web/export không thay NI. Không dependency Android T098.
  - **Kiểm chứng / hoàn thành**: Chạy same owner/status/version/QR-null/refresh/denial/Back/accessibility/background/account-switch cases trên iOS, actual decode/scan và process kill/relaunch/reauth financial theo approved policy khi có scope. Ghi fixture/native/API/channel tách biệt. Known-ID status subset độc lập US2; không giả financial acceptance khi normal Confirm disabled, không remote/paid simulator mặc định. NI thiếu thì BLOCKED/NOT_RUN; không tick toàn T099/T060 hoặc SC-007 từ một subset hay kết quả Android.
  - **Bằng chứng / truy vết**: NI; L/C/A/G phân lớp. US1..4; FR-001..025 theo journey; SC-001..007; V01/V02/V03/V05/V06/V08/V09/V10/V12/V13/V14/V15/V16/V17/V18/V19/V20/V21/V22/V23/V24/V25/V26/V27/V28/V29/V30.

- [ ] T100 Đối chiếu traceability và bàn giao integration increment với activation còn gated — `apps/mobile/specs/006-wallet-payment-history/tasks.md`, `apps/mobile/specs/006-wallet-payment-history/validation-matrix.md`, `apps/mobile/specs/006-wallet-payment-history/validation.md`, `apps/mobile/specs/006-wallet-payment-history/contracts/integration-gates.md`.

  - **Phụ thuộc**: T077. **Gói plan**: I6.
  - **Bắt đầu / gate**: READY cho truthful status-only handoff sau T094.status và observed/blocked A/NA/NI records; full financial readiness chỉ sau T088 và tất cả applicable source/API/G/native/old-task prerequisites. Task này không stage/commit/push hoặc tự chạy Spec Kit/enable Payment.
  - **Kiểm chứng / hoàn thành**: Bảo toàn49 historical completions; mới task nào đủ toàn tiêu chí mới tick. Map US/FR/SC/V tới tests/files/layer/revision/prereqs và evidence actual. Báo T100.status trước nếu chỉ reads xong, để toàn T100 unchecked khi create/QR/financial scope chưa đáp ứng; không “full PASS” từ subset. Existing T042/T043/T052/T053..T062 không mất prerequisites và không bị thay thế bởi new IDs. Chỉ đề xuất readiness/next authorized scope, real Confirm/create/recovery activation vẫn cần riêng scope/gate đã được chốt; không source/provider/native claims từ docs/fixtures.
  - **Bằng chứng / truy vết**: DOC; tổng hợp từng layer. US1..4; FR-001..025; SC-001..007; V01..V30.

## Truy vết integration extension và ranh giới bằng chứng

Các bảng T001..T062 phía trên giữ lịch sử preparation. Bảng này bổ sung actual-contract work, không thay thế task/tests cũ, không ngụ ý49 task cũ đã cover REVIEW/version.

| Plan package | Task mới   | Story / milestone                                | Gate                                                                       |
| ------------ | ---------- | ------------------------------------------------ | -------------------------------------------------------------------------- |
| I1           | T063..T066 | Shared Payment contract/observation foundation   | Source ready; no activation                                                |
| I2           | T067..T078 | US3 known-ID reads; discovery optional           | Core C/W ready; T076 Product scope, T078 approved A read environment       |
| I3           | T079..T080 | US2 recovery policy decisions                    | BLOCKED GAP-06, no invented retention/store                                |
| I4           | T081..T088 | US2 explicit create/replay/immutable correlation | BLOCKED D1/full I3; D2/D4 scope approved, Confirm stays off                |
| I5           | T089..T093 | US2 QR renderer/decode                           | D3/D4 selected; T089 DOC ready, T090..T093 after deps; QR-01 evidence open |
| I6           | T094..T100 | Checks/A/G/NA/NI/handoff                         | Evidence scopes separate; no subset-as-full-task PASS                      |

| FR     | Integration tasks (plus preserved original mapping)                                            | Cases                           |
| ------ | ---------------------------------------------------------------------------------------------- | ------------------------------- |
| FR-001 | T063..T070,T072,T075,T078,T079..T084,T087,T090,T095..T099                                      | V01,V02,V15,V25                 |
| FR-002 | Preserve T012..T020; T094,T095 regression/refresh, no balance rewrite                          | V03,V04,V05,V27                 |
| FR-003 | T071,T072,T077,T094,T095                                                                       | V05,V24,V29                     |
| FR-004 | T063,T064,T066..T070,T072,T075,T077,T078,T095                                                  | V02,V04,V05,V06,V16,V19         |
| FR-005 | T081,T085,T086,T096                                                                            | V03,V07                         |
| FR-006 | T063,T064,T081,T083,T085,T086,T096                                                             | V07,V29                         |
| FR-007 | T081,T083..T086,T089..T093,T096,T097                                                           | V07,V08,V12,V15,V28             |
| FR-008 | T079..T084,T086..T088,T096,T097                                                                | V08,V09,V10,V11,V13,V25         |
| FR-009 | T065..T070,T073..T075,T078..T088,T090..T093,T095..T099                                         | V01,V12,V13,V15,V25             |
| FR-010 | T065,T066,T070..T072,T075,T081,T083..T088,T090..T093,T095..T099                                | V09,V12,V14,V17                 |
| FR-011 | T063..T070,T073..T075,T078,T095,T097                                                           | V14,V15,V16,V17,V18,V22         |
| FR-012 | T065..T070,T073..T075,T077,T078,T095,T098,T099                                                 | V06,V13,V17,V18                 |
| FR-013 | T071,T072,T075,T077,T095,T097                                                                  | V05,V16                         |
| FR-014 | T075,T085,T086,T095..T097                                                                      | V11,V12,V17,V22,V25             |
| FR-015 | Preserve T021..T032/T057.history; T094 and T098/T099 existing-ledger regression                | V19,V23,V27                     |
| FR-016 | Preserve T021..T032; T073/T074 negative compatibility guard, T094 regression                   | V20,V23,V27                     |
| FR-017 | Preserve P3 exact magnitude/delta/detail; T094,T095,T097..T099 verify supplied read facts only | V03,V21,V22,V23,V27             |
| FR-018 | Preserve P3 ledger status; T066/T075 Payment vocabulary separate, T094,T097..T099              | V02,V18,V21,V22,V30             |
| FR-019 | Preserve T027/T029 supplied explanations; T094,T097..T099 no client settlement                 | V21,V22,V30                     |
| FR-020 | T073..T076,T095; preserve P3 safe reference boundary                                           | V15,V23,V24,V26                 |
| FR-021 | T063,T064,T066,T068,T071,T072,T080..T086,T090,T094..T099                                       | V03,V07,V16,V21                 |
| FR-022 | T088,T094,T097..T100 and preserved no-cash-out/action surface                                  | V22,V26,V30                     |
| FR-023 | T067,T070,T072,T075..T078,T085,T086,T089..T093,T095,T098,T099                                  | V04,V07,V17,V24,V29             |
| FR-024 | T063,T064,T066,T067,T070,T073..T078,T080..T088,T090..T093,T095..T100                           | V04,V14,V15,V26                 |
| FR-025 | T063,T064,T067,T070,T073..T080,T081..T093,T094..T100                                           | V04,V07,V15,V26,V27,V28,V29,V30 |

| SC     | Task integration / acceptance                                          | Không được kết luận từ subset                                                                           |
| ------ | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| SC-001 | Preserved P2; T064,T071,T072,T094,T095,T097..T099                      | C amount/refresh result không thay real owner wallet evidence                                           |
| SC-002 | T081,T085,T086,T089..T093,T096..T099                                   | Timing prep proxy khác full valid-input→decoded QR flow; external waits excluded                        |
| SC-003 | T063..T070,T075,T077,T078,T090..T093,T095,T097..T099                   | 7 states incl REVIEW + version/QR-null no false paid; six-state historical fixture không cover new wire |
| SC-004 | T079..T084,T086..T088,T096..T099                                       | Intent/HTTP replay/ledger posting counters riêng; simulated crash không device kill/restart             |
| SC-005 | Preserved P3 >=200 entries/page20; T073/T074/T094/T095 discovery guard | Payment list status/order watermark không phải ledger snapshot hoặc sum-based balance                   |
| SC-006 | T063..T070,T075..T080,T082..T084,T087,T090,T095..T099                  | Zero other-owner/denied/sample leak phải có real API/native evidence tương ứng                          |
| SC-007 | T075..T077,T085,T086,T089..T093,T098,T099,T100                         | W/NA/NI riêng cho cả4 journeys; optional/unrun/blocked không thành platform PASS                        |

| Cases giữ nguyên | New integration tasks                                               | Evidence cần phân biệt                                                                           |
| ---------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| V01/V02          | T063..T070,T071/T072,T075..T078,T082..T084,T087,T090,T095,T098/T099 | L/C/W rồi A/native; denial không hồi sinh                                                        |
| V03..V06         | T063/T064,T068,T070..T072,T077,T094/T095                            | Exact money/virtual zero và preserved P2; no create on reconnect                                 |
| V07              | T063/T064,T081,T083,T085/T086,T096                                  | Estimate vs server quote; no invented policyVersion/TTL                                          |
| V08..V11         | T079..T084,T086..T088,T096/T097                                     | Key/body/replay/current projection/401 opt-out/provenance, no new intent on uncertainty          |
| V12              | T065/T066,T075,T085,T089..T093,T097..T099                           | Shell/C QR-null khác rendered decode/merchant/native proof                                       |
| V13/V25          | T070,T079..T084,T087/T088,T095..T099                                | Known-ID independent read; lost-ID/store/retention/process-kill gated GAP-06                     |
| V14..V18         | T065..T072,T075/T077/T078,T090..T093,T095,T097..T099                | 7states, version ordering, null suppression, separate PAID refresh, no URL/provider authority    |
| V19..V23         | Preserve P3 tasks; T073/T074,T094/T095,T097..T099                   | Ledger200+ sequence/type/ref unchanged; Payment discovery status cursor/mutable membership riêng |
| V24/V26          | T075..T078,T085/T086,T090..T093,T098/T099                           | Thin routes/Back/accessibility/isolation, no financial egress from preview                       |
| V27              | T078,T094/T095,T096; preserved T057.wallet/history prerequisites    | Actual A read vs C fixture; real create needs own approved scope                                 |
| V28              | T088,T096/T097, old T058 after its full prerequisites               | Backend/channel atomicity evidence; no mock/source/QR-screen-as-G                                |
| V29/V30          | T075/T076/T077,T085/T086,T089..T094,T097..T100                      | Width/accessibility/QR geometry/native and no extra financial actions                            |

## Dependency, ownership và checkpoint của extension

IDs mới nối tiếp62 IDs gốc và được nhóm theo story; **dependency/entry gates quyết định thực thi**, không phải chỉ số ID. Không yêu cầu chạy nốt13 task cũ trước khi bắt đầu I1/I2. T043/T052 có thể review actual source riêng nhưng việc còn unchecked không cấm schema/known-ID GET work; full gate/activation vẫn giữ nguyên yêu cầu.

```text
P1 + P2/P3 reads + P5 prep (completed; retain evidence)
  -> T063 -> T064 -> T065 -> T066                  I1 actual contract/model
     -> T067 -> T068 + T069 -> T070               I2 independent owner status
        -> T071 -> T072 -> T075 -> T077
        -> T073 -> T074 -> T076 (optional; after T075; no dependency into T077)
T077 + approved A read environment -> T078 -> T095 (actual A read record)
T063 + T051 -> T079 --X D1 exceptions/total-loss -> T080 full (D2 approved; design subset only)
  -> T081 -> T082 + T083 -> T084 -> T085 -> T086 -> T087 -> T088 DOC gate
T064 + T038 -> T089 READY DOC (D3/D4 approved) -> T090 RED -> T091 -> T092 -> T093
  independent of T079/T080/create/live environment; import/device prerequisites still enforced
T077 -> T094.status; T086/T087 -> T094.create; T093 -> T094.qr
T086/T087 + approved actual API scope -> T096
T096 + T093 + approved channel/BE proof/current checks -> T097
T077 -> T098.status / T099.status (need T078 + checks/environment)
T093 -> T098.qr / T099.qr (actual devices/checks)
T096/T097 -> T098.financial / T099.financial (approved executable financial scope)
T077 + T094.status + observed/blocked A/NA/NI -> T100.status handoff
All applicable evidence + original gate prerequisites -> full financial readiness/handoff
```

- T094/T095/T098/T099/T100 có named checkpoints để không chặn independent read increment. **Task-level checkbox chỉ hoàn tất toàn phạm vi bắt buộc/đã chọn của task đó**; subset được ghi trong validation chứ không tự tick task. T077 chỉ sở hữu known-ID status C/W; optional discovery có criteria riêng.
- T078 read-only integration không yêu cầu T079..T093, provider enabled, tạo Payment, QR decoder hoặc G acceptance; chỉ cần approved read environment/current checks. T096/T097 không depend T088 activation closure, tránh vòng chờ readiness/report→test→report. T088 chỉ ghi source readiness/stop gate, không cấp quyền tài chính.
- Legacy T053/T054/T056/T057 Wallet và History checkpoints độc lập; T055 model coordination, T042/43/52 và T058 financial/backend gates không được mới-task bypass. Source/new-DTO checks không tick các task đó. T059/T060 native scope đầy đủ cũng không được tick từ status-only evidence.
- T094.record/checks cùng revision có thể được dẫn lại, không bắt rerun không có thay đổi; source revision mới phải revalidate phần ảnh hưởng. Không giữ A/G/native record cho source/contract khác mà không kiểm compatibility.

| File owner                                | Task sequence / resource lock                                                                                      | Không được suy ra dependency nghiệp vụ                                                                                  |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| payment types/outcome/reducer             | T064 rồi T066; later intent changes T084 serialized                                                                | US3 không phụ thuộc US2 intent                                                                                          |
| tests/fixtures/payment-api.ts             | T063 rồi T067; T081 sau đó; T071/T073 có case data trong test file riêng                                           | Không cùng writer fixture                                                                                               |
| api/payment-api.ts                        | T068; T074 nếu selected; T083 serialize nếu cùng file                                                              | Create không bắt buộc optional discovery UI T076                                                                        |
| status/payment views/public exports       | T075 rồi optional T076; T085 sau T075; QR T091 ảnh hưởng payment component                                         | File serialization không làm status chờ QR/create                                                                       |
| QA host and create UI tests               | T085: qa/payment-qa-host.tsx, wallet-payment-create-ui.test.ts, wallet-payment-qa-host.test.ts; tests trước source | QA source/binding producer thuộc T085; actual operational runbook/permission thuộc T096, không preview financial egress |
| WalletProvider/runtime/context            | T078 rồi T084 nếu đều triển khai; giữ owner-read/session contract                                                  | Không bật global Payment vì một read capability đủ                                                                      |
| QR component/model/tests/package/lock     | T089 DOC→T090 RED→T091 install/adapter→T092 decoder→T093 W, approved D3 scope                                      | SVG không encoder; D3 scope already approved, no extra approval for same package/lock scope; no install in docs task    |
| validation/gates/recovery/plan/quickstart | T077/T079/T080/T086/T087/T088/T089/T093..T100 writers serialize                                                    | Device/API preparations độc lập; shared documentation writer không tạo product dependency                               |

**Ví dụ [P] sau đúng deps**: T071 với T073 sau T070 vì khác test files; T072 sau T071 có thể cùng T074 sau T073 vì refresh hook/helper khác list adapter/hook. Hai task cùng phase không mặc nhiên parallel. Không đánh[P] T098/T099 do cùng documentation files: execution/device runs có thể điều phối riêng nhưng record writer serialize. Không tự spawn agent hoặc mở thread.

## Tổng số và chiến lược thực thi sau tasks update

| Nhóm                   | Giữ task cũ | Bổ sung       | Tổng | Completed hiện tại |
| ---------------------- | ----------- | ------------- | ---- | ------------------ |
| Setup/foundation       | 11          | 4 (I1)        | 15   | 15                 |
| US1 Wallet/Home        | 9           | 0             | 9    | 9                  |
| US4 History/detail     | 12          | 0             | 12   | 12                 |
| US2 top-up/QR/recovery | 11          | 15 (I3/I4/I5) | 26   | 14 (prep + QR)     |
| US3 Payment status     | 9           | 12 (I2)       | 21   | 18 (prep + I2)     |
| Cross-cut/evidence     | 10          | 7 (I6)        | 17   | 0                  |
| Total                  | 62          | 38            | 100  | 68                 |

1. **Đã hoàn tất I1 source-only**: T063..T066, test-first actual DTO/version/REVIEW/QR-null models; no HTTP adapter/financial egress hoặc activation.
2. **I2 source hoàn tất, actual reads còn gate**: T067..T072 rồi T075/T077. T073/T074 list transport có thể làm riêng; T076 UI optional. T078 cần approved A read environment; T095 A proof sau đó. Không chờ create/QR hoặc T079/T080.
3. **Create branch**: D2 đã duyệt; full T079/T080 vẫn chờ D1, chỉ sau đó T081..T087 C/W integration, T088 gate record. Mọi UNKNOWN giữ nguyên key/body/ID; không tự chọn storage/horizon, credentials hoặc backend lookup.
4. **QR branch — ưu tiên tiếp theo**: T089 ghi full source/design review D3/D4 đã duyệt, rồi T090 RED→T091 scoped install/adapter/import→T092 pixel decoder harness→T093 actual W screenshot decode. Không chờ D1/create. T091 source/web/Metro-import thiếu thì ghi BLOCKED, không bypass để tick downstream; QR-01/T042/native/channel vẫn cần đủ evidence. Lệnh tasks không install hoặc implement.
5. **Accept by layer**: T094 current-scope source checks, T095 read A, T096 create A, T097 channel/backend G, T098 Android/T099 iOS. T100 báo đúng partial/full state; không bật financial capability, tự deploy hoặc chạy lệnh Spec Kit tiếp.

**Historical generation snapshot (trước I1/I2)**:38 task mới đều có checkbox unchecked, sequential IDs T063..T100, story labels cho US2/US3, paths/deps/entry/verify/evidence/trace cụ thể.49 completions gốc giữ nguyên. Tổng100 task,51 unchecked (13 cũ +38 mới). Không new application test/source, financial egress, QR encoder, dependency, storage implementation hoặc Git index operation được thực hiện bởi generation này.
