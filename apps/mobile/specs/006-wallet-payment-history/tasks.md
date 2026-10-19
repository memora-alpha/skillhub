# Tasks: Wallet, payment status and transaction history

**Later ordinary integration — 2026-10-18:** The user authorized connecting normal native Top-up/Payment. [Current source/validation boundary](contracts/normal-payment-integration.md) supersedes earlier normal-flags-off notes. Web create stays unavailable.100 IDs/83 checked task blocks remain untouched; no acceptance parent/subset is ticked from this follow-up. Actual API/payOS/Android/iOS and original remaining criteria are still open.

**Implementation checkpoint — 2026-10-18, BE7fc0f83 / HEAD5101aea + working tree:** Test-first eligible source batch is implemented. T043/T052/T076/T078..T088/T094 complete within DOC/L/C/W/source-check criteria;100 IDs,83 checked/17 unchecked, original68 completed task bodies preserved. Normal Payment/status/create/recovery/Confirm flags remain off. Private native QA read/financial entries are source-ready, not an activated or accepted deployment. Current fields, cleanup/store/claim/create/replay/QR/status replace earlier pending-source proposals below. D1/D2/D3/D4 are not reopened. Actual API/payOS/Android/iOS acceptance and full T100 stay gated; historical results keep their original scope.

**Current tasks revision — 2026-10-18:** backend7fc0f83, inspected HEAD5101aea, branch feat/mobile-wallet-payment-history unchanged. [Plan](plan.md), [source audit](contracts/backend-review-7fc0f83.md), [HTTP](contracts/payment-http.md), [recovery](contracts/payment-recovery.md), [gates](contracts/integration-gates.md), [validation](validation.md). D1 SOURCE_VERIFIED_WITH_LIMITATIONS; GAP-06 SOURCE_READY / MOBILE_AND_ACCEPTANCE_PENDING. D2 native-first, D3 pinned tools and D4 QA/two-device workflow approved; environment existence reported available, actual binding/results unverified.

Preserve **100 IDs /68 checked /32 unchecked**, including all68 completed task blocks byte-for-byte. This update revises24 unchecked tasks only; no completion/implementation/financial action. T052/T076/T078 now own new contract/recovery/status/policy read work independently of US2/QR. T076 unused optional-discovery task is deliberately reassigned; discovery UI remains NOT_SELECTED and no longer has an implicit implementation task. Existing completed T063..T075/T077 evidence is historical; new fields are not retroactively covered. T089..T093 QR source/decoder/W are completed and reused, not reinstalled/reselected. Original P1..P5/source evidence is retained in validation.

## Quy ước và giới hạn thực thi

- Exact checklist ID/state and completed blocks are historical invariants; dependencies, not ID order, govern execution. File paths are repository-relative. Future source files are task targets, not implemented features.
- READY means source/design prerequisite permits work after named dependencies. GATED means actual build/deployment/data/channel/device/permission evidence missing. PREP is inert UI/model; BLOCKED means named unsupported behavior or missing required producer, not a missing source claim already resolved by7fc0f83.
- Write tests first and record RED→GREEN per schema/adapter/model/UI producer. T081 test-production task records complete RED cases; later implementation must make them GREEN before integration. No skipped financial assertion PASS.
- [P] marks distinct-file work after its own dependencies; same file (schema/fixture/HTTP/runtime/docs) has one writer. No instruction to spawn agents/threads. T082/T083 may run in parallel after T081; shared fixture was produced by T081, subsequent case updates stay in their own test files.
- Shared authenticated HTTP/query/session/connection/AbortSignal only; exact money; no shared pagination expansion, backend edits, dependencies or production flag activation. Policy GET is a snapshot, not quote/reservation; existing AppError does not expose details. Use local ID or explicit policy GET→owner GET; absence never proves no creation.
- Only backend confirms/post Credit. QR/providerStatus/redirect/clock/close/waiting never determines payment result. PAID remains PAID with recovery warning or independent read failure. No new key/intent on UNKNOWN/REVIEW/missingQR/render failure/404/empty discovery; no total-loss repair/clearance/withdrawal/refund/admin action.
- D1 total identity loss/privileged restore and missing in-product REVIEW clearance are unsupported support stops. Do not ask for an invented oracle/SLA. Native unresolved records survive logout, RAM/cache/draft/QR clear, B cannot access A. T080 finalizes record/index/cleanup/capacity; storage failure blocks dispatch; no web-create fallback.
- L=logic, C=synthetic HTTP/storage contract, W=rendered web, A=actual API, G=approved payOS channel/backend posting, NA/NI=native device evidence, DOC=design review. Source, fixture, web, export, BE mocked reports, A/G and process-kill native are distinct.
- Full task checkbox requires all its stated scope/producers. Named status/QR/Wallet/History checkpoints may run independently and are recorded in validation; they never complete the parent or bypass another prerequisite. A source/DOC task may complete with actual-layer gates recorded because actual-layer acceptance belongs to separate named tasks; it cannot claim those actual results.

## Bằng chứng contract và gate dùng chung

| Capability                    | Source / completed work                                                                                                                                | Current producer / stop                                                                                                                                                                                                                                        |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Wallet/Home, History/detail   | Owner GETs/exact strings/virtualzero/limit20/type/referenceType/snapshot chain; completed T001..T032. Credit source unchanged vs081b3d2.               | Preserve independent T053/T054/T056/T057 wallet/history checkpoints. No date/status/search filter; date deferred; no ledger sum/client settlement.                                                                                                             |
| Payment projection/status     | Implemented source7fc0f83 adds required recoveryRequired/recoveryReason; existing T063..T075/T077 drops these new fields.                              | T052 RED/schema/types → T076 RED/reducer/statusUI → T078 policyGET/scopedread/QA source. No intent/storage/encoder dependency.                                                                                                                                 |
| Creation-policy/create/replay | Authenticated advisory GET, owner/current-version reads; Payment identity fallback/backfill/no-TTL/pause/channel/REVIEW guards source-backed in audit. | T079 D1 limitclosure → T080 cleanup/capacity → T081 RED → T082/T083 → T084/T085 → T086/T087/T088. Fresh-policy race and known incident never permit replacement on uncertainty.                                                                                |
| Local QR                      | T089..T093 complete, pinned encoder/SVG/independent actualW decoder and rawbytes tests.                                                                | Reuse; T042 full native usability/QRgate and T097 channel evidence open. Same-version null latch persists when metadata clears.                                                                                                                                |
| Environment/release           | D4 QA/two-device and environment existence approved.                                                                                                   | Actual migration/backfill/old-binary ingress block/all-instance deployment, executable read/financialQA build/entry, authA/B/data/channel/actions/amount/support/operator owner unverified: T095..T099 and original applicable gates. No automatic activation. |

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

- [ ] T042 [US2] Đối chiếu full QR-01 từ encoder/decoder đã có và bằng chứng native còn thiếu — `apps/mobile/specs/006-wallet-payment-history/contracts/qr-validation.md`, `apps/mobile/specs/006-wallet-payment-history/validation.md`.

  - **Phụ thuộc**: T038, T041; renderer/W producer T093; native QR evidence từ T098.qr/T099.qr theo dependencies của từng checkpoint.
  - **Bắt đầu / gate**: GATED QR native/scan usability. D3 và workflow D4 đã duyệt; T089..T093 đã hoàn tất, không chọn/cài lại encoder.
  - **Kiểm chứng / hoàn thành**: Record source/license/import/byte/capacity/W hiện có đúng revision; thu actual Android/iOS pixels và independent decode, accessibility/layout/raw-byte equality/session/null suppression theo full QR contract. T098.qr/T099.qr không chờ T042; QR subset không chạy tiền. G/payOS bank scan giữ evidence riêng T097; không dùng model/SVG export/W để thay native hoặc tick full task khi native bắt buộc còn thiếu. Không deep link/save/share hay financial activation.
  - **Bằng chứng / truy vết**: DOC/L/W/NA/NI; G riêng tại T097. FR-007/009/010/023/025; SC-002/003/006/007; V12/V14/V18/V24/V26/V29/V30.

- [x] T043 [US2] Lập biên bản source-contract và activation stop gate theo BE7fc0f83 — `apps/mobile/specs/006-wallet-payment-history/contracts/integration-gates.md`, `apps/mobile/specs/006-wallet-payment-history/contracts/payment-recovery.md`, `apps/mobile/specs/006-wallet-payment-history/contracts.md`.

  - **Phụ thuộc**: T041, T079, T080.
  - **Bắt đầu / gate**: READY DOC sau dependencies; source D1 đã có, release GATED. Không sửa adapter hoặc bật Confirm.
  - **Kiểm chứng / hoàn thành**: Dẫn source controller/DTO/policy/create/identity/migration/posting/worker/REVIEW/runbook; phân biệt policy snapshot với quote, pause với disabled, retained/reconstructed replay với total loss. Đánh giá mobile new-field/store/create/QA chưa implement và deployment/API/G/NA/NI còn mở. Task hoàn tất biên bản DOC khi mọi mục có nguồn/giới hạn/stop; không yêu cầu financial activation để viết biên bản, không đóng T042/T058 hay production từ source review.
  - **Bằng chứng / truy vết**: DOC. FR-007/008/009/010/014/021/022/025; SC-003/004/006; V08/V09/V10/V11/V13/V25/V28.

