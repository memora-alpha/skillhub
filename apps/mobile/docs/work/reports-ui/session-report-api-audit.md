# Đối chiếu API Session và Report với mobile

Rà source working tree `fix/mobile-session-ui` lúc **2026-11-11T14:30:54+07:00**. Chỉ kiểm tra và ghi nhận; không sửa code BE/mobile hoặc gọi API thật. “Đã nối” nghĩa là có adapter và consumer trong source, không phải xác nhận deployment/native đã hoạt động.

## Hoàn thiện mobile theo BE — 2026-11-11T21:59:24+07:00

Người dùng đã yêu cầu sửa cả bốn nhóm còn thiếu từ audit bên dưới. Hiện đã hoàn thiện phía mobile:

- Report hiện hạn/lý do khóa ngay ngoài Session, kiểm tra BE trước form và trước gửi/sau scan; cập nhật ở deadline, giữ draft và không POST khi không được phép. Policy/read chưa kiểm tra được thì có thử lại; không tự cho gửi và không hiển thị lỗi thiếu metadata kỹ thuật.
- Notification xác nhận lịch mở đúng màn lịch thỏa thuận.
- Confirm/finalize không tự gửi thêm TEXT Chat; BE phát SYSTEM. Đọc các thẻ lịch sử/share nội dung khác được giữ.
- Path schema nhận lastActivityAt; cursor cũ bị từ chối khi tải thêm thì reset toàn bộ chain của đúng owner/session rồi đọc trang đầu. Thứ tự BE được giữ nguyên.

63 tests và 13 nhóm browser fixture PASS, cùng lint/types/structure/web export/diff check; chi tiết và giới hạn tại [status](status.md). Không sửa BE hoặc kiểm tra API triển khai. Các cột “Mobile hiện tại” và “Phần còn cần làm” trong bảng audit 21:22 bên dưới mô tả trạng thái trước lần sửa này.

## Rà toàn bộ phần BE bổ sung mới — 2026-11-11T21:22:59+07:00

Đã `git fetch origin`, xác nhận `origin/dev` ở `78f8944b`, không có commit dev mới hơn chưa nằm trong HEAD. Phạm vi so sánh với mốc trước cập nhật `90279b28` có ba commit implementation BE: `de18bdf3` (schedule system messages), `53d7ecb9` (Path activity ordering), `1c706f9d` (Session/Report contracts). Đối chiếu cả source mobile đang có thay đổi chưa commit của lần đồng bộ trước. Lần rà này chỉ kiểm tra và cập nhật tài liệu, không sửa code app/BE, không gửi dữ liệu thật.

