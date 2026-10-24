# Feature Specification: Learning Request

**User amendment (2026-10-24):** [Proposed tags reviewed with the post](proposed-tags.md)
adds inline label proposals and atomic Staff/Admin approval into the shared Tag
catalog. This supersedes canonical-ID-only input for this new optional field.

**User-approved FE amendment (2026-10-12):** [fe-extension-design.md](fe-extension-design.md) extends LR with request-specific teaching overview, selected owner's Sharing Skills, recurring weekly availability, hourly desired Credit and canonical Tag lookup. These additions supersede older planning exclusions for those exact hints, while retaining legacy slots and existing lifecycle/moderation rules.

**Feature Branch**: `feat/learning-request`

**Created**: 2026-10-06

**Status**: User chọn và chốt các đề xuất A cho expiry, edit/cancel, Catalog tags, moderation, grants và kênh rejection ngày 2026-10-06. Bộ keyword/pattern cụ thể và upstream runtime vẫn là release gates.

**Input**: Tiếp tục implement backend Learning Request từ Google Sheet “SkillHub - Backend Breakdown Task”, SH-030–034; cập nhật theo SRS V1.5 và các lựa chọn A đã được user chốt ngày 2026-10-06.

## Sources and scope

- [Backlog A23:K27](https://docs.google.com/spreadsheets/d/1jdgrnCNeQLK1g339kY0WUYy6o7lgx6hG9j0tu1fb1Xw/edit#gid=733891926&range=A23:K27), đọc ngày 2026-10-06: năm task đều có owner Long và trạng thái “Đang làm”. Trạng thái sheet không phải bằng chứng đã có implementation.
- [BR Mapping](https://docs.google.com/spreadsheets/d/1jdgrnCNeQLK1g339kY0WUYy6o7lgx6hG9j0tu1fb1Xw/edit#gid=1002): BR-02, BR-07–10, BR-39/40; BR-11/12 là ranh giới tích hợp Proposal.
- [Open Decisions](https://docs.google.com/spreadsheets/d/1jdgrnCNeQLK1g339kY0WUYy6o7lgx6hG9j0tu1fb1Xw/edit#gid=1003): OP-06 ghi “Đã chốt”; user đã chọn grant matrix cụ thể trong lượt này. Rejection của LR dùng IN_APP; email/push rộng hơn theo OP-05 vẫn mở, không chặn slice này.
- [SRS V1.5](../../../../docs/SRS_SkillHub_V1.5-1.docx), revision ngày 03/10/2026, là baseline SRS hiện tại: mục 6.4, 8.2, 18.10, 18.31, BR-07–12 và AC-03/04 cho Learning Request; 6.14, 18.13, 18.19, 18.32, 18.39/40 cho tích hợp downstream.
- [Đối chiếu V1.4 → V1.5](srs-v1.5-changes.md): các mục Learning Request, BR-07–12 và AC-03/04 giữ nguyên; các thay đổi cần chỉnh plan thuộc LearningPath/LearningPlan, TWO_WAY/ONE_WAY và completion. V1.4 giữ làm nguồn so sánh.
- [Research](research.md) ghi khác biệt với schema và các tài liệu dữ liệu cũ. Không lấy giá trị nghiệp vụ từ schema cũ để lấp chỗ trống của SRS V1.5.
- [ERD v3 alignment and SRS V1.6 Tag evidence](erd-v3-alignment.md), supplied by the user on 2026-10-07, supersedes LR slot storage and mapped database attributes. SRS V1.6 18.10/FR-LR-01/07/08 confirms that Tag remains in scope. `verifiedTeacherOnly` is restored from the explicitly supplied v3 ERD, default false, without inferring a verification badge or expanding Proposal/Verification implementation.

Phạm vi là SH-030 tạo/publish, SH-031 word/pattern moderation, SH-032 approve/reject kèm reason/audit/notification, SH-033 edit/cancel/expire và SH-034 browse/search/filter/gợi ý. Có contract cho Proposal/Path/Schedule và một phần notification in-app cần thiết để hoàn tất rejection flow. Không triển khai frontend, Proposal/Chat, Learning Path/Schedule, Credit, admin hide/restore SH-101, cấu hình dashboard SH-105 hoặc Gemini SH-114.

Trong V1.5, **LearningPath** là thỏa thuận tổng; **LearningPlan** là lộ trình teacher tạo cho một learner. TWO_WAY có đúng hai plan đối ứng, ONE_WAY có đúng một plan. Loại trao đổi/vai trò/giá được chốt sau kết nối trong Chat, không phải field mới của Learning Request. Skill/goal của Request mô tả nhu cầu ban đầu; từng plan có skill/goal riêng, hai chiều có thể khác kỹ năng.

## User Scenarios & Testing

### User Story 1 - Tạo và publish nhu cầu học (Priority: P1)

User ACTIVE tạo nhu cầu học với skill/tag chuẩn, lưu bản nháp và publish sau khi nội dung được kiểm tra.

**Independent Test**: Tạo bản nháp, publish bài sạch và bài flagged, kiểm tra dữ liệu, quyền sở hữu và trạng thái nhìn thấy.

**Acceptance Scenarios**:

1. **Given** User ACTIVE có quyền tạo và Skill ACTIVE, **When** nhập dữ liệu hợp lệ, **Then** bản nháp thuộc đúng người đăng, chưa nhận Proposal và không giữ Credit.
2. **Given** bản nháp hợp lệ, **When** publish nội dung sạch, **Then** Request thành OPEN, moderation NOT_REQUIRED và chỉ OPEN nhận Proposal mới.
3. **Given** nội dung trúng rule, **When** publish, **Then** Request thành PENDING_MODERATION, moderation PENDING và chưa xuất hiện trong feed thông thường.
4. **Given** account không ACTIVE, thiếu quyền hoặc bị hạn chế tạo hoạt động mới, **When** tạo/publish, **Then** bị từ chối và không có Request hoạt động mới.

### User Story 2 - Duyệt bài flagged và thông báo lý do (Priority: P1)

Staff/Admin có permission phù hợp xem queue và quyết định trên chính phiên bản nội dung đã đọc.

**Independent Test**: Approve/reject bài pending; đọc kết quả bằng tài khoản owner và kiểm tra reason, audit cùng notification thực tế.

**Acceptance Scenarios**:

1. **Given** bài PENDING_MODERATION chưa hết hạn, **When** reviewer có quyền approve với reason của thao tác nhạy cảm, **Then** bài OPEN và moderation APPROVED, có audit.
2. **Given** bài pending, **When** reject với reason 10–500 ký tự, **Then** bài REJECTED, moderation REJECTED, owner đọc được reason và nhận notification; người ngoài không đọc được reason.
3. **Given** reason thiếu/ngắn/quá dài, thiếu permission hoặc bài đã đổi phiên bản, **When** quyết định, **Then** không thay đổi trạng thái, không sinh audit/notification thành công.
4. **Given** rejection delivery bị retry hoặc process restart, **When** xử lý lại, **Then** owner chỉ nhận một notification của quyết định đó; rejection cũ không bị đổi nội dung khi Request được sửa sau này.

### User Story 3 - Sửa, hủy và hết hạn đúng vòng đời (Priority: P1)

Owner sửa/re-publish khi hợp lệ, hủy trước lock và giữ lịch sử kết nối. Bộ lọc chạy lại khi nội dung đã publish/moderation thay đổi.

**Independent Test**: Kiểm tra chuyển trạng thái, re-moderation, hai người sửa đồng thời và cancel cạnh tranh với lock.

**Acceptance Scenarios**:

1. **Given** bài REJECTED, **When** owner sửa thành bản nháp rồi publish lại, **Then** có vòng kiểm tra mới; quyết định cũ không phê duyệt nội dung mới.
2. **Given** bài OPEN/PENDING_MODERATION, **When** owner sửa nội dung, **Then** nội dung mới chạy filter và có trạng thái moderation phù hợp, không giữ APPROVED của phiên bản cũ.
3. **Given** Request chưa có Path/Schedule lock, **When** owner hủy, **Then** Request CANCELLED, không nhận Proposal mới và lịch sử Proposal còn nguyên.
4. **Given** Path/Schedule đã lock hoặc Request MATCHED, **When** gọi hủy trực tiếp, **Then** bị từ chối; người dùng đi qua cancel/reschedule của module sở hữu lịch.
5. **Given** Request thuộc tập trạng thái được phép hết hạn và đã tới expiresAt, **When** đọc/gửi Proposal/approve hoặc expiry job chạy, **Then** không tiếp tục xem nó như OPEN dù job đang chậm; worker trùng lặp không làm đảo ngược trạng thái mới.
6. **Given** TWO_WAY thiếu một plan/learner confirmation hoặc ONE_WAY thiếu learner confirmation, **When** module Path/Schedule xử lý lock, **Then** chưa lock/tạo Session và chưa chuyển Request sang MATCHED. Có đủ confirmation nhưng chưa lock cũng không tự chuyển MATCHED; owner được hủy Request đến trước Schedule LOCKED theo giao thức cancel/lock chung.
7. **Given** thỏa thuận liên kết Request chỉ hoàn tất một phần Session hoặc settlement chưa commit, **When** xử lý completion, **Then** chưa CLOSED; chỉ completion flow của owner đóng Request sau khi toàn bộ Session của mọi plan hoàn tất, không còn dispute giữ Credit và settlement theo exchangeType commit thành công.

Edit, expiry và lock cutoff theo policy đã chọn dưới đây. Phần này vẫn phụ thuộc Catalog/Path owner contracts và không tuyên bố upstream feature đã được triển khai.

### User Story 4 - Tìm Request phù hợp (Priority: P2)

Người có quyền xem browse/search theo skill/tag/từ khóa, có pagination và ưu tiên nhu cầu phù hợp Sharing Skill của mình.

**Independent Test**: Dữ liệu nhiều skill/status/owner; so sánh kết quả feed, mine và moderation queue.

**Acceptance Scenarios**:

1. **Given** nhiều Request ở các trạng thái, **When** người dùng xem feed, **Then** chỉ thấy OPEN còn hạn và projection được phép; không lộ bài nháp, reject reason hay flagged rule.
2. **Given** bộ lọc skill/tag/keyword, **When** tìm kiếm, **Then** kết quả và tổng số đều áp dụng cùng scope, phân trang có thứ tự ổn định.
3. **Given** User có Sharing Skill phù hợp, **When** yêu cầu gợi ý, **Then** các Request khớp được ưu tiên theo contract đã chốt; không cần AI và không tự bắt buộc người chia sẻ phải VERIFIED.
4. **Given** Guest, **When** gọi browse/detail, **Then** không tự được cấp quyền truy cập ẩn danh; SRS/accepted RBAC chưa cho phép Guest browse Request.

### Edge Cases

- Skill/tag bị ẩn sau khi tạo draft; active state phải được kiểm tra lại khi publish.
- User bị khóa hoặc permission bị thu hồi sau khi nhận JWT.
- Reviewer đọc bản v1 nhưng owner sửa v2 trước khi approve; hai reviewer quyết định đồng thời.
- Pending Request hết hạn ngay trước approve; expiry/cancel cạnh tranh với accept/lock.
- Thời gian có offset hợp lệ, thiếu timezone, ngày không tồn tại, end <= start, hơn 5 slot hoặc slot đã qua lúc publish.
- Rule/config bị thiếu hoặc lỗi: không suy ra nội dung sạch; giữ draft và báo lỗi dịch vụ để retry.
- Unicode tiếng Việt, nội dung chứa markup, từ khóa trong title/goal, wildcard bất lợi; không thực thi HTML hoặc regex tùy ý.
- Notification consumer chết sau insert trước ack; duplicate event; Request đã sửa khi event cũ tới.
- Filter status không mở rộng quyền, keyword không tạo SQL injection, count không lộ dữ liệu private.

## Requirements

### Functional Requirements

| ID     | Yêu cầu                                                                                                                                                                                                                                                                  | Nguồn                                         |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------- |
| LR-R01 | Owner là User hiện hành; chỉ account ACTIVE có permission và không bị hạn chế tạo hoạt động mới được create/publish. Không nhận owner/status/moderation từ client.                                                                                                       | SH-030; LR-001; BR-07/39                      |
| LR-R02 | title 10–120; description 20–3000 được sanitize; learningGoal 10–1000; skillId trỏ Skill ACTIVE. Validate sau chuẩn hóa.                                                                                                                                                 | SRS 18.10                                     |
| LR-R03 | currentLevel tùy chọn thuộc NONE/BEGINNER/INTERMEDIATE/ADVANCED; tags tùy chọn tối đa 10 tag hợp lệ; preferredSlots tối đa 5 khoảng tương lai end > start, chỉ mang tính gợi ý.                                                                                          | SRS 18.10; BR-02                              |
| LR-R04 | Publish luôn chạy word/pattern filter; sạch -> OPEN/NOT_REQUIRED; flagged -> PENDING_MODERATION/PENDING. Không dùng Gemini làm quyết định tự động.                                                                                                                       | SH-031; FR-LR-02/03; BR-08                    |
| LR-R05 | Reviewer có permission action riêng, chỉ quyết định trên pending và phiên bản hiện hành. Approve -> OPEN/APPROVED; reject -> REJECTED/REJECTED.                                                                                                                          | SH-032; FR-STF-05/06; BR-39                   |
| LR-R06 | Reject bắt buộc reason 10–500 ký tự; owner đọc được reason và nhận notification. Approve/reject nhạy cảm đều có reason/audit; audit lỗi phải rollback quyết định.                                                                                                        | SH-032; BR-09/40; SRS 18.31                   |
| LR-R07 | Re-edit nội dung đã publish/moderation chạy filter mới; REJECTED được sửa và publish lại. Quyết định của bản cũ không được áp dụng cho bản mới.                                                                                                                          | SH-033; FR-LR-05; LR-006; SRS 18.31           |
| LR-R08 | Owner cancel chỉ trước Path/Schedule lock, không xóa Proposal history. MATCHED/CLOSED và luồng đã lock đi qua module Path/Schedule.                                                                                                                                      | SH-033; BR-10; LR-007/008                     |
| LR-R09 | expiresAt tùy chọn, ở tương lai theo config; hạn dùng clock backend, không phụ thuộc clock client. Không cho thao tác OPEN trên Request đã tới hạn dù job chưa chạy.                                                                                                     | SH-033; SRS 18.10; NFR-TIME-01                |
| LR-R10 | Browse/search/filter phân trang theo skill/tag/keyword và status trong scope cho phép; ưu tiên Sharing Skill khi dùng gợi ý.                                                                                                                                             | SH-034; FR-LR-07/08; LR-009                   |
| LR-R11 | Owner xem bản nháp/reject của mình; reviewer xem queue theo quyền; feed chỉ chứa projection OPEN còn hạn. Không lộ email/auth/payment, flaggedReason/rule list hoặc reject reason của người khác.                                                                        | BR-28/39; SRS 18.31; accepted RBAC            |
| LR-R12 | Chỉ OPEN còn hạn nhận Proposal; không self-proposal. Accept chỉ thành NEGOTIATING/mở Conversation; MATCHED do lock flow đủ confirmation theo exchangeType; CLOSED do completion toàn thỏa thuận và settlement thành công. Module này không Hold Credit hoặc tạo Session. | BR-11/12; SRS 8.2, 18.13/19/39/40; SH-040/042 |
| LR-R13 | Mutation, audit và durable rejection event cùng atomic boundary; retry/delivery trùng không tạo notification trùng. Vòng đời không bị ghi đè bởi stale command/job.                                                                                                      | Constitution 3/7/8; SH-005/032/113            |

### Key Entities

- **Learning Request**: nhu cầu của owner, skill/tag, nội dung/mục tiêu, preferences, trạng thái nghiệp vụ và moderation riêng biệt, thời hạn và phiên bản.
- **Preferred Slot**: một khoảng ưu tiên của Request; không phải lịch đã confirm hay Session.
- **Moderation Decision**: quyết định của reviewer trên phiên bản nội dung, reason phù hợp cho owner, thông tin kiểm duyệt nội bộ và audit.
- **Rejection Notification**: thông báo cho owner gắn với một quyết định cụ thể; retry không tạo bản thứ hai.
- **Skill/Tag/Sharing Skill**: dữ liệu do module Catalog/Skills sở hữu; Request chỉ tham chiếu và lấy dữ liệu qua contract.

## Success Criteria

- **SC-01**: Năm task SH-030–034 có acceptance cases, dependency và đường kiểm chứng tương ứng; không đánh dấu triển khai bằng trạng thái sheet.
- **SC-02**: Tất cả bài flagged trong bộ case kiểm thử bị giữ khỏi feed tới khi được duyệt; không có stale approval trong case cạnh tranh.
- **SC-03**: Mỗi quyết định reject thành công có reason hợp lệ, audit và đúng một notification owner có thể đọc, kể cả retry/restart.
- **SC-04**: Các case sai quyền/owner/account và thao tác sau lock bị từ chối, không phát sinh thay đổi nghiệp vụ thành công.
- **SC-05**: List phân trang ổn định và không rò dữ liệu private; mục tiêu P95 <= 2 giây theo NFR-PERF-01. Workload/volume phải được thống nhất trước khi dùng benchmark làm release evidence.

## Dependencies and planning assumptions

- SH-022 là dependency create/publish (active Skill và tag chuẩn); SH-023 là dependency gợi ý. Repo hiện chưa có runtime hai module này. Có thể lập contract và test doubles trước; release cần implementation thật.
- SH-002/003/005/006 có source nền tảng; wiring permission runtime và LR config chưa hoàn chỉnh. Xem [research](research.md).
- SH-110/113 chưa có notification nghiệp vụ. Plan thực hiện in-app rejection notification; không cần chờ email/push OP-05.
- Grant matrix OP-06 được user chốt: USER được create/read và sửa/hủy Request của mình cùng đọc/đánh dấu notification của mình; STAFF được đọc queue, approve/reject qua grant tách biệt; ADMIN chỉ được moderation và cấu hình rule khi được cấp grant tường minh (`learning-request:moderation:configure`). Không role inheritance và không mặc định STAFF có quyền ADMIN hay ngược lại.
- Save draft/publish tách action, optimistic version và thứ tự feed là đề xuất kỹ thuật trong [plan](plan.md), chưa phải nghiệp vụ mới được người dùng phê duyệt.
- Dữ liệu legacy expectedDurationMinutes/budgetCredit và hạn 30 ngày trong tài liệu cũ không thành field/rule bắt buộc. TTL 30/90 dưới đây là lựa chọn A do user duyệt, không lấy từ legacy SRS. `verifiedTeacherOnly` is an optional input, default false, added by the user's later ERD v3 instruction; it is not required by SRS 18.10's field table.
- **LR-D01 đã chốt:** expiresAt bỏ trống dùng TTL 30 ngày từ publish thành công; user có thể chọn thời điểm tương lai tối đa 90 ngày từ lần publish đó. Edit/approve không tự gia hạn. Publish lại sau REJECTED mở kỳ mới và áp dụng TTL mặc định/hạn custom hợp lệ. Chỉ OPEN/PENDING_MODERATION tự chuyển EXPIRED; DRAFT/REJECTED/NEGOTIATING/MATCHED/CLOSED/CANCELLED không bị expiry worker kết thúc.
- **LR-D02 đã chốt:** mọi field được sửa khi DRAFT; sau lần publish đầu tiên skillId bất biến. Owner được sửa các field khác ở OPEN/PENDING_MODERATION/REJECTED trước NEGOTIATING; nội dung sửa chạy lại filter và stale approval không áp dụng. NEGOTIATING không được sửa Request. Owner được hủy đến trước Schedule LOCKED, kể cả Request NEGOTIATING; cancel/accept/lock dùng chung transaction/row-lock boundary. Giữ Proposal/Conversation history; không hủy Request đã MATCHED/CLOSED.
- **LR-D03 phần Catalog đã chốt:** Request và Sharing Skill dùng cùng canonical Tag ID do Catalog sở hữu; tối đa 10 tag hợp lệ. Tag được xác nhận qua Catalog contract, không nhận text tự do/tạo taxonomy thứ hai trong LR.
- **Moderation đã chốt:** chuẩn hóa Unicode NFKC, case và whitespace; giữ dấu tiếng Việt. Rule set được quản lý versioned qua System Configuration bởi Admin được cấp quyền; Staff ra quyết định từng bài flagged. Bộ keyword/pattern và category thực tế ban đầu cần Product Owner duyệt trước production; không tự bịa danh sách từ cấm. Rule set thiếu/lỗi không tự coi nội dung là sạch.
- Rejection notification của LR dùng IN_APP, owner có thể đọc reason snapshot và đánh dấu đã đọc. Email/push theo OP-05 không nằm trong release slice này.
- Path/Schedule owner kiểm tra plan author, learner confirmation đúng version, A/B confirmation cùng version thỏa thuận và lịch, conflict và wallet phải trả trước lock. TWO_WAY Hold cả hai; ONE_WAY chỉ learner, teacher không phải có cam kết 20 Credit. LR create/publish/accept không kiểm tra số dư hay tạo Hold.
- Completion owner tổng hợp tất cả plan/Session, dispute và settlement theo loại trao đổi trước gọi LR lifecycle contract. LR không tự áp settlement 96%/4% cho ONE_WAY, không tự cập nhật “kỹ năng đã học” cho cả hai participant.
- OP-13 mới trong SRS V1.5: fee/min-max Credit/refund/cancel/no-show ONE_WAY còn cần chốt. Gate của Path/Wallet cho ONE_WAY không ngăn lập/triển khai core create/moderation/search LR; kiểm chứng đầy đủ consumer flow phải chờ owner implementation/policy. Material/OP-14 không thuộc module này.
- OTP softban BR-41 chỉ chặn thao tác OTP; không tự biến ACTIVE account/session hợp lệ thành LOCKED hay thêm restriction tạo Learning Request.

## Remaining Decision

Các lựa chọn dưới đây do user duyệt ngày 2026-10-06. Chỉ bộ rule moderation ban đầu còn cần PO cung cấp/duyệt; không tự tạo business keyword.

| ID     | Cần chốt                                                                                                                              | Ảnh hưởng và hướng chuẩn bị                                                                                       |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| LR-D03 | [NEEDS CLARIFICATION: Product Owner cần duyệt category, keyword/pattern thực tế trong moderation rule set khởi tạo trước production.] | SH-031/032; Admin cấu hình versioned rule set, Staff quyết định flagged; rule set thiếu/lỗi không được fail open. |

Không thêm penalty/no-show/dispute/settlement vào module này. OP-13 chỉ gate Path/Wallet ONE_WAY end-to-end; không ngăn implementation/test core Learning Request.
