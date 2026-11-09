# Settings và Profile — hiện trạng

Cập nhật: 2026-11-10T00:32:44+07:00. Phạm vi theo [plan](plan.md).

## Chia commit trên nhánh riêng — 2026-11-10

- Nhánh `fix/settings-profile` được tạo từ `dev@c0821daf` sau yêu cầu chuyển toàn bộ thay đổi; không mất staged/unstaged. `dev` và nhánh mới không có upstream theo yêu cầu; chưa push.
- `dcbaea14` — `fix(mobile): complete profile moderation and public previews`: Profile/count, kiểm duyệt, public self-preview, subset PATCH và guard session, kèm regression tương ứng.
- `6972375e` — `feat(mobile): persist and redesign account settings`: Settings/API preferences,7 màn cùng theme, timezone chỉ chọn, bỏ entry inbox trùng, chuyển Help/Preferences khỏi preview và test tương ứng.
- Contract, plan/status và audit gom trong commit tài liệu riêng. Tách test count sang `profile-completed-path.test.ts`, các test preferences ở `settings-preferences.test.ts`; không thay hành vi hay số lượng cases.
- Kiểm tra trước commit:26/26 focused tests và6/6 scope-validation tests PASS; TypeScript, full ESLint, structure925 và whitespace đạt. Full1077/1077 và web export là evidence source gần nhất trước việc tổ chức lại test files. Pre-commit lint-staged/Prettier và commit-msg commitlint của hai commit source chạy thành công, không bỏ hooks.
- Source **Ready for review**; API triển khai/Android/iOS và các gaps review summary/danh sách review vẫn chưa nghiệm thu/triển khai như các mục bên dưới. Phần lịch sử bên dưới ghi trạng thái tại từng lượt trước khi tạo nhánh/commit.

## Kiểm duyệt hồ sơ và self public-preview — 2026-11-10

- Source PRO-GAP-03/04 đã sửa theo yêu cầu: validate profileModeration riêng tư từ `/me`; notice bio/avatar bị HIDE hoặc REQUEST_EDIT cùng lý do/thời điểm trên Profile và Edit Profile. Nút sửa trên Profile mở `/edit-profile`; khi không còn record hoặc không có account, notice không hiển thị. Scan avatar vẫn có feedback riêng.
- Self-preview luôn dùng `/profiles/:userId` qua PublicApiProfileScreen, giống hồ sơ người khác; không lấy private bio từ own account. Khi public read lỗi/403/404 không fallback về own data. Giữ nhãn preview, Back history/request và self fallback `/profile`. Own Profile/Edit vẫn xem được bio gốc để sửa.
- Edit Profile chỉ PATCH field thay đổi, giữ explicit clear bio; sửa tên/headline không gửi kèm bio không đổi và không vô tình kích hoạt backend gỡ moderation bio. Notice avatar chỉ đổi theo dữ liệu account sau scan/refetch, không clear lạc quan khi mới chọn ảnh.
- Trước sửa3 regression cases FAIL (normalization/validation moderation và nhánh self-preview); sau sửa focused **20/20 PASS**. Full mobile **1077/1077 PASS**,0 fail/skipped/cancelled; log ignored `.expo/profile-moderation-tests.log`. Tăng5 cases so với1072:2 boundary moderation,2 notice/public UI và1 subset patch; cập nhật regression self entrypoint sẵn có.
- TypeScript, full ESLint, structure **925 source files**, Prettier và `git diff --check` PASS. Web export PASS `.expo/profile-moderation-web`, dotenv/telemetry tắt; log `.expo/profile-moderation-export.log`.
- Web component fixture PASS320/390/430px:2 field notices với action/lý do/thời điểm, lý do dài không tràn ngang, action sửa hoạt động, record sạch không hiện notice; chữ130% vẫn đọc/bấm được. Đã xem screenshot390px và320px chữ130%; script/screenshots ignored `.expo/profile-moderation-preview.cjs` / `.expo/profile-moderation-preview/`. Đây là fixture cho component notice, không phải nghiệm thu Staff/API/native thật.
- [Audit](profile-api-audit.md) giữ baseline/evidence trước sửa; summary sao và danh sách review PRO-GAP-01/02 vẫn chưa làm. Chưa sửa backend/shared/dependency, chưa stage/commit/push. Nghiệm thu deployed API/Android/iOS vẫn mở.