| BE đã bổ sung/sửa                                                                                                                                                                              | Mobile hiện tại                                                                                                                                              | Phần còn cần làm                                                                                                                                                                        |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /sessions/mine` và `/sessions/:id`: `reporting.canReport`, `blockedReason`, `reportBy`, `evaluatedAt`; thêm `deadlines.reportBy`                                                          | Schema đã nhận, SessionLimitsPanel và ReportEditor chưa dùng để kiểm tra trước                                                                               | Dùng snapshot BE để khóa/giải thích CTA bên ngoài và kiểm tra lại khi vào form; POST vẫn kiểm tra cuối. Chưa triển khai precheck UI                                                     |
| Eligibility dùng cùng policy với POST: participant, không CANCELLED, không có báo cáo mở của chính caller, thời gian DB trước hạn; thiếu policy trả null deadline và REPORT_POLICY_UNAVAILABLE | Đã có thông báo lỗi POST cho hết hạn/trùng/hủy; chưa có UI trạng thái theo snapshot                                                                          | Không dùng hạn giải trình thay hạn báo cáo hoặc tự cộng cố định số giờ; không coi policy thiếu là được gửi                                                                              |
| Participant case list/summary: hasHandler, ownEvidenceCount, canSendMessage/messageBlockedReason, canAttachEvidence/evidenceBlockedReason                                                      | Đã nhận và dùng ở thread có Path, quyền message/evidence riêng                                                                                               | Không thiếu endpoint; case không có Path vẫn dùng fallback đã ghi ở status, POST quyết định cuối                                                                                        |
| Mine/detail có evidenceCount và metadata đúng party cho cả file mới/cũ; private evidence và download cũng nhận legacy của reporter                                                             | Đã đồng bộ count và nullable storedFileId; download theo evidence ID                                                                                         | Không dùng lại workaround đếm file cũ; không lấy metadata đối tác                                                                                                                       |
| Report message/evidence notifications có relatedPathId/pathId, relatedSessionId/sessionId, relatedOrderId, messageId/evidenceId đã kiểm receipt                                                | Routing đã dùng canonical relatedPathId; private party lấy từ runtime                                                                                        | Những ID khác không buộc phải có màn mới khi case route đã đúng                                                                                                                         |
| Event notification mới `learning-path.schedule.confirmed`, gửi cho người còn lại; payload có path/conversation/plan/schedule/version/message refs                                              | Nhận/hiện được thông báo bằng schema type string và copy BE; notificationTarget chưa có nhánh này                                                            | Bổ sung routing tới lịch của đúng thỏa thuận. Hiện bấm thông báo chưa đọc chỉ đánh dấu đọc, chưa mở lịch                                                                                |
| BE tự tạo SYSTEM Chat khi một bên xác nhận lịch; phân biệt chờ, hai bên xác nhận, đổi lịch đã áp dụng                                                                                          | Chat đã parse/render SYSTEM dưới dạng text; ApiScheduleScreens vẫn tự share TEXT confirmation sau thành công                                                 | Bỏ auto TEXT confirmation tương ứng, giữ đọc thẻ lịch sử; tránh hai cập nhật cho cùng thao tác                                                                                          |
| BE tự tạo SYSTEM Chat khi finalize thành công, gồm số buổi học; giữ notification locked, không phát trùng generic delivered                                                                    | Chat đã đọc SYSTEM; ApiHoldScreen vẫn tự share scheduledMessage sau finalize                                                                                 | Bỏ auto TEXT finalization tương ứng; không xóa luồng share nội dung khác chỉ vì dùng chung helper                                                                                       |
| Path mine đổi sang lastActivityAt DESC/id DESC, thêm lastActivityAt và cursor activity-v1; cursor createdAt cũ trả 400 INVALID_LEARNING_PATH_CURSOR                                            | UI giữ nguyên thứ tự BE và filter không sort lại; schema bỏ lastActivityAt, chưa có recovery riêng cho cursor cũ. Footer thử tải thêm vẫn dùng fetchNextPage | Nhận lastActivityAt nếu consumer cần metadata; reset/reload từ trang đầu khi gặp cursor cũ, tránh lặp lại cursor bị từ chối. Kéo refresh thủ công hiện có, không kết luận sort đang sai |

Nguồn BE ngoài contract Session/Report: [Path list](../../../../../services/api/docs/learning-path-list.md), [Schedule communications](../../../../../services/api/specs/008-connections/schedule-communication-plan.md). Source mobile kiểm tra: SessionLimitsPanel/ReportEditorScreen; notificationTarget/NotificationRow/NotificationsScreen; ApiScheduleScreens/ApiHoldScreen/useConfirmedFormShare; messageSchema/ApiMessageBubble; pathSummarySchema/learning-paths-api/ApiPathsContent/useConnectionList.

### Điều cần phân biệt

- Không có endpoint public mới trong ba commit trên: chủ yếu thêm trường trên GET hiện có, đổi cursor và thêm event/system messages. Kiểm tra hạn trước form không cần BE viết API mới.
- BE không thêm mốc sớm nhất được báo cáo: không có rule bắt buộc đợi buổi học kết thúc. Snapshot vẫn có thể cho phép báo cáo trước buổi học nếu các điều kiện hiện tại đạt. Không tự đổi thành rule “chỉ sau buổi học” ở mobile.
- API upload/status/scan bằng chứng đã tồn tại trước, không phải API mới của lần cập nhật này. Mobile tự chờ READY khi gửi như đã làm; ba commit này không đổi thành việc BE tự nhận ảnh và tạo báo cáo trong cùng một request.
- Không có thay đổi mới về join window LiveKit, học bù khi hai bên cùng vắng hoặc cutoff đổi lịch trong các diff này. Các phần đó giữ rule BE đã có, không suy ra chính sách mới từ trường reportBy.
- Contract Path activity cần migration `20261111000000_learning_path_activity` khi triển khai BE. Session/Report và schedule system messages không cần migration mới; worker/API cần chạy bản mới để đăng ký events. Đây là điều kiện rollout, chưa phải bằng chứng môi trường thật đã triển khai.

Kiểm chứng của lần rà: đọc diff/source của ba commit sau fetch; diagnostic không gọi API thật tái hiện notification xác nhận lịch chưa có route, schema bỏ lastActivityAt và adapter không tự restart khi cursor cũ bị từ chối. Evidence ignored: `.expo/check-be-additions.ts`. Không chạy lại toàn bộ test/lint/build cho lần audit chỉ sửa tài liệu; các kiểm tra implementation lần trước ghi riêng trong status. Không xác nhận API deployed, storage/worker/provider hoặc native từ source/diagnostic.

Các đoạn dưới đây giữ lịch sử audit/implementation trước mốc rà này.

Ở mốc audit ban đầu, người dùng chọn kiểm tra điều kiện khi POST. Yêu cầu mới đã thay lựa chọn này bằng precheck theo dữ liệu BE; xem cập nhật đầu tài liệu.

**Cập nhật implementation 2026-11-11T14:59:12+07:00:** người dùng yêu cầu sửa rồi giới hạn **chỉ mobile, không sửa BE**. AUD-01/02 đã nối phía FE; AUD-03 có routing và fallback thread read-only khi thiếu context; AUD-04 dùng handlerId của owner và xử lý rejection khi summary thiếu dữ liệu; AUD-05 FE đã theo window BE đã chốt; AUD-06 FE đọc count từ private evidence API, filter BE vẫn chưa sửa. AUD-07 giữ tùy chọn. Chi tiết và kiểm chứng tại [status](status.md). Các mục dưới giữ mô tả audit ban đầu, không phải tuyên bố toàn bộ lỗi BE đã được sửa.

## Các luồng người dùng đã nối

**Đối chiếu BE mới 2026-11-11T20:30:01+07:00:** `1c706f9d` đã có trong nhánh hiện tại. [Contract BE](../../../../../services/api/specs/014-trust-report-support/session-report-contracts.md) xác nhận capabilities riêng của viewer, count/metadata legacy + current và context notification. Mobile đã dùng `canSendMessage`/`canAttachEvidence`, lý do khóa và `ownEvidenceCount` ở participant summary; mine/detail đọc `evidenceCount`, evidence giữ nullable `storedFileId`. Notification ưu tiên canonical `relatedPathId`, vẫn lấy party từ runtime hiện tại. AUD-03/04/06 không còn cần workaround cũ khi BE trả contract mới. Session parser giữ `reporting`/`deadlines.reportBy`; không tự tính hạn, không phục hồi precheck UI theo lựa chọn trước của người dùng. AUD-05 đã theo server join window từ thay đổi mobile trước; BE lần này không đổi window. Đây là xác minh source và fixture, chưa xác nhận API deployment. Các phát hiện bên dưới là audit lịch sử, không phải danh sách lỗi BE hiện còn.

Endpoint bên dưới có prefix `/api/v1`. `:sid` là Session, `:pid` là LearningPath, `:cid` là ReportCase, `:partyId` là chính người dùng đang mở trao đổi riêng.

| API BE                                                                         | Mobile consumer                                                            | Kết quả source                                                                            |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `GET /sessions/mine`                                                           | `sessions-api.ts#list` → `useSessionList`, Calendar/Path sessions/busy-day | Đã nối, đọc cursor qua `readCursorPages`                                                  |
| `GET /sessions/:sid`                                                           | `sessions-api.ts#detail` → detail/room/reschedule/action preflight         | Đã nối; nhận attendance, deadlines, allowedActions, quota, progress                       |
| `POST /sessions/:sid/livekit-token`                                            | `sessions-api.ts#liveKitToken` → `use-room-connection.native.ts`           | Đã nối cho native build; web/Expo Go không phải môi trường nghiệm thu cuộc gọi            |
| `POST /sessions/:sid/confirm-completion`                                       | `completion-action.ts` → `useSessionAction` → detail                       | Đã nối, xác nhận hai bên riêng                                                            |
| `POST /sessions/:sid/absence-excuse`                                           | `SessionAttendancePanel` → `submitExcuse`                                  | Đã nối, theo allowedActions/hạn                                                           |
| `POST /sessions/:sid/absence-excuse/decision`                                  | `SessionAttendancePanel` → `decideExcuse`                                  | Đã nối chấp nhận/từ chối                                                                  |
| `POST /sessions/:sid/reschedule-proposals`                                     | `reschedule-api.ts` → action/hook → `RescheduleScreen`                     | Đã nối đổi lịch và MAKEUP_REQUIRED                                                        |
| `POST /schedule-proposals/:id/confirm`                                         | `reschedule-api.ts#confirmReschedule` → proposal panel                     | Đã nối xác nhận cùng version                                                              |
| `POST /learning-plans/:id/schedule-proposals`, `PATCH /schedule-proposals/:id` | `learning-paths-api.ts` → luồng lập/sửa lịch ban đầu                       | Đã nối; API revise chỉ cho trước khi Path khóa                                            |
| `GET/POST /sessions/:sid/cancellation-requests`                                | `post-learning-api.ts` → `LearningChangePanel`                             | Đã nối đọc/tạo; có expectedStartAt và Idempotency-Key                                     |
| `POST /sessions/:sid/cancellation-requests/:id/response`, `.../withdraw`       | `post-learning-api.ts#respond` → `LearningChangePanel`                     | Đã nối chấp nhận/từ chối/rút                                                              |
| `GET /learning-paths/:pid/settlement-status`                                   | `path-changes-api.ts` → `PathSettlementPanel`                              | Đã nối                                                                                    |
| `POST /sessions/paths/:pid/settlement-consent`                                 | `path-changes-api.ts#approveSettlement` → `SettlementConsentForm`          | Đã nối đồng ý quyết toán sớm                                                              |
| `POST /reports/sessions/:sid`                                                  | `reports-api.ts#submit` → `ReportEditorScreen`                             | Đã nối, kiểm tra điều kiện khi gửi theo quyết định hiện tại                               |
| `POST /materials/:id/reports`                                                  | `reports-api.ts#submit` nhánh MATERIAL → editor                            | Đã nối đúng body không có evidenceFileIds                                                 |
| `GET /reports/mine`, `GET /reports/mine/:cid`                                  | `reports-api.ts` → ReportsScreen/owner detail                              | Đã nối và kiểm owner                                                                      |
| `POST /reports/evidence-files`, `GET /reports/evidence-files/:id`              | `ServerFilePicker` dùng upload/status                                      | Đã nối upload, SCANNING/READY                                                             |
| `GET/POST /reports/support/cases/:cid/parties/:partyId/messages`               | `PrivateCaseThread`                                                        | Đã nối cho báo cáo của người gửi; còn thiếu đường mở cho một số bên liên quan, xem AUD-02 |
| `GET/POST /reports/support/cases/:cid/parties/:partyId/evidence`               | `PrivateCaseThread`                                                        | Đã nối đọc/bổ sung                                                                        |
| `GET /reports/support/cases/:cid/parties/:partyId/evidence/:id/download`       | `PrivateCaseThread` → signed URL → Linking                                 | Đã nối tải bằng chứng riêng                                                               |
| `GET /learning-paths/:pid/cases`, `.../cases/:cid/summary`, `.../overview`     | `path-overview-api.ts`, hooks → list/summary/overview                      | Đã nối summary các case đối tác/hệ thống; chưa nối từ summary sang thread                 |

