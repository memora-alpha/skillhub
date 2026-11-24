# Bàn giao FE về tệp đính kèm trong chat

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