## Điều chỉnh Settings và rà API Profile — 2026-11-10

- Gỡ ô nhập “Múi giờ khác”; chỉ còn native Picker với preset và giá trị account đã lưu. Không tự đổi timezone khi mở màn. Gỡ entry “Trung tâm thông báo” trùng `/notifications`; giữ nguyên inbox thật và các điểm vào khác.
- [Audit Profile/API](profile-api-audit.md) ghi4 gaps: summary sao chưa dùng; review received/sent/public chưa nối; thiếu notice profileModeration; self public-preview vẫn hiển thị own bio bị HIDE. Backend đã có source API cho các phần này. Các gaps chưa được triển khai trong lượt audit; không coi chúng đã hoàn tất.
- Tái hiện projection bằng source parser/helper/public adapter và synthetic fixture: hidden bio vẫn được copy vào self-preview, summary/moderation không được project. Không suy thành rò rỉ public: backend public projection có lọc HIDE riêng.
- Focused **7/7 PASS**, TypeScript, full ESLint, structure923 và diff whitespace đạt. Regression Locale dùng lựa chọn preset UTC, kiểm failed draft/retry/double-save và session guard. Không chạy lặp full suite/export cho hai chỉnh sửa giao diện nhỏ này; full1072 và export ở dưới là evidence lượt redesign trước.
- Browser fixture PASS7 màn tại320/390/430px và chữ130%, Save trong viewport; xác nhận timezone có0 textbox, chọn UTC/lưu lỗi giữ selection/retry thành công, mục “Trung tâm thông báo” không còn, notification Save tiếp tục hoạt động. Không có pageerror. Screenshot/script local giữ tại `.expo/settings-design-preview/` và `.expo/settings-design-preview.cjs`.
- Nghiệm thu native và API triển khai chưa thực hiện; chưa stage/commit/push.

## Thiết kế lại Settings — 2026-11-09