## Phát hiện cần xử lý

### AUD-01 — FE thiếu lý do báo cáo vắng/trễ

- BE `reports.dto.ts#REPORT_REASON_CODES` có `NO_SHOW_LATE`; `reportReasons` của mobile thiếu giá trị này, dù `constants/ui-copy.ts` đã có nhãn.
- Người dùng không thể chọn đúng lý do vắng/trễ. API tạo báo cáo đã có, **không cần BE tạo endpoint mới**.
- FE bổ sung enum/lựa chọn dành cho Session; tránh áp dụng lý do điểm danh cho báo cáo Material một cách máy móc.

### AUD-02 — Thread có API/component nhưng thiếu lối mở từ vụ việc đối tác/hệ thống

- `ReportDetailScreen` có nhánh `support=1&pathId=...` để dùng thread riêng của bên liên quan.
- `PathCaseSummaryScreen` và `ParticipantCaseCard` không tạo route này; trạng thái NEED_MORE_INFO chỉ dẫn `/help`. Không tìm thấy consumer tạo `support=1` trong source mobile.
- `GET /reports/mine/:cid` chỉ dành cho reporter; không dùng nó thay summary của đối tác/system case.
- FE nối từ tóm tắt vụ việc tới thread đã có, với caseId/pathId và partyId của chính viewer. BE đã có API/quyền kiểm tra bên liên quan; không cần mở quyền đọc nội dung riêng của đối tác.

