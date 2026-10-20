# Contracts mobile

Các file này sở hữu phần giao tiếp mobile cần dùng; backend sở hữu wire contract. Đối chiếu working tree tại HEAD ed5a17dd9f1a6d5e45e1b6af33b17dd4518b46fd, không import backend types/source vào app. Chưa gọi deployed API trong migration.

| Domain                         | Contract                                  |
| ------------------------------ | ----------------------------------------- |
| Auth/account                   | [auth-account](auth-account.md)           |
| Profile/avatar                 | [profile](profile.md)                     |
| Skill catalog/sharing/evidence | [skills-evidence](skills-evidence.md)     |
| Learning Request/Tag           | [learning-requests](learning-requests.md) |
| Wallet/Payment                 | [wallet-payments](wallet-payments.md)     |
| Notification inbox/SSE         | [notifications](notifications.md)        |

## Quy ước chung

Base /api/v1. Success JSON: {success:true,message,data,meta?}; 204 không có body. Error: {success:false,message,statusCode,details?}. Code an toàn có thể được helper lấy từ message; không giả định top-level code hay requestId. List dùng data array và meta.pagination {limit,hasMore,nextCursor}; cursor opaque theo owner/filter, không suy hết trang bằng số items. Chi tiết tại [response helper](../../src/lib/http/response.ts).

Mỗi domain ghi nguồn (working tree/commit nếu xác định được), endpoint/method/auth, shape thực dùng, error/state/paging/idempotency/lifecycle phù hợp và chênh lệch yêu cầu/source. Domain không dùng upload/realtime thì không tạo contract giả.

## Ba chiều độc lập

Backend: Có trong source / Chưa có / Chưa xác minh deployment. Mobile: API đã nối trong source / Fixture / Chưa nối. Verification: source review / automated fixture / web / real API / Android / iOS / provider, ghi riêng. Backend source có route không chứng minh deployment; API adapter có source không chứng minh acceptance.

Đổi API: đọc controller/DTO/schema hiện tại, so requirement, sửa domain contract và work liên quan, ghi breaking/gap có nguồn; không âm thầm sửa nghiệp vụ hoặc copy toàn bộ backend spec. Rule kỹ thuật chung nằm trong guides, task ở plan, kết quả/hiện trạng ở status. Snapshot baseline không tự cập nhật khi checkout đổi.
