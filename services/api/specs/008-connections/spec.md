# Feature Specification: Kết nối — Proposal và Chat

**Feature Branch**: `feat/connections`

**Created**: 2026-10-09

**Status**: API implementation added; approved limits are in [policies.md](policies.md).
Real-store and production gates remain pending; see [validation.md](validation.md).

**Input**: “Tiếp tục sử dụng speckit để plan phần tiếp theo Kết nối (proposal, chat)”.

## User Scenarios & Testing _(mandatory)_

### User Story 1 — Gửi và quản lý đề nghị kết nối (Priority: P1)

User có Sharing Skill phù hợp gửi đề nghị nhận dạy cho Learning Request OPEN của người khác. Chủ bài xem đề nghị nhận được; người gửi theo dõi, sửa hoặc rút PENDING. User cũng gửi lời mời từ Sharing Skill công khai tìm được qua search.

**Why this priority**: Bắt đầu kết nối trước khi thương lượng.

**Independent Test**: Hai tài khoản ACTIVE, một kỹ năng và một bài OPEN; gửi/xem/sửa/rút đề nghị, kiểm tra người thứ ba không đọc được nội dung riêng.

**Acceptance Scenarios**:

1. **Given** bài OPEN và proposer có Sharing Skill cùng skill, **When** gửi hợp lệ, **Then** tạo một PENDING tới đúng chủ bài.
2. **Given** bài yêu cầu VERIFIED, **When** proposer chưa VERIFIED hoặc skill archive, **Then** từ chối.
3. **Given** đã có PENDING cùng proposer/Request, **When** gửi lại hoặc gửi đồng thời, **Then** không sinh PENDING thứ hai; có thể sửa bản cũ đúng version hoặc withdraw.
4. **Given** Sharing Skill công khai của người khác, **When** gửi direct invitation, **Then** gắn đúng recipient/skill, không cần Request và không bắt người muốn học sở hữu kỹ năng đó.
5. **Given** PENDING chưa hết hạn, **When** recipient reject hoặc proposer withdraw đúng version, **Then** trạng thái terminal và lịch sử được giữ.
6. **Given** đề nghị tới hạn, **When** thao tác hoặc expiry worker chạy, **Then** không accept/update được dù worker trễ.

### User Story 2 — Chấp nhận để mở thương lượng (Priority: P1)

Chỉ recipient accept đề nghị hợp lệ. Hệ thống mở đúng một Conversation cho đề nghị; Request thành NEGOTIATING nếu có nguồn bài đăng.

**Why this priority**: Ngăn match trùng và không tạo cam kết tài chính sớm.

**Independent Test**: Accept và thử hai accept cạnh tranh trên cùng Request; đối chiếu Conversation, Request và dữ liệu tài chính/buổi học.

**Acceptance Scenarios**:

1. **Given** PENDING chưa hết hạn, nguồn hợp lệ và hai account ACTIVE, **When** recipient accept, **Then** Proposal ACCEPTED, Conversation hai participant và Request NEGOTIATING nếu có được ghi nguyên tử.
2. **Given** hai Proposal cùng Request, **When** accept đồng thời, **Then** đúng một thắng, một Conversation nguồn Request và lần còn lại conflict.
3. **Given** accept thành công nhưng mất phản hồi, **When** retry cùng lệnh, **Then** cùng Conversation được trả sau kiểm tra quyền hiện hành.
4. **Given** accept, **When** một phần ghi dữ liệu bắt buộc lỗi, **Then** không để lại ACCEPTED/NEGOTIATING/Conversation một phần.
5. **Given** accept thành công, **Then** không Hold Credit, tạo LearningPath/LearningPlan, Schedule, Session hoặc chuyển MATCHED.
6. **Given** Request cancel/expire hoặc đã sửa khiến nguồn/skill/eligibility không còn hợp lệ trước accept, **When** accept, **Then** từ chối và giữ lịch sử; sửa nhưng vẫn hợp lệ được kiểm lại theo bản hiện hành, trừ khi caller yêu cầu đúng version đã xem.

### User Story 3 — Chat riêng tư và trạng thái đã đọc (Priority: P1)

Hai participant đọc lịch sử phân trang, gửi text và biết tin đã được đối phương đọc. Text thương lượng không thay xác nhận nghiệp vụ.

**Why this priority**: Hoàn thành luồng kết nối bằng kênh thương lượng có lịch sử.