### AUD-03 — Thông báo Report chưa dẫn tới màn tương ứng

- BE phát `report.session.opened`, `report.case.updated`, `report.case.message`, `report.case.evidence`.
- `notificationTarget()` chưa xử lý bốn type này. Diagnostic chạy helper thật với payload UUID hợp lệ: cả bốn trả `undefined`; người dùng đọc được thông báo nhưng không có target mở vụ việc.
- FE nối routing. Với case không phải mình tạo, cần dùng summary/thread của bên liên quan thay owner GET.
- BE nên bổ sung context tối thiểu vào notification tin nhắn: hiện payload chỉ có `{caseId,partyId}`, thiếu pathId/target context để mobile phân biệt owner report với partner/system case. Có thể bổ sung pathId/target phù hợp, hoặc cung cấp read-only context theo caseId cho viewer. Phải giữ riêng thread của từng party; không trả nội dung đối tác.

### AUD-04 — Gating gửi phản hồi khác BE

- Mobile `canWriteCase()` cho OPEN/UNDER_REVIEW/NEED_MORE_INFO và dùng một cờ cho cả message/evidence.
- BE `CaseMessagesService.send()` còn bắt buộc `handlerId`; case mới OPEN chưa có người nhận trả `CASE_HANDLER_REQUIRED` sau khi người dùng soạn. Evidence attach không yêu cầu handler nên không nên khóa chung hai hành động.
- Với báo cáo của mình: BE mine/detail hiện trả raw case có `handlerId`, nhưng schema mobile bỏ field; FE có thể đọc field để xử lý ngay, không nhất thiết cần API mới.
- Với summary của bên liên quan/system case: projection chỉ có id/path/session/reason/status/block/timestamps, chưa có handler/capability. Đề nghị BE trả các cờ viewer-specific `canSendMessage`, `canAttachEvidence`, lý do bị chặn; không cần lộ danh tính handler nếu không phục vụ người dùng.