## Phase 6 — US3: preparation đã hoàn tất và current contract correction T052

T044..T051 giữ nguyên completed preparation; phần correction7fc0f83 được giao cho task T052 chưa hoàn tất. T052 RED→schema/types độc lập US2, tiếp tục T076/T078 theo graph hiện hành. Không dùng task prep cũ để claim new recovery fields đã nghiệm thu.

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

- [x] T052 [US3] Viết red contract tests rồi cập nhật Payment recovery fields và CreationPolicy schema/types — `apps/mobile/tests/wallet-payment-contract.test.ts`, `apps/mobile/tests/fixtures/payment-api.ts`, `apps/mobile/tests/wallet-payment-observation.test.ts`, `apps/mobile/tests/wallet-payment-read-refresh.test.ts`, `apps/mobile/tests/wallet-payment-status-ui.test.ts`, `apps/mobile/src/features/wallet/preview/payment-contract-host.ts`, `apps/mobile/src/features/wallet/preview/qr-host.ts`, `apps/mobile/src/features/wallet/schemas/payment-contracts.ts`, `apps/mobile/src/features/wallet/types/payment.ts`, `apps/mobile/specs/006-wallet-payment-history/data-model.md`.

  - **Phụ thuộc**: T051, T064.
  - **Bắt đầu / gate**: READY source7fc0f83. Đây là phần correction mới của task chưa hoàn tất; T063/T064 giữ lịch sử, không coi fields mới đã được test. Không chờ T079/T080/create/QR.
  - **Kiểm chứng / hoàn thành**: Viết fixtures/tests synthetic trước schema/types và quan sát RED→GREEN. Quote đúng constraint model: recoveryRequired="Required boolean"; recoveryReason="Required nullable string"; CreationPolicy có canCreate:boolean, reasonCode:string/null, existingPaymentId:own UUID/null, cả3 required; không timestamp/version/reservation/quote. Không default missing thành false/null, giữ exact VND/Credit/dates/numeric version/nullable checkout và unknown-safe. Validate reason/required consistency; unknown nonempty recovery/policy reason không trở thành payment failed/paid hay cho create; inconsistent eligible projection unavailable. Kiểm null/false checkout preparation/expiry khác required-recovery, REVIEW/channel/missing-checkout và PAID có warning. Cập nhật tất cả affected synthetic DTO constructors trong các tests/preview hosts đã liệt kê để required-field change không làm gãy consumers; chỉ fixture shape, không đổi renderer/encoder hay reducer/UI behavior thuộc T076. Focused US3 tests không import/instantiate intent/coordinator/encoder; sửa QR-host fixture không tạo dependency nghiệp vụ/gate QR. Existing preparation models vẫn tách actual DTO. Fixtures thuộc L/C không proof API thật. Giữ schema/outcome/old preparation tương thích, không transport/store/encoder/flag.
  - **Bằng chứng / truy vết**: L/C fixture + DOC. FR-001/004/009/010/011/012/014/021/024/025; SC-003/006; V01/V02/V03/V14/V15/V16/V18/V25/V26.

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
  - **Bắt đầu / gate**: **READY**. Synthetic payment models no real channel/HTTP; QR source/W đã có qua T089..T093; full QR/native acceptance còn gate; không yêu cầu T042 hoặc read story hoàn tất để test unavailable/error UI. Intent-only/status-only checks vẫn chạy tại T041/T050 độc lập; task này dành cho phối hợp cả hai.
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
  - **Bắt đầu / gate**: **GATED G/QR/native/release**. Source Payment7fc0f83 đã có; current tasks cung cấp integration producers. Giữ nguyên T043/T052/T042/T056/T055 prerequisites; cần T096/T097 actual authorized evidence cùng revision và QR-01/full-check prerequisites. Không lấy source/fixture/mock hoặc guessed sandbox làm G; không tự thực hiện tiền/DBrepair hoặc bỏ legacy dependencies.
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

## Dependency graph và thứ tự thực thi — baseline read checkpoints

Graph baseline này giữ entryconditions Wallet/History/preparation; current payment correction/create graph cuối tài liệu govern updated T052/T076/T078/T079+. Không dùng baseline ordinal/group labels để bỏ current prerequisites.

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

Current-source D1 confirmed with limits; D2/D3/D4 approved. T079/T080 finalize documented support/cleanup/capacity/index limits before native store. No new BE promise, encoder selection or workflow approval is requested. Actual deployment/migration/backfill/ingress/config, executableQA/authA/B/data/actions/amount/channel, support/operator owner and Android/iOS evidence remain GATED as assigned T095..T099; totalidentity loss/REVIEW replacement unsupported and safely blocked. See current graph/unchecked task bodies below; older baseline acceptance mappings are not closed gates.

## Kiểm tra chất lượng task list — historical62-task checkpoint

Các con số/gate bên dưới là snapshot62-task cũ. Current total100/68checked, new correction ownership/dependencies/verification ở cuối tài liệu thay các source-missing hoặc discovery labels cũ; không thay đổi completed blocks.

- 62 checklist task, IDs T001..T062; Setup/foundation11, US1=9, US4=12, US2=11, US3=9, cross-cut10.49 task T001..T041/T044..T051 đã tick theo tiêu chí; P4/P5 chỉ preparation.13 task T042/T043/T052..T062 còn unchecked.
- Tất cả có đường dẫn file cụ thể, phụ thuộc/entry/verify/evidence. File thực tế và helper tách nhỏ của P1..P5 được ghi trong validation; paths phase sau vẫn là change map. Đủ25 FR,7 SC,30 case rows; tick increment không thay acceptance đầy đủ của các hàng này.
- 15 task có [P] sau khi điều kiện của chúng đáp ứng; ví dụ theo story ở trên. Các task bị chặn không được đổi thành READY vì model tests xanh.
- T042 QR-01 BLOCKED; T043/T052 SOURCE REVIEW READY nhưng unchecked; T058 GAP-06/QR/channel GATED; T057/T059/T060 environment GATED. T033..T041/T044..T051 PREP. Các READY source tasks vẫn cần invocation triển khai sau.
- Hook check tại mobile Spec Kit root: `.specify/extensions.yml` không tồn tại ở lần sinh này, không before/after_tasks hook để chạy.
- Remediation I1/I2/C1/I3: giữ62 IDs; Wallet/History có checkpoints W/checks/A/native độc lập, T050 bỏ phụ thuộc US2, Home unavailable thuộc T011 và quickstart chỉ chạy file đã được tạo ở giai đoạn tương ứng. Dependency/checkpoint của T012+ giữ nguyên sau P1.
- Kết quả P1/P2/P3 ở validation; P3 bổ sung V19..V23 và History/detail subset V01/V02/V03/V24/V26/V29. Không tick task cross-capability/phase sau hoặc đóng toàn V/FR/SC từ subset này. A/G/NA/NI và T053+ vẫn NOT_RUN; format/link/index checks không thay financial acceptance.
- `.specify/extensions.yml` vẫn không tồn tại khi kết thúc P5 preparation, nên không có after_implement hook. T038 chỉ hoàn tất specification/model tests; QR-01 renderer/decoder vẫn BLOCKED. T044..T051 độc lập với US2 intent; memory-remount không là restart recovery. T042/T043/T052..T062 chưa thực hiện, không skipped-as-PASS.

## Integration task extension — current7fc0f83 và preserved implementation

Current source/contracts thay baseline4121c3f/081b3d2 cho các correction tasks chưa hoàn tất. T063..T075/T077 vàT089..T093 đã completed đúng scope cũ; source D1 có thêm policy/recoveryfields/identityguards. T052/T076/T078 chịu trách nhiệm new correction, không mở lại completed task hoặc gán evidence mới vào checkbox cũ. T079/T080 READY DOC closure/cleanup, T081..T088 cần own producers, actual A/G/native giữ gate. No discovery UI; productionPayment/Confirm defaults off. T078 giờ là source/inert read integration; actual environment/activation evidence riêngT095. Đây là tài liệu, không code/call/payment.

## Phase 8 — Completed Payment integration foundation (I1, T063..T066)

