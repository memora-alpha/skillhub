# Checkpoint tích hợp Session

Đối chiếu source ngày 2026-10-14, HEAD `01ced645`, nhánh `feat/mobile-session`.
Đây là ghi nhận hiện trạng để lập plan; chưa gọi API thật hoặc nghiệm thu thiết bị.

## Mobile baseline trước implementation

- `src/features/calendar/screens/CalendarScreen.tsx` dùng `useSessionsPreview`.
- `src/features/sessions/context.tsx` dựng buổi từ Path preview và lưu thay đổi cục bộ; completion/đổi lịch chưa gọi backend.
- `src/features/sessions/screens.tsx` có danh sách theo Path, chi tiết, form đổi lịch và completion. Tái sử dụng các màn này, không coi local confirmation là nghiệp vụ thật.
- Routes chính: `/calendar`, `/learning-sessions/[id]`, `/learning-sessions/[id]/reschedule`; `/session/[id]` là chi tiết mẫu cũ. Xác nhận hoàn thành dùng modal ngay tại detail, không có route riêng.

Implementation checkpoint 2026-10-14: Calendar/list/detail/completion dùng API
qua SessionsProvider, shared HTTP/Auth/Query và allowlist schema. Legacy Session
render cùng detail thật, ID mẫu không request/fallback. Đổi lịch chỉ có draft và
submit disabled; preview providers/RoomScreen được giữ khi tách, gallery Session
ID mẫu bị vô hiệu hóa. Kết quả fixture/web và gaps còn mở ở [validation](validation.md).

## HTTP trong source backend

Các route có prefix `/api/v1`. Kiểm tra response thực trước khi tích hợp.

| Thao tác          | Contract hiện có                                                                                                                                                                                                                                   |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Danh sách         | `GET /sessions/mine?from=...&to=...`; trả mảng, tối đa 100, sắp `startAt`, rồi `id`. Có id/pathId/planId/teacherId/learnerId/startAt/endAt/status, hai confirmation status và role. Mặc định không lấy toàn lịch sử.                               |
| Chi tiết          | `GET /sessions/:sessionId`; participant-only, trả bản ghi Session, chưa có projection tên/avatar đối tác, tên kỹ năng hoặc đề xuất đổi lịch.                                                                                                       |
| Hoàn thành        | `POST /sessions/:sessionId/confirm-completion`; `{ note?: string }`, note tối đa 1000 ký tự. Kiểm tra endAt theo giờ DB, participant và dispute; trả `{ id, status }`, cần đọc lại confirmation từng bên. Không gọi endpoint settlement.           |
| Đề xuất đổi lịch  | `POST /sessions/:sessionId/reschedule-proposals`; `{ expectedVersion, startAt, endAt }`, thời gian có offset/Z; trả `{ id: scheduleProposalId, version, status: "NEEDS_REVISION" }`. Không tự xác nhận người gửi. Không có field reason trong DTO. |
| Xác nhận đổi lịch | `POST /schedule-proposals/:scheduleId/confirm`; `{ expectedVersion }`; trả id/version/bothConfirmed/status. Lịch mới áp dụng khi đủ hai bên và kiểm tra cutoff.                                                                                    |

Bằng chứng: `services/api/src/modules/learning-sessions/{learning-sessions.controller.ts,learning-sessions.service.ts,learning-sessions.dto.ts}` và `services/api/src/modules/scheduling/{scheduling.controller.ts,scheduling.service.ts,scheduling.dto.ts}`.

## Dependency và giới hạn cần giữ trong plan