### AUD-05 — Thời điểm đóng phòng giữa FE/BE chưa đồng nhất

- BE `sessionJoinWindow()` đóng theo `endAt + lateMinutes`, và `sessionJoinAccess()` nhận cả AWAITING_CONFIRMATION. Policy mặc định trong catalog là 10 phút sau endAt.
- FE `sessionJoinReason()` chặn ngay `now >= endAt`; `RoomScreen` cũng dừng attempt và không giữ cuộc gọi sau endAt.
- Diagnostic dùng chính helper BE/FE: lúc 5 phút sau endAt với lateMinutes=10, BE `canJoin=true`, FE trả `SESSION_ENDED`.
- Đây là **lệch policy cần chốt**, không phải thiếu token endpoint. Nếu sản phẩm muốn đóng đúng endAt thì BE cần cùng rule; nếu giữ grace window thì FE theo closesAt/status được BE cho phép. Chưa tự quyết định hoặc thay đổi hành vi này.

### AUD-06 — Metadata bằng chứng mới bị lọc khỏi owner mine/detail

- `createSessionReport()` lưu evidence với `partyId=actor.userId`, `storedFileId=fileId`.
- `evidenceSummary` dùng cho listMine/mineDetail lại có `where: {storedFileId: null}`. Vì vậy file mới có storedFileId không nằm trong `reportEvidenceCaseIdRecords` của owner response.
- Mobile đếm tệp ban đầu bằng độ dài mảng này; phần tóm tắt có thể không hiện số tệp dù đã gửi. **Không kết luận mất file:** `PrivateCaseThread` đọc endpoint evidence riêng, không có filter này, nên vẫn có đường xem/tải.
- BE nên trả count/metadata **của đúng viewer/party** cho các file mới (ví dụ evidenceCount); không bỏ filter đơn giản rồi làm lộ evidence của đối tác. FE dùng field đã thống nhất thay cách đếm metadata legacy.

