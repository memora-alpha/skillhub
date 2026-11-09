# Rà source mobile sau migration tài liệu

## Mục tiêu và phạm vi

Rà code Auth/session/network, Learning Request và Profile/Skills; đối chiếu source/contract và kiểm chứng findings. Wallet/Payment ngoài phạm vi review. Các bản sửa được theo dõi riêng trong status.

Baseline review: HEAD ed5a17dd9f1a6d5e45e1b6af33b17dd4518b46fd. Quy trình theo [workflow](../../workflow.md); contract [auth](../../contracts/auth-account.md), [profile](../../contracts/profile.md), [skills](../../contracts/skills-evidence.md), [Learning Request](../../contracts/learning-requests.md), [network](../../network-state.md).

## Phần review đã thực hiện

- [x] Theo báo cáo Sonar người dùng gửi ngày2026-11-09: xử lý3 cognitive-complexity,23 nested ternary và2 route re-export trong Community/Learning Path. Tách logic trình bày, giữ nguyên nội dung/quyền/luồng async; chạy rule SonarJS cục bộ và regression mobile, không đổi dependency dự án.

- [x] Đọc runtime/HTTP/storage/session/provider và cleanup, flow recovery, private/public boundaries.
- [x] Đọc LR adapters/query/form/preflight/conflict/expiry/weekly/Tag/offering và đối chiếu backend source cần thiết.
- [x] Đọc Profile/Skills query/UI/save/upload/scan/job lifecycle và projection/cache behavior.
- [x] Chạy mobile suite, lint/typecheck/structure và tái hiện findings bằng source thật trong harness cô lập.
- [x] Ghi findings có trigger/impact/file/line, bằng chứng và giới hạn tại [status](status.md).

## Điều kiện hoàn thành review

Findings có bằng chứng tái hiện hoặc chuỗi source rõ; không gán lỗi cho khác biệt nhánh Wallet, không lấy suite xanh thay acceptance API/native. Review không tác động dữ liệu thật. Các đề xuất sửa và kết quả follow-up nằm ở findings.

## Kiểm chứng

Checks sử dụng scripts mobile và dependencies hiện có. Reproduction dùng TypeScript transpilation/VM dependency injection, TanStack Query thật và Axios fixture trong tests; không gửi API thật. [Bằng chứng](evidence/reproduce.cjs.txt) là text để không thêm một script vào app lint/runtime.

## Rà luồng Skills

- [x] Đối chiếu FR-SK-01..04, SK-001..004 và AC-01..16 với source cùng bằng chứng hiện có.
- [x] Kiểm owner/public cache, denial ở trang sau, race/session và callbacks quản lý/upload.
- [x] Kiểm validation, catalog/level, version/idempotency, upload/scan/submit, history và archive bằng source/regression.
- [x] Dọn helper polling cũ chỉ còn test gọi, nhánh UI không thể chạy và component/type không có consumer; giữ guards và routes còn sử dụng.
- [x] Bỏ catalog/context/screens/routes Skills demo, chuyển entry points sang API và loại public Skills mẫu khỏi màn hồ sơ.
- [x] Rà profile → list → edit/detail → verification và trạng thái lỗi trên web fixture; đối chiếu theme/shared components ở320/375/430px.
- [x] Cập nhật findings, bằng chứng và acceptance còn mở trong [status](status.md).

API/scanner/Staff và native acceptance tiếp tục theo checklist004. GAP-09 cần timestamp/sort pagination từ backend; material-change policy SK-002 cần contract cụ thể trước khi thay đổi badge. Restore UI, learned-skills/search/contact không được suy thành task còn thiếu của phạm vi quản lý Skills004.

## Rà lại Auth/session — 2026-10-31

- [x] Đối chiếu các lỗi đăng nhập/phiên đã ghi với source hiện tại, gồm login, bootstrap/refresh/storage, logout/logout-all, đăng ký/OTP và recovery.
- [x] Tái hiện F02 và các ca logout/refresh khác generation bằng source thật với adapter cô lập; chạy focused regression hiện có.
- [x] Ghi lỗi còn mở, lỗi cũ đã sửa và phần chưa xác minh tại [review Auth](auth-review-2026-10-31.md).

Lượt review ban đầu chỉ thay tài liệu/evidence. Bản sửa tiếp nhận trên nhánh từ dev:

- [x] Tạo `fix/mobile-auth-session` từ `origin/dev@0825a5d3` và mang các thay đổi tài liệu sang nhánh mới.
- [x] AUTH-01/F02: gắn owner generation cho signed-in recovery, cleanup độc lập với màn hình; giữ guest recovery và điều hướng khi reset thành công.
- [x] AUTH-02: retry cleanup sau logout thay vì restore credential; bảo vệ phiên mới khỏi completion cũ.
- [x] AUTH-03: refresh single-flight theo generation, cleanup đúng Promise.
- [x] AUTH-04: bỏ hướng xác minh email khi API chỉ trả ACCOUNT_NOT_ACTIVE chung.
- [x] Bổ sung regression controller/store/screens; kiểm TypeScript, lint, structure và toàn bộ suite; cập nhật bằng chứng tại status.