- **GAP-01 — Đọc đổi lịch (chặn nghiệm thu US4):** chưa thấy route đọc schedule proposal/version/items/confirmation. Session detail không trả scheduleProposalId hoặc currentVersion. Không thể tự đặt expectedVersion = 1, lấy version từ preview, hoặc chỉ giữ POST response trong máy người gửi để giả lập đối phương xác nhận. Cần contract đọc được lịch đang áp dụng và đề xuất hiện hành bởi cả hai participant sau reload.
- **GAP-02 — Tính nhất quán đổi lịch:** source kiểm tra trùng lịch khi đề xuất, nhưng đường xác nhận cuối chưa thấy kiểm tra lại xung đột với các buổi khác; cần owner backend xác minh. Mobile không thể bảo đảm lịch không trùng bằng dữ liệu cục bộ.
- **GAP-03 — Projection và runtime:** danh sách/chi tiết chưa trả tên/avatar đối tác hoặc tên/nội dung plan. Tên/avatar có thể lấy từ public-profile API hiện có qua public export; thiếu thì hiển thị rõ chưa có dữ liệu. Detail trả raw Prisma Session có hai BigInt attendance fields; response helper chỉ bọc data, chưa thấy serializer ở main/app.module. Suy luận từ source: JSON serialization có thể lỗi, chưa gọi runtime để kết luận đã fail. Cần smoke detail trước nghiệm thu US2/US3; parser mobile không giải quyết được nếu server không trả JSON.
- **GAP-04 — Độ đầy đủ danh sách:** cap 100 chưa có pagination hoặc cờ truncation. Không tuyên bố tải toàn bộ lịch sử; plan phải ghi giới hạn nếu khoảng ngày có trên 100 buổi. Ranh giới UTC/query và hiển thị timezone cần kiểm chứng.
- Lỗi hiện có gồm `SESSION_ACCESS_DENIED`, `SESSION_NOT_ENDED`, `SESSION_BLOCKED_BY_DISPUTE`, `SESSION_CANNOT_BE_RESCHEDULED`, `STALE_SCHEDULE_VERSION`, `RESCHEDULE_CUTOFF_VIOLATION`, `RESCHEDULE_CUTOFF_OR_STATE_VIOLATION` và `SCHEDULE_CONFLICT`. Không gộp lỗi nghiệp vụ thành lỗi mất mạng.
- Không có command từ chối/rút đề xuất trong controller đã đọc; không thêm action đó hoặc bắt buộc lý do đổi lịch trong feature này.

US1–US3 có thể lập plan trước. US4 thuộc spec nhưng chỉ nghiệm thu thật sau khi GAP-01 được giải quyết và GAP-02 được xác minh bởi backend; task mobile không bao gồm sửa backend.

Runtime checkpoint 2026-10-14: Swagger local xác nhận các route POST đổi lịch
hiện có và vẫn chưa có route GET đề xuất/version/xác nhận. Authenticated smoke
teacher fixture: list trả 200/8 buổi; detail ID hợp lệ của participant trả 500
`Internal server error`. GAP-03 tiếp tục chặn nghiệm thu detail/completion;
nguyên nhân BigInt là suy luận source, chưa có log xác nhận. Evidence ở
[validation](validation.md); không sửa BE.

GAP-03 diagnostic checkpoint: đã tái hiện qua service build/Prisma thật. Đọc
detail thành công; serialize đúng wrapper response ném `Do not know how to
serialize a BigInt` do teacherAttendanceSeconds/learnerAttendanceSeconds.
Cần backend trả projection JSON-safe hoặc serialize hai field theo contract;
mobile không sửa được response lỗi trước khi đến client.

Fix checkpoint 2026-10-14 theo yêu cầu bổ sung "tạm chỉnh đi": đã cho phép sửa
riêng `LearningSessionsService.detail()` ở BE, chuyển hai attendance BigInt thành
decimal string sau authorization. Không đổi schema/data hay API đổi lịch.
Smoke HTTP sau fix: hai participant đều đọc detail 200, attendance fields là
string; Session không tồn tại trả 404. Phần JSON serialization của GAP-03 đã
được xử lý; projection tên/nội dung plan vẫn chưa có. GAP-01/GAP-02 giữ mở.
