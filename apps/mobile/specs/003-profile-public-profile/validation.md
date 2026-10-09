# Validation — Spec 003

Cập nhật: 2026-10-09. Phạm vi theo [spec](spec.md), nghiệm thu theo
[checklist](checklist.md). Phạm vi mobile profile/settings, recovery Auth và tài liệu liên quan.

## Kết quả hiện tại

| Kiểm tra                   | Kết quả                                                                                                                                                                      |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Typecheck / lint           | Pass.                                                                                                                                                                        |
| Structure                  | Pass, 165 source files; không vượt giới hạn dòng.                                                                                                                            |
| `npm test`                 | 75 pass; thêm 4 tests reset signed-in/guest, dedup, failure/retry và callback cũ.                                                                                            |
| Browser với API local thật | Login/own identity; save/reopen/clear persistence; invalid/no-change không gửi; cancel bỏ draft; self-preview dùng hồ sơ đã lưu.                                             |
| Browser với HTTP fixtures  | Unicode validation, pending/back/lưu trùng, 400/503/network và retry; public targets/empty/unavailable/retry; menu viewer; logout/đổi account trong lúc lưu.                 |
| Responsive web             | Own editor/self-preview ở width 320/375/430 không tràn ngang; đã xem screenshots 320 và 430.                                                                                 |
| LAN/CORS trực tiếp         | Preview origin localhost:3000 gọi API LAN thật; không proxy, 3 lần lưu và 0 page runtime errors.                                                                             |
| Android 14 / Pixel 7       | Expo Go SDK 57: login/own API, no-change disabled, keyboard headline/bio, hardware Back bỏ draft, save/reopen và GET `/me` xác nhận persistence.                             |
| Android chữ lớn            | Font scale 130%: editor/self-preview không tràn ngang; nút Hủy/Lưu và skill chưa kết nối hiển thị đầy đủ. Đã xem screenshots.                                                |
| Avatar web với API thật    | Chọn/preview/Hủy không upload; multipart `image` nhận 202, owner status 200; sau 90 giây còn QUARANTINED. DELETE cleanup 204, profile/avatar gốc đã khôi phục.               |
| Avatar HTTP fixtures       | File sai/quá lớn; partial profile save + upload lỗi/retry; pending/lưu trùng/back; CLEAN refresh, rejected, delete lỗi/retry, đổi account lúc upload; 0 page runtime errors. |

Thông báo avatar chuyển sang toast theo yêu cầu; không có dòng trạng thái dưới
avatar. Browser fixtures đạt: toast duy nhất tự hết hạn; chờ bình thường không có
retry; chờ lâu/refresh lỗi có toast và retry; CLEAN cập nhật ảnh im lặng; đổi account
không nhận callback cũ. Width 320/430 không tràn ngang, đã xem screenshot 320;
0 page runtime errors. Chưa QA native lại.

Profile/settings mới đã kiểm tra bằng browser fixtures: private info chuyển sang
Tài khoản; summary → public preview → grid hai cột → bio/skills. Account
hiện email/xác minh/trạng thái own identity; privacy/help/version mở đúng nội dung.
OTP recovery từ Settings điền email readonly, cancel không gửi request; verify
proof rồi reset, lỗi giữ draft, double submit chỉ một request, thành công về login.
Logout hiện tại/tất cả: confirm/cancel, lỗi/retry đạt. 0 page runtime errors;
screenshots profile/settings/account ở width 320/430/900 không tràn ngang; đã xem
profile/settings 320. Avatar/profile/public regression fixtures cũng đạt.
Không đặt lại mật khẩu tài khoản thật; chưa nghiệm thu gửi OTP email thật hoặc
bố cục/keyboard recovery mới trên native.

Ở bản tinh chỉnh trước khi khôi phục commit: cover cam, avatar 80px có viền
trắng, tên và số thống kê lớn hơn; bio/skills có đường nhấn màu, icon hoạt động có
nền màu. Dùng variant riêng; bố cục public/editor/settings giữ hiện tại. Typecheck,
lint, structure và 75 tests đạt. Browser fixtures kiểm tra lại profile/settings
ở width 320/430/900, tên/headline/bio dài và field tùy chọn trống ở 320: không tràn
ngang, Cài đặt vẫn truy cập được sau cuộn; 0 page runtime errors. Đã xem screenshot
320/430 và hai trạng thái dài/trống. Chưa kiểm tra bản tinh chỉnh trên native.

Yêu cầu khôi phục bố cục ban đầu: Ví Credit/Tài liệu của tôi ở hàng đầu,
Đánh giá/Cài đặt ở hàng sau, toàn bộ grid nằm trước Giới thiệu. Browser fixtures
đã xác nhận vị trí hai cột và thứ tự so với bio, các shortcut mở đúng notice/route.
Cài đặt giữ các chức năng hiện có; nút Đăng xuất dùng nền đỏ nhạt, viền/icon đỏ.
Đã kiểm tra lại reset OTP và đăng xuất hiện tại/tất cả (confirm/cancel, lỗi/retry),
width 320/430/900 không tràn ngang, 0 page runtime errors; đã xem ảnh Profile và
footer Cài đặt 320. Typecheck/lint/structure/75 tests đạt; chưa QA native lại.