Các completed blocks sau giữ nguyên historical actual DTO/REVIEW/version/QR-null evidence. Required recoveryfields/policy mới chưa thuộc evidence đó; task T052/T076 tạo tests/correction mới trước adapter/UI. Owner-status foundation vẫn độc lập US2 intent/QR.

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

## Phase 9 — US3: owner reads đã có, correction và policy reads độc lập (I2)

T067..T075/T077 giữ completed blocks. T076 được chuyển từ optional discovery chưa chọn sang recovery reducer/status correction sau T052; T078 thêm policy GET/QA read binding sau T076. Contract/status checks không chờ T079/T080/create/QR; actual read A riêng T095. No discovery UI, no normal financial flag.

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

- [x] T076 [US3] Sửa observation/status UI cho recovery metadata cùng version theo tests trước model/UI — `apps/mobile/tests/wallet-payment-observation.test.ts`, `apps/mobile/tests/wallet-payment-status-ui.test.ts`, `apps/mobile/tests/wallet-payment-read-refresh.test.ts`, `apps/mobile/src/features/wallet/utils/payment-observation.ts`, `apps/mobile/src/features/wallet/utils/payment-status-presentation.ts`, `apps/mobile/src/features/wallet/components/payment-status-panel.tsx`, `apps/mobile/src/features/wallet/hooks/use-payment-status.ts`.

  - **Phụ thuộc**: T052, T070, T072, T075, T077.
  - **Bắt đầu / gate**: READY sau schema. T076 được phân bổ lại từ discovery UI optional chưa làm; discovery UI vẫn NOT_SELECTED và không còn task triển khai ngầm. US3 không phụ thuộc intent/store/create/encoder.
  - **Kiểm chứng / hoàn thành**: Viết tests RED trước reducer/presentation: current owner/session/payment/ticket, numeric newer/older version, immutable quote conflict; operational recoveryRequired/recoveryReason đổi hoặc clear cùng version không bị coi là financial conflict. Same-version checkout:null được latch, reason clear không phục hồi QR, old ticket/lower version không hoàn tác accepted data. Known REVIEW/channel/missing-checkout và unknown reason có trạng thái hỗ trợ/đọc lại an toàn; không tính TTL/polling. PAID + warning hoặc Wallet/History lỗi vẫn PAID; retry chỉ reads, không cộng Credit/tạo TOP_UP/create. Cover denied eviction/late cache/session cleanup, loading/error/stale/unavailable/Back/accessibility và không trùng loading. Default unavailable/production flags và preview no-egress giữ nguyên; full task cần cả reducer lẫn UI/tests, không tick từ một subset.
  - **Bằng chứng / truy vết**: L/C/W synthetic + DOC; API/G/NA/NI chưa nghiệm thu. FR-001/004/009/010/011/012/013/014/023/024/025; SC-003/006/007; V01/V02/V05/V06/V14/V15/V16/V17/V18/V24/V25/V26/V29/V30.

- [x] T077 [US3] Ghi checkpoint độc lập cho actual-contract owner status và refresh — `apps/mobile/specs/006-wallet-payment-history/validation.md`, `apps/mobile/specs/006-wallet-payment-history/quickstart.md`.

  - **Phụ thuộc**: T075, T070, T072. **Gói plan**: I2.
  - **Bắt đầu / gate**: READY khi source tương ứng đã tồn tại. T074/T076 optional, T079..T093/create/QR/harness T053 không phải prerequisite cho known-ID scope.
  - **Kiểm chứng / hoàn thành**: Chạy actual schema/observation/read/read-refresh/UI tests + foundation/Wallet/History/P4/P5 regression, mobile lint/check-types/check-structure. W kiểm7states/version/QR-null, coalescing, account switch/denial/PAID refresh failure và thin-route/Back tại320/375/430; controlled read-only fixture, zero POST/provider/remote QR. T077 chỉ sở hữu status L/C/W+checks; optional discovery phải đạt task/checkpoint riêng, không chặn hoặc được pass nhờ T077. Hoàn tất khi full status subset qua trên cùng revision; A/G/NA/NI vẫn NOT_RUN. Không tick T053+/T052 từ record này.
  - **Bằng chứng / truy vết**: L/C/W/DOC. FR-001/003/004/009/010/011/012/013/014/021/023/024/025; SC-001/003/006/007; V01/V02/V03/V05/V06/V12/V14/V15/V16/V17/V18/V22/V24/V26/V29/V30.

- [x] T078 [US3] Viết tests rồi tích hợp policy GET, scoped read lifecycle và QA read binding độc lập mutation — `apps/mobile/src/features/wallet/index.ts`, `apps/mobile/tests/wallet-payment-policy-read.test.ts`, `apps/mobile/tests/wallet-payment-read.test.ts`, `apps/mobile/src/features/wallet/api/payment-api.ts`, `apps/mobile/src/features/wallet/utils/payment-query-keys.ts`, `apps/mobile/src/features/wallet/hooks/use-payment-creation-policy.ts`, `apps/mobile/src/features/wallet/qa/payment-read-qa-host.tsx`, `apps/mobile/app.config.ts`, `apps/mobile/src/app/_layout.tsx`, `apps/mobile/src/qa/payment-qa-entry.tsx`, `apps/mobile/tests/wallet-payment-qa-entry.test.ts`, `apps/mobile/tests/wallet-payment-read-qa-host.test.ts`, `apps/mobile/specs/006-wallet-payment-history/contracts/integration-gates.md`.

  - **Phụ thuộc**: T052, T076, T077.
  - **Bắt đầu / gate**: READY source/inert HTTP fixture sau dependencies; actual deployment/API read evidence ở T095. Không chờ D1 storage/create/QR/G; không bật production Payment/read flag trong task này.
  - **Kiểm chứng / hoàn thành**: RED trước adapter/query/QA source. GET /payments/creation-policy qua shared authenticated client + AbortSignal; validated3 fields, no-store/advisory semantics, owner/environment/session-scoped keys/tickets, cancellation/denial eviction/late-response cleanup. Policy false không tắt owner status/list/detail; canCreate true không kết luận prior unknown resolved. Existing AppError bỏ details: expose explicit GET-based own blocker read path, không đoán details.existingPaymentId hoặc sửa shared HTTP/parser. No policy polling/reservation/automatic POST. QA read host dùng injected shared owner client/build/environment binding, chỉ GET cho đúng owner/approved QA; production/preview hoặc wrong binding fail closed. Tests inert/chặn all mutation, không financial egress từ preview. T078 owns proposed app.config.ts QA build selector (preserve existing app.json), thin _layout mount and src/qa/payment-qa-entry.tsx read-only entry plus tests; reuse AppProviders/shared auth/client and feature public entry export, no source HTTP logic in root. Native QA build binding selects read host explicitly; normal/production/preview/web, missing/mismatched binding fail closed, URL cannot select QA mode. Tests assert mounted read entry/GET-only and unchanged normal navigation with inert transport. These source producers belong to approved D4 scope, not a new permission request. Actual built entry/invocation/config/auth and outcome need T095, absence gates A only. Full source task không phụ thuộc làm được actual A; không dùng read capability để bật create/recovery/Confirm.
  - **Bằng chứng / truy vết**: L/C/W fixture + DOC; A tại T095. FR-001/004/009/011/012/014/024/025; SC-003/006/007; V01/V02/V04/V05/V14/V15/V17/V18/V25/V26/V27.

## Phase 10 — US2: D1 closure và native cleanup/capacity contract (I3)

Source7fc0f83 đã xác nhận D1, READY DOC sau dependencies. T079 ghi supported guarantees + unsupported supportstop, không chờ BE trả lại câu đã chốt. T080 chốt record/index/cleanup/capacity trước tests/store; no local unresolved TTL, native-first/web unavailable. Design/SOURCE evidence không tick task hoặc nghiệm thu restart.

- [x] T079 [US2] Đóng phần xác nhận/source D1 và chốt unsupported total-loss/support-stop — `apps/mobile/specs/006-wallet-payment-history/contracts/d1-backend-confirmation.md`, `apps/mobile/specs/006-wallet-payment-history/contracts/backend-review-7fc0f83.md`, `apps/mobile/specs/006-wallet-payment-history/contracts/payment-recovery.md`, `apps/mobile/specs/006-wallet-payment-history/contracts/integration-gates.md`, `apps/mobile/specs/006-wallet-payment-history/contracts/completion-proposal.md`.

  - **Phụ thuộc**: T063, T051.
  - **Bắt đầu / gate**: READY DOC; D1 SOURCE_VERIFIED_WITH_LIMITATIONS, source-sync đã gỡ. Không hỏi lại cam kết D1 hoặc lựa chọn D2–D4.
  - **Kiểm chứng / hoàn thành**: Đối chiếu receipt với source7fc0f83/migration: no-TTL mapping+Payment identity, lost mapping same-ID200, retained map/missing Payment409, body conflict, live actor authorization, legacy block, provider check trước replay, pause/channel and CREATED/PENDING/REVIEW. Ghi đầy đủ giới hạn privileged restore/total client or BE loss, no GET-by-key/owner-clearance/repair/replacement API; known incident/404/list empty/amount-time không cho tạo lại, chỉ support-stop. Thay tiêu chí cũ đòi oracle bao phủ mọi total-loss bằng xác định rõ unsupported boundary; không giả bảo đảm universal recovery/SC-004 hay coi BE report/mock là deployment. Full DOC task chỉ tick sau mọi decision/source/limit/operational responsibility/acceptance layer được record; actual rollout/owner assignment chưa kiểm chứng giữ gate T096+, không làm blocker câu hỏi lặp.
  - **Bằng chứng / truy vết**: DOC/source only. FR-001/008/009/010/014/025; SC-003/004/006; V09/V10/V11/V13/V15/V25/V27/V28.

