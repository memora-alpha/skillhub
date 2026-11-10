# Hoàn thiện Settings và Profile

## Kết quả và nguồn

Hoàn thiện Settings/Profile trên mobile Expo. Baseline khảo sát `dev@4b588f62`; bản đối chiếu triển khai `dev@c0821daf`.

Nguồn: [SRS1.6](../../../../../docs/SRS_SkillHub_V1.6_VietLai_DongBoNghiepVu.docx) PRO-001..004 và profile timezone/locale; [contract](../../contracts/profile.md), users responses/DTO và notification-preferences controller/service/policy được đối chiếu source. Thiết kế tái sử dụng Settings ActionGroup, FeaturePage/Panel, Input/Button, theme hiện có và native Expo UI Picker/Switch; không có frame mới được cung cấp.

## Baseline và phạm vi

Settings timezone/language/notification chỉ dùng context xem thử, không lưu API; Profile hiện placeholder count dù backend đã trả số lộ trình. Edit Profile/avatar, danh hiệu, Skills và recovery có source riêng đang hoạt động, giữ nguyên luồng.

- [x] Tách Preferences khỏi product-shell preview, giữ route `/preferences/[section]`, dọn preview state không còn consumer.
- [x] Lưu timezone IANA/locale bằng PATCH profile, đọc saved account; validate zone và không giả chuyển toàn bộ UI sang English.
- [x] GET/PATCH notification preferences với đủ ba nhóm, loading/error/reload/draft/save và guard phiên/nhấn lặp.
- [x] Privacy giải thích dữ liệu công khai/riêng tư, mở đúng self public-preview và quản lý kỹ năng.
- [x] Parse/project/render completedLearningPathCount, phân biệt số buổi và unknown trên server cũ.
- [x] Gắn generation cho callback updateProfile ngay khi render hook; chống read cũ ghi đè save và không cập nhật cache phiên khác.
- [x] Focused regression, TypeScript/ESLint/structure/full mobile suite và kiểm diff; bằng chứng tại status.

Không sửa backend/shared/root/dependencies, không phát push token hay đổi formatter lịch toàn app, không triển khai bản dịch English toàn bộ hoặc tự thêm field riêng tư. Nghiệp vụ mới không đủ contract phải ghi giới hạn. Rollback bằng revert các thay đổi mobile trong lượt này, không có migration/storage schema mới.

## Kiểm chứng

Ca chính: mở bằng dữ liệu tài khoản, save field độc lập, custom/invalid timezone, malformed notification response, double Save, lỗi giữ draft, logout/account switch khi request pending, public projection không lộ timezone/locale, completed paths khác completed sessions. Kiểm source và fixtures bằng Node/tsx; Android/iOS và deployed API/email/push chưa có nghiệm thu trong phạm vi phiên này.

Native/API UAT đề xuất: đổi timezone/language rồi mở lại sau đăng nhập; bật/tắt từng nhóm và xác minh policy gửi ở backend; kiểm dropdown/switch/keyboard/font/Back trên Android/iOS; xem own/public count từ tài khoản có lộ trình hoàn thành. Không dùng helper tests để tự xác nhận UAT.

## Tiếp nhận thiết kế lại Settings — 2026-11-09

Settings dùng giao diện thống nhất với app. Giữ theme Crafted Exchange, Nunito, AppHeader/SafeArea, Input/Button/ActionRow và các luồng API đã nối. Tham khảo cách tổ chức account/preferences của [Notion](https://www.notion.com/help/account-settings) và nhóm thông báo của [Spotify](https://support.spotify.com/us/article/notification-settings/); dùng cấu trúc tham khảo, không thêm chức năng bên ngoài contract SkillHub.

- [x] Thống nhất 7 màn: Settings, Account, Timezone, Language, Notifications, Privacy, Help qua SettingsPage/Section/Note; scope trong feature Settings, không đổi shared theme hoặc component toàn app.
- [x] Thẻ tài khoản, nhóm bảo mật, giá trị timezone/ngôn ngữ rõ; lựa chọn ngôn ngữ dạng radio row; native Picker/Switch có màu app và đủ chiều rộng; nút Save cố định.
- [x] Privacy chia thông tin công khai/riêng tư và action quản lý; Help chuyển từ product-shell về Settings, giữ nguyên nội dung FAQ, tìm kiếm và accordion.
- [x] Giữ draft/error/pending/owner guards; kiểm keyboard chọn ngôn ngữ trên web, loading/disabled/selected và Save không bị nội dung dài đẩy khỏi viewport.
- [x] Web fixture trên 320/390/430px, chữ130%, screenshot và hành vi chính; cập nhật regression hiện có cho cây UI mới, kiểm workspace và export.

Chưa có nghiệm thu native keyboard/safe-area/VoiceOver/TalkBack hoặc API thật. Route và reset-password flow dùng lại hiện có; không thiết kế lại toàn bộ auth hoặc chính sách pháp lý trong lượt này.

## Điều chỉnh tiếp và rà API Profile — 2026-11-10

- [x] Timezone chỉ cho chọn trong Picker; gỡ ô nhập thủ công, giữ lựa chọn đã lưu và validation trước Save.
- [x] Gỡ entry “Trung tâm thông báo” trùng inbox; giữ nguyên tính năng thông báo thật và API preference.
- [x] Rà source Profile, các shortcut và backend API; ghi4 gaps còn mở cùng evidence tại [audit](profile-api-audit.md). Lượt này chỉ sửa Settings và audit Profile, chưa triển khai các gaps mới.
- [x] Chạy regression trọng tâm và browser fixture cho Picker-only, giữ draft khi save lỗi, retry và không còn entry trùng; kiểm TypeScript/lint/structure.

## Sửa kiểm duyệt và self public-preview — 2026-11-10

Triển khai PRO-GAP-03/04 trong [audit](profile-api-audit.md). Giữ phạm vi mobile, dùng backend contract hiện có; review summary/danh sách reviews và i18n toàn app tiếp tục ngoài lượt sửa này.

- [x] Validate private profileModeration từ `/me`, tương thích null/missing; enum action, reason và timestamp sai không bị coi là hồ sơ sạch.
- [x] Notice cho bio/avatar HIDE hoặc REQUEST_EDIT trên Profile/Edit Profile, có lý do/thời điểm và action mở Edit. Giữ bio gốc để chủ hồ sơ sửa; không đưa reason ra public.
- [x] Self-preview đọc public API giống target khác; bỏ nhánh own-data, không fallback private bio khi read lỗi/denied, giữ history/request context/self fallback.
- [x] Edit Profile PATCH subset field đã đổi để chỉnh tên/headline không xóa moderation bio qua việc gửi lại field bio không đổi. Avatar giữ scan/refetch lifecycle hiện có.
- [x] Regression trước sửa:3 failures xác nhận parser chưa validate/default moderation và self-preview chưa đi public API. Sau sửa focused20/full1077, TypeScript/lint/structure/export và UI fixture đạt; cập nhật contract/status.

Native/API UAT bổ sung: Staff HIDE bio và REQUEST_EDIT avatar, refresh `/me`, mở own/edit thấy lý do nhưng self-preview theo public projection; chỉ đổi tên thì bio warning giữ nguyên; sửa bio thành công thì notice theo response mới; upload ảnh mới chờ kết quả scan/refetch. Logout/account switch không giữ reason của owner cũ. Không tự ghi nghiệm thu thật khi chỉ có fixtures.
