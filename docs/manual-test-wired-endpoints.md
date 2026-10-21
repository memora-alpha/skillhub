# Kiểm thử các endpoint vừa gắn màn hình

Chạy API tại `http://localhost:3001`, web tại `http://localhost:3000`, Flutter web tại `http://localhost:8082`.

Tài khoản:

- Admin: `admin@skillhub.local` / `Adm1n-LCPKD9L3dp!`
- Staff: `staff@skillhub.local` / `Staff123!`
- Cần thêm một tài khoản người dùng thường để thử ví, thẻ, chat và lộ trình.

## Flutter

| Màn hình | Việc cần làm | Endpoint |
| --- | --- | --- |
| Ví Credit | Mở ví, thấy số khả dụng và số đang giữ | `GET /me/wallet` |
| Lịch sử giao dịch | Xem sổ Credit và danh sách lệnh nạp | `GET /me/wallet/transactions`, `GET /payments` |
| Chi tiết giao dịch | Mở một bút toán | `GET /me/wallet/transactions/:id` |
| Nạp Credit | Thấy cổng nạp đang mở hoặc lý do bị chặn | `GET /payments/creation-policy` |
| Thanh toán payOS | Tạo lệnh với số tiền bội số 1.000 | `POST /payments` |
| Trạng thái thanh toán | Tải lại mã QR, hủy lệnh chưa trả | `GET /payments/:id`, `POST /payments/:id/cancel` |
| Thẻ kỹ năng | Xem thẻ, gửi đề xuất, mở chi tiết đề xuất | `GET /tags`, `POST /tag-requests`, `GET /me/tag-requests`, `GET /me/tag-requests/:id` |
| Danh mục và cấp độ | Từ một kỹ năng chia sẻ, mở danh mục | `GET /skills/:skillId`, `GET /skills/:skillId/levels` |
| Hồ sơ xác minh | Từ lịch sử, mở hồ sơ và lấy liên kết bằng chứng | `GET /me/skills/:id/verifications/:verificationId`, `GET .../evidence/:evidenceId/download` |
| Thông báo | Tải hộp thư, đánh dấu đã đọc, bấm Nghe sự kiện | `GET /notifications`, `PATCH /notifications/:id/read`, `GET /events` |
| Thông báo đẩy | Dán mã FCM dài ít nhất 20 ký tự, rồi ngừng thiết bị | `POST /notifications/push-tokens`, `DELETE /notifications/push-tokens/:id` |
| Chi tiết yêu cầu học | Mở một yêu cầu trên khám phá | `GET /learning-requests/:requestId` |
| Tin nhắn | Mở một cuộc trao đổi, gửi tin | `GET /conversations/:id`, `POST /conversations/:id/read`, `GET .../message-deliveries/:clientMessageId` |
| Gửi tệp trong chat | Chọn ảnh | `POST .../attachments`, `GET .../attachments/:fileId/status`, `GET .../messages/:messageId/attachments/:attachmentId/download` |
| Lộ trình và buổi học | Tải lộ trình, mở thỏa thuận, tạo lộ trình, xác nhận, thêm kế hoạch, đánh giá, quyết toán, tải buổi học, lấy mã phòng, xác nhận hoàn thành, đổi lịch, xác nhận lịch | `GET/POST/PATCH /learning-paths`, `POST .../confirm`, `POST .../final-validation`, `POST .../finalize`, `POST .../plans`, `POST /learning-paths/plans/:id/confirm`, `POST/GET .../reviews`, `POST /sessions/paths/:id/settlement`, `GET /sessions/mine`, `GET /sessions/:id`, `POST .../livekit-token`, `POST .../confirm-completion`, `POST .../reschedule-proposals`, `POST /schedule-proposals/:id/confirm` |
| Lịch sử uy tín | Mở từ điểm uy tín | `GET /reputation/me` |
| Thành tích | Chọn hoặc ẩn danh hiệu | `PATCH /me/achievements/selected-title` |
| Báo cáo buổi học | Mở từ một buổi học và gửi | `POST /reports/evidence-files`, `GET /reports/evidence-files/:fileId`, `POST /reports/sessions/:sessionId` |

Báo cáo tài liệu vẫn là bản xem thử vì API không có endpoint báo cáo tài liệu.

## Web Admin

Đăng nhập `http://localhost:3000/admin`.

| Màn hình | Việc cần làm | Endpoint |
| --- | --- | --- |
| Thẻ | Tạo thẻ, bật hoặc tắt | `GET/POST /admin/tags`, `PATCH /admin/tags/:tagId` |
| Đề xuất thẻ | Mở chi tiết, duyệt hoặc từ chối | `GET /admin/tag-requests`, `GET /admin/tag-requests/:id`, `POST .../approve`, `POST .../reject` |
| Danh mục kỹ năng → Cấp độ | Thêm cấp độ, bật hoặc tắt | `GET/POST /admin/skills/:skillId/levels`, `PATCH .../levels/:levelId` |
| Chi tiết báo cáo | Mở một vụ từ hàng đợi | `GET /reports/staff/:caseId` |

Webhook payOS và webhook LiveKit không có màn hình vì máy chủ thanh toán và LiveKit gọi chúng, không phải người dùng.