- [x] T080 [US2] Chốt contract native correlation, cleanup/capacity và storage failure theo D1/D2 — `apps/mobile/specs/006-wallet-payment-history/contracts/payment-recovery.md`, `apps/mobile/specs/006-wallet-payment-history/data-model.md`, `apps/mobile/specs/006-wallet-payment-history/plan.md`, `apps/mobile/specs/006-wallet-payment-history/contracts/completion-proposal.md`.

  - **Phụ thuộc**: T079, T052.
  - **Bắt đầu / gate**: READY DOC sau D1 closure; full contract trước T081/T082. D2 native-first đã duyệt, không hỏi lại storage/logout.
  - **Kiểm chứng / hoàn thành**: Chốt field formatVersion/environment/ownerId/key/canonical2-field body/localIntentId/dispatchMarker/optional payment UUID; session generation RAM-only; visible ASCII key1..128, format/owner/environment/UUID validation. Chốt separate financial SecureStore namespace/service WHEN_UNLOCKED_THIS_DEVICE_ONLY, single JS writer/synchronous claim, serialized UTF-8 record <2048 bytes (budget thiết kế, không BE/SecureStore SLA). No automatic TTL/purge chỉ áp dụng unresolved correlation: giữ encrypted unresolved qua logout, RAM/cache/draft/QR clear, A reauth mới đọc, B không enumerate A và late A response không ghi. Phân loại resolved/unresolved theo payment-recovery.md: accepted owner-bound backend observation và accounted dispatch, không local timer/status ranking/no-creation oracle. Cleanup resolved record khi phân loại được xác nhận và trước khi báo logout cleanup thành công; không giữ resolved như ngoại lệ FR-001. Deletion/index-update lỗi phải khóa financial runtime/restore và báo cleanup chưa hoàn tất, không giả xóa thành công hoặc tạo key mới. T080 phải chốt thứ tự/marker cho crash cleanup và index consistency trước store implementation; không claim atomicity/fsync. Trước store code phải ghi cụ thể owner-index/lookup layout, bounded per-write/index capacity + crash/partial-write/read-back failure handling; không im lặng prune/overwrite unresolved để có chỗ hoặc tạo mới, không tự đặt retention horizon/total native quota như bảo đảm platform. Storage/capacity/corruption/cleanup failure fail closed; no plaintext/memory/auth-token-store fallback. Không QR/provider payload/balance/history/credentials. Known ID resume GET; lost ID còn key/body chỉ explicit replay theo D1; detected total loss/known restore support-stop, undetectable loss không thể bảo đảm phát hiện. Full task cần finalized record/index/cleanup/capacity/kill-case matrix; còn layout/policy chưa ghi thì T082 chưa được bắt đầu, không tick từ design approval.
  - **Bằng chứng / truy vết**: DOC design; persistence/device proof chưa có. FR-001/008/009/021/024/025; SC-004/006; V01/V02/V09/V10/V11/V13/V25/V26.

## Phase 11 — US2: explicit create sau contract và durable storage (I4)

Entry: T079/T080 và T052/T076/T078 đầy đủ → T081 RED → T082 storage song song T083 adapter sau deps → T084 claim → T085 review/QR/status/QA → T086 fixture/W → T087 source recovery → T088 DOCstop. Storage, adapter và coordinator đều có tests trước source. Full financial release không được mở từ C/W; actual environment/channel/native T096+ riêng.

- [x] T081 [US2] Viết red tests create/replay và durable correlation theo contract đã chốt — `apps/mobile/tests/wallet-payment-create.test.ts`, `apps/mobile/tests/wallet-payment-durable-recovery.test.ts`, `apps/mobile/tests/fixtures/payment-api.ts`.

  - **Phụ thuộc**: T080, T052, T076, T078.
  - **Bắt đầu / gate**: READY khi full prerequisites đã đạt; tests trước store/POST/coordinator. Không yêu cầu API thật hoặc native kill để tạo L/C tests.
  - **Kiểm chứng / hoàn thành**: RED cases exact2-field body/PAYOS/money and visible ASCII key1..128; persist/read-back before POST; concurrent caller/remount sync claim;201fresh/200same-ID replay, lost mapping Payment survives PENDING/PAID, retained map missing Payment409, changed-body409. Policy true→POST paused/channel/provider/unresolved/reconciliation/provenance rejection race; legacy Payment absent all list pages vẫn block by policy own ID. Shared AppError không có details nên local ID/policy GET fallback, no ID giữ support/unknown.401 renewal opt-out replayAfterRenewal:false, no lifecycle/mutation retry; malformed/timeout/abort after commit giữ key/body. Tests resolved/unresolved classification, resolved deletion/index-update/crash failure and logout, unresolved preservation, corrupt/oversized/index-full/read/write failure, ID-persist fail, known-ID reads, lost-ID explicit replay, total-loss/support and A→B→A/late writes. Không đưa endpointfake vào actual client; boundary synthetic theo source. Chỉ test task này có thể complete sau đủ RED cases và expected-failure record; GREEN và runtime acceptance ở producer sau, không skipped assertion thành PASS.
  - **Bằng chứng / truy vết**: L/C inert tests RED; full GREEN at T082..T087. FR-001/005/006/007/008/009/010/014/021/024/025; SC-002/003/004/006; V01/V03/V07/V08/V09/V10/V11/V13/V15/V25/V26.

- [x] T082 [P] [US2] Implement native SecureStore boundary và web-create unavailable theo red tests — `apps/mobile/src/features/wallet/utils/payment-recovery-record.ts`, `apps/mobile/src/features/wallet/storage/payment-correlation-store.ts`, `apps/mobile/src/features/wallet/storage/payment-correlation-store.native.ts`, `apps/mobile/src/features/wallet/storage/payment-correlation-store.web.ts`, `apps/mobile/tests/wallet-payment-durable-recovery.test.ts`.

  - **Phụ thuộc**: T081, T080.
  - **Bắt đầu / gate**: READY sau finalized record/index/cleanup/capacity và RED tests; không tự cài dependency hoặc thay auth store.
  - **Kiểm chứng / hoàn thành**: GREEN storage subset đúng T080: owner/environment isolation, key/body/marker persistence và read-back trước dispatch, optional-ID durable update, unresolved no-TTL/logout preservation; resolved record/index cleanup theo T080/FR-001, B cannot read/enumerate A, old-session writes rejected, bounded/corrupt/full/partial-write failures block create. Web returns unavailable, no browserplaintext/memory fallback. Serialize writes/index theo approved layout; read-back không phải fsync/CAS/atomic storage+network. Test resolved cleanup versus unresolved preservation, deletion/index failure, cleanup crash, A→B→A and late-write rejection; simulations and cleanup/failure outcomes đầy đủ; actual kill/reinstall/device loss NOT_RUN tới T098/T099. Không HTTP create trong store tests. Full task cần toàn contract native boundary + web behavior, không tick từ schema helper hoặc vài happy cases.
  - **Bằng chứng / truy vết**: L/C storage boundary simulations; NA/NI riêng. FR-001/008/009/021/024/025; SC-004/006; V01/V02/V09/V11/V13/V25/V26.

- [x] T083 [P] [US2] Implement explicit create/same-intent replay bằng shared HTTP adapter — `apps/mobile/src/features/wallet/api/payment-api.ts`, `apps/mobile/tests/wallet-payment-create.test.ts`.

  - **Phụ thuộc**: T081, T078.
  - **Bắt đầu / gate**: READY red HTTP cases; có thể cùng T082 sau deps nếu khác file/test writer. Policy GET đã thuộc T078, không viết lại.
  - **Kiểm chứng / hoàn thành**: GREEN exact body/key/PAYOS, POST authenticated AbortSignal + replayAfterRenewal:false, no automatic mutation retries. Parse current DTO gồm recovery fields,201/200 same-ID current projection không assumption PENDING/QR, quote mismatch giữ cùng Payment/support. Không generate/rotate key trong adapter; replay chỉ caller explicit cùng immutable key/body. Code mapping/unknown errors preserves prior context; policy/owner GET fallback không phải POSTreplay và không match intent bằng amount/time. Cover provider disabled before replay, pause permits same identity, body409/reconciliation/legacy/503/no ID/malformed/401renewal. Không dựng GET-by-key, client cancel/refund/mark-paid, provider request, widen shared pagination or guess details support; list/detail existing tests pass.
  - **Bằng chứng / truy vết**: C synthetic HTTP; A tại T096. FR-001/006/007/008/009/010/014/021/024/025; SC-003/004/006; V01/V07/V08/V09/V10/V11/V13/V15/V25/V27.