Kết quả local không nghiệm thu backend/deployment hoặc native. Không đổi backend CORS hoặc thêm web credential persistence.

## Tiếp nhận UX đăng nhập và đăng xuất

- [x] Ghi nhớ email hợp lệ gần nhất trên thiết bị/web, tự điền ở Login, giữ sau logout; ưu tiên route email và không ghi đè input đã sửa khi hydration trễ.
- [x] Theo lựa chọn người dùng, chuyển logout khỏi menu tài khoản xuống cuối Hồ sơ; giữ dialog xác nhận. Follow-up bỏ nút logout riêng trong Cài đặt, giữ Đăng xuất tất cả thiết bị.
- [x] Kiểm regression preference/hydration và các consumer của AccountMenu qua checks mobile; bằng chứng ở status.
- [x] Bỏ màn Bộ giao diện mobile: xóa route /ui, catalog và entry point ở Hồ sơ/menu/Stack; đổi Back mặc định liên quan sang Hồ sơ và kiểm consumer điều hướng.

## Rà lại thay đổi Auth và UX

- [x] Rà working tree mới nhất và tái hiện các race cleanup cùng lỗi persistence của email bằng source thật.
- [x] Ghi AUTH-05/P2 và AUTH-06/P3 cùng trigger/evidence/hướng sửa trong review Auth tại lượt31/10; bản sửa tiếp nhận ngày01/11 bên dưới.
- [x] Chạy lại full suite và checks workspace, ghi kết quả tại status; không dùng suite xanh để đóng finding ngoài coverage.

## Sửa AUTH-05/06 — 2026-11-01

- [x] Regression trước sửa cho queued logout + login fail/success, cleanup retry sau write phiên mới và retry email sau storage failure.
- [x] Cleanup theo intent, chỉ bị thay thế bởi credential hiện tại đã lưu thành công; ngăn cleanup cũ xóa B hoặc publish guest cho B.
- [x] Tách email đã persist với email trong RAM/pending write, cho retry cùng email sau lỗi mà không ghi trùng.
- [x] Chạy focused suite và checks toàn mobile, cập nhật source/contract/evidence/status; giữ giới hạn native/API rõ ràng.

## Dọn source và rà logic — 2026-11-01

- [x] Theo lựa chọn người dùng, giữ các màn có nhãn xem thử và dependencies còn được dùng; chỉ xóa mock/code không còn consumer.
- [x] Rà import graph từ routes, kể cả platform siblings; đọc consumer trước khi bỏ16 file, chuyển2 cấu hình/helper sang vị trí đúng trách nhiệm và gỡ exports/state/nhánh mock không thể truy cập.
- [x] Sửa read preference email có thể retry sau lỗi bộ nhớ ban đầu, xác nhận regression thất bại trước sửa và đạt sau sửa; nối shortcut Đánh giá về tôi tới route hiện có.
- [x] Chạy full suite, TypeScript, lint, structure và export web; cập nhật [hồ sơ dọn source](cleanup-2026-11-01.md) và [status](status.md) với kết quả và giới hạn.
- [x] Rà toàn bộ diff trước commit, chạy lại tests trọng tâm/format/quy tắc commit và kiểm toolchain pnpm đúng phiên bản; ghi kết luận source ready cùng acceptance còn mở trong status. Chưa stage/commit/push.

## Màn Chính sách mobile — 2026-11-08

- [x] Thay Quay lại bằng icon mũi tên, giữ history Back và fallback guest.
- [x] Tách Điều khoản/Bảo mật; mặc định tóm tắt 5 ý, cho đọc bản đầy đủ và giữ metadata/bản dự thảo. Nội dung đăng ký vẫn dùng bản đầy đủ.
- [x] Đối chiếu bản tóm tắt với shared legal draft và source uy tín/điều khoản/Credit; không tự đặt liên hệ, retention hoặc cam kết pháp lý. Không sửa shared content/BE.
- [x] Kiểm web fixture 320/390/430px, chuyển mục/đọc đầy đủ/back/font/overflow; TypeScript, lint và structure.
- [x] Chỉnh bố cục theo phản hồi tiếp: tham khảo privacy hub chính thức Airbnb/Spotify, dùng tab gạch chân + danh sách chủ đề mở/đóng, hạ notice/version xuống cuối. Dùng Nunito/theme; kiểm accordion, accessibility, loaded fonts và full suite do bổ sung aria mapping trên Button mobile.
