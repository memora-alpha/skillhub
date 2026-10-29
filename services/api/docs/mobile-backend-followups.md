# Backend: lỗi lịch học, Credit và thứ tự danh sách

Mốc đối chiếu source: 2026-10-27T21:05:35+07:00, commit `eb479fff56864d86981a9834bd636c57143d5253`.

Phạm vi: kiểm tra xung đột khi đổi lịch, Credit penalty cho no-show và thứ tự/phân trang của Proposal, LearningPath, Sharing Skill, Conversation. Tỷ lệ phạt no-show chưa được xác định trong policy.

Trạng thái bên dưới phản ánh source tại mốc đối chiếu; chưa xác minh bằng HTTP, DB integration hoặc deployment.

## Tổng hợp trạng thái

| ID | Nội dung đã đề xuất | Kết quả kiểm tra source |
| --- | --- | --- |
| BE-01 | Tạo đề nghị đổi lịch bị báo trùng với chính Session của buổi giữ nguyên | **Chưa sửa** |
| BE-02 | Kiểm lại xung đột tại lần xác nhận đổi lịch cuối cùng | **Chưa sửa** |
| BE-03 | Phạt Credit theo phần trăm khi không dạy/no-show | **Chưa hoàn tất; có một phần cơ chế thủ công, còn thiếu policy** |
| BE-04 | Proposal mới nhất lên đầu, phân trang cùng thứ tự | **Chưa sửa** |
| BE-05 | Lộ trình mới tạo lên đầu, không bị bài cũ vừa sửa đẩy xuống | **Chưa sửa**; vẫn giới hạn 100, chưa có phân trang |
| BE-06 | Kỹ năng mới tạo lên đầu ổn định sau mở lại app | **Chưa sửa** |
| BE-07 | Hội thoại có hoạt động mới nhất nằm ở đầu toàn danh sách | **Chưa sửa ở BE**; mobile chỉ sắp xếp các hội thoại đã biết |

Không mục nào trong bảy mục trên có đủ bằng chứng để đóng hoàn toàn. BE-04..07 là thay đổi hành vi được đề xuất, phân biệt với hai lỗi logic BE-01..02.

## BE-01 — Tạo đề nghị đổi lịch báo trùng sai

