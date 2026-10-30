# AI hỗ trợ soạn nội dung học và kiểm duyệt

Ngày: 2026-10-23. Trạng thái: bản thiết kế để triển khai tiếp; chưa triển khai.
Phạm vi: backend `services/api`. Kế hoạch: [plan.md](plan.md).

## Mục tiêu và quyết định của người dùng

Lập kế hoạch cho ba khả năng: AI soạn Learning Request, AI tạo nội dung
LearningPlan và AI kiểm duyệt nội dung. Người dùng đã chọn kiểm duyệt cả
Learning Request, mô tả Sharing Skill, chat và review; AI tư vấn cho Staff,
giữ luồng từ khóa và quyết định thủ công hiện tại của Learning Request.

Hai chức năng soạn nội dung chỉ tạo bản nháp riêng tư. Người dùng xem/sửa rồi
gửi qua API nghiệp vụ hiện có. AI không tạo hoặc xác nhận thỏa thuận, lịch,
Session, Hold/settlement, badge, rating hay điểm uy tín.

Giới hạn đợt đầu do thiết kế đề xuất: chat được phân tích khi participant
báo cáo các tin cụ thể. Quét toàn bộ chat nền, phân tích attachment và tự động
ẩn/xóa nội dung không thuộc đợt này. Đây không phải quyết định đã được người
dùng phê duyệt về quyền truy cập toàn bộ chat.

## Nguồn yêu cầu và hiện trạng đã kiểm tra

- SRS hiện hành: [SRS V1.6](../../../../docs/SRS_SkillHub_V1.6_VietLai_DongBoNghiepVu.docx),
  FR-LR-02/03 và quy định tạo/sửa/xác nhận LearningPlan theo từng chiều.
  Các tính năng AI là phần mở rộng được yêu cầu trong chat, không ghi là
  chức năng đã có trong SRS hoặc production.
- [Request text policy](../../src/modules/learning-requests/domain/request-text.policy.ts):
  title 10–120, description 20–3000, learningGoal 10–1000; skill/tag ACTIVE;
  nội dung plain text; tag tối đa 10. Preference/Credit/offerings đã có owner rules.
- [Publish](../../src/modules/learning-requests/application/use-cases/publish-learning-request.use-case.ts)
  và [moderation policy](../../src/modules/learning-requests/domain/moderation.policy.ts):
  word/pattern filter phiên bản hóa, flagged vào PENDING_MODERATION; thiếu hoặc
  sai cấu hình filter không được xem là sạch. Staff approve/reject đúng version.
- [LearningPathsService](../../src/modules/learning-paths/application/services/learning-paths.service.ts):
  LearningPath là thỏa thuận; LearningPlan là nội dung của một chiều teacher→learner.
  Chỉ teacher/creator tạo hoặc sửa plan của mình; learner confirm đúng version.
  TWO_WAY cần hai plan đối ứng, ONE_WAY một plan.
- [LearningPlan DTO](../../src/modules/learning-paths/presentation/http/learning-paths.dto.ts):
  learningGoal 1–1500, totalSessions 1–100, sessionOutline có đúng số phần tử,
  mỗi content 1–2000 ký tự. Bản đầu AI chỉ sinh tối đa 20 buổi/lần; đây là
  giới hạn kỹ thuật mới, không giảm giới hạn 100 của API tạo plan thủ công.
- [SharingSkillsService](../../src/modules/sharing-skills/application/services/sharing-skills.service.ts):
  description 20–1500; version, visibility và verification thuộc Sharing Skills.
- [ReviewsService](../../src/modules/reviews/application/services/reviews.service.ts): review sau
  settlement, comment tối đa 1000; tạo review đã cập nhật reputation/achievement.
  AI chỉ phân tích comment; không suy ra vi phạm từ rating thấp hoặc hoàn tác điểm.
- [ConversationAccessService](../../src/modules/conversations/application/services/conversation-access.service.ts)
  chỉ cho participant đọc chat. MongoDB sở hữu tin PUBLISHED; không có quyền Staff
  đọc toàn bộ chat được suy ra từ role. Cần contract truy cập excerpt riêng cho case.
- [Verification AI](../007-skills/verification-ai.md) đã có source và được commit
  riêng tại `5603cffd`; chưa bật hoặc triển khai runtime. Không xem các helper/job
  của nó là hạ tầng dùng chung sẵn có.

## User stories và tiêu chí chấp nhận

### US1 Soạn Learning Request