Ở lần khôi phục commit trước, dùng kiểu dáng `ac4590d`: ProfileHero
và theme giống commit; ProfileSummary chỉ thêm slot retry avatar đã có. Thẻ trắng,
avatar 64px, public preview riêng; grid sáu nút trước bio/skills/huy hiệu minh họa.
Giữ shortcut Tài liệu của tôi theo yêu cầu trước; Thông tin riêng tư ở Cài đặt.
Không thay đổi source Cài đặt/Auth/API ở lần khôi phục này. Các luồng tài khoản,
OTP reset và logout trong Settings được kiểm tra lại bằng fixtures và đều đạt.
Avatar/profile/public regression đạt, 0 page runtime errors; screenshot 320/430/900
không tràn ngang, đã xem Profile 320. Typecheck/lint/structure và 75 tests đạt;
chưa kiểm tra lại native hoặc pipeline avatar thật.

Sau đối chiếu SRS 1.6 và yêu cầu bỏ các mục chưa khớp: xóa section/fixture huy hiệu,
số dư Credit gán cứng và thống kê số buổi trên own/public; đổi shortcut thành
Xác minh kỹ năng. Giữ sáu shortcut và tất cả chức năng Cài đặt. Contract số buổi
vẫn được đọc, không đổi thành số Learning Path; GAP-02 còn mở. Typecheck, lint,
structure (165 files) và 75 tests đạt. Browser profile/settings/reset/logout và
profile save/public regression đạt: không còn mục đã bỏ, 0 runtime errors;
320/430/900 không tràn ngang, đã xem Profile 320. Chưa QA native lại.

Các browser runs không ghi nhận page runtime errors. Profile test account đã được
khôi phục ba field ban đầu và đọc lại để xác nhận; session test được logout.
Không lưu mật khẩu/token trong source hoặc tài liệu.

## Điều kiện kiểm thử

- Lần đầu: preview `http://localhost:8084`, API local cổng 3001 qua transport proxy
  trong Playwright, giữ nguyên response/body/status và chỉ cho phép origin test.
- Lần tiếp theo: preview `http://localhost:3000` đúng `CORS_ORIGIN` đang có,
  API `http://192.168.1.179:3001/api/v1` qua LAN. Chạy lại toàn bộ real-API browser
  acceptance không dùng proxy/interception: pass, 3 lần lưu, 0 page runtime errors.
  Preflight trả 204; readiness qua LAN trả 200. Không sửa `.env` hoặc backend.
- Script và screenshots nằm trong `.expo/` ignored; credentials
  được truyền qua environment của process test, không ghi vào script.
- Public target khác vẫn là fixture; kiểm thử này không tích hợp public API/skills.
- Android chạy trực tiếp qua LAN trên emulator Pixel 7, Android 14/API 34.
  Sau kiểm thử đã khôi phục hồ sơ và đọc lại ba field gốc; logout cả phiên native
  và phiên xác minh. Font scale/network latency đã trả về giá trị ban đầu.
- Mô phỏng latency của emulator không giữ được request LAN đủ lâu để xác nhận
  pending Back native; không tick mục đó từ lần thử này. Script cleanup đã sửa
  expectation logout từ 200 sang đúng contract 204; lần xác minh cuối pass.
- Avatar policy đối chiếu backend spec FR-009/SC-008, quickstart bước 6 và code
  ProcessAvatarUseCase: chỉ CLEAN được chọn và cấp URL. Đây là scan tự động;
  SRS PRO-004 về Staff ẩn avatar vi phạm không phải yêu cầu duyệt từng ảnh.
- Lần kiểm thử upload ban đầu, TCP tới ClamAV thất bại. Sau đó đã bật ClamAV local,
  PING trả PONG và INSTREAM quét ảnh repo trả `stream: OK`. Chưa có bằng chứng real CLEAN;
  không dùng fixture CLEAN để đánh dấu scanner hoặc ảnh công khai thật đã hoàn tất.
- Thêm `expo-image-picker ~57.0.20` và image-loader; npm/root pnpm lockfiles chỉ
  thêm dependency liên quan. Frozen root lockfile được xác minh; không sửa backend.

## Phần còn mở

Review trước commit/push (2026-10-09): typecheck/lint/structure, 75 mobile tests,
6 commit-scope tests, Prettier, diff whitespace và pnpm frozen lockfile đạt.
Production Expo web export đạt; output nằm trong `.expo/` ignored. Fetch xác nhận
`origin/dev` tại `1b5b423`, nhánh hiện tại `ac4590d` thiếu 5 commit và có 1 commit
riêng. Mô phỏng merge hai HEAD phát hiện conflict ở profile/index.ts,
PublicProfileScreen.tsx và AppProviders.tsx do dev thêm public profile/proposals.
Chưa áp dụng merge vào working tree; kết quả checks hiện tại chưa xác minh bản
đã kết hợp với dev. Root `.expo/` và `tsconfig.json` là file local ngoài scope,
không đưa vào commit này. Real CLEAN/native vẫn còn các mục bên dưới.

- Pending hardware Back native; iOS/thiết bị thật và Public Profile Figma riêng.
- Native gallery/upload avatar; real CLEAN sau khi ClamAV hoạt động.
- Bố cục profile/settings/account và OTP recovery mới trên native, email OTP thật.
- Các GAP trong spec: public API/skills, title, path count và backend sanitize bio.

Plan cũ ghi web/mock checks pass ngày 2026-10-08 trước rebase dùng MockSession.
Bằng chứng hiện tại ở trên dùng AuthSession sau rebase; không dùng kết quả lịch sử
để tick nghiệm thu native hoặc các phần ngoài scope.