- API: `POST /api/v1/sessions/:sessionId/reschedule-proposals`.
- Tái hiện: lịch đã áp dụng có ít nhất hai Session; đổi một buổi còn đủ điều kiện/cutoff sang giờ trống, giữ nguyên các buổi còn lại.
- Source: [candidateItems và otherSessions](../src/modules/scheduling/application/services/scheduling.service.ts#L690). `candidateItems` chứa toàn bộ lịch; `otherSessions` chỉ loại `sessionId` đang đổi. Query chỉ chọn giờ bắt đầu/kết thúc, không giữ identity để loại phép so sánh một buổi giữ nguyên với chính Session của nó. Vòng overlap sau đó ném `409 SCHEDULE_CONFLICT`.
- Mong đợi: so sánh có mapping ScheduleItem → Session và bỏ self-comparison; vẫn kiểm xung đột nội bộ lịch, Session khác cùng Path và Path khác của cả hai người. Không chỉ loại toàn bộ Session cùng Path vì có thể bỏ sót trùng thật giữa hai chiều.
- Kiểm lại khi sửa: lịch hai/nhiều buổi đổi một buổi sang giờ trống phải thành công; đổi sang giờ của buổi khác hoặc Session ngoài lịch phải bị chặn; hai khung giờ chỉ tiếp giáp không bị coi là overlap.

## BE-02 — Chưa kiểm lại xung đột khi xác nhận đổi lịch cuối

- API: `POST /api/v1/schedule-proposals/:scheduleId/confirm`.
- Tái hiện: đề nghị đổi sang giờ trống → một Session khác của teacher hoặc learner được tạo/đổi vào giờ đó → người còn lại xác nhận đề nghị cũ.
- Source: [confirmProposal](../src/modules/scheduling/application/services/scheduling.service.ts#L449), [điểm gọi applyReschedule](../src/modules/scheduling/application/services/scheduling.service.ts#L542), [applyReschedule](../src/modules/scheduling/application/services/scheduling.service.ts#L85). Nhánh apply kiểm mapping/history, trạng thái và cutoff, rồi cập nhật Session/history; chưa đọc lại lịch xung đột của hai người trước khi ghi.
- Mong đợi: trong transaction xác nhận cuối, kiểm toàn bộ lịch ứng viên với Session hiện tại của cả hai người, bỏ self-comparison đúng identity. Trùng phải trả `409 SCHEDULE_CONFLICT`; rollback xác nhận vừa ghi, giờ Session, appliedVersion, history và audit; lịch cũ vẫn hiệu lực.
- TransactionRunner mặc định [Serializable](../src/infrastructure/database/transaction-runner.ts#L39), nhưng isolation không thay cho truy vấn kiểm xung đột còn thiếu. Không kết luận thiếu isolation hoặc yêu cầu hạ isolation khi sửa.
- Kiểm lại khi sửa: xung đột phát sinh sau tạo đề nghị của từng người; xung đột tại lần confirm cuối; hai thao tác đồng thời; retry/conflict rollback không để ghi nhận áp dụng một phần. Giữ ca không trùng và kiểm cutoff hiện có.

## BE-03 — Credit penalty khi không dạy/no-show

Chưa có policy xác định tỷ lệ phạt no-show và khoản Credit làm cơ sở tính phạt.

### Đã có trong source

- [Report resolution](../src/modules/reports/application/services/reports.service.ts#L521) có thể áp vi phạm đã phán quyết, điều chỉnh Credit theo số tiền explicit và reversal với permission tương ứng. [DTO](../src/modules/reports/presentation/http/reports.dto.ts#L83) nhận `amount` có dấu; không phải tỷ lệ phạt no-show.
- [Reputation](../src/modules/reputation/application/services/reputation.service.ts#L176) có `NO_SHOW: -8` điểm uy tín. `applyNoShow` có hook tại dòng 205 nhưng tìm trong source hiện tại chỉ thấy khai báo; report resolve có thể gọi `applyViolation` với NO_SHOW. Giảm Reputation không chứng minh đã trừ Credit.
- [Lifecycle](../src/modules/learning-sessions/application/services/learning-sessions.service.ts#L405) và [sessionStatusAt](../src/modules/learning-sessions/domain/session.policy.ts#L40) đưa buổi hết giờ sang AWAITING_CONFIRMATION, không tự tính Credit penalty từ việc hết giờ.

### Phần chưa triển khai

- Chưa tìm thấy policy/config tỷ lệ phạt no-show/cancel và luồng tính khoản Credit bị phạt theo tỷ lệ gắn với buổi vi phạm.
- SRS hiện hành [V1.6](../../../docs/SRS_SkillHub_V1.6_VietLai_DongBoNghiepVu.docx), mục **18.20**, **OP-01**, **OP-13**, **CAN-002..004** để tỷ lệ penalty/refund ở trạng thái cần chốt; mọi penalty/refund/release phải có ledger + audit. [Credit policy G05](../specs/009-credit-payment/policies.md) cũng còn mở.
- **4% là phí settlement sau hoàn thành, không phải tỷ lệ phạt no-show.** Không áp 4% làm mặc định hoặc quyết toán Credit theo từng Session.

### Quyết định cần chốt trước implementation

1. Thế nào là no-show đã xác nhận; ai quyết định, dựa trên bằng chứng nào và xử lý sự cố kỹ thuật/khiếu nại ra sao.
2. Tỷ lệ; tính trên tổng Credit thỏa thuận hay phần phân bổ cho buổi; quy tắc làm tròn và phiên bản policy.
3. Người bị trừ/người nhận khoản bồi hoàn; dùng Available hay Held; xử lý không đủ tiền, hủy một buổi hoặc toàn thỏa thuận, ONE_WAY/TWO_WAY.
4. Với ONE_WAY, teacher không có Hold bắt buộc: không lấy Held learner làm tiền phạt của teacher nếu chưa có quyết định nghiệp vụ.

Tiêu chí sau khi chốt: thực thi ở BE với decision identity/idempotency, ledger và audit nguyên tử, đúng nguồn tiền và không thu hai lần khi retry; mobile chỉ hiển thị kết quả BE.

## BE-04..07 — Thứ tự danh sách

Thứ tự đề xuất: Proposal, Sharing Skill và LearningPath theo **createdAt giảm dần**; Conversation theo **thời điểm hoạt động/tin nhắn gần nhất giảm dần**. Chỉnh sửa không thay đổi thời điểm tạo.

| ID / API | Bằng chứng hiện tại | Cần thay đổi |
| --- | --- | --- |
| BE-04 — `GET /proposals` | [list](../src/modules/proposals/application/services/proposals.service.ts#L111): `id ASC`, cursor `id > cursor.id`. [DTO](../src/modules/proposals/presentation/http/proposals.dto.ts#L70) chỉ nhận sent/received | `createdAt DESC, id DESC`; cursor `(createdAt,id)` cùng thứ tự; giữ direction/status/learningRequestId và owner scope. `direction=all` là đề xuất bổ sung, không bắt buộc nếu mobile gộp hai luồng đúng phân trang |
| BE-05 — `GET /learning-paths/mine` | [listMine](../src/modules/learning-paths/application/services/learning-paths.service.ts#L239): `updatedAt DESC, id ASC`, `take:100`; [controller](../src/modules/learning-paths/presentation/http/learning-paths.controller.ts#L44) chưa nhận cursor | Sắp `createdAt DESC, id DESC` trước giới hạn. Bổ sung pagination nếu cần xem toàn bộ; công bố response/cursor contract cho mobile |
| BE-06 — `GET /me/skills` | [list](../src/modules/sharing-skills/infrastructure/persistence/sharing-skills.repository.ts#L147): `id ASC`, cursor theo id; [publicSharing/ownSharing](../src/modules/sharing-skills/infrastructure/persistence/sharing-skills.repository.ts#L25) chưa trả createdAt | `createdAt DESC, id DESC`, cursor tương ứng và trả createdAt. `GET /profiles/:id/skills` dùng cùng repository; áp dụng cùng thứ tự nếu yêu cầu đồng bộ public list được giữ |
| BE-07 — `GET /conversations` | [list](../src/modules/conversations/application/services/conversations.service.ts#L57): `id ASC`, cursor theo id; [view](../src/modules/conversations/domain/conversation-view.ts#L2) chỉ có createdAt, chưa có lastActivityAt/lastMessageAt | Có projection hoạt động mới nhất, fallback createdAt khi chưa có tin; trả timestamp và sắp giảm dần với ID làm tie-breaker, cursor nhất quán; cập nhật activity theo tin đã commit/publish qua cơ chế cross-store hiện có |

### Tác động mobile và tiêu chí kiểm lại

- Chỉ sort các trang đã tải ở mobile không đưa được mục mới còn nằm ở trang sau lên trang đầu. Không tải toàn bộ dữ liệu chỉ để che thứ tự BE.
- Proposal “Tất cả” hiện [nối received rồi sent](../../../apps/mobile/src/features/proposals/api/list-all-proposals.ts#L46). BE đổi order từng direction chưa đủ sửa tab này: cần BE hỗ trợ all hoặc mobile merge có buffer/cursor đúng hai luồng; sort riêng từng batch vẫn có thể sai toàn danh sách.
- Pagination mới phải kiểm nhiều trang, timestamp bằng nhau, cursor sai scope/filter/version, refresh có mục mới và mục thay đổi activity. Với Chat, chốt semantics mục chuyển vị trí giữa các lần tải, tránh bỏ sót/trùng khi activity thay đổi.
- Thay response mảng của Path thành page là thay contract: cập nhật docs/Swagger và consumer mobile (`api.mine`, list, lookup path theo conversation, kiểm giới hạn 100); không chỉ đổi BE rồi để client parse sai.
- Giữ quyền participant/owner, status filters và dữ liệu riêng tư. Response timestamp phải chuẩn UTC/ISO; không dùng ID UUID để suy ra thời điểm tạo.

## Những màn đã đúng hoặc không cùng quy tắc

- Yêu cầu của tôi/bảng tin: [repository](../src/modules/learning-requests/infrastructure/persistence/prisma-learning-request.repository.ts#L333) đã `createdAt DESC, id DESC`, cursor theo cùng cặp. Không ghi thành lỗi chưa sửa.
- Tab gợi ý phù hợp: cùng repository ưu tiên matchScore rồi createdAt/id; muốn đổi sang thuần mới nhất là thay quy tắc recommendation riêng.
- Lịch sử ví: [entrySequence DESC](../src/modules/credit/infrastructure/persistence/prisma-wallet.repository.ts#L65) đã đưa ledger mới lên trước.
- Buổi học/Calendar: thứ tự giờ học phục vụ lịch, không tự đổi sang ngày tạo chỉ vì quy tắc danh sách bài mới nhất.

## Bằng chứng và bước tiếp theo

- Đã đọc implementation scheduling, list services/repositories/views/DTOs, transaction runner, report resolution, reputation, lifecycle, SRS V1.6 và policy G05; đối chiếu các ca reschedule hiện có trong `test/learning-platform/phase2.test.mjs` và `test/learning-platform-audit.test.mjs`.
- Chưa có kết quả test runtime, repro HTTP, DB integration hoặc kiểm deployment cho các kết luận này. Các ca BE-01/02 là tiêu chí regression cần bổ sung.
- Ưu tiên đề nghị: BE-01/02 → thống nhất contract và sửa BE-04..07 cùng mobile → chốt policy BE-03 trước tính phạt tài chính. Chỉ đóng từng mục sau khi source, regression và bằng chứng runtime phù hợp được cập nhật.