**Independent Test**: Gửi/đọc/retry/reconnect; kiểm tra người thứ ba và phiên bị thu hồi.

**Acceptance Scenarios**:

1. **Given** Conversation hợp lệ, **When** participant gửi text 1–2000 ký tự sau chuẩn hóa an toàn, **Then** có một tin với người gửi/thời điểm hệ thống.
2. **Given** cùng định danh gửi và nội dung, **When** retry, **Then** không tạo bản thứ hai; đổi nội dung cùng định danh bị conflict.
3. **Given** tin đang hoàn tất gửi, **When** lỗi xử lý/mất phản hồi, **Then** User phân biệt đang xử lý với đã gửi, truy vấn kết quả và retry an toàn.
4. **Given** lịch sử nhiều trang, **When** tải trang cũ hoặc tin mới sau reconnect, **Then** thứ tự ổn định, không mất tin đã công bố và không tải toàn bộ lịch sử.
5. **Given** participant đánh dấu đã đọc tới tin hiển thị, **When** lệnh retry/out-of-order, **Then** mốc đọc chỉ tăng và không đánh dấu tin tương lai.
6. **Given** người ngoài, Staff/Admin không thuộc Conversation hoặc phiên hết hiệu lực, **When** đọc/gửi/read marker, **Then** từ chối; người ngoài không biết nội dung/sự tồn tại tài nguyên riêng.
7. **Given** lộ trình/lịch đã chốt ở feature sau, **When** tiếp tục chat, **Then** vẫn theo quyền participant; nhắn “đồng ý” không thay Confirm object/version.
8. **Given** User có kết nối nhận cập nhật đang hoạt động, **When** tin đã công bố hoặc mốc đã đọc thay đổi, **Then** nhận event qua SSE mà không phải tải lại danh sách định kỳ; reconnect phát lại event còn lưu và không nhân đôi tin.

### User Story 4 — File an toàn (Priority: P1)

Participant gửi loại file cho phép, tối đa 15 MB/file, chỉ sau validation và scan CLEAN; chỉ participant tải được.

**Why this priority**: BR-29/CHAT-002 yêu cầu attachment có kiểm soát.

**Independent Test**: Upload → scan → gửi file → tải bằng participant; thử file chưa scan/sai chủ/sai loại/vượt cap.

**Acceptance Scenarios**:

1. **Given** file ≤15.000.000 bytes, đúng loại/MIME thực và CLEAN, **When** chủ file gửi trong Conversation của mình, **Then** file gắn đúng tin và cả hai participant tải qua quyền hiện hành.
2. **Given** file 15.000.001 bytes, MIME/extension không khớp, scan chưa xong hoặc malware, **When** upload/gửi/tải tương ứng, **Then** bị từ chối.
3. **Given** file người khác, purpose khác hoặc đã gắn tin khác, **When** gửi fileId, **Then** không gắn được; metadata client không thay metadata hệ thống.
4. **Given** crash giữa lưu nội dung/gắn file/công bố tin, **When** retry/reconcile, **Then** công bố nhiều nhất một lần và không xóa nhầm hoặc công bố file chưa an toàn.
5. **Given** tin không có text, **When** có attachment hợp lệ, **Then** chấp nhận; không có cả hai bị từ chối.

### User Story 5 — Notification và card nghiệp vụ (Priority: P2)

Thông báo proposal/chat theo kênh cấu hình; card Path/Schedule phản ánh sự kiện đã commit của owner.

**Why this priority**: Notification là Should; card cần contract nhưng producer học/lịch ở feature sau.

**Independent Test**: Replay sự kiện; chỉ một notification/card và card không tự cấp quyền confirm.

**Acceptance Scenarios**:

1. **Given** proposal đã commit, **When** delivery retry, **Then** một notification/event/recipient; lỗi kênh không rollback kết nối.
2. **Given** sự kiện Path/Schedule hợp lệ có object/version, **When** card hiển thị, **Then** giữ version sự kiện, sự kiện cũ không ghi đè trạng thái mới; client không giả card được.
3. **Given** chưa có producer Path/Schedule, **Then** integration ghi Pending, không tạo lộ trình/lịch giả để gọi feature hoàn thành.
4. **Given** notification được tạo/đánh dấu đã đọc hoặc Proposal đổi trạng thái, **When** thay đổi đã commit, **Then** User được quyền nhận event SSE; lỗi kết nối được replay hoặc yêu cầu đồng bộ lại rõ ràng.

### Edge Cases

