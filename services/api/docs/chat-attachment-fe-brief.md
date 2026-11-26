# Bàn giao FE về tệp đính kèm trong chat

## Hậu kiểm trong chat riêng

Bật ở BE bằng `CHAT_ATTACHMENT_POST_MODERATION_ORIGIN` (origin công khai của API, ví dụ `https://skillhub.memora.cam`) và `media:enforce`. Sau khi POST upload trả `202`, gọi GET status như cũ. Khi state là `READY`, FE được phép gửi **thẻ tin nhắn**. Điều khiển mở/tải tệp bằng `availability`.

| `availability` | Hiển thị |
| --- | --- |
| `PENDING_SCAN` | Đang kiểm tra an toàn, khóa nút tải. |
| `AVAILABLE` | Cho tải qua endpoint download hiện có. |
| `REVOKED` | Tệp đã bị thu hồi, ẩn nút tải và bản xem trước. |
| `UNAVAILABLE` | Tệp không khả dụng. |

API lịch sử và delivery bổ sung `attachments[].availability`. Người nhận có thể thấy thẻ trước khi tệp tải được. Khi nhận SSE `chat.attachment.availability.updated` với `{ conversationId, messageId, fileId }`, cả hai phía tải lại tin hoặc thread và cập nhật thẻ. Khi SSE nối lại, đọc lại dữ liệu REST. Event cũ `chat.attachment.updated` vẫn cập nhật màn chờ upload của người gửi.

Endpoint download tiếp tục trả `{ url, expiresAt }`. Khi hậu kiểm bật, URL dẫn đến backend và hết hạn sau 60 giây. Mỗi lượt tải kiểm tra lại session, quyền tham gia, kết quả quét mã độc và thu hồi. Lượt tải mới sau khi thu hồi trả lỗi; dữ liệu đã tải về nằm trên thiết bị người nhận.

Admin/Staff có quyền `chat-attachment:moderate` xem metadata kết quả tại `GET /api/v1/content-moderation/chat-attachments?before=<cursor>`. Kết quả `BLOCK` tự bị thu hồi. Admin/Staff có thể xác nhận thu hồi ca `REVIEW` hoặc `FAILED` qua `POST /api/v1/content-moderation/chat-attachments/{fileId}/revoke` với `{ reason }`. Quyết định được ghi audit. Đình chỉ tài khoản vẫn đi qua luồng quản trị hiện có.

Triển khai migration `20261124010000_chat_attachment_post_moderation` và identity seed trong release. FE cần hỗ trợ trường và event mới trước khi bật mode trên môi trường dùng chung. Đo mốc 3 giây cho việc phát hành thẻ sau khi nhận đủ upload trên môi trường QA.

## Thay đổi

- JPG/JPEG hợp lệ vẫn có thể upload nếu encoder thêm một ít byte 0 ở cuối. Backend vẫn kiểm tra định dạng thật và áp dụng luồng quét mã độc, OCR và kiểm duyệt trước khi cho gửi. `415 FILE_FORMAT_UNSUPPORTED` ở bước upload nghĩa là backend chưa nhận được định dạng tệp hợp lệ.
- Backend phát thêm event `chat.attachment.updated` khi lưu kết quả kiểm duyệt cuối. Event dùng SSE `GET /api/v1/events` đã có và chỉ tới tài khoản upload tệp. Payload giữ nguyên `{ "fileId": "..." }`.

## Cách dùng trong chat

1. Sau upload, lưu `data.fileId` và gọi `GET /api/v1/conversations/{conversationId}/attachments/{fileId}/status`.
2. Khi nhận `chat.attachment.updated`, đọc lại status của tệp tương ứng. Event chỉ báo trạng thái có thể đã đổi. Một tệp có thể phát nhiều event ở các bước khác nhau. Client mobile hiện đã invalidate query tệp khi nhận event này.
3. Mở nút gửi khi `data.state` là `READY`. Với `QUARANTINED` hoặc `SCANNING`, vẫn chờ. Nếu có `moderationStatus: "REVIEW_REQUIRED"`, hiển thị tệp cần xem xét. Với `REJECTED` hoặc `SCAN_FAILED`, hiển thị kết quả cuối và cho người dùng chọn lại tệp. Khi SSE ngắt hoặc vừa kết nối lại, đọc lại status. Có thể dùng polling có giới hạn cho tệp đang chờ khi SSE chưa kết nối.

Event không tự tạo tin nhắn. Người gửi vẫn bấm gửi và backend xác thực tệp lần cuối. Với màn chat mobile hiện tại, việc invalidate status đã có sẵn, nên QA có thể kiểm tra event mới ngay sau khi backend áp dụng migration.

Nếu muốn hiển thị riêng trạng thái cần xem xét, FE thêm `moderationStatus` dạng tùy chọn vào schema đọc response. Logic mở nút gửi vẫn dựa vào `state`.

## QA

- Upload JPG thông thường và JPG có byte 0 đệm hợp lệ. Cả hai phải đi vào luồng quét. Tệp bị cắt hoặc khai sai định dạng vẫn phải bị từ chối.
- Khi kiểm tra tệp sạch kết thúc, nút gửi tự mở sau khi SSE kích hoạt đọc lại status. Phía nhận chỉ thấy tệp sau khi người gửi bấm gửi thành công.
- Dùng mẫu bị bộ kiểm duyệt chặn để xác nhận vẫn nhận event cập nhật, status trả `REJECTED` và nút gửi vẫn khóa.

Backend cần migration `20261124000000_chat_attachment_moderation_event`. Thay đổi này không thêm biến môi trường.