- [x] T084 [US2] Nối durable claim với immutable intent và known/lost-ID recovery — `apps/mobile/src/features/wallet/utils/payment-intent.ts`, `apps/mobile/src/features/wallet/utils/payment-intent-result.ts`, `apps/mobile/src/features/wallet/context/payment-preparation.ts`, `apps/mobile/src/features/wallet/context/WalletProvider.tsx`, `apps/mobile/tests/wallet-payment-create.test.ts`, `apps/mobile/tests/wallet-payment-durable-recovery.test.ts`.

  - **Phụ thuộc**: T082, T083, T076.
  - **Bắt đầu / gate**: READY sau store+adapter và GREEN các subset producers; không bật financial capability.
  - **Kiểm chứng / hoàn thành**: Test RED coordinator gaps trước behavior; synchronous shared claim trước await cho multiple callers/remount, frozen owner/environment/key/body và conservative marker persisted trước POST, add ID sau response. Known ID read-only bootstrap; lost ID giữ key/body/UNKNOWN và explicit same-intent replay only khi policy/source/no known incident cho phép. Policy true không clear local unknown; current rejection không chứng minh earlier attempt không commit. Failed ID write retains known ID/lock, no replacement. Logout/background/cancel/renew reconnect no replay; dispose private runtime/tickets/QR/cache và late writes, retain only encrypted unresolved A correlation inaccessible in B; resolved cleanup/failed cleanup follows T080, no success claim or new intent from deletion. PAID and independent refresh remain US3, không derive ledger/credit. Full task needs claim/store/network/session failure matrix, no durable recovery claim từ memory remount.
  - **Bằng chứng / truy vết**: L/C simulations + DOC; actual process at T098/T099. FR-001/007/008/009/010/014/021/024/025; SC-002/003/004/006; V01/V08/V09/V10/V11/V13/V16/V18/V25/V26.

- [x] T085 [US2] Nối review/create→QR/status và approved QA host với tests trước UI/source — `apps/mobile/src/features/wallet/index.ts`, `apps/mobile/src/features/wallet/components/topup-form.tsx`, `apps/mobile/src/features/wallet/views/topup-screen.tsx`, `apps/mobile/src/features/wallet/views/payment-screen.tsx`, `apps/mobile/src/features/wallet/qa/payment-qa-host.tsx`, `apps/mobile/app.config.ts`, `apps/mobile/src/app/_layout.tsx`, `apps/mobile/src/qa/payment-qa-entry.tsx`, `apps/mobile/tests/wallet-payment-qa-entry.test.ts`, `apps/mobile/tests/wallet-payment-create-ui.test.ts`, `apps/mobile/tests/wallet-payment-qa-host.test.ts`, `apps/mobile/specs/006-wallet-payment-history/quickstart.md`.

  - **Phụ thuộc**: T084, T078, T076, T093.
  - **Bắt đầu / gate**: READY model/UI/inert QA after producers. D4 workflow hai thiết bị đã duyệt, dùng lại QR source/W T089..T093. Actual operational binding tại T096 vẫn GATED.
  - **Kiểm chứng / hoàn thành**: RED UI/host tests rồi compose: policy snapshot before fresh review/Confirm; dùng approved1.000–2.000.000 VND inclusive, bước1.000, rate1.000 VND/Credit và exact integer text, không rounding. Estimate khác quote thực tế; expiry chỉ backend, replay không gia hạn. Reason-specific own/global support blocks và policy→POST race; same-ID raw QR/render retry/null/REVIEW, owner status và PAID independent Wallet/History refresh. Không tạo intent/key mới khi unknown/missingQR/renderfailure. Back retains draft/identity, accessibility/loading/error/denied/stale/unavailable/success; chỉ1loading per operation. Native-first, web Confirm off. QA host binds injected shared owner runtime/client to approved environment/build+explicit actions; wrong owner/build/environment/production/preview fail closed. Source tests dùng inert boundaries, normal WalletProvider capability defaults/real Confirm giữ off, labeled preview không network/cache thật; no public route/new dependency/new provider. Extend T078-owned app.config.ts/_layout/payment-qa-entry and QA-entry tests sequentially for explicit native financial QA mode, with binding/environment/owner/action checks and real Confirm confined to approved QA host. RED tests prove root actually mounts host, production/preview/web/wrong binding cannot reach it, and no automatic mutation. No new design approval for this D4 source scope. Full task cần đủ UI+host+entry tests and executable producer mount/build-selection contract; invocation/build/environment thực tế chưa cấp thì T096 GATED, không giả command. Không tick từ UI subset hoặc bật normal flag để pass native/financial.
  - **Bằng chứng / truy vết**: L/C/W synthetic + DOC; A/G/NA/NI riêng. FR-001/005/006/007/008/009/010/011/013/014/021/023/024/025; SC-002/003/004/006/007; V01/V07/V08/V09/V10/V11/V12/V14/V15/V16/V17/V24/V25/V26/V29/V30.

- [x] T086 [US2] Ghi full source/fixture create composition checkpoint — `apps/mobile/specs/006-wallet-payment-history/validation.md`, `apps/mobile/specs/006-wallet-payment-history/quickstart.md`.

  - **Phụ thuộc**: T085, T081.
  - **Bắt đầu / gate**: READY C/W after full producers; không yêu cầu tài chính thật để nghiệm thu source checkpoint.
  - **Kiểm chứng / hoàn thành**: Run existingschema/recovery/policy/observer/read/refresh/create/storage/UI/QA tests đủ requested scope và affected P1..P5 regression. W controlled synthetic loopback chứng minh taps/remount/logical intent vsHTTP counters, exact quote, policy/POST race, UNKNOWNlock/Back, replay key/ID, QR composition/null/error/REVIEW và no-egress. Reuse pinned QR screenshot decoder/source checks ở current revision; old T093 remains scoped evidence, no reinstall. Sourcechecks at T094.create after T087; task này không thay parent T094 or old T053/T055/T056 prerequisites. Native process proof, API/channel/real posting NOT_RUN/blocked riêng. Full T086 requires full C/W scope, không tick vì status/QR subset.
  - **Bằng chứng / truy vết**: L/C/W/DOC only. FR-001/005/006/007/008/009/010/011/013/014/021/023/024/025; SC-002/003/004/006/007; V01/V07/V08/V09/V10/V11/V12/V13/V14/V15/V16/V17/V18/V24/V25/V26/V29/V30.

- [x] T087 [US2] Kiểm chứng đầy đủ source recovery boundary và ghi native restart gate — `apps/mobile/tests/wallet-payment-durable-recovery.test.ts`, `apps/mobile/specs/006-wallet-payment-history/contracts/payment-recovery.md`, `apps/mobile/specs/006-wallet-payment-history/validation.md`.

  - **Phụ thuộc**: T082, T084, T086.
  - **Bắt đầu / gate**: READY L/C simulations sau producers. Native/API kill evidence nằm T096/T098/T099, không tạo vòng chờ để source tests chạy.
  - **Kiểm chứng / hoàn thành**: GREEN full logic/fixture matrix: write-before-dispatch/crash-before-or-afterPOST, commit-before-response, failed IDwrite, malformed/abort/timeout, corrupted/oversized/capacity/index failure, Alogout→B→A và latewrites, knownID GET/lostID explicit retained replay, no lifecycle replay/newkey. D1 no-TTL: không bịa expired-retention horizon; total client/backend loss/knownrestore/404/empty discovery giữ support, no replacement oracle. Tách logicalintents/HTTPattempts/backendpostings. Full task needs all assigned simulations and per-case native/API prerequisites recorded; sim success không SC-004/process-kill PASS. Actual native must later run full device checklist, nhưng không là prerequisite của source task này hoặc T096; không skipped assertion thành PASS.
  - **Bằng chứng / truy vết**: L/C/DOC; actual A/G/NA/NI separately gated. FR-001/008/009/010/014/024/025; SC-003/004/006; V01/V02/V08/V09/V10/V11/V13/V15/V18/V25/V26.