- Accept cạnh tranh reject/withdraw/expiry/Request cancel/edit/skill archive/revoke/account lock.
- Sibling PENDING sau accept: giữ lịch sử, reject/withdraw được; không accept thêm hoặc tự reopen Request.
- Direct invitation không suy ra teacher/learner cố định hoặc exchangeType chính thức.
- Request cancel trước LOCK không xóa Conversation; downstream recheck nguồn trước tạo cam kết mới.
- Mongo/Redis/S3/scanner lỗi; restart sau commit trước ack; duplicate/out-of-order/unknown event.
- Hai send cùng file, cleanup cạnh tranh attach, URL download hết TTL hoặc file bị thu hồi.
- Read marker tới tin Conversation khác, chưa công bố hoặc vượt sequence hiện có.
- SSE reconnect bằng cursor user khác/hết cửa sổ replay, token hết hạn khi stream mở, quyền bị thu hồi, proxy buffering, client chậm và chuyển API instance.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-CN-001**: Chỉ User ACTIVE, phiên/permission hiện hành được thao tác. Restriction tạo hoạt động mới kiểm riêng, không tự chặn đọc/học đã chốt.
- **FR-CN-002**: Proposal source LEARNING_REQUEST/DIRECT_SEARCH, hai User khác nhau, skill và message 10–1000 ký tự. Request suy ra recipient/skill từ bài, không nhận ghi đè client.
- **FR-CN-003**: Nguồn Request OPEN/chưa hết hạn/không tự gửi; proposer có Sharing Skill cùng skill, VERIFIED nếu bài yêu cầu; kiểm lại khi accept.
- **FR-CN-004**: Direct invitation tham chiếu Sharing Skill công khai hợp lệ của recipient, không cần Request; kiểm lại khi accept, không bắt người muốn học có sẵn skill đó.
- **FR-CN-005**: Tối đa một PENDING cùng proposer/Request. Proposer sửa/withdraw PENDING đúng version; chỉ recipient reject/accept.
- **FR-CN-006**: Gợi ý duration 60–180; slots 0–5 khoảng tương lai start < end; initialSessionCount ≥1 và ≤config. proposedCredit tùy chọn tối đa hai chữ số thập phân; nếu có phải có ngữ cảnh TWO_WAY (≥20) hoặc ONE_WAY (>0 và policy min/max); không là thỏa thuận đã Confirm.
- **FR-CN-007**: Expiry hệ thống tính theo config, không do client; hết hạn không accept/update dù worker trễ.
- **FR-CN-008**: Accept nguyên tử giữa Proposal, Request NEGOTIATING nếu có, Conversation và delivery bắt buộc; chống nhiều match đồng thời và retry trùng.
- **FR-CN-009**: Một Proposal tối đa một Conversation. Accept không tạo tài chính/lộ trình/lịch/Session hoặc MATCHED.
- **FR-CN-010**: Chat text 1–2000 ký tự hoặc file; lịch sử có pagination/thứ tự ổn định. Nội dung/sentAt không đổi sau gửi; edit/delete message ngoài phạm vi.
- **FR-CN-011**: Cùng định danh/nội dung gửi tối đa một tin; khác nội dung conflict; pending/delivered/error truy vấn và khôi phục sau crash được.
- **FR-CN-012**: Chỉ participant đọc/gửi/read marker/upload/download; live auth được kiểm cả retry; không có bypass staff/admin chung.
- **FR-CN-013**: Mốc đã đọc chỉ tăng tới tin công bố trong đúng Conversation; không giả người đọc hoặc tin tương lai.
- **FR-CN-014**: File ≤15.000.000 bytes; PDF, DOC/DOCX, XLS/XLSX, PPT/PPTX, TXT, JPG/JPEG/PNG/WEBP; MIME thực/extension/size và CLEAN. Bytes private, metadata server, số file/tổng/message theo policy riêng.
- **FR-CN-015**: Đồng bộ tin/file/sự kiện có dedupe, bounded retry, lỗi lưu bền và reconciliation; enqueue không được báo delivered.
- **FR-CN-016**: Card chỉ từ sự kiện commit có objectId/version; text/card không sửa hoặc Confirm nghiệp vụ thay owner.
- **FR-CN-017**: Notification proposal/chat qua kênh cấu hình, dedupe; mặc định chỉ reference, không lộ text/file riêng.
- **FR-CN-018**: TTL, chống spam, retention, report-message và nhân sự đọc chat phải có policy trước bật capability phụ thuộc; không tự đặt penalty/retention hoặc cấp quyền từ role.
- **FR-CN-019**: Chat, notification và application events server→client MUST dùng SSE theo quyết định người dùng ngày 2026-10-09; thao tác gửi/đọc/Confirm vẫn qua HTTP có xác thực. Event chỉ thông báo state đã commit, không thay action nghiệp vụ.
- **FR-CN-020**: SSE có cursor theo User, replay sau reconnect, duplicate protection và yêu cầu resync khi cursor ngoài cửa sổ; kiểm tra quyền hiện hành cho stream và từng event, không lộ payload riêng cho người ngoài hoặc phiên thu hồi.
- **FR-CN-021**: SSE hỗ trợ nhiều API instance, heartbeat, token expiry/reconnect, bounded buffering và cleanup khi disconnect; mất tín hiệu phân phối không mất state/event lưu bền hoặc biến thành thành công giả.

