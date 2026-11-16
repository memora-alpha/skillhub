# Làm gọn giao diện mobile

## Phạm vi

Rà toàn bộ màn mobile đang có, thống nhất khoảng cách và cách trình bày danh sách/form theo theme hiện hành. Bỏ tiêu đề/nội dung dẫn trùng, gom bộ lọc thành một thanh ngang, đưa thao tác phụ vào icon có nhãn. Giữ điều hướng, nội dung nghiệp vụ, trạng thái lỗi/quyền, xác nhận, keyboard và vùng chạm tối thiểu 44pt. Không sửa API/backend, stack, dependencies hoặc dữ liệu.

## Task

- [x] Rà source các nhóm màn: auth, Home, Discover, học tập/lộ trình, tin nhắn/đề xuất, tài liệu, kỹ năng, lịch/buổi học, hồ sơ/cài đặt, đánh giá/uy tín/thành tích, báo cáo, Ví và pháp lý.
- [x] Chuẩn hóa thanh lọc và icon action dùng chung; áp dụng cho các danh sách có controls trùng lặp.
- [x] Làm gọn layout form/chi tiết/cài đặt ở component sở hữu; bỏ các tiêu đề dẫn trùng, giữ nội dung quyết định nghiệp vụ.
- [x] Kiểm source/consumer, TypeScript/lint/structure/full tests và browser 320/390/430px/chữ lớn/keyboard; ghi giới hạn native và API triển khai.
- [x] Dọn style/props/nhánh JSX không còn consumer sau các chỉnh sửa, rà toàn bộ diff mobile và chạy hồi quy trước commit.

## Kiểm chứng

Source, test và browser fixture được ghi riêng tại [status](status.md). Fixture không thay nghiệm thu thiết bị/API. Lỗi route thư viện miễn phí tiếp tục theo [status Tài liệu](../materials-ui/status.md#lỗi-đang-mở--api-thư-viện-miễn-phí-chưa-khả-dụng-trên-bản-triển-khai).