- [x] T088 [US2] Đối chiếu source readiness và giữ activation stop gates hiện hành — `apps/mobile/specs/006-wallet-payment-history/contracts/integration-gates.md`, `apps/mobile/specs/006-wallet-payment-history/contracts/payment-recovery.md`, `apps/mobile/specs/006-wallet-payment-history/validation.md`.

  - **Phụ thuộc**: T086, T087, T043.
  - **Bắt đầu / gate**: READY DOC review after producers; activation GATED. Task không bật Payment/Confirm và không prerequisite của actual QA T096 để tránh cycle.
  - **Kiểm chứng / hoàn thành**: Record current contracts/policy/recovery fields/store/coordinator/QR/status/source checks and case trace; D1 source verified with limits, D2 cleanup/capacity implemented/tested vs design, total-loss safe support stop. Ghi từng pending deployment/migration/ingress/QA/build/A/G/NA/NI/QR-01/originalT042/T043/T052/T058 prerequisite. DOC full task complete chỉ khi tất cả mục evidence/stop rõ, không phải permission tài chính hoặc closure full financial readiness. Không dùng fixture/model/web/export/source/BE mock để thay API thật/channel/native.
  - **Bằng chứng / truy vết**: DOC with scoped L/C/W references. FR-001/008/009/010/014/022/025; SC-003/004/006; V09/V10/V11/V12/V13/V15/V16/V18/V25/V27/V28/V30.

## Phase 12 — US2: QR source/decoder/W đã hoàn tất, giữ evidence scope (I5)

T089..T093 giữ nguyên completed blocks và approved D3/D4. Reuse encoder/renderer/decoder; correction mới của Payment metadata ở T052/T076, không làm lại tooling. Native QR/checkpoint và actual bank/payOS/channel ở T042/T097/T098/T099, chưa tự PASS.

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

- [x] T094 Chạy checks theo checkpoint contract/status/create/QR và full mobile regression — `apps/mobile/specs/006-wallet-payment-history/quickstart.md`, `apps/mobile/specs/006-wallet-payment-history/validation.md`.

  - **Phụ thuộc theo checkpoint**: T094.status = T052, T076, T078; T094.qr = T052, T076, T093; T094.create = T086, T087. Full T094 cần union các producers và full regression bắt buộc, không dùng parent như prerequisite để chạy subset.
  - **Bắt đầu / gate**: READY theo scope; status-contract sau T052/T076/T078, create sau T086/T087, QR sau T052/T076 current schema/fixture/metadata corrections và completed T093; không cần T078/create/store. Evidence T093 cũ không tự bao phủ correction revision mới. Actual API/payOS/native không prerequisite của source checks.
  - **Kiểm chứng / hoàn thành**: Chỉ chạy test files đã tồn tại và tạo bởi đúng giai đoạn; status không require wallet-payment-create/durable/QA-financial files hoặc intent/encoder để chạy. Source ổn định: focused + affected/full mobile regression, lint/check-types/check-structure; W bounded fixtures, export chỉ import/build proof. Reuse checks cùng revision/scope, rerun khi source/deps/drift/failure làm evidence không còn hợp lệ; không full rerun sau mỗi task. Record command/revision/case/producers và blocked layers. T094.status không đòi T086/T087; full checkbox T094 cần tất cả contract/status/create/QR scope bắt buộc và legacy regressions, không từ subset; T056 có own prerequisites.
  - **Bằng chứng / truy vết**: L/C/W/DOC; US1..4; FR-001..025; SC-001..007; V01..V30 theo từng scope.

- [ ] T095 Nghiệm thu read-only API thật cho owner status, creation-policy và related refresh — `apps/mobile/specs/006-wallet-payment-history/validation.md`, `apps/mobile/specs/006-wallet-payment-history/contracts/integration-gates.md`, `apps/mobile/specs/006-wallet-payment-history/quickstart.md`.

  - **Phụ thuộc**: T078; named checkpoint T094.status hợp lệ trên revision hiện tại (không cần full T094/create/QR).
  - **Bắt đầu / gate**: GATED A-read: actual executable read-QA binding/build/entry, matching deployed7fc0f83/migration/auth/config, approved own/nonowner IDs/known PAID + exact Wallet/History snapshots. Environment existence đã xác nhận; không hỏi lại D4 design, không đoán binding.
  - **Kiểm chứng / hoàn thành**: Thực hiện chỉ read requests được cho phép: policy3fields/known+unknown reason/own ID vs globalnull, new recovery fields, disabled provider vẫn ownerGET, wrongowner404/denial eviction/current generation/manual checks, same-version operational QR-null/reason cases theo dataset BE có kiểm soát. PAID triggers GET Wallet/History: Home/Wallet dùng backend snapshot, History fresh chain; refresh errors giữ PAID và retry chỉGET. Khi BE chưa cấp fault data thì fault case ghi BLOCKED/A NOT_RUN, không giả fault nhưAPIthật. List transport sau T074:20/status/cursor/order/owner-snapshot và legacy checkout-missing absent list nhưng policy own blocker; không build discovery UI hoặc coi emptylist no-creation. Không create/provider lookup/webhook/seed/markpaid/DB change; không require T079..T093 hoặcG để ownerreads. Full task cần toàn read acceptance được chọn và data; không tick từ health200/source/fixture/statussubset thiếu PAID refresh/policy.
  - **Bằng chứng / truy vết**: A/DOC; FR-001/002/003/004/009/010/011/012/013/014/015/016/017/020/021/024/025; SC-001/003/005/006; V01/V02/V03/V04/V05/V06/V14/V15/V16/V17/V18/V20/V23/V25/V27.

- [ ] T096 Nghiệm thu API create/replay/recovery qua executable QA binding đã được phép — `apps/mobile/specs/006-wallet-payment-history/quickstart.md`, `apps/mobile/specs/006-wallet-payment-history/validation.md`, `apps/mobile/specs/006-wallet-payment-history/contracts/payment-recovery.md`.

  - **Phụ thuộc**: T079, T080, T085, T086, T087; T094.create hợp lệ; không đòi T088 activation closure hoặc native financial để tránh cycle.
  - **Bắt đầu / gate**: GATED A/financial actions: actual deployment/migration/backfill/all-instance rollout + first-release exact POST ingress-block evidence, config/provenance/provider channel, executable QA build/entry/auth/permissions/actions/amount. D4 approved design và environment existence không thay actual binding hay quyền thanh toán.
  - **Kiểm chứng / hoàn thành**: Trước call tài chính, điền/verify runbook6.1 actualbuild/entry/invocation/A/B/data/allowedactions/counters/stops; host producerT085 phải có, không bật normalConfirm/productionflags để pass. Dùng exact stablebody/key201/200same-ID/quote/recoveryfields; lostHTTPmap+survivingPayment/PENDING+PAID, retainedmap/missingPayment409, changedbody409, concurrentfreshkeyblock, REVIEW/legacy, policytrue→POSTblock, pause replay vsproviderdisabled503, interruption/knownID/lostID đúngD1. Fault/restore/migrationdata phải owningBE cung cấp bằng chứng/dataset được duyệt, mobile không xóa mapping/Payment hay restore/seed/DBrepair. Missingallidentity/404/emptylist supportstop, no replacement. Counter intent khác HTTP replay khác actual posting; no provider/mock fixture-as-A. Full task cần đủ assignedAPI cases/requireddata; thiếubinding/action permission case nào giữGATED, tiếp tục phầnđộc lập; không chạy tiền từ docs.
  - **Bằng chứng / truy vết**: A/DOC; financial channel transfer riêngG; FR-001/005/006/007/008/009/010/014/021/024/025; SC-002/003/004/006; V01/V07/V08/V09/V10/V11/V12/V13/V15/V25/V27/V28.

- [ ] T097 Nghiệm thu payOS channel và backend-owned verification/atomic posting — `apps/mobile/specs/006-wallet-payment-history/validation.md`, `apps/mobile/specs/006-wallet-payment-history/contracts/qr-validation.md`, `apps/mobile/specs/006-wallet-payment-history/contracts/integration-gates.md`.

  - **Phụ thuộc**: T096, T093; latest T094.create/qr checks và approved channel scope; không cần full T042/T058/T088 activation để thu evidence.
  - **Bắt đầu / gate**: GATED G: channel/mode/merchant/credentials chỉ BE giữ, actual two-deviceQA build/devices và explicit allowed transfers/amount, webhook/worker/readiness/counters do BE/channel owner cung cấp. Không giả sandbox hoặc tự thực hiện giao dịch thật từ task generation.
  - **Kiểm chứng / hoàn thành**: Verify actualQR scanned from device2, verified callback/delay/duplicate/out-of-order/provider ambiguity/REVIEW and PAID/ledger/wallet/lots/audit/outbox atomicity source-owned. Pause hidesQR vẫn drain/webhook/currentchannel replay; channel switch/no parallel credentials/oldorder block và supportrunbook do operator xử lý, không mobile override. Financialdelta từ exactbackend snapshots/postingcounts, no localincrement/refund/adminworkflow. RawQR/credentials/receipts/logs lưu private theo runbook, no publicdocs. FullGtask needs actual channel outcomes + backendatomicproof at sameversion; source, mockedprovider, independentdecode/W/deviceUI không đủ. LegacyT058 keepsown deps, evidence may be referenced without auto-tick.
  - **Bằng chứng / truy vết**: G/owningBE evidence + DOC; FR-007/008/009/010/011/013/014/017/018/019/021/022/025; SC-002/003/004/006/007; V08/V09/V12/V14/V16/V17/V18/V22/V25/V27/V28/V30.

