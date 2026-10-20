# Notification inbox

Nguồn đối chiếu: `services/api/src/modules/notifications/presentation/http/notifications.controller.ts`, DTO/response cùng thư mục; các notification producer và `services/api/specs/008-connections/contracts/sse.md`. Yêu cầu: SRS 1.6 FR-NTF-01/02, BR-09, FR-LR-04.

- `GET /notifications?limit=20&cursor=...`: envelope paginated, mới nhất trước; `id`, `type`, `title`, `body`, `payload`, `readAt`, `createdAt`. Cursor opaque; không tự tạo hoặc đổi thứ tự trang.
- `PATCH /notifications/:notificationId/read`: 204 không body; lặp lại vẫn giữ lần đọc đầu tiên trên server. Quyền `notification:read:self` / `notification:update:self` và recipient do server kiểm tra.
- SSE dùng kết nối `/events` sẵn có, không mở stream riêng. `notification.created/read` chỉ mang `notificationId`, sau đó invalidate inbox trong cache theo user/generation. Fresh stream/reset tải lại inbox; cursor chỉ tiến sau khi hydration thành công.

Source mobile: `features/notifications`; route `/notifications`, header dùng cùng query. Danh sách hỗ trợ kéo làm mới hoặc nút làm mới (web/accessibility), tải thêm, lọc chưa đọc trong các trang đã tải và đánh dấu từng mục. Lỗi refresh giữ nội dung còn được phép đọc; 403/404 dùng read-access boundary hiện có. Sau 204 cập nhật dấu đã đọc trong cache rồi tải timestamp server. Logout/switch session dùng connection runtime/cache cleanup.

Liên kết chỉ dựng từ allowlist loại thông báo + UUID: Proposal, Chat, Learning Request bị từ chối, verification history và Learning Path locked/settled. Unknown type/payload vẫn hiển thị title/body, không mở URL từ payload. Report/session chưa có đích API được xác minh nên chỉ đọc nội dung tại inbox.

## Giới hạn hợp đồng

- Chưa có tổng unread hoặc unread filter trên server. Chuông chỉ dùng dấu chấm khi **các trang đã tải** có mục chưa đọc; không thể suy tổng unread/toàn bộ inbox từ trang đầu.
- Chưa có bulk mark-read, notification preferences thật hoặc push/email production trong phạm vi này. Không hiển thị thao tác giả từ preview trên màn thật.
- Kiểm thử fixture chứng minh contract/client behavior; không xác nhận delivery worker, DB, proxy SSE hoặc native device đã chạy ở môi trường triển khai.

## Kiểm chứng ngày 2026-10-20

- `pnpm --filter mobile test`: 337 pass, 0 fail/skip trên Node 22.19.0. Lượt Node 24.19.0 trước đó lỗi module mock của các test profile/skills; không sửa harness ngoài phạm vi.
- `pnpm --filter mobile check-types`, `lint`, `check-structure`: pass. Các file source sửa/thêm đều trong giới hạn dòng.
- `pnpm exec expo export --platform web --output-dir ../../.git/notification-web-preview` từ mobile: xuất bundle thành công.
- Chưa có visual/native/live API acceptance: công cụ từ chối lệnh khởi chạy web preview riêng với `blocked by policy`; fixture tạm đã dọn. Test notification kiểm tra HTTP/204/cursor, malformed response, allowlisted routes và SSE hydration/replay/session guards.