User ACTIVE có quyền tạo Request chọn skill và mô tả nhu cầu ngắn. AI trả
title/description/learningGoal/tag đề xuất và các câu hỏi còn thiếu.

1. Chỉ skill và tag ACTIVE do backend cung cấp được dùng trong kết quả.
2. AI không tự khai kinh nghiệm, chứng chỉ, kỹ năng có thể dạy, lịch rảnh, ngân sách,
   currentLevel hoặc yêu cầu teacher VERIFIED thay người dùng.
3. Khi thiếu mục tiêu tối thiểu, trả NEEDS_INPUT và câu hỏi; không bịa bản nháp hoàn chỉnh.
4. Kết quả READY qua sanitizer và các bound hiện có; giữ phần người dùng đã khai
   trong trường riêng, không lặng lẽ đổi giá trị.
5. Chưa ghi LearningRequest. User gửi bản đã chỉnh qua POST/PATCH hiện có,
   vẫn chịu eligibility, validation, version và moderation khi publish.

### US2 Tạo nội dung LearningPlan

Teacher của đúng chiều học chọn skill, mục tiêu, số buổi và mô tả trình độ
do người học cung cấp. AI đề xuất mục tiêu và nội dung từng buổi.

1. Backend xác định teacher/learner từ path hiện tại; không tin actor IDs trong body.
2. AI sinh đúng totalSessions đã chọn, theo thứ tự; không tự đổi số buổi hoặc giá.
3. Mỗi buổi có mục tiêu, nội dung, bài luyện trong `content` tương thích DTO hiện có.
4. Chỉ creator xem kết quả riêng tư trước khi gửi. Learner thấy plan sau khi teacher
   chủ động tạo/sửa qua API nghiệp vụ hiện có; confirmation vẫn theo version.
5. Không đọc chat tự động để viết plan. Teacher cung cấp bản tóm tắt nhu cầu;
   mức độ được coi là tự khai, không phải kết quả đánh giá trình độ của AI.
6. Nếu path/plan/catalog thay đổi hoặc quyền mất trong lúc chạy, kết quả được đánh
   dấu STALE/CANCELLED; không trả READY để dùng như đề xuất còn hiệu lực.

### US3 Kiểm duyệt Learning Request

Sau publish/republish hoặc edit nội dung đang OPEN/PENDING_MODERATION, AI phân tích
snapshot đúng nội dung đã lưu, cung cấp lời giải
thích và đoạn dẫn chứng cho Staff. Bộ lọc từ khóa vẫn quyết định OPEN hay
PENDING_MODERATION theo luồng hiện tại.

1. Không chờ Gemini trong transaction publish; AI lỗi không đổi kết quả filter.
2. AI không approve/reject/chuyển trạng thái Request. Bài OPEN bị AI gắn cờ
   chỉ tạo case tư vấn; chưa có quyền approve/reject của luồng PENDING cho bài OPEN.
3. Rule hit hiện tại vẫn là hit dù AI trả NO_CONCERN. Staff xem hai tín hiệu riêng.
4. Chỉ kết quả cùng content hash/policy hiện tại được hiển thị là còn hiệu lực;
   lưu captured/current entity version riêng. Nội dung đổi làm bản cũ STALE trong
   lịch sử riêng tư. Staff quyết định qua endpoint có sẵn khi hợp lệ.

### US4 Kiểm duyệt mô tả Sharing Skill và review

AI phân tích mô tả đang visible khi tạo/sửa/bật visible/restore Sharing Skill;
phân tích comment
không rỗng khi tạo review. Không dùng review rating làm bằng chứng nội dung xấu.

1. Tạo job/case cùng transaction thay đổi nguồn; tắt flag thì không phát sinh job.
2. Chỉ thay đổi nội dung liên quan mới sinh phân tích mới; retry/idempotency không
   tạo nhiều case/job cho cùng source hash và policy/prompt version.
3. AI và việc đóng case không đổi visibility, archivedAt, verificationStatus,
   review.hiddenAt, rating, reputation hay achievement.
4. Bằng chứng case review là dữ liệu riêng tư, không mở review của thỏa thuận cho
   Staff qua endpoint participant; dùng quyền đọc case riêng, có audit.

### US5 Kiểm duyệt chat theo báo cáo

Participant báo cáo một tin và chọn tối đa 9 tin ngữ cảnh cùng conversation.
Conversations owner xác thực các tin trước khi lưu snapshot phục vụ case.