### Key Entities

- **Proposal / Invitation**: Nguồn, người gửi/nhận, skill, gợi ý, trạng thái/version/thời hạn.
- **Conversation**: Hai participant, một đề nghị ACCEPTED; Request tùy nguồn.
- **Message**: Text/file, sender, thời điểm/thứ tự công bố, loại và object/version khi là card.
- **Attachment**: File riêng tư validation/CLEAN gắn tin, metadata hệ thống.
- **Read State**: Mốc đọc từng participant, chỉ tăng.
- **Delivery Receipt**: Theo dõi gửi/retry/kết quả, tách nội dung chat và nghiệp vụ học.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-CN-001**: 100% ca hợp lệ trong acceptance matrix đi đúng trạng thái/giữ lịch sử; ca không hợp lệ không đổi dữ liệu.
- **SC-CN-002**: 20 accept cạnh tranh cùng Request chỉ một thành công; Conversation/proposal ≤1; Hold, Session và lộ trình mới do Accept bằng 0.
- **SC-CN-003**: Retry cùng tin/event 20 lần chỉ hiển thị một bản; các điểm crash đã liệt kê không mất tin đã công bố/file đã xác nhận gửi sau phục hồi.
- **SC-CN-004**: 100% ca người ngoài/phiên thu hồi/account khóa bị chặn; file 15.000.001 bytes, malware/MIME giả bị chặn.
- **SC-CN-005**: Thao tác/list thông thường P95 ≤2 giây ở tải test công bố theo NFR-PERF-01/02. Upload/recovery đo riêng; pending không là delivered.
- **SC-CN-006**: Reconnect không mất tin công bố; read state không lùi/vượt tin hiện có khi retry/out-of-order.
- **SC-CN-007**: Trong ma trận SSE, reconnect/replay qua hai API instance không bỏ sót event còn trong cửa sổ hoặc nhân đôi state hiển thị; cursor hết hạn yêu cầu resync rõ; 100% ca sai User/thu hồi quyền/token hết hạn không nhận thêm dữ liệu riêng sau điểm kiểm tra quyền.

## Assumptions

- Backend-only; không implement UI, Path/Plan/Schedule/Session/Credit/LiveKit hoặc toàn Report/Dispute.
- SRS v1.6 là nguồn: FR-PP-01…06, FR-SK-07, BR-11/12/29, PP-001…005, CHAT-001…006, 18.11/12/28/38; FR-NTF-01 là Should. P1/P2 chỉ thứ tự triển khai, không đổi MoSCoW.
- Direct search theo hướng người tìm skill liên hệ chủ Sharing Skill công khai (FR-SK-07). Chống trùng lời mời cùng chiều/skill là đề xuất thiết kế, không thay anti-spam policy.
- Một Request có một kết nối ACCEPTED trong vòng đời hiện tại; không auto reject sibling hoặc reopen/end-negotiation vì SRS chưa quy định.
- Request cancel không xóa Conversation/lịch sử; chưa tự khóa chat theo trạng thái bài/path. Live account và participant vẫn quyết định truy cập.
- Quyết định người dùng ngày 2026-10-09: SSE là transport realtime chung cho chat, notification và application events; HTTP cho commands/history/hydration/resync. Không client polling định kỳ làm kênh nhận chính. Presence/typing chưa có requirement và vẫn ngoài scope.
- Policy chưa chốt ghi ở research thành activation/release gates; spec mô tả hành vi khi config hợp lệ, không tuyên bố production-ready.
