# Session và đổi lịch

Đối chiếu working tree tại `be4738b9`, nhánh `feat/mobile-session`, ngày 2026-10-22. Đây là audit source, chưa xác minh API đang triển khai. [Work Phase 07](../work/phase-07-session-api/plan.md) sở hữu task; [status](../work/phase-07-session-api/status.md) sở hữu bằng chứng.

Theo yêu cầu người dùng, LiveKit được tích hợp ở nhánh khác. Contract này chỉ ghi ranh giới liên quan; không tiếp nhận token, SDK/media, quyền camera/mic, room UI hoặc reconnect vào Phase 07. Chưa có tên/ref nhánh đó để xác minh khả năng ghép nối.

## Nguồn

- Yêu cầu: [SRS 1.6](../../../../docs/SRS_SkillHub_V1.6_VietLai_DongBoNghiepVu.docx) §18.18–18.20, §18.23, §18.33, §18.38; CMP-001..006, CAN-001..004.
- Backend Session: [controller](../../../../services/api/src/modules/learning-sessions/presentation/http/learning-sessions.controller.ts), [service](../../../../services/api/src/modules/learning-sessions/application/services/learning-sessions.service.ts), [projection](../../../../services/api/src/modules/learning-sessions/presentation/http/learning-sessions.responses.ts).
- Backend lịch: [controller](../../../../services/api/src/modules/scheduling/presentation/http/scheduling.controller.ts), [DTO](../../../../services/api/src/modules/scheduling/presentation/http/scheduling.dto.ts), [service](../../../../services/api/src/modules/scheduling/application/services/scheduling.service.ts).
- Read thỏa thuận: [controller](../../../../services/api/src/modules/learning-paths/presentation/http/learning-paths.controller.ts), `LearningPathsService.detail()` trong [service](../../../../services/api/src/modules/learning-paths/application/services/learning-paths.service.ts).
- Mobile: [Sessions API](../../src/features/sessions/api/sessions-api.ts), [schema](../../src/features/sessions/types.ts), [runtime](../../src/features/sessions/runtime.tsx), [Path read schema](../../src/features/learning-paths/api/learning-paths-contract.ts).
- Lịch sử: [spec Session 006](../../specs/006-session/contracts.md), [validation](../../specs/006-session/validation.md). Không sửa checkpoint cũ thành bằng chứng mới.

## HTTP và quyền

Base `/api/v1`, Bearer qua shared HTTP/Auth runtime; adapter nhận `data` đã bóc envelope. Không dùng quy ước pagination chung để suy ra những endpoint hiện trả mảng cap 100.