### AUD-07 — Hạn/eligibility Report chưa có cho mọi buổi, hiện là cải tiến tùy chọn

- `attendance-view.ts` chỉ trả `excuseOrReportBy` cho outcome vắng; createSessionReport luôn kiểm tra current outcome finalizesAt hoặc attendance policy.
- Nếu sau này cần precheck, BE trả hạn/eligibility theo cùng rule với POST (canReport, reasonCode, hạn, active case của viewer, thời gian máy chủ). Không dùng confirmBy/makeupBy/hạn quyết toán Path hoặc hard-code 48h ở FE.
- Theo lựa chọn mới của người dùng, **chưa cần bổ sung cho luồng hiện tại**; chỉ báo lỗi thật sau gửi và giữ draft. Không khôi phục banner/precheck trong audit này.

## API có nhưng không cần đưa vào app người dùng

- `POST /sessions/paths/:pid/settlement` chưa có consumer mobile. Hiện app theo dõi settlement-status và consent; worker BE `settleCompletedPaths()` xử lý tự động. Không coi thiếu nút gọi quyết toán thủ công là lỗi tích hợp.
- `/reports/staff/queue`, `/reports/staff/:cid`, `/reports/staff/:cid/:action`, `/reports/staff/evidence/:id/download` và support queue/incidents/severity là API moderation của STAFF/ADMIN; không phải thiếu trong app USER hiện tại.
- `POST /livekit/webhook` là provider → BE, mobile không gọi trực tiếp.
- Không thấy API GET riêng của schedule-proposal, nhưng mobile đọc schedule/version/items từ LearningPath detail; đây là read surface đang dùng, không kết luận thiếu API chỉ vì không có GET theo scheduleId.

## Tài liệu cũ và giới hạn kiểm chứng

- Một số phần cũ của `docs/contracts/sessions.md`/Phase07 vẫn ghi đổi lịch unavailable, Report preview hoặc conflict đổi lịch chưa xử lý. Source hiện đã nối propose/confirm và Reports API. SchedulingService đã gọi assertNoSessionConflicts cả lúc propose và apply sau hai xác nhận, đồng thời loại các Session thuộc snapshot hiện tại để tránh tự trùng. Không dùng các blocker cũ làm kết luận hiện tại; việc xác minh nguyên tử/triển khai vẫn cần integration test thật.
- Các phát hiện trên là source audit, không phải kết quả chạy server, migration, LiveKit hay hai tài khoản thật. Không thay code để “sửa luôn” các phát hiện trong yêu cầu kiểm tra này.
- Diagnostic ignored: `apps/mobile/.expo/session-report-api-audit.ts` và `session-report-api-audit-result.json`; chạy bằng `pnpm --filter mobile exec tsx .expo/session-report-api-audit.ts`. Không tạo/gửi báo cáo hay tin nhắn thật.

## Đường source chính

- BE: `learning-sessions/presentation/http/learning-sessions.controller.ts`, `session-changes.controller.ts`; `scheduling/presentation/http/scheduling.controller.ts`; `reports/presentation/http/reports.controller.ts`, `report-support.controller.ts`, `reports.dto.ts`; `learning-paths/presentation/http/path-overview.controller.ts`.
- BE behavior: `reports/application/services/{reports,case-messages,report-support}.service.ts`, `reports/application/services/participant-cases.reader.ts`, `learning-sessions/domain/{attendance-view,session.policy}.ts`, `notifications/infrastructure/events/{case-message,learning-path}-notification.handler.ts`.
- Mobile: `sessions/api/{sessions-api,reschedule-api}.ts`, `sessions/components/session-attendance-panel.tsx`, `sessions/screens/{room,reschedule}-screen.tsx`; `learning-paths/api/{post-learning,path-changes,path-overview}-api.ts`; `reports/api/reports-api.ts`, `reports/components/private-case-thread.tsx`, `reports/screens/report-read-screens.tsx`; `learning-paths/screens/path-case-summary-screen.tsx`, `notifications/utils/notification-target.ts`.
