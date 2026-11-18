# Thành tích và danh hiệu — hiện trạng

Cập nhật: 2026-11-13T21:17:14+07:00. Trạng thái source: **Ready for review**. Phạm vi theo [plan](plan.md).

## UI và dữ liệu

- Danh hiệu đang hiển thị nằm trên cùng, có nút Ẩn gọn; bên dưới là số thành tích thực, bộ lọc theo nhóm và danh sách thẻ ngang, thành tích mới nhất trước. Mỗi thẻ có huy hiệu bên trái, tên/chú thích ở giữa và nút Dùng bên phải; nội dung tự tăng chiều cao khi chữ lớn. Font Nunito, màu, radius, Button và notice theo app; không thêm thư viện.
- Nhấn Dùng để đặt danh hiệu, thẻ đang dùng có dấu chọn và nền cam nhạt. Chú thích lấy từ description server, không dựng điều kiện mới; không lặp ngày mở khóa. Seed tiếng Anh được dịch ở lớp hiển thị, dùng chung với own/public Profile; chuỗi tùy chỉnh giữ nguyên, API/cache vẫn giữ title gốc.
- Loading/error/denied/empty tách riêng; filter chỉ có nhóm đang chứa dữ liệu. Lỗi lưu giữ danh hiệu hiện có, có làm mới để đối chiếu. Không hiển thị progress hoặc badge chưa mở khóa khi BE chưa trả.

## Đối chiếu backend

- GET `/api/v1/me/achievements`: `{selectedTitle,items:[{code,title,description,unlockedAt}]}`. Service đánh giá và trả thành tích active đã mở khóa. Seed hiện có12 định nghĩa nhưng không phải contract tổng số để tính phần trăm.
- PATCH `/api/v1/me/achievements/selected-title`: `{code}` chọn thành tích active đã mở khóa; `{}` ẩn. Response `{selectedTitle}` chứa tên, không phải code; `409 TITLE_NOT_UNLOCKED` khi không hợp lệ. Cả hai endpoint đã nối trước lượt này; không phát hiện endpoint User còn bỏ sót trong phạm vi thành tích.
- GET own/public profile đã có `selectedTitle`. Sau PATCH, hủy read cũ, cập nhật account/achievements và invalidate đúng self public-profile. Request không tự replay sau renewal; khóa gửi trùng và bỏ completion phiên cũ. Adapter validate mã, timestamp và code trùng.
- Đã fetch origin/dev (`5a70621d`); không có bổ sung khác ở module BE so với baseline. Không sửa source BE, không chạy seed/migration. Chưa có User API catalog, tiến độ hoặc danh sách thành tích của người khác; chưa tự bổ sung nghiệp vụ đó.

## Kiểm chứng

- Focused **6/6 PASS**: adapter chọn/ẩn, raw title/localization/custom copy, dữ liệu lỗi, session, thứ tự, đồng bộ cache self và chặn gửi lặp. Sau review bổ sung ca chuỗi trùng thuộc tính Object vào test localization và chạy lại6/6 PASS; TypeScript và ESLint file ảnh hưởng cũng PASS.
- Full mobile suite **1.154/1.154 PASS**, không fail/skipped/cancelled; log ignored `.expo/achievements-ui-full-tests.log`. TypeScript và full ESLint PASS. Structure983 source files PASS.
- Backend build và **18/18 PASS** qua `learning-platform/phase3.test.mjs`, log ignored `.expo/achievements-ui-api-tests.log`; fake transaction DB, không phải deployed API.
- Browser fixture dùng screen/card và adapter thật, hooks/session/transport thay thế:320/390/430px không tràn ngang; empty/custom copy dài, chữ130%, lọc nhóm, chọn mã gốc/ẩn body rỗng, lỗi lưu/làm mới, TITLE_NOT_UNLOCKED, loading/error/denied không hiện empty giả đều PASS. Đã xem ảnh normal/empty/long. Script và ảnh ignored ở `.expo/achievements-ui-preview.cjs` và `.expo/achievements-ui-preview/`.
- Expo web export PASS tại `.expo/achievements-ui-web`, log ignored `.expo/achievements-ui-export.log`; thực hiện trước chỉnh sửa cuối về lookup chuỗi tùy chỉnh. Whitespace và structure PASS sau chỉnh sửa cuối.