- [ ] T098 Nghiệm thu Android riêng cho status/QR và full financial restart recovery — `apps/mobile/specs/006-wallet-payment-history/validation.md`, `apps/mobile/specs/006-wallet-payment-history/contracts/qr-validation.md`, `apps/mobile/specs/006-wallet-payment-history/contracts/payment-recovery.md`.

  - **Phụ thuộc theo checkpoint**: status = T078/T095/T094.status; qr = T093/T094.qr (T052/T076/T093 current revision, không T078/create); financial = T096/T097/T094.create; actual platform build/device/data riêng. Named checkpoints không chờ parent/full task.
  - **Bắt đầu / gate**: GATED NA actual device/supported simulator. status→T095 safe realread; QRsynthetic dùng completedrenderer và independent screenshot decoder; financial cần authorized QA host/actions/amount. Không dùng web/Metro/export hoặc platformkia thay bằng chứng.
  - **Kiểm chứng / hoàn thành**: status: newrecovery/policy/exactmoney/ownerdenial/session/tickets/sameversionnull/PAIDrefresh/offline/Back/accessibility; không requirecreate/intent/QR để checkstatus. qr: actualmountedpixels decode rawpayload Unicode/dense/capacity, null/config/version and retry/fault, seconddeviceworkflow separate actualbankG; syntheticQR không chờG/T042. financial: SecureStore owner/environment/index/bytecapacity, actualprocesskill trước/saudispatch/commit/response/IDpersistence, reauthA→B→A/latewrites, knownIDGET/lostIDexplicitreplay/supporttotal-loss, noautomaticmutation/duplicateledger/keyrotation. Source/simulationskhông actualkill. FullcheckboxT098 cần đủ cácplatformscopes bắt buộc và financialend-to-end, không tick từstatus/QRsubset; legacy T059 có prerequisites riêng.
  - **Bằng chứng / truy vết**: NA/DOC, actualAPI/channel evidencecrossreferences; US1..4; FR-001..025; SC-001..007 theo scope; V01..V30.

- [ ] T099 Nghiệm thu iOS riêng cho status/QR và full financial restart recovery — `apps/mobile/specs/006-wallet-payment-history/validation.md`, `apps/mobile/specs/006-wallet-payment-history/contracts/qr-validation.md`, `apps/mobile/specs/006-wallet-payment-history/contracts/payment-recovery.md`.

  - **Phụ thuộc theo checkpoint**: status = T078/T095/T094.status; qr = T093/T094.qr (T052/T076/T093 current revision, không T078/create); financial = T096/T097/T094.create; actual platform build/device/data riêng. Named checkpoints không chờ parent/full task.
  - **Bắt đầu / gate**: GATED NI actual device/supported simulator. status→T095 safe realread; QRsynthetic dùng completedrenderer và independent screenshot decoder; financial cần authorized QA host/actions/amount. Không dùng web/Metro/export hoặc platformkia thay bằng chứng.
  - **Kiểm chứng / hoàn thành**: status: newrecovery/policy/exactmoney/ownerdenial/session/tickets/sameversionnull/PAIDrefresh/offline/Back/accessibility; không requirecreate/intent/QR để checkstatus. qr: actualmountedpixels decode rawpayload Unicode/dense/capacity, null/config/version and retry/fault, seconddeviceworkflow separate actualbankG; syntheticQR không chờG/T042. financial: SecureStore owner/environment/index/bytecapacity, actualprocesskill trước/saudispatch/commit/response/IDpersistence, reauthA→B→A/latewrites, knownIDGET/lostIDexplicitreplay/supporttotal-loss, noautomaticmutation/duplicateledger/keyrotation. Source/simulationskhông actualkill. FullcheckboxT099 cần đủ cácplatformscopes bắt buộc và financialend-to-end, không tick từstatus/QRsubset; legacy T060 có prerequisites riêng.
  - **Bằng chứng / truy vết**: NI/DOC, actualAPI/channel evidencecrossreferences; US1..4; FR-001..025; SC-001..007 theo scope; V01..V30.

- [ ] T100 Bàn giao traceability100 tasks và từng lớp readiness/activation — `apps/mobile/specs/006-wallet-payment-history/tasks.md`, `apps/mobile/specs/006-wallet-payment-history/validation-matrix.md`, `apps/mobile/specs/006-wallet-payment-history/validation.md`, `apps/mobile/specs/006-wallet-payment-history/contracts/integration-gates.md`.

  - **Phụ thuộc**: T078 và T094.status cho handoff.status; full task cần T088/T094/T095/T096/T097/T098/T099 và applicable originalgates T042/T043/T052/T058/T059/T060, không dùng status handoff để skipfull deps.
  - **Bắt đầu / gate**: READY DOC scoped handoff; full financial GATED until all applicable evidence. No capability enablement/sourceorfinancial action in handoff.
  - **Kiểm chứng / hoàn thành**: Preserve original68checked/100IDs; ticks later only fullcriteria evidence. Trace US1..4/25FR/7SC/30V tofiles/tests/producers/revision/source vsfixture/W/A/G/NA/NI. Record status+policy+recoverycorrection independently, D1sourceverifiedwithlimits and knownall-loss supportstop, D2cleanup/store actualproof vsproposal, reusableQR vsnative/channel open. MissingAPI/build/channel/permission/native staysBLOCKED/GATED; no subset-as-parentPASS, no skippedfinancialassertionPASS. Fullhandoff requires all scope/gates evidence; proposedactivation remains separate authorizedrelease, no new tasks/auto-nextcommand.
  - **Bằng chứng / truy vết**: DOC aggregating scoped evidence; US1..4; FR-001..025; SC-001..007; V01..V30.

## Truy vết integration extension và ranh giới bằng chứng

Các bảng FR/SC/V sau giữ coverage gốc (không phải acceptance PASS). Current correction ownership bổ sung ở bảng tiếp theo; T076 không còn discovery UI. Các mapping cũ nhắc optional T076 không cấp scope discovery. No new FR/SC/V IDs; full catalog vẫn25/7/30.

| Plan package | Task IDs / current responsibility                                | Gate                                                                                            |
| ------------ | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| I1           | Completed T063..T066; new schema fields owned by unchecked T052  | New tests trước schema, old checked evidence unchanged.                                         |
| I2           | Completed T067..T075/T077; correction T076, policy/QA reads T078 | T052→T076→T078 READY source; actualA at T095; discovery UI NOT_SELECTED.                        |
| I3           | T079/T080                                                        | SourceD1 verified; full DOCclosure+cleanup/capacity trước store, no total-loss oracle invented. |
| I4           | T081..T088                                                       | Full source producers/deps required; defaults/Confirm off; real A/G/native separately gated.    |
| I5           | Completed T089..T093 reuse                                       | Native/channel and original QR-01/T042 still open.                                              |
| I6           | T094..T100                                                       | Layer/scope checkpoints; no subset-as-parent PASS.                                              |

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

### Ownership bổ sung cho contract7fc0f83

| Requirements / cases (existing IDs)                                                         | Producer mới trong unchecked tasks                                                           | Exit / limits                                                                                                                                         |
| ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-001/004/009/010/011/012/014/021/024/025; SC-003/006; V01/V02/V03/V14/V15/V16/V18/V25/V26 | T052 tests/schema/types, T076 reducer/status, T078 GETpolicy/readQA                          | All current recovery/policy fields and equal-version behavior tested; no intent/create/QR dependency, no APIthật claim.                               |
| FR-005..010/014/021/024/025; SC-002/003/004/006; V07..V13/V15/V25/V27                       | T079/T080 closure/cleanup; T081 RED; T082..T085 implementation; T086/T087 source cases       | policy→POSTrace, mappingloss/survivingID, missingPayment409, retained unknown/key/body, native store/capacity failclosed; no loss-replacement oracle. |
| FR-011/013/014/023/024/025; SC-003/006/007; V05/V14..V18/V24/V26/V29/V30                    | T076+T078 independent status, T085 composition                                               | PAID and related refresh independent; QR-null remains latched; recoverymetadata clearing doesn't restoreQR; preview/QA no-egress and Back accessible. |
| FR-001..025 / SC-001..007 / V01..V30 scoped                                                 | T094 source/W; T095 Areads; T096 Acreate; T097 G; T098 NA/T099 NI; applicable original gates | Requirements/cases only PASS when their own full applicable evidence exists; no fixture/source/W-as-A/G/native.                                       |

