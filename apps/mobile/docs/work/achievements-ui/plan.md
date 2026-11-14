# Thành tích và danh hiệu

## Mục tiêu và phạm vi

Theo yêu cầu người dùng: đồng bộ UI với app Expo, tham khảo app khác để thiết kế lại và đối chiếu API BE còn thiếu kết nối. Sửa feature achievements và cách hiển thị danh hiệu trên Profile; giữ route, theme Nunito, HTTP/session runtime. Không đổi backend hoặc tự đặt điều kiện mở khóa.

## Nguồn

- [UI guide](../../guides/ui-and-styling.md), [Profile contract](../../contracts/profile.md).
- [Controller](../../../../../services/api/src/modules/reputation/presentation/http/achievements.controller.ts), [service](../../../../../services/api/src/modules/reputation/application/services/achievements.service.ts), [seed](../../../../../services/api/src/modules/reputation/application/seed-achievements.ts).
- Tham khảo cách trình bày bộ sưu tập huy chương của [Duolingo](https://www.youtube.com/watch?v=zFtK6GVDSN4) và phần thưởng thử thách của [Strava](https://support.strava.com/en-us/articles/15401916-strava-challenges). Dùng theme và components của SkillHub.

## Hiện trạng ban đầu

Mobile đã nối GET danh sách và PATCH chọn/ẩn danh hiệu, nhưng dùng các Panel và nút lặp; một số seed tiếng Anh. BE trả thành tích đã mở khóa, chưa có catalog/progress của thành tích chưa mở khóa. `selectedTitle` là chuỗi title, không phải code.

## Task

- [x] Đối chiếu controller/service/DTO và origin/dev, xác định endpoint và field hiện có.
- [x] Đưa danh hiệu trên hồ sơ lên đầu; bộ sưu tập dạng thẻ, lọc nhóm và sắp xếp mới nhất.
- [x] Đồng bộ typography/màu, dịch đúng seed tiếng Anh để hiển thị và giữ nguyên dữ liệu tùy chỉnh.
- [x] Giữ code gốc khi chọn, body rỗng khi ẩn; sửa đồng bộ cache own/self-public, chặn completion phiên cũ và gửi lặp.
- [x] Kiểm tra adapter, lifecycle, states, màn nhỏ, text lớn; ghi evidence và giới hạn.
- [x] Theo phản hồi: bỏ nút làm mới, giữ pull-to-refresh; giảm padding/kích thước thẻ, dùng vùng bấm đặt danh hiệu riêng và kiểm tra chọn/ẩn.

## Tiêu chí và kiểm chứng

Thành tích mở khóa từ BE là nguồn duy nhất của bộ sưu tập và số lượng. Chọn/ẩn phải cập nhật hồ sơ; lỗi không báo lưu thành công hoặc biến thành empty state. Không tự tạo badge khóa, tiến độ hay mẫu số từ số seed. Kiểm tra TypeScript, lint, structure, tests và web export; browser fixture dùng source thật kiểm tra lọc, chọn/ẩn, lỗi và chiều rộng320/390/430. Native và API triển khai cần nghiệm thu riêng.