| Method và endpoint                               | Contract trong source                                                                                                                                            | Mobile hiện tại                                                                              |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `GET /sessions/mine?from=...&to=...`             | Participant, timestamp có Z/offset; khi có `to`, lọc `startAt` trong khoảng đóng; sắp startAt/id; tối đa 100, không cursor/total/truncation flag                 | Calendar dùng mine theo tháng; danh sách toàn Path đã chuyển sang Path API                   |
| `GET /sessions/:sessionId`                       | Participant; id/pathId/planId/**planVersion/outlineSessionNo**, teacherId/learnerId, giờ/status/role, confirmation từng bên, **progress**, attendance projection | Đã nối detail và giữ planVersion/outlineSessionNo/progress; thiếu metadata không bịa context |
| `GET /learning-paths/:pathId`                    | A/B của Path; plans có version/outline, schedule hiện hành, sessions thực tế của Path đã khóa                                                                    | Session dùng public useLearningPath để đọc context, toàn bộ buổi và proposal đổi lịch        |
| `POST /sessions/:sessionId/confirm-completion`   | Body `{}` hoặc `{note}` tối đa 1000 ký tự; sau endAt, participant, state/dispute theo server; receipt `{id,status}`                                              | Đã nối modal/preflight/receipt/reconcile; refresh Path và mine đúng owner, không replay      |
| `POST /sessions/:sessionId/reschedule-proposals` | `{expectedVersion,startAt,endAt}`; trả `{id: scheduleProposalId,version,status:"NEEDS_REVISION"}`                                                                | Chưa nối; form và nút gửi đang unavailable                                                   |
| `POST /schedule-proposals/:scheduleId/confirm`   | `{expectedVersion}`; trả `{id,version,bothConfirmed,status}`                                                                                                     | Feature learning-paths có adapter cho lịch trước khóa; Session chưa nối đổi lịch sau khóa    |

Session detail trả attendance counters dạng decimal string, không còn raw BigInt gây lỗi JSON như checkpoint cũ. Không cần mở lại task sửa serializer. `attendanceStatus=UNAVAILABLE`: không suy ra vắng mặt từ số 0 hoặc lấy lastLeft-firstJoined tính thời lượng.

`progress` là `{agreement:{completed,total},plan:{completed,total}}`, do backend đếm Session thuộc plan version của thỏa thuận đã khóa. Không đếm từ Calendar cap 100, không cộng optimistic khi người dùng chạm xác nhận.

Schema mobile giữ metadata bổ sung là optional để tương thích projection list và server chưa trả field; giá trị có mặt phải qua validation. Không tự điền version/số buổi hoặc progress bằng 0 khi thiếu. Context thiếu/sai version không chặn đọc Session hoặc completion hợp lệ. Path reader cũng loại trùng Session.id/sessionNo, số buổi ngoài outline và khoảng giờ hiệu lực không hợp lệ.

## Đọc context và đề xuất đổi lịch

`GET /learning-paths/:pathId` trả:

- `id`, `participantAId`, `participantBId`, `currentVersion`, `lockedVersion`, trạng thái và terms.
- `plans[]`: `id`, `version`, teacher/learner, `skillId`, `learningGoal`, `sessionOutline[{sessionNo,content}]`.
- Mỗi plan có `schedule` nullable: `id`, `version`, `appliedVersion`, `status`, `participantAConfirmedAt`, `participantBConfirmedAt`, `items[{sessionNo,startAt,endAt}]`.
- `plans[].sessions[]`: `id`, `sessionNo`, startAt/endAt/status của Session thực tế. Đây là lịch đang có hiệu lực, khác items của proposal chưa áp dụng.

**Đính chính GAP-01 lịch sử:** nay đã có read surface qua Path, dù không có `GET /schedule-proposals/:id`. Có thể chuẩn bị tích hợp bằng endpoint thật này; chưa đủ bằng chứng để tuyên bố hai tài khoản/reload hoạt động trên deployment.

Mapping cần xác minh tại boundary: Session.pathId = Path.id; Session.planId/planVersion = plan.id/version; Session.outlineSessionNo = sessionNo của outline/item; `plans[].sessions` chứa đúng Session.id. Không lấy item đầu, không chỉ match giờ, không dùng version Path thay version schedule. A/B là participant của Path, không đồng nhất cố định với teacher/learner trong TWO_WAY.

`schedule.version` là current version đọc từ server; `appliedVersion` là bản đã áp dụng. Lịch cũ hiển thị từ Session, lịch đề xuất từ schedule items. Reload ở máy đối phương phải dựng được cùng proposal/version/confirmations từ GET; POST receipt trong RAM không thay read contract.

Mở đề xuất mới không tự confirm tác giả. Cả hai xác nhận **cùng version** trước startAt lịch cũ ít nhất 60 phút; đủ hai bên và backend áp dụng mới đổi giờ Session. Version/cutoff/state theo server. Không có API từ chối/rút proposal đã xác minh; không thêm action hoặc reason bắt buộc.

## Gate đổi lịch còn mở

| ID             | Source finding                                                                                                                                                                               | Điều kiện trước khi bật mutation thật                                                                                                                                                             |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SESSION-DEP-01 | `proposeReschedule()` kiểm trùng buổi khác. `confirmProposal()` → `applyReschedule()` kiểm cutoff/state/history nhưng chưa thấy truy vấn kiểm lại xung đột với Session khác tại confirm cuối | Backend owner cung cấp contract/evidence kiểm conflict nguyên tử ở confirm cuối, gồm conflict phát sinh sau proposal và giữa các Path. Mobile không dùng Calendar/list local thay kiểm tra server |
| SESSION-DEP-02 | Path detail cung cấp proposal/version/appliedVersion/items/xác nhận và Session hiệu lực trong source                                                                                         | Smoke hai participant trên bản API đích: trước đề xuất, sau đề xuất, sau một confirm, sau áp dụng và reload; mapping ONE_WAY/TWO_WAY phải đúng                                                    |
| SESSION-DEP-03 | Source hiện dùng config cutoff/duration; SRS chốt 60 phút và 60–180 phút                                                                                                                     | Xác minh cấu hình test/deployment đúng rule trước nghiệm thu; không tự chỉnh config/backend                                                                                                       |

Có thể làm schema/read/UI và fixture độc lập. Giữ gửi/xác nhận thật unavailable khi DEP-01/04 chưa có bằng chứng; không gọi tạm để chứng minh UI.

**SESSION-DEP-04 — false conflict ở bước đề xuất (rà lại 2026-10-22):** `proposeReschedule()` tạo `candidateItems` cho toàn bộ lịch, chỉ loại Session đang đổi khỏi `otherSessions`, rồi so tất cả candidate với tất cả other. Buổi giữ nguyên trong cùng lịch vẫn nằm ở cả hai phía, nên tự overlap và trả `SCHEDULE_CONFLICT` dù giờ mới của buổi mục tiêu không trùng. Đã chạy chính biểu thức conflict trích từ source với hai buổi tách biệt: chỉ buổi đổi trả false, thêm buổi giữ nguyên trả true. Đây là diagnostic source, chưa gọi API thật. Backend cần kiểm lịch hiệu lực cuối cùng với exclusion/mapping đúng cho toàn proposal, bảo toàn kiểm trùng nội bộ và với lịch khác; không chỉ bỏ qua toàn bộ conflict.

Gửi đổi lịch ở mobile vẫn khóa tại nút `disabled` trong `RescheduleDraft`; SessionsApi chưa có propose/confirm. `rescheduleUnavailableMessage()` chỉ giải thích trạng thái này, không gửi request. Helper dựng payload chưa có consumer đã được bỏ. Cần giải quyết DEP-01/04 và kiểm DEP-02/03 trước khi nối mutation.

Màn đổi lịch hiển thị lịch hiện tại và form trước, proposal hiện tại ở dưới; không có nút tải lại đề nghị. `KeyboardFormScrollView` dùng pull refresh chung để refetch cả Session và Path đang active, không replay mutation và không reset draft cùng Session.id.

Card chỉ hiển thị đề nghị đang chờ khi giờ của chính buổi học thay đổi so với lịch hiệu lực và schedule có version mới chưa áp dụng. Buổi giữ nguyên trong proposal đổi buổi khác không hiện trạng thái chờ; proposal CANCELLED/EXPIRED cũng không hiện chờ xác nhận. Cùng appliedVersion nhưng giờ không khớp Session thì không dùng snapshot đó.

Phase 07 đã sửa availability cho `CONFIRMED`/`READY` và cutoff 60 phút. Footer detail không còn mở đổi lịch cho ONGOING hoặc buổi đã qua cutoff; màn đổi lịch đọc proposal/version/A-B từ Path, giữ submit unavailable. Dùng đồng hồ thiết bị chỉ để hướng dẫn, không bảo đảm eligibility; backend vẫn quyết định cuối.

## Completion, cache và recovery

- Giữ modal ngay tại detail; không khôi phục route completion riêng. API complete đã có, task mới chỉ bổ sung regression/đồng bộ consumer.
- Một bên confirm không làm COMPLETED; rời phòng không confirm. Backend không đòi counter attendance >0 để client cho phép xác nhận.
- Mutation giữ khóa gửi đồng bộ, `retry:false`, `replayAfterRenewal:false`; không tự thêm Idempotency-Key chưa được endpoint hỗ trợ.
- Timeout/5xx/lost response: giữ draft/receipt nếu có, GET đối chiếu trước hành động gửi lại. Proposal không có server idempotency: không tự tạo version mới vì mất POST response; read không đủ chứng minh kết quả thì giữ trạng thái chưa rõ và chặn gửi lặp.
- Keys và late results theo owner/generation. 403/404 ẩn/xóa private projection; stale cache cùng account có cảnh báo, mutation bị khóa đến khi read thành công. Context Path lỗi không làm biến mất detail Session hợp lệ; riêng action cần Path/version phải khóa.
- Sau complete/apply-reschedule, đọc lại detail/list và Path liên quan qua public boundary của learning-paths. Không tự đặt progress, Path COMPLETED, settledAt hoặc số dư. Không import private feature modules.
- Backend có settlement command và worker; Session UI không gọi settlement theo buổi. Kết quả cuối thỏa thuận/Wallet/ledger thuộc work tương ứng.

## Lỗi cần giữ đúng nghĩa

`SESSION_ACCESS_DENIED`, `SESSION_NOT_FOUND`, `SESSION_NOT_ENDED`, `SESSION_CANNOT_BE_COMPLETED`, `SESSION_BLOCKED_BY_DISPUTE`, `SESSION_CANNOT_BE_RESCHEDULED`, `STALE_SCHEDULE_VERSION`, `APPLIED_SCHEDULE_VERSION_MISMATCH`, `SESSION_SCHEDULE_HISTORY_MISSING`, `RESCHEDULE_CUTOFF_VIOLATION`, `RESCHEDULE_CUTOFF_OR_STATE_VIOLATION`, `SCHEDULE_CONFLICT`, `SCHEDULE_ALREADY_LOCKED`, `STALE_LEARNING_PATH_VERSION`.

Đọc lại khi stale/conflict; không tự nâng version rồi gửi tiếp. Không biến lỗi nghiệp vụ thành mất mạng; text UI đi qua safe mapping của app.

## Ranh giới LiveKit và Report

- Backend Session hiện có `join` metadata và endpoint token. Phần nối chúng vào mobile thuộc **nhánh LiveKit khác**; Phase 07 không đổi route `room.tsx`, SDK/dependencies/app config hoặc tự đặt join window. RoomScreen chỉ chuyển import sang provider chỉ đọc trong `preview/context.tsx`. Khi ghép nhánh, cần đối chiếu import này cùng schema detail, CTA và cache/session cleanup để giữ cả hai thay đổi.
- [Backend Report controller](../../../../services/api/src/modules/reports/presentation/http/reports.controller.ts) đã có create theo Session, mine, upload/status evidence. [Mobile reports](../../src/features/reports/screens.tsx) vẫn dùng preview. Không nối Session thật sang editor local để báo thành công giả.
- Work Phase 08 cần tiếp nhận toàn luồng report riêng: POST body reasonCode/description/evidenceFileIds, quyền/scan/recovery, list/detail owner. Hiện chưa thấy owner GET detail theo report ID trong controller; không đoán endpoint.
- Source report dùng 48 giờ và có thể chặn settlement/đổi Path sang DISPUTED; SRS §18.20/18.38 vẫn để dispute window cần chốt. Không hard-code 48 giờ thành policy sản phẩm đã duyệt, không tự đổi Session sang DISPUTED ở client.

SRS SES-002 và source renewal ONGOING/AWAITING_CONFIRMATION có khác biệt cần nhánh LiveKit giữ trong hồ sơ riêng. Cancel/no-show, completion timeout/auto-confirm, production dispute policy chưa được phase này quyết định.