- Đồng nhất7 màn qua layout Settings riêng: header căn giữa từ AppHeader hiện có, giới hạn640px, nền kem, card bo20px, Nunito, màu đất nung và xanh rừng từ theme. Giữ shared component toàn app; phần style mới chỉ có consumer trong feature Settings.
- Settings có thẻ tài khoản và các nhóm security/preferences/support. Account hiển thị email/status rõ. Language dùng radio rows có checked/disabled và nhóm semantic; web hỗ trợ Space/phím mũi tên. Timezone dùng tên địa điểm, đồng hồ tham khảo, native Picker và input vùng khác. Notifications có Switch theo nhóm, mô tả và thông tin bảo mật. Privacy phân lớp public/private. Help chuyển về Settings với search/accordion và nội dung FAQ cũ.
- Save bar cố định tại Language/Timezone/Notifications, giữ pending/draft/error và API/session guards. Giao diện không giả đã có bản dịch English; không thêm privacy toggle hoặc quyền push ngoài contract.
- Tham khảo tổ chức Settings từ [Notion](https://www.notion.com/help/account-settings) và nhóm thông báo từ [Spotify](https://support.spotify.com/us/article/notification-settings/). Đây là tham khảo cấu trúc, không phải sao chép theme của họ.
- Web fixture chạy component màn hình, AppScreenLayout/AppHeader, Button/Input/ActionRow/Icon và Expo UI Host/Picker/Switch thật. Auth/router/mutations dùng adapter fixture; không gọi API thật. Script local ignored `.expo/settings-design-preview.cjs`.
- Browser PASS:7 màn tại320/390/430px, không tràn ngang; nút Save ở trong viewport; chữ130% vẫn cuộn và bấm Save được. Đã kiểm radio bằng click/Space/ArrowLeft, locale field-only save, invalid/custom timezone, save lỗi giữ draft rồi retry thành công, bật/tắt và save notification, tìm kiếm/empty/accordion Help. Không có pageerror.
- Đã xem screenshot overview/account/language/timezone/notifications/privacy/help390px và timezone320px chữ130%. Bản tổng hợp local `.expo/settings-design-preview/settings-redesign.png`; các screenshot/script là artifact ignored, không phải nguồn nghiệm thu native.

- Full mobile suite sau redesign **1072/1072 PASS**,0 fail/skipped/cancelled; log ignored `.expo/settings-redesign-tests.log`. Regression Locale dùng cây UI mới và tiếp tục kiểm draft/nhấn lặp/phiên cũ.
- TypeScript, full ESLint và focused ESLint sau sửa keyboard handler, structure **923 source files**, Prettier và diff whitespace PASS. Key handler dùng event type của Pressable SDK58; chỉ gắn trên web và không thay native press behavior.
- Web export PASS tại `.expo/settings-redesign-web`, log ignored `.expo/settings-redesign-export.log`; tắt dotenv/telemetry. Không sửa services/shared/root/dependencies hoặc commit/push. Nghiệm thu Android/iOS và API triển khai vẫn chưa thực hiện.

Source đã nối timezone/locale và notification preferences vào API hiện có, cập nhật Privacy/public-preview và completedLearningPathCount. Không đổi backend. Mobile vẫn dùng tiếng Việt; timezone lưu trên account, các lịch giữ thông tin múi giờ riêng. Không đăng ký native push token.

Lệnh tạo nhánh ban đầu tại `dev@4b588f62` từng bị từ chối cấp quyền. Việc tạo nhánh sau đó và các commit hiện hành được ghi ở đầu file.

Trạng thái source: **Ready for review**. Nhánh riêng đã có và phần source đã chia commit; chưa push hoặc nghiệm thu API/native.

## Bằng chứng

- Full mobile suite **1072/1072 PASS**, fail/skipped/cancelled0, `tsx --experimental-test-module-mocks --test --test-concurrency=4 tests/**/*.test.ts test/profile.test.mjs`. Log local ignored `.expo/settings-profile-tests.log`.
- Thêm7 tests: notification API và malformed response, timezone hợp lệ/không hợp lệ, path count riêng với session count, notification mutation ownership/cache/duplicate/late completion, profile mutation stale-screen/late response và Locale screen field-only save/failed draft/double-save/session switch. Bổ sung public API test cho path count và reject count âm.
- TypeScript, full ESLint `--max-warnings 0`, structure **916 source files**, Prettier code thay đổi và `git diff --check` đạt.
- Expo web export PASS tại `.expo/settings-profile-web`, log ignored `.expo/settings-profile-export.log`; tắt dotenv/telemetry. Export xác nhận bundle/route, không phải nghiệm thu layout native hoặc deployed API.
- Rà TSX theo `react-best-practices`: hooks không điều kiện trước auth guard, draft theo route/generation, pending/flight guard, callback phiên cũ không phát mutation vào phiên mới, cache key theo owner/session, không tự replay mutation. Expo UI Picker/Switch dùng props từ package SDK58 đang cài và Host.

Nghiệm thu người dùng: chưa thực hiện. Chưa kiểm deployed API hoặc Android/iOS; kiểm source/fixture không chứng minh email/push thật hay native UI. Bản dịch English toàn bộ, đồng bộ formatter múi giờ khắp app và review-summary trên Profile chưa thuộc phần sửa này.

Bước tiếp: review các commit và chạy kịch bản native/API trong [plan](plan.md) khi môi trường sẵn sàng. Chưa push.
