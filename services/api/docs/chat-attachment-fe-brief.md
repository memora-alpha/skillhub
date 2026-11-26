# Bàn giao FE về tệp đính kèm trong chat

## Phân phối tệp chat riêng có kiểm duyệt

Sau khi POST upload trả `202`, dùng GET status và `canAttach` để mở nút gửi **thẻ tin nhắn**. `state: READY` tiếp tục biểu thị đã gửi được thẻ. `accessStatus` và `availability` cùng biểu thị quyền đọc. Tệp chỉ đạt `AVAILABLE` sau malware `CLEAN` và nội dung `APPROVED` theo kết quả enforcement. Cấu hình runtime cần `media:enforce` để các lượt xử lý mới có thể phê duyệt tệp. `CHAT_ATTACHMENT_POST_MODERATION_ORIGIN` xác định origin nếu client cần URL API tuyệt đối.

| `availability` | Hiển thị |
| --- | --- |
| `PENDING_SCAN` | Đang kiểm tra an toàn, khóa nút tải. |
| `AVAILABLE` | Cho tải qua endpoint download hiện có. |
| `REVOKED` | Tệp đã bị thu hồi, ẩn nút tải và bản xem trước. |
| `UNAVAILABLE` | Tệp không khả dụng. |

API status, lịch sử và delivery trả `attachmentType`, `mimeType`, `fileSizeBytes`, `width`, `height`, `accessStatus` và `moderationStatus`. Kích thước ảnh theo orientation, có thể `null` khi đang xử lý hoặc là tài liệu. Sau khi ảnh đạt yêu cầu và có bản dẫn xuất, lịch sử/delivery trả `previewUrlEndpoint` và `thumbnailUrlEndpoint`. Gửi Bearer token khi mở cả hai endpoint. SSE `chat.attachment.availability.updated` gồm `{ conversationId, messageId, fileId, stateRevision }` để hai phía đọc lại tin hoặc thread. Khi kết nối lại, đọc lại REST. `chat.attachment.updated` cập nhật màn upload của người gửi.

Endpoint download trả `{ url, expiresAt }`. URL backend hết hạn sau 60 giây và phải được tải bằng Bearer token thuộc cùng tài khoản và session đã xin URL. Web nên tải qua proxy xác thực, Mobile tải bằng HTTP client của app trước khi mở file. Các response bytes có `Cache-Control: private, no-store`. Lượt tải tiếp theo sau thu hồi trả lỗi. Web/Mobile cần xóa preview đã cache khi tệp bị thu hồi.

Admin/Staff có quyền `chat-attachment:moderate` xem metadata kết quả tại `GET /api/v1/content-moderation/chat-attachments?before=<cursor>`. Kết quả `BLOCK` tự bị thu hồi. Admin/Staff có thể xác nhận thu hồi ca `REVIEW` hoặc `FAILED` qua `POST /api/v1/content-moderation/chat-attachments/{fileId}/revoke` với `{ reason }`. Quyết định được ghi audit. Đình chỉ tài khoản vẫn đi qua luồng quản trị hiện có.

Áp migration `20261126000000_secure_chat_attachment_moderation` và triển khai đồng bộ client dùng Bearer khi tải bytes. Vô hiệu hóa signed URL storage cũ hoặc để hết TTL trước cutover, kiểm tra origin/bucket/CDN riêng tư và bypass cache cho các endpoint phục vụ bytes. Tệp lịch sử thiếu kết quả hợp lệ chờ recheck theo lô. Chỉ rollback về bản giữ fail-closed hoặc tạm khóa đường đọc. Dùng model ghim phiên bản hoặc cấu hình `CONTENT_MODERATION_MODEL_CACHE_REVISION` để cho phép cache nội dung với model alias, tăng revision khi model đổi.

Khi đo P95 trên staging, chạy baseline và candidate cùng bộ tệp tổng hợp và profile tải. Tổng hợp bản ghi JSONL `{ group, durationMs, outcome }` bằng `node scripts/benchmark-chat-moderation.mjs baseline.jsonl candidate.jsonl` từ `services/api`. Các nhóm đo và hướng dẫn thu mẫu nằm trong [kế hoạch](../../../docs/superpowers/plans/2026-11-26-secure-chat-attachment-moderation.md#đo-hiệu-năng-và-nghiệm-thu-chung).

## Thay đổi

- JPG/JPEG hợp lệ vẫn có thể upload nếu encoder thêm một ít byte 0 ở cuối. Backend vẫn kiểm tra định dạng thật và áp dụng luồng quét mã độc, OCR và kiểm duyệt trước khi cho gửi. `415 FILE_FORMAT_UNSUPPORTED` ở bước upload nghĩa là backend chưa nhận được định dạng tệp hợp lệ.
- Backend phát thêm event `chat.attachment.updated` khi lưu kết quả kiểm duyệt cuối. Event dùng SSE `GET /api/v1/events` đã có và chỉ tới tài khoản upload tệp. Payload giữ nguyên `{ "fileId": "..." }`.

## Cách dùng trong chat

1. Sau upload, lưu `data.fileId` và gọi `GET /api/v1/conversations/{conversationId}/attachments/{fileId}/status`.
2. Khi nhận `chat.attachment.updated`, đọc lại status của tệp tương ứng. Event chỉ báo trạng thái có thể đã đổi. Một tệp có thể phát nhiều event ở các bước khác nhau. Client mobile hiện đã invalidate query tệp khi nhận event này.
3. Mở nút gửi khi `data.canAttach` là `true`. Nếu có `moderationStatus: "REVIEW_REQUIRED"`, hiển thị tệp cần xem xét. Với `REJECTED` hoặc `SCAN_FAILED`, hiển thị kết quả cuối và cho người dùng chọn lại tệp. Khi SSE ngắt hoặc vừa kết nối lại, đọc lại status. Có thể dùng polling có giới hạn cho tệp đang chờ khi SSE chưa kết nối.

Event không tự tạo tin nhắn. Người gửi vẫn bấm gửi và backend xác thực tệp lần cuối. Với màn chat mobile hiện tại, việc invalidate status đã có sẵn, nên QA có thể kiểm tra event mới ngay sau khi backend áp dụng migration.

Nếu muốn hiển thị riêng trạng thái cần xem xét, FE thêm `moderationStatus` dạng tùy chọn vào schema đọc response. Logic mở nút gửi vẫn dựa vào `state`.

## QA

- Upload JPG thông thường và JPG có byte 0 đệm hợp lệ. Cả hai phải đi vào luồng quét. Tệp bị cắt hoặc khai sai định dạng vẫn phải bị từ chối.
- Sau finalize, người gửi gửi được thẻ. Người nhận có thể thấy thẻ pending. Thử cả download, preview và thumbnail trước `APPROVED` và sau thu hồi.
- Dùng mẫu bị bộ kiểm duyệt chặn để xác nhận event cập nhật, status trả `REJECTED` và thẻ đã gửi chuyển `REVOKED`.

Backend cần migration `20261124000000_chat_attachment_moderation_event`. Thay đổi này không thêm biến môi trường.
