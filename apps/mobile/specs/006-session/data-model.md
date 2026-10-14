# Data model phía mobile

Projection đọc, không thêm DB/model backend. Dùng allowlist/schema bỏ room metadata, attendance và fields ngoài scope.

## SessionSummary / SessionDetail

| Field                                | Quy tắc                                                                                                                     |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| id/pathId/planId/teacherId/learnerId | UUID, user thuộc teacher/learner; detail id khớp route.                                                                     |
| startAt/endAt                        | Timestamp có offset/Z, parse được, endAt > startAt; timezone thiết bị khi hiển thị.                                         |
| status                               | CONFIRMED, READY, ONGOING, AWAITING_CONFIRMATION, COMPLETED, CANCELLED, DISPUTED; giá trị khác chưa hỗ trợ.                 |
| teacher/learnerConfirmationStatus    | string/null; CONFIRMED là xác nhận, null chưa ghi nhận; giá trị chưa biết hiển thị chưa xác định và khóa command liên quan. |
| role                                 | TEACHER/LEARNER ở list, đối chiếu participant; detail suy từ userId, không role account.                                    |
| teacher/learnerConfirmedAt           | timestamp/null nếu có; không bịa từ thời điểm bấm.                                                                          |
| partnerId/name/avatar                | partnerId từ hai participant, name/avatar từ public profile được phép.                                                      |

Tên/nội dung plan và progress toàn Path chưa có projection; không suy Path hoàn thành từ Session.

## RescheduleProjection — dependency, chưa phải DTO server

Cần scheduleProposalId/sessionId/currentVersion/appliedVersion, lịch cũ, giờ đề xuất và xác nhận từng bên ở phiên bản đang xem. Phân biệt không có proposal với chưa đọc được. Chưa có read contract thì không gửi command/version giả hoặc tự đặt state expiry.

Form local: ngày giờ mới và durationMinutes 60–180; startAt ISO UTC từ giờ địa phương hợp lệ, endAt = startAt + duration. Không reason bắt buộc, Credit/session count.

## State và cache

- Session state từ server; một completion confirmation không tự chuyển COMPLETED hoặc settle Credit.
- Đổi lịch: lịch cũ → proposal chờ → đủ hai confirm + server apply → lịch mới. Thiếu confirm/quá cutoff giữ lịch cũ; propose không tự confirm tác giả.
- Prefix `['sessions', userId, generation]`; list thêm from/to/timezone, detail thêm sessionId. Proposal key chỉ sau contract thật.
- Mutation: idle → pending → receipt/refetch hoặc uncertain/error → reconcile. Success receipt khóa gửi lặp nếu refetch thất bại; không suy cả hai confirmation từ id/status.
- Draft chỉ trong account/form hiện tại; đổi account loại kết quả cũ. 403/404 xóa/ẩn cache liên quan. Refresh network lỗi giữ cache cùng account có cảnh báo stale và khóa mutation đến khi đọc lại.
- Calendar gắn ngày startAt địa phương. Sắp tới: chưa endAt, chưa COMPLETED/CANCELLED; lịch sử: đã endAt hoặc COMPLETED/CANCELLED. Chỉ nhóm trình bày, không đổi status.
- Query từ đầu tháng địa phương đổi UTC tới đầu tháng sau trừ 1ms, vì backend dùng lte. Trả 100 rows báo có thể thiếu, cho thu hẹp khoảng; không suy total.