## Dependency, ownership và checkpoint hiện hành

IDs giữ lịch sử, không phải thứ tự phải chạy. Forward references chỉ tới task mới được giao scope rõ; không bỏ dependency ngầm. Current execution graph:

```text
Completed foundation + Wallet/Home + History + P4/P5 + I1/I2 + QR remain
  T051 + T064 -> T052 (RED current DTO/policy -> schema/types)
  T052 + T070/T072/T075/T077 -> T076 (RED -> reducer/status UI)
  T052/T076/T077 -> T078 (RED -> policyGET/scopedreads/QA read source)
  T078 -> T094.status (latest scoped checks, NOT full T094)
  T078 + T094.status + approved actual read binding/data -> T095
  (US3 branch above has NO T079/T080/create/intent/storage/QR requirement)

  T063 + T051 -> T079 (D1/source/unsupported support-stop DOC)
  T079 + T052 -> T080 (final record/index/cleanup/capacity DOC)
  T041 + T079/T080 -> T043 (source-contract/activation-stop DOC)
  T080 + T052/T076/T078 -> T081 (complete RED case producer)
  T081 -> T082 [P] storage tests+source
  T081 + T078 -> T083 [P] create/replay tests+adapter
  T082/T083/T076 -> T084 durableclaim/coordinator
  T084/T078/T076/T093 -> T085 review/QR/status/QA composition
  T085/T081 -> T086 full C/W checkpoint -> T087 full source recovery
  T086/T087/T043 -> T088 DOC readiness/stop (does NOT activate)
  T086/T087 -> T094.create; T052/T076 + completed T093 -> T094.qr
  (T094.qr has NO T078/create/store prerequisite; all current affected producers required)
  Full T094 needs all required scope/regression; no checkbox from subset
  T079/T080/T085/T086/T087 + T094.create + allowed actions/runbook -> T096
  T096/T093 + scoped checks + approved channel -> T097

  T078/T095/scoped checks + Android or iOS -> T098.status / T099.status
  T093 + T094.qr + Android or iOS -> T098.qr / T099.qr (synthetic pixels)
  T096/T097/scoped checks + native financial permission -> T098.financial / T099.financial
  T038/T041/T093 + T098.qr/T099.qr -> T042 full QR DOC/nativegate
  Original T043/T052/T042/T056/T055 + actualG record -> T058 legacy G gate
  (T097 doesn't wait for T042/T058; no G/QR circular readiness dependency)

  T078/T094.status -> T100.status DOC partial handoff
  All required source/A/G/NA/NI + original applicable gate deps -> full T100
```

- Current graph labels checkpoint nodes explicitly: T094.status does not mean full T094, T098.qr does not mean full T098. Their producing scopes are verified and logged before use; a parent checkbox remains unchecked until all its scope is done. Earlier dependency graphs/tables above describe baseline/preparation; this graph and task bodies govern the remediated execution.
- Legacy T053/T054/T056/T057 wallet/history checkpoints retain independent prerequisites. T055 model coordination and T058 financial gates keep their original dependencies; T059/T060 device scopes not passed from newstatus-only results. No taskgeneration runs a harness or native acceptance.
- T088 DOC doesn't gate T096 execution; T096/T097 actualQA permission/data are separate. T087 source simulations don't wait for actual devicekill; device recovery proof at T098/T099 remains mandatory for native acceptance. This avoids source→A→G→native→source cycles.

| Shared file owner                  | Resource order / concurrency rule                                                                                                                                                                                                                                                                                      |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Payment types/schema/fixtures      | T052 first; T081 later adds create fixtures. Never write same shared fixture concurrently; T082 durabletest and T083 createtest own different files.                                                                                                                                                                   |
| Observation/status presentation/UI | T076 after schema, T078 consumer after T076, T085 composition after producers. US3 doesn't wait for US2.                                                                                                                                                                                                               |
| payment-api/querykeys              | Existing T068/T074 complete, T078 policyGET first, T083 POST later. Serialize one HTTP adapter, no duplicate clients.                                                                                                                                                                                                  |
| Store vs POST                      | T082 native/web store/test and T083 adapter/test can [P] after dependencies because disjoint files; T084 consumes both.                                                                                                                                                                                                |
| Owner/runtime/QA hosts             | T078 first: app.config.ts, thin _layout, src/qa/payment-qa-entry.tsx, wallet public index + entry tests/read host. T085 extends same files after T078 for financial QA; serialize writers, no new provider/public route. Read entry must not import unfinished create/store/QR modules. Normal/preview flags stay off. |
| Docs/model/contracts               | T079 + T052 can be coordinated on different files; T080 after both; T043 after T080. All validation/quickstart/gate writers serialize.                                                                                                                                                                                 |
| QR / package / lock                | Completed T089..T093 unchanged; no install/reselection or shared dependency edits in correction. Re-run affected checks only as justified by integration changes.                                                                                                                                                      |

Parallel examples by story: US1/US4 are already complete; independent Aread/device dataset preparation may run in parallel with US3/source work but docs writer serializes. US3 T052 then T076 then T078 are ordered; T076 source and US2 T079 DOC may proceed independently after their own dependencies. US2 T082 and T083 are [P] after T081; no other task may concurrently change their shared fixture/runtime. Native Android/iOS runs can be coordinated independently once appropriate scoped prerequisites and permissions exist; record writers serialize, no [P] on shared-document tasks.

## Tổng số và chiến lược thực thi hiện hành

| Nhóm                                                     | Tổng | Completed | Unchecked |
| -------------------------------------------------------- | ---- | --------- | --------- |
| Setup/foundation + I1                                    | 15   | 15        | 0         |
| US1 Wallet/Home                                          | 9    | 9         | 0         |
| US4 History/detail                                       | 12   | 12        | 0         |
| US2 prep/create/QR/recovery                              | 26   | 25        | 1         |
| US3 prep/owner status/current contract-policy correction | 21   | 21        | 0         |
| Cross-cut/evidence                                       | 17   | 1         | 16        |
| Total                                                    | 100  | 83        | 17        |

Source batch T052→T076→T078 và T079/T080/T043→T081..T088 đã hoàn tất trong phạm vi source/fixture; full T094 source checks đạt. Phần tiếp theo là bằng chứng được cấp riêng T095 owner-read API → T096 create/replay → T097 payOS → T098/T099 native; chưa đủ actual binding/actions/build/data thì giữ GATED, không bật production. T100 chỉ handoff partial; full parent và original gates vẫn có prerequisites riêng. Không tự chạy Spec Kit tiếp theo.

## Implementation ownership and scoped handoff — 2026-10-18

These helper splits implement the listed producers without adding task IDs or a new route/provider/dependency. T052 owns required metadata/CreationPolicy parser and synthetic DTO fixes; T076 owns equal-version recovery metadata/QR detach-latch/status warning. T078 owns payment-policy-query, creation-policy hook, use-qa-runtime/use-qa-related-refresh, read host, build selector and private root mount. T079/T080/T043 DOC closure is recorded in recovery/integration-gates/contracts; final slot design preceded store work.

T082 adds storage/correlation-store-core.ts plus platform openers and utils/payment-recovery-record.ts. T084 splits utils/payment-create-runtime.ts (session/ticket/lease), payment-create-observe.ts (accepted projection/cleanup), payment-create-dispatch.ts (explicit POST/replay), payment-create-state.ts and payment-create-coordinator.ts; context/payment-create-session.ts shares one model per environment/session. T085 composes components/payment-create-panel.tsx and qa/payment-qa-host.tsx through lazy qa/financial-entry.tsx, public index and existing private QA root. Normal topup-form/views remain gated and their source isolation is tested; no artificial normal-route changes. preview/create-host.ts and create.tsx extend only the existing labeled preview with private synthetic memory/boundaries, never native storage/account HTTP. T082/T083 implementation/test writers remain disjoint; shared root/config/export writers serialize T078→T085.

T094.status, T094.create and T094.qr each met all own producers on this revision, followed by full mobile source regression/checks. Full T094 checkbox covers that complete source scope only. T095/T096/T097/T098/T099 are NOT_RUN/GATED (actual read/APIcreate/channel/NA/NI); source bundles and pixels are not substitutes. T100.status/eligible-source handoff is recorded; full T100 remains unchecked with legacy T042/T053..T062 and actual evidence prerequisites. No scoped parent or original financial/native task is ticked from a subset.