## Giới hạn và nghiệm thu

Android/iOS, TalkBack/VoiceOver và API triển khai **NOT_RUN**. Nghiệm thu người dùng chưa thực hiện. Backend chỉ lưu tên danh hiệu; không có selected code trong response, nên mobile đối chiếu thẻ đang dùng theo title như contract hiện hành. Nếu BE cho phép nhiều thành tích trùng title cần mở rộng contract riêng.

## Điều chỉnh theo phản hồi — 2026-11-13T21:10:38+07:00

- Bỏ nút Làm mới, giữ kéo xuống qua scroll refresh chung. Chỉ hiện vòng tải cho lần kéo xuống; refetch nền sau PATCH không làm xuất hiện vòng tải. Chặn pull khi đang lưu/đang tải; notice lỗi hướng dẫn kéo xuống kiểm tra.
- Dùng FeaturePage compact (padding12/gap8); danh hiệu trên hồ sơ thành một hàng, bỏ dòng mô tả lặp. Thẻ padding10/gap6, icon28, tiêu đề cạnh icon, giữ mô tả/ngày thật. Bộ sưu tập và số đã mở khóa cùng hàng. Tham khảo thêm [Duolingo achievements](https://blog.duolingo.com/achievement-badges/) và [Strava Trophy Case](https://support.strava.com/en-us/articles/15402068-the-strava-trophy-case).
- Chỉ vùng hành động chân thẻ thay đổi danh hiệu, vùng bấm cao tối thiểu44; chạm tiêu đề không gửi PATCH. Pending khóa nút, thành công chuyển sang Đang dùng, có thể ẩn rồi chọn lại. Không thay API/hook/session contract.
- Focused6/6, TypeScript, ESLint feature, structure983 và whitespace PASS. Browser fixture lần này dùng cả RefreshableScrollView/PullRefreshBoundary thật: kéo chuột xuống tải lại và xóa notice lỗi, chọn/ẩn, pending, mã/body, bấm Enter, lọc, dữ liệu dài,320/390/430px và chữ130% PASS; không pageerror. Đã xem ảnh normal390 cập nhật tại `.expo/achievements-ui-preview/normal-390.png`. Session/hook/transport vẫn là fixture, không xác nhận deployed API/native.
- Full suite/backend/export ở mục trước là evidence lượt trước; không chạy lại vì lượt này chỉ sửa UI và trạng thái vòng tải.

### Giảm chữ và đồng bộ màu — 2026-11-13T21:13:38+07:00

Gỡ mô tả/ngày trên card, rút nhãn thao tác thành Chọn. Filter được chọn dùng Button craft màu cam; card đang dùng cũng dùng primarySoft/primaryMuted thay màu xanh. TypeScript, ESLint feature, whitespace và browser fixture320/390/430px, chữ130%, lọc/chọn/ẩn/pull refresh/keyboard đều PASS. Đã xem ảnh normal390 mới; API/native vẫn chưa nghiệm thu.

### Bổ sung chú thích, thiết kế thẻ ngang — 2026-11-13T21:17:14+07:00

Theo phản hồi thiếu chú thích, đổi bộ sưu tập hai cột thành các thẻ ngang: icon40, tên15/22 đậm, chú thích13/18 dịu màu và nút Dùng tối thiểu52x44. Phần chữ có toàn bộ chiều rộng còn lại và tự xuống dòng, không cắt điều kiện/custom copy. Bỏ đường chia chân thẻ và nhãn thao tác dài lặp lại; danh hiệu đang dùng có check-circle, giữ màu cam ở filter/card. Tham khảo cách phân cấp huy hiệu/mốc của Duolingo theo nguồn trong plan.

TypeScript, ESLint feature, whitespace và browser fixture320/390/430px, chữ130%, dữ liệu dài, lọc/chọn/ẩn/pending/pull refresh/Enter đều PASS. Đã xem ảnh normal390 và long390 mới. Hook/API không thay đổi, chưa nghiệm thu native/deployed API; full suite/backend/export là bằng chứng các lượt trước.