1. Chỉ tin PUBLISHED, người báo cáo có quyền xem; tối đa 10 tin TEXT/FILE có text,
   tổng text tối đa 12.000 ký tự. Không đọc bytes attachment, filename, URL tải,
   SYSTEM message, tin DRAFT hoặc tin conversation khác.
2. Chỉ excerpt đã chọn được cung cấp cho AI/Staff; Staff không được quyền list
   history, tải file hoặc tự thêm tin bằng quyền đọc case.
3. Không tin text/author/time từ client. Backend lấy text từ MongoDB qua owner
   contract, kiểm tra conversation/PUBLISHED/sender/sequence/digest và PostgreSQL
   publication receipt, lấy membership từ PostgreSQL, kiểm tra lại trước ghi case.
4. Report thất bại khi không có text có thể phân tích; attachment-only vẫn có thể
   đi luồng report thủ công hiện có nếu phù hợp, không gọi AI để đoán nội dung file.
5. Báo cáo lặp có dedupe/throttle. Một lời tố cáo hoặc output AI không chứng minh
   vi phạm; Staff xem đoạn được report cùng các câu hỏi/thiếu ngữ cảnh.

### US6 Staff triage và vận hành

1. Queue có loại nguồn, thời điểm, trạng thái job, mức ưu tiên gợi ý và freshness;
   snippet riêng tư chỉ xuất hiện ở detail có quyền tương ứng.
2. Claim/close case dùng expectedVersion, reason và audit. Kết quả đóng case là
   NO_ACTION / POLICY_CONCERN / INSUFFICIENT_EVIDENCE, chỉ là ghi nhận review.
3. Quyền đọc, đọc excerpt chat/review, yêu cầu chạy lại và triage là grants riêng;
   STAFF/ADMIN không mặc nhiên có mọi quyền, cần seed được review.
4. Kết quả AI gồm NO_CONCERN / NEEDS_REVIEW / INCONCLUSIVE, policy version,
   dẫn chứng theo field/message và giải thích; không có verdict “fraud confirmed”.
5. Provider safety block, output sai schema, outage và quota không được chuyển
   thành NO_CONCERN; lưu lỗi sạch để Staff phân biệt với kết quả phân tích.

## Yêu cầu chung

- Mỗi capability và từng nguồn moderation bật/tắt độc lập, mặc định tắt.
- PostgreSQL sở hữu job/result/case/evidence snapshot; MongoDB vẫn sở hữu chat gốc.
  Snapshot excerpt là bản sao phục vụ review, có nguồn, hash và retention riêng.
- Idempotency-Key bắt buộc với endpoint tạo job/report/chạy lại; replay không
  tính quota hai lần. Authorization luôn chạy lại trước khi trả replay.
- External call ngoài transaction; outbox/job có dedupe, lease, bounded retry,
  recovery và chặn worker cũ ghi đè kết quả.
- AI không có tool execution, browsing, khả năng gọi API nghiệp vụ hay truy cập DB.
  Text của người dùng, catalog và tin nhắn đều là dữ liệu, không phải chỉ thị.
- Không gửi tên thật/email/token/Credit/chat không liên quan/chứng chỉ tới provider.
  Sender trong chat được thay bằng nhãn A/B; không khẳng định đã loại bỏ mọi PII
  do PII vẫn có thể nằm trong text người dùng viết.
- Việc bật xử lý dữ liệu thật cần chính sách thông báo/xử lý dữ liệu, retention,
  bộ quy tắc nội dung và ngân sách được chốt; xem các gate trong plan.

## Không thuộc phạm vi

Frontend/mobile; matching; đánh giá trình độ tự động; AI tutor; OCR attachment;
quét toàn bộ chat; tự động hide/delete/block/sanction/refund; sửa chính sách tài
chính; phát triển toàn bộ hệ thống giải quyết report/dispute hiện có.

## Thước đo và gate

Kết quả bản nháp: schema hợp lệ, không bịa dữ liệu người dùng, đúng catalog/số
buổi, tỷ lệ được người dùng dùng và chỉnh sửa. Kiểm duyệt: precision/recall và
false-positive trên tập tiếng Việt do người review gán nhãn, gồm phản hồi tiêu
cực hợp lệ, trích dẫn nội dung xấu và trường hợp thiếu ngữ cảnh. Mục tiêu định
lượng, ngân sách và retention là release gate, chưa được mặc định thành nghiệp vụ.
