# Trạng thái Phase03 Wallet và Top-up

## Hiện trạng

- Cập nhật lúc: 2026-10-22T15:19:11+07:00.
- Trạng thái: Sau cleanup và rebase, sửa danh sách Sonar người dùng cung cấp: tách nhánh UI/cancel/events/observation/query và fixture, nhóm chữ số tuyến tính, kiểm Unicode QR theo code point; sửa async thừa, constructor Error, Number.NaN và tham số placeholder. SonarJS local trên 27 file code đạt ngưỡng cognitive 15, không nested conditional/ternary hoặc super-linear regex; type-aware require-await đạt. Full suite 574/574. Source Sonar đã commit theo nhóm runtime và UI; chưa chạy Sonar server hoặc nghiệm thu điện thoại/deployed SSE/provider.
- Nhánh/baseline: mobile `feat/mobile-wallet-payment-history`, `9e86bb90` sau rebase lên `1c8fb8d9398480d62505d361c36bc11584c1e443`, thêm các commit refactor Sonar theo yêu cầu. Sau rebase, source mobile khớp bản đã kiểm trước đó; BE hiện tại giữ nguyên nhánh đích, gồm cancel/recovery đã đối chiếu. Không sửa BE/shared/root tooling trong lượt Sonar.
- Source có thật: Wallet/Home, history/detail, native create/recovery/QR/status và explicit cancel có xác nhận. CANCELLED là terminal, dừng polling và resolve correlation đủ điều kiện; PAYMENT_RECOVERY_PENDING có copy riêng và không tự mở intent mới. Web và independent status vẫn read-only.
- Checkout ưu tiên `payment.updated`/`wallet.updated` đúng owner/payment qua public subscription của SSE app. Event chỉ GET hydrate, không dùng payload để tự xác nhận PAID hoặc cập nhật Credit; ready/subscription có catch-up GET. Đọc event chờ request cũ kết thúc rồi bắt đầu GET mới, tránh nhận lại PENDING từ poll cũ. Consumer hoàn tất trước cursor acknowledgment; dedupe/version/abort/focus guards giữ riêng theo owner.
- Poll là dự phòng: SSE connected dùng 30 giây/20 reads; chưa kết nối/gián đoạn dùng 2 giây/300 reads. Budget khoảng 10 phút scheduled waits cho mỗi cửa sổ focus/foreground hoặc đổi kết nối; REVIEW/UNKNOWN vẫn 30 giây/120 reads, lỗi backoff 10/20/30. Hết safety-read budget nhưng SSE còn kết nối vẫn báo đang theo dõi. QR không có check thủ công; independent status và web reads vẫn dùng policy HTTP hiện hành. Không mutation qua event/lifecycle.
- Một regression nhãn được tái hiện RED: bootstrap/create/recovery cũng dùng command busy nên từng hiện “Đang xử lý yêu cầu hủy…” dù không hủy. Hiện `cancelling` chỉ bật trong cancel explicit, kể cả preflight; kiểm tra nền/khôi phục không gắn nhãn hủy. PAID/terminal từ GET vẫn ẩn nút và đóng modal. Chưa xác minh đây là toàn bộ nguyên nhân quan sát trên bản cài điện thoại.
- Hai nhánh nhấp nháy đã tái hiện trước đó: pending GET từng làm canCancel=false; sau fix lease, GET lỗi/stale vẫn làm canCancel=false và UI dùng flag này để ẩn nút. Hiện visibility dựa Payment PAYOS CREATED/PENDING đang giữ; nút mở modal và giữ màu qua GET/stale. canCancel không còn quyết định disabled UI; coordinator xác nhận bằng GET mới khi stale trước POST. PAID/REVIEW/denial/lỗi/conflict không POST, blur/logout invalidates continuation. checking/command priority, QR privacy, cadence và storage schema không đổi.
- Modal xác nhận ở giữa màn hình theo pattern LogoutDialog hiện có; không giãn layout QR. Có quote amount khi có, nút tiếp tục và xác nhận đỏ. Back/backdrop/tiếp tục chỉ đóng; inactive/terminal/denial đóng modal, không tự mở lại khi resume. Chỉ thao tác command thực sự làm nút disabled/hiện tiến trình.
- Command explicit vẫn ngắt GET bằng abort/ticket, giữ lease mới và same-key cancel; late GET không đổi outcome hoặc mở khóa command. Poll không ngắt command, pending cancel giữ nút disabled “Đang hủy thanh toán…”. Không sửa BE/storage schema.
- Đối chiếu BE dev: GET detail chỉ đọc DB projection; webhook verified mới ghi PAID/Credit. Worker fallback đặt nextAttemptAt +60 giây và sweep 15 giây. Nhịp FE cũ giải thích một phần chậm đã báo; chưa có trace thực tế để kết luận phần thời gian provider/webhook/deployed API.
- Cancel dùng no-body POST + stable key theo Payment ID, tách operation tạo đơn. Busy/timeout đọc lại; explicit retry cùng key, không tự POST khi resume/restart. PAID/REVIEW/denial và late session được xử lý; chưa đổi schema SecureStore hoặc backend.
- Hai fixes trước (account restore/check và fresh related reads sau PAID) được giữ nguyên. Plan/contract/index/roadmap/matrix/architecture/state docs cập nhật theo BE dev; spec006 giữ nguyên task IDs/checkbox/nội dung.
- Theo quyết định mới nhất, đã bỏ toàn bộ mục trợ giúp, báo mất yêu cầu, hướng dẫn mở rộng và lời dẫn liên hệ hỗ trợ khỏi UI payment/QA. Không còn entry UI gọi `supportStop`; khôi phục, hủy và guard total-loss/correlation hiện có được giữ nguyên. Nút kiểm tra còn ở các màn đọc/khôi phục khác, bị ẩn trong QR kể cả fallback blocked; chưa có ID vẫn có explicit restore/same-key tiếp tục.
- Nghiệm thu người dùng: Chưa thực hiện; không suy từ checks.
- Cấu trúc T16: route → screens/views → hooks/context/utils → api; schemas/types/storage và components tách theo trách nhiệm. Import graph AST xác nhận toàn bộ module runtime Wallet có đường dùng từ src/app, không src nào import tests. Ambient qrcode-core.d.ts giữ để khai báo thư viện, không phải file runtime mồ côi. QA là công cụ API nội bộ có binding owner/build/environment; không khôi phục preview hoặc mock account data.
- Đã chuyển sáu module không có application consumer (intent/result/observer mẫu và helper query/read/navigation cũ) sang tests/fixtures; tách các phần model-only khỏi outcome, QR, policy và types. Test HTTP thật dùng payment-read-query trực tiếp thay re-export từ observer mẫu. Không thay API contract, storage hoặc behavior coordinator; 573 test được giữ, không bỏ test để dọn cấu trúc.
- Review trước commit: gỡ model preparation cũ khỏi WalletProvider, chuyển helper lịch sử sang test fixture để giữ coverage; xóa hai hook không có caller và màn unavailable cũ, alias palette và subtitle props không dùng. T15 đã thay guard development của T14 bằng xóa toàn bộ Wallet preview; không còn folder, route, export, catalog hoặc notification demo. Hai host regression chuyển vào tests/fixtures; bỏ form mẫu không còn caller. QA vẫn cần binding internal owner/build/environment hiện hành.
- Review event: GET thấp hơn version trong hint hoặc chưa có projection fresh không được đánh dấu processed/ack cursor; giữ event để reconnect/replay và fallback tiếp tục đọc. Catch-up ngoài stream có catch riêng, tránh unhandled rejection. Retry budget không reset chỉ vì nhận ready; reset sau kết nối ổn định 30 giây hoặc foreground/explicit retry, chặn ready→bad replay lặp vô hạn. Không event nào tự xác nhận PAID/đổi Credit/POST.
- Git: vẫn nhánh `feat/mobile-wallet-payment-history`; 5 commit sau rebase: `2a3884f7` component dùng chung, `017c4b11` event subscriptions/reconnect, `74762a66` lịch sử/chi tiết giao dịch, `30167ea9` nạp/hủy/recovery và dọn preview/model cũ, `9e86bb90` tài liệu. Refactor Sonar đã commit riêng: 0dc35c2c runtime/storage/fixtures/script, 00c259ef UI và kiểm thử component; tài liệu chốt trong commit tiếp theo. Chưa push. `.env`/`.expo` ignored; dependency phục vụ kiểm SonarJS local nằm trong `.expo`, không đổi manifest/lockfile.
- Chỉnh nhẹ số trong card nạp theo phản hồi tiếp theo: ô tiền 17→20, Credit ước tính 13→15, preset 11→13; dùng token typography hiện có, giữ card gọn và chức năng. Lượt typography chỉ chạy lint/format/diff checks, không chạy lại suite hoặc export; số 571/571 bên dưới thuộc lượt T13.
- Lịch sử theo yêu cầu tham khảo [VCB Digibank](https://portal.vietcombank.com.vn/content/personal/KhoAnh/20221130_HDSD%20VCB%20DIGIBANK/21.%20Tra%20cu%CC%9B%CC%81u%20li%CC%A3ch%20su%CC%9B%CC%89%20giao%20di%CC%A3ch%20ta%CC%80i%20khoa%CC%89n-the%CC%89.pdf): từng dòng phẳng, đường phân cách mảnh, không card/icon; ngày giờ đầy đủ trong mỗi dòng, Credit căn phải. Switch Tất cả/Nạp Credit/Học tập luôn hiển thị, dùng cùng RN component trên native/web; giữ mapping filter, backend order, cursor, owner/session và pull refresh. Combined filter đang giữ vẫn hiển thị, chỉ đổi khi người dùng chọn nhóm; không thêm bộ lọc ngày chưa có API.
- Chi tiết dạng biên nhận phẳng, không icon: loại giao dịch, Credit, trạng thái, thời gian, mã giao dịch và mã giao dịch gốc khi có reversal. Đã bỏ các phần biến động ví, số dư khả dụng/tạm giữ/sau giao dịch theo yêu cầu mới; ẩn operationId và UUID tham chiếu nội bộ. Không bịa tên người nhận/ngân hàng, phí hoặc VND gốc từ Credit. Parser/contract không đổi.
- Card số dư trước đây được render trực tiếp ở màn Nạp Credit; đã gỡ card và Wallet query riêng của màn này. Ví Credit vẫn có số dư và note. Form nhập tiền/review/preset, min 2.000 VND, cancel modal và coordinator không đổi.
- Đã khôi phục note giải thích tỷ lệ Credit và Credit tạm giữ ở màn Ví Credit theo yêu cầu. QR hiện ưu tiên quote/QR, deadline và status inline, mã thanh toán nhỏ ở cuối; không còn hướng dẫn quét hoặc khung card deadline/mã/hủy. Hủy dùng đỏ nhạt, xác nhận đỏ đặc; các thông báo lỗi được viết gọn hơn và không suy PAID từ error code. Giữ theme/font, số dư Wallet API, sáu preset, review và ngưỡng mới 2.000 VND; bản ghi cũ 1.000 VND vẫn recovery/retry cùng key theo BE.
- UI verification là source review, synthetic bundle và JS export; không phải screenshot/native visual acceptance. API/provider, Android/iOS SecureStore/process termination và UI/device UAT chưa chạy. Không có giao dịch thật trong lượt này.
- Bước tiếp: trên thiết bị/API triển khai, kiểm `/events` trả SSE và payment.updated sau commit, foreground/background/reconnect/cursor rồi GET PAID, nút hủy qua bootstrap/poll/preflight. Đối chiếu ngân hàng → webhook → commit → event → GET để xác định phần chờ còn lại. Xác nhận deployed cancel/CANCELLED/recovery/migration trước UAT theo [plan](plan.md); không sửa BE hoặc kết luận tốc độ thực tế từ fixture.

## Bằng chứng hiện hành

| Phạm vi | Kết quả | Môi trường/giới hạn |
| --- | --- | --- |
| Sonar follow-up | SonarJS 4.2.2 local: 27 file code, 0 lỗi ở cognitive-complexity (15), super-linear-regex, no-nested-conditional và no-nested-ternary; type-aware require-await đạt. Full suite 574/574, types/unused, lint mobile, structure 600 files đạt | Logs `.expo/wallet-sonar-rules.log`, `.expo/wallet-sonar-tests.log`, `.expo/wallet-sonar-types.log`, `.expo/wallet-sonar-lint.log`. Tool chỉ cài trong `.expo`; không đổi manifest/lockfile. Không thay Sonar server scan hoặc UAT native/provider |
| Contract BE dev | Đã đọc controller/DTO/use case/worker/read projection và HTTP009 tại `1c8fb8d` | Git source, không phải deployed API |
| Follow-up trợ giúp trước khi bỏ UI (lịch sử) | Focused 35/35 PASS | Log `.expo/payment-help-tests.log`; các tương tác help sau đó được gỡ theo yêu cầu mới nhất |
| Regression RED | 7/7 ca đầu thất bại trước implementation | API/coordinator chưa có cancel; CANCELLED chưa terminal |
| Full mobile suite trước redesign form top-up | 542/542 PASS, 0 fail/skip | Log `.expo/payment-design-tests.log`; gồm cancel/recovery/deadline/checkout UI và consumer auth/profile/skills/LR, QR encoder/decoder. Không chạy lại suite trong lượt redesign form |
| Ngưỡng 2.000 VND và bỏ note Credit | Full suite 544/544 PASS | Tạo mới bị chặn dưới 2.000 VND; bản ghi cũ 1.000 VND vẫn recovery/retry cùng key; UI regression xác nhận note vắng ở draft và review. Log `.expo/payment-minimum-full-tests.log` |
| Redesign các màn Wallet payment | Full suite 544/544 PASS; preview bundle và Expo export Android/iOS/web PASS | Tổng tiền/Credit đặt trước QR, palette chung scoped, status/history/detail được làm rõ. Log `.expo/payment-redesign-tests.log`; không xác nhận screenshot/device |
| Rút gọn nội dung và bỏ trợ giúp | Full suite 542/542 PASS; types/lint/structure/preview bundle PASS | Log `.expo/payment-content-cleanup-tests.log`; 3 test tương tác help cũ thay bằng 1 test xác nhận UI không lộ help/báo mất, giữ hồi phục/check/cancel regressions; không skip test |
| History/receipt theo VCB và khôi phục note ví (trước T12) | Full suite 548/548 PASS; types/lint/structure PASS | 6 ca cũ kiểm exact decimals, dấu delta, HOLD, held về 0, thứ tự/nhóm ngày và ẩn mã nội bộ trong receipt. Log `.expo/wallet-history-receipt-tests.log`; phần nhóm ngày/biến động sau đó được bỏ theo T12, không dùng evidence này thay kiểm chứng UI hiện tại |
| Rút gọn màn nạp/history/receipt T12 | Focused 5/5 và full suite 561/561 PASS, 0 fail/skip; type/lint/structure PASS | Thay 6 test presentation cũ bằng 5 ca: exact amount/time/identity và ẩn số dư/mã nội bộ, status/reversal, ngày giờ mỗi dòng/onOpen, switch mapping/reselect, retained combined filter. Log `.expo/wallet-history-compact-tests.log`; JSX tổng hợp không thay mounted/native visual UAT. Structure 624 source files sau gỡ card/helper/control cũ |
| Giảm trễ kiểm tra thanh toán | Focused 41/41 và full suite 552/552 PASS; type/lint/structure PASS | 4 ca mới: nhận PAID sau tối đa 2 giây chờ + API giả lập, nhịp nhanh cho chuyển khoản muộn trong budget, hồi phục sau lỗi và giữ cadence/budget REVIEW/UNKNOWN. Giữ các ca serialized/lifecycle/denial/cancel/related refresh. Log `.expo/payment-confirmation-focused.log`, `.expo/payment-confirmation-full-tests.log`; RED trước fix 3 ca cadence không đạt tại `.expo/payment-confirmation-red.log`. Không đo provider/API/native thật |
| Thu gọn QR/cancel/copy | Full suite 552/552 PASS; type/lint/structure PASS | Cập nhật regressions có sẵn: không lộ check/scan/help trên QR, vẫn thông báo khi hết budget, ẩn QR stale/cancel, hủy cần xác nhận và bị chặn inactive/busy, fallback QR giữ restore trong khi màn khác vẫn có check. Log `.expo/qr-checkout-cleanup-tests.log`; source review màu/spacing, chưa native/pixel UAT |
| Ổn định polling và ưu tiên hủy explicit | Full suite 556/556 PASS; type/lint/structure PASS | 4 regressions RED trước fix, sau fix đạt: giữ cancel/QR qua nhiều GET; cancel ngắt GET chậm; late GET không mở khóa command mới/đổi dữ liệu; GET không ngắt command; UI xác nhận trong GET và giữ nút pending cancel disabled. Logs `.expo/payment-poll-stability-red.log`, `.expo/payment-poll-stability-full-tests.log`, `.expo/payment-poll-stability-final-focused.log`. Synthetic transport/JSX callbacks, không native/API/provider thật |
| Nút hủy qua GET lỗi/stale/phục hồi | Focused 19/19 và full suite 558/558 PASS; type/lint/structure PASS | RED tái hiện UI mất nút khi canCancel=false dù Payment PENDING còn giữ. Sau fix: giữ action/confirmation, khóa click stale, mở lại sau fresh read; terminal/REVIEW/denial ẩn, durable identity giữ nguyên và không POST khi stale. Logs `.expo/payment-cancel-visibility-red.log`, `.expo/payment-cancel-visibility-focused.log`, `.expo/payment-cancel-visibility-full-tests.log`. JSX/coordinator synthetic, chưa trực quan trên điện thoại thật |
| Màu nút ổn định và modal xác nhận | Focused 23/23, full suite 562/562 PASS; type/lint/structure PASS | 3 regressions RED preflight trước fix. Kiểm GET/stale không disabled nút, modal hai lần bấm, Back/backdrop/inactive chỉ đóng, terminal đóng; xác nhận stale GET mới, PAID/REVIEW/403/404 không POST, rời màn trong GET không cancel muộn, cùng key/coalesce giữ nguyên. Logs `.expo/payment-cancel-modal-red.log`, `.expo/payment-cancel-modal-full-tests.log`, `.expo/payment-cancel-modal-final-focused.log`. Native modal dùng RN theo pattern app sau kiểm API Expo UI universal không có centered dialog; source/bundle chưa thay pixel/native UAT |
| Event checkout và nhãn hủy T13 | Focused 42/42, full suite 571/571 PASS; 0 fail/skip | 1 regression RED nhãn busy chung tại `.expo/payment-event-label-red.log`; 10 ca bổ sung cho nhãn, fresh event GET/PAID và pause, ref validation/dedupe/owner, hint không phải PAID, safety cadence, shared cursor/consumer failure. Logs `.expo/payment-events-focused.log`, `.expo/payment-events-full-tests.log`. Chat hydration/reconnect/auth/cursor tái sử dụng; synthetic tests chưa thay native/deployed event acceptance |
| Audit trước commit T14 (trước T15) | Full suite 575/575 PASS, 0 fail/skip; focused 30/30 và preview gate 1/1 | Regression RED stale event tại `.expo/wallet-audit-event-red.log`; 4 ca mới cho version chưa bắt kịp, ready→bad replay retry budget, healthy/reset và production/dev preview. Logs `.expo/wallet-audit-full-tests.log`, `.expo/wallet-audit-focused.log`; guard và test preview sau đó được thay bằng removal ở T15 |
| Gỡ Wallet preview T15 | Focused 21/21 và full suite 573/573 PASS, 0 fail/skip | Hai test chỉ kiểm preview navigation/dev gate bị gỡ cùng tính năng; kiểm kiến trúc được đổi sang xác nhận folder/route/menu/export mẫu không tồn tại. Host tạo đơn/QR chuyển sang tests/fixtures, vẫn giữ behavior/QR decoder coverage. Logs `.expo/wallet-preview-removal-focused.log`, `.expo/wallet-preview-removal-tests.log` |
| Rà cấu trúc T16 | Full suite 573/573 PASS, 0 fail/skip; AST import audit PASS | Runtime Wallet reachable từ app routes; không source import tests; tên style khớp component; không preview hoặc legacy-model helpers trong application graph. Log `.expo/wallet-structure-tests.log`; helper/model fixtures là scaffolding lịch sử, không là implementation runtime hoặc bằng chứng nghiệm thu native |
| Typecheck/lint/structure | PASS trên source mới nhất | `tsc --noEmit --noUnusedLocals --noUnusedParameters`, ESLint toàn mobile `--max-warnings 0`, checker 600 source files. Logs `.expo/wallet-structure-types.log`, `.expo/wallet-structure-lint.log`. Format các file di chuyển/sửa đạt; không đổi dependencies |
| UI review | PASS trong phạm vi source/build | Source review và synthetic preview bundle; trạng thái pending/recovery/deadline/cancel giữ nguyên logic. Không mounted trong app thật/device và không pixel-review screenshot |
| Form top-up mới | Source, preview bundle và Expo export PASS | Form dùng Wallet projection/policy, compact entry, ngưỡng mới 2.000 VND, palette/gradient theo HTML, hậu tố VND, header centered và review/confirm hiện hành; note riêng đã bỏ khỏi draft/review. Preview synthetic không thay native visual/API acceptance |
| Dependencies | Đã phục hồi | Root pnpm10.24 `install --frozen-lockfile --ignore-scripts --config.confirmModulesPurge=false`; không đổi manifest/lockfile. Trước đó QR thiếu qrcode và tsc thiếu jsqr |
| Export Android/iOS/web | PASS sau cấu trúc T16 và UI/payment hiện hành | `expo export --platform all --no-bytecode --output-dir .expo/wallet-structure-export`; log `.expo/wallet-structure-export.log`. JS export không thay native acceptance |
| Diff/docs integrity | PASS | Whitespace sạch; link trong contract/plan/status resolve; spec006 giữ nguyên 100 task IDs/83 checked; không sửa BE/shared/root manifest/lockfile hoặc staged index |
| Actual API / payOS / native / UAT | NOT_RUN | Không giao dịch thật, không gọi cancel tài khoản thật; chưa native SecureStore/process-kill |

Checkout deadline chỉ định dạng `expiresAt` do BE trả: khi countdown chạm 0, UI báo đang chờ server, không đổi Payment state, tự hủy hoặc gia hạn. QR chỉ render khi payment active, PENDING, có checkout identity khớp payment ID/raw QR, không stale/cancel pending/recovery. Bank account/recipient không có trong checkout model nên không được bịa hoặc hiển thị.

Full suite đầu 533/534: test cũ hardcode 7 labels chưa tính CANCELLED. Sau sửa uniqueness theo `paymentStates`, suite 534/534. Source review phát hiện automatic description che recovery guidance; sửa điều kiện và thêm JSX regression, full suite cuối 535/535. Không bỏ hoặc skip test. Logs cục bộ ignored: `.expo/payment-cancel-red.log`, `.expo/payment-be-full-tests.log`, `.expo/payment-be-export.log`.

## Bằng chứng lượt 2026-10-20 (lịch sử)

| Phạm vi | Kết quả | Mốc và giới hạn |
| --- | --- | --- |
| Baseline source/contract | PASS trong phạm vi được giao | SRS 18.14–18.17, current controller/DTO, source wallet và spec006; mapping trong plan |
| Regression RED | Đã tái hiện hai lỗi | Missing restore action trong account JSX và Query coalesce pre-PAID; lỗi harness JSX ban đầu được sửa trước khi xác nhận RED hành vi |
| Focused GREEN | 5/5 PASS | `tsx --experimental-test-module-mocks --test tests/wallet-account-recovery.test.ts tests/wallet-payment-read-refresh.test.ts`; callback test mock native leaves, không phải render/device |
| Full mobile suite | 522/522 PASS, 0 failed/skipped | Installed `tsx --experimental-test-module-mocks --test --test-concurrency=4 tests/**/*.test.ts test/profile.test.mjs`; synthetic HTTP/storage/Query, gồm các consumer auth/profile/skills/LR; không cộng lại focused suite |
| Lint/types/structure | PASS | Installed ESLint `--max-warnings 0`, `tsc --noEmit`, checker 613 source files |
| Web JS export | PASS | Expo export web `--no-bytecode`; chỉ bundling, không browser visual/native acceptance |
| UI source review | PASS trong phạm vi source | Reuse PaymentAction/surface/theme; recovery nút có điều kiện và disabled guards; visual browser/device NOT_RUN |
| Final focused/type/lint/format và docs integrity | PASS | Focused 5/5 chạy lại với restore/check/policy, inactive/busy guards; final tsc, affected tests ESLint, Prettier và diff whitespace đạt. Các link mới/thay đổi resolve; link M04 cũ ngoài scope chưa sửa. Spec006 nguyên vẹn, 100 task IDs/83 checked |
| Real API / provider / Android / iOS / UAT | NOT_RUN | Chưa có phiên kiểm thử native/API/channel và quyền hành động tài chính cụ thể được xác minh |

Logs tạm được ignore tại `apps/mobile/.expo/phase03-tests.log`, `phase03-export.log` và `phase03-web/`. Lệnh `pnpm --filter mobile check-types` bị wrapper dừng với `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY` khi định xử lý lại dependencies; dùng trực tiếp installed binary tương đương, không cài lại hay đổi lockfile.

## Review và bàn giao

Lượt 2026-10-22 thêm cancel mutation explicit, key riêng theo Payment ID và terminal handling; không automatic mutation retry, không đổi schema storage. Source review đối chiếu double tap/lease, retry/restart, denial/session và QR suppression. Lượt 2026-10-20 chỉ sửa callbacks/guards và related GET refresh, không thêm mutation/key. UI review mới ở mức source/callback; chưa có screenshot/native pixels.

Các open criteria spec006/T042, T053..T062, T095..T100 giữ nguyên. “Ready for review” chỉ nói phạm vi source review/fix mới; không đóng toàn phase hoặc tự ghi xác nhận owner. Kịch bản UAT và prerequisite nằm trong plan, không tạo checklist acceptance thứ hai.

## Nhật ký tiếp tục

### 2026-10-22T14:44:14+07:00

Tách nốt model/test-only code còn nằm trong utils/types/policy/outcome/QR sau khi gỡ preview. Sáu module không có application consumer chuyển sang fixtures, kiểm GET hợp đồng dùng source read-query trực tiếp, style đổi tên account-topup-panel.styles.ts. AST import audit không còn Wallet runtime mồ côi (ambient declaration giữ đúng vai trò) hoặc src import tests. Full suite 573/573, unused/types/lint/format/structure 600 files và Android/iOS/web JS export đạt; không stage/commit, sửa BE hoặc thực hiện giao dịch thật.

### 2026-10-22T14:30:50+07:00

Theo phản hồi cấu trúc, gỡ hẳn 14 file Wallet preview khỏi src (hai host còn dùng được chuyển sang test fixtures), route, public export, stack/catalog và notification mẫu; xóa form top-up mẫu không còn caller. Không chỉ thêm development guard. Hai test chỉ kiểm tính năng preview được gỡ theo, kiểm kiến trúc đổi sang assert absence; behavior/QR coverage giữ lại. Full suite 573/573, focused 21/21, types/unused, lint toàn mobile, structure 606 files và export Android/iOS/web đạt. Các module preview khác ngoài Wallet chưa thay đổi; không stage/commit hoặc gọi API/provider thật.

### 2026-10-22T14:19:51+07:00

Audit nhánh và staged/unstaged/untracked mobile; dọn hook/màn/alias/props thừa, bỏ inert model khỏi account provider nhưng giữ helper kiểm thử ở fixtures, giới hạn wallet preview vào development. Sửa acknowledge/dedupe khi event còn mới hơn GET và reconnect budget bị ready frame reset; catch-up ngoài stream có xử lý rejection. Full suite 575/575, types gồm unused checks, lint toàn mobile, structure 622 files và all-platform JS export đạt. Giữ nguyên index 102 dòng test cũ, không commit/push hoặc thao tác API/provider thật. Source sẵn sàng chuẩn bị commit đủ file; native/deployed SSE acceptance còn mở.

### 2026-10-22T13:56:35+07:00

Tách cờ cancellation khỏi busy chung sau regression nhãn sai trong bootstrap/recovery. Đối chiếu BE dev đã có SSE payment/wallet; nối màn checkout vào stream app qua public subscription, fresh GET sau lease cũ, owner/version/dedupe/cursor/lifecycle guards. Poll 30 giây khi SSE connected, 2 giây dự phòng khi disconnected; giữ same-key cancel và backend-only PAID. Focused 42/42, full suite 571/571, types/lint/structure 626 files và export Android/iOS/web đạt. Không sửa BE/shared/root hoặc index, không giao dịch thật, chưa native/deployed SSE UAT.

### 2026-10-22T07:28:52+07:00

Rà soát lại toàn bộ màn Wallet payment theo Apple HIG, Google Pay UX và Stripe mobile guidance. Đồng nhất palette scoped, đưa tổng tiền/Credit lên trước QR, làm rõ card deadline/thông tin/cancel, trạng thái và history/detail. Giữ API/BE, state transitions, dữ liệu contract và min 2.000 VND; không dựng recipient hoặc tiện ích chưa có. Full suite 544/544, typecheck, lint, structure 625 files, synthetic preview bundle và Expo export Android/iOS/web đạt; chưa pixel-review native/device, chưa gọi API/provider thật.

### 2026-10-22T03:10:51+07:00

Thu gọn ô nhập theo crop, nâng ngưỡng nạp mới lên 2.000 VND và bỏ note riêng về thời điểm cộng Credit ở draft/review; giữ nhãn Credit ước tính cùng luồng payment hiện có. Full suite mới nhất 544/544, typecheck, lint, structure, synthetic preview và Expo export Android/iOS/web đạt. API/provider/native UAT chưa chạy.

### 2026-10-22T03:02:57+07:00

Đổi ngưỡng tạo yêu cầu nạp mới ở mobile thành 2.000 VND, cập nhật nhãn/hint và lỗi validation; bước tiền vẫn 1.000 VND. Tách validate ngưỡng app khỏi validate BE để bản ghi 1.000 VND đã dispatch vẫn phục hồi và retry cùng key được. Không sửa BE; cần xác minh native/API sau này, chưa chạy giao dịch thật.

### 2026-10-22T02:59:13+07:00

Đã làm lại màu và bề mặt theo HTML người dùng gửi: token kem/cam đất scoped trong form top-up, thẻ có shadow nhẹ, VND accessory, CTA gradient; giữ Nunito và chức năng review/confirm. Input dùng accessory tùy chọn, các form khác không đổi; AppHeader centered chỉ bật trên top-up. Typecheck trực tiếp, ESLint file ảnh hưởng, structure 624 source files, synthetic preview bundle và Expo export Android/iOS/web đều đạt. Không chạy test suite cho lượt styling; suite 542/542 là evidence từ lượt trước. Không nghiệm thu native/API hoặc giao dịch thật.

### 2026-10-22T02:25:37+07:00

Đã hoàn thành checkout React Native theo reference HTML trong giới hạn đã chọn: giữ theme form, QR/payment data và hành vi hiện có; bỏ các tiện ích chưa chọn. Responsive preview 320/375/430; synthetic state flows và 542/542 suite đã ghi nhận đạt. Chạy lại typecheck/lint/structure trên source mới đạt; Android/iOS/web export đạt. API/provider/native UAT chưa chạy, không có giao dịch thật.

### 2026-10-22T01:58:30+07:00

User báo bị kẹt sau thao tác trợ giúp. Tái hiện bẫy nút supportStop trực tiếp; thêm 3 ca regression JSX, sửa visibility và xác nhận riêng. Focused suite 35/35, structure/diff đạt; types/lint cuối đạt. Không clear intent, tự POST hoặc bỏ guard tài chính; không sửa backend/storage schema. Reload app để bỏ incident RAM từ lần bấm nhầm trước; bootstrap tiếp tục restore record đã lưu.

### 2026-10-22T01:42:39+07:00

Đính chính baseline BE: controller trong checkout mobile cũ hơn dev. Đồng bộ phase theo cancel và checkout recovery trên dev, thêm native cancel có xác nhận, terminal CANCELLED, recovery copy, stable cancel identity, behavior/transport/UI regressions. Full mobile 535/535, types/lint/structure và final Android/iOS/web JS export đạt. Giữ nguyên thay đổi trước, specs và index; không sửa BE/shared/root tracked files, không commit/push hay thực hiện giao dịch thật. API/provider/native UAT NOT_RUN.

### 2026-10-20T10:10:59+07:00

Tiếp nhận Phase03 trên nhánh Wallet thật, sửa hai gap có regression RED→GREEN và đính chính baseline migration. Full suite/checks và web export đạt; bổ sung negative inactive/busy/policy và chạy lại focused/type/lint/format đạt. Real API/provider/native/UAT NOT_RUN. Không sửa backend/shared/root tooling, không commit/push/checkout hoặc thực hiện giao dịch thật.

## Quan sát migration được giữ làm lịch sử

Các mục bên dưới mô tả checkout migration tại thời điểm cũ, không là hiện trạng của nhánh Wallet đã đối chiếu ở trên.

### Hiện trạng ghi ngày 2026-10-19

- Cập nhật lúc: 2026-10-19T20:19:15+07:00.
- Trạng thái: Đang phát triển ở nhánh riêng; ngoài phạm vi triển khai của checkout này.
- Revision tích hợp: Chưa được đối chiếu.
- Source checkout migration: Wallet preview/fixtures tại HEAD ed5a17dd9f1a6d5e45e1b6af33b17dd4518b46fd. Đây không đại diện source hoặc tiến độ của nhánh Wallet/Payment.
- Nơi sở hữu task/quyết định/evidence triển khai: hồ sơ ở nhánh đang làm; file này chỉ giữ ranh giới phối hợp.
- Nghiệm thu của nhánh đó: Chưa xác minh; không kết luận pass/fail/pending từ việc không có artifact tại checkout này.
- Bước tiếp theo tại đây: tiếp tục công việc mobile khác; đối chiếu Wallet/Payment ở bước review/tích hợp theo [plan tham chiếu](plan.md).

### Bằng chứng và giới hạn lúc migration

| Nguồn                                                  | Điều được xác nhận                                                                                                          | Giới hạn                                                               |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Source review lúc migration                            | Checkout cũ có screens và `src/features/wallet/fixtures.ts` (đường dẫn lịch sử không còn tại revision hiện tại) | Không là bằng chứng thiếu implementation toàn dự án                    |
| [Contract backend](../../contracts/wallet-payments.md) | Có controller/DTO trong checkout migration                                                                                  | Không xác minh deployment/provider hoặc source tích hợp của nhánh khác |

Không chạy test/API/native/provider hoặc tạo giao dịch trong lần cập nhật thông tin này. Không có task sản phẩm nào được tick, không tạo trạng thái triển khai thứ hai cho nhánh đang làm.

### Nhật ký migration

### 2026-10-19T19:58:07+07:00 — quan sát lúc migration

Selector cũ trỏ006 nhưng checkout không có hồ sơ/source tích hợp; lúc đó mới xác minh được preview boundary. Nhận định đây là blocker cần tìm lại baseline được thay thế bằng thông tin liên nhánh bên dưới.

### 2026-10-19T20:19:15+07:00 — cập nhật phạm vi liên nhánh

Đã bỏ phân loại thiếu006 là lỗi/nợ của checkout migration, rút các task P03 giả định và chuyển plan/status thành điểm tham chiếu liên nhánh. Review source tại checkout này gồm Auth/session/network, Learning Request và Profile/Skills.
