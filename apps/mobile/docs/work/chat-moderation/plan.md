# Cảnh báo nội dung chat

## Phạm vi và thiết kế

Cảnh báo inline ngay dưới tin chưa gửi, lấy cảm hứng từ TikTok/Messenger: biểu tượng cảnh báo, nền đỏ nhạt và lý do ngắn gọn. Tin bị chặn chỉ báo “Không gửi được tin nhắn”, không có nút sửa/bỏ hoặc gửi lại. Trong lúc chờ gửi chỉ hiển thị “Đang gửi…”, không hiển thị trạng thái kiểm tra nội dung. Dùng theme, font, Icon và composer hiện có của SkillHub; không xác nhận pixel-match với ứng dụng tham khảo.

Thay đổi thuộc mobile. Backend quyết định chặn nội dung, thông tin liên hệ và trạng thái tệp; không thêm bộ lọc hay provider ở client.

## Contract

- `400 CONTACT_INFORMATION_NOT_ALLOWED`: giải thích loại thông tin cần bỏ.
- `422 CONTENT_MODERATION_BLOCKED`: lần gửi bị hủy; không retry cùng ID. Người dùng vẫn có thể soạn và gửi tin khác bình thường.
- `503 CONTENT_MODERATION_TEMPORARILY_UNAVAILABLE`: giữ nội dung và ID để kiểm tra/thử lại đúng lần gửi. Text dùng outbox hiện có; tệp dùng recovery thủ công hiện có.
- Tệp chỉ được gửi khi status là `READY`; `REJECTED` tiếp tục yêu cầu thay tệp. Kiểm duyệt media có thể trả `409 CONTENT_MODERATION_BLOCKED`.

Nguồn: `services/api/src/modules/conversations/presentation/http/conversations.controller.ts`, `services/api/src/modules/conversations/application/services/conversations.service.ts`, `services/api/src/infrastructure/storage/file-content-moderation.ts` và `services/api/docs/content-moderation-rollout.md`.

## Tasks

- [x] Lưu mã lỗi trong outbox tương thích dữ liệu version 1, giữ cảnh báo qua restart.
- [x] Cảnh báo đỏ cho tin bị chặn, không có thao tác sửa/bỏ/retry; giữ composer hiện hành.
- [x] Chặn retry ID đã bị từ chối, cho phép gửi tin mới với ID mới.
- [x] Trạng thái “Đang gửi…” khi chờ kiểm duyệt; không hiển thị bước kiểm tra nội dung.
- [x] Recovery từ lỗi không rõ kết quả sang `422` được mở khóa; các lỗi permission sau lần gửi không rõ kết quả vẫn giữ reconciliation.
- [x] Kiểm tra outbox qua restart, session cũ, outage và cảnh báo không có nút thao tác.
- [x] Đặt tin lỗi theo thời điểm gửi thay vì ghim cuối danh sách, giữ vị trí/identity của tin mới khi chuyển từ outbox sang lịch sử và giữ thứ tự sequence của backend.
- [x] Đồng bộ thông báo hệ thống/xác nhận lịch bằng khung nền nhạt, icon theo nội dung và nút xem lịch hiện có; giữ nguyên dữ liệu xác nhận, actor và hướng học.
- [x] Tự cập nhật trạng thái ảnh/tệp bằng monitor chung; bỏ nút kiểm tra khi đang chờ hoặc gửi bình thường, chỉ hiện retry khi có lỗi hoặc cần recovery.
- [x] Hiển thị đúng lỗi chọn/tải/đọc trạng thái tệp; nhãn không tiếp tục báo đang xử lý sau lỗi/timeout. Tự thử lại tối đa hai lần đọc trạng thái khi lỗi mạng/5xx, giữ nguyên trạng thái server và không tải/gửi lại mutation.
- [x] Hoàn tất checks sau khi giản lược UI và ghi kết quả trong [status](status.md).
- [x] Rà code dư thừa và lỗi hiện tại: giản lược wrapper/props retry và helper chỉ dùng một lần; sửa monitor chạy lại khi cùng tệp chuyển từ READY về chờ kiểm tra, xóa cảnh báo sau trạng thái cuối; đồng bộ test UI và chạy full checks.

## Nghiệm thu

Source đáp ứng contract và focused/full tests, typecheck, lint, structure. Kiểm tra màn hẹp bằng web harness từ component thật; đây là bằng chứng presentation với dữ liệu mẫu. Native/API thật cần kiểm tra riêng bằng tài khoản test trên môi trường có bật `chat:enforce` và `media:enforce`.
