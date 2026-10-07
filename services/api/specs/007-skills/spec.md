# Feature Specification: Kỹ năng và xác minh bằng chứng

**Feature Branch**: `feat/skills`
**Created**: 2026-10-07
**Status**: Ready for planning; implementation chưa bắt đầu.
**Input**: Tiếp tục sử dụng Spec Kit để plan phần tiếp theo Kỹ năng.

## User Scenarios & Testing

### User Story 1 — Chọn và quản lý kỹ năng chia sẻ (Priority: P1)

User chọn kỹ năng chuẩn, khai báo kinh nghiệm, sửa mô tả hoặc ẩn/archive mà vẫn giữ lịch sử.
**Why this priority**: Là dữ liệu nền cho tìm người dạy và xác minh.
**Independent Test**: Với catalog có sẵn, một User ACTIVE thêm/sửa/ẩn/archive kỹ năng của mình.

**Acceptance Scenarios**:

1. **Given** skill ACTIVE, **When** User thêm level hợp lệ và mô tả 20–1500 ký tự, **Then** skill xuất hiện với trạng thái UNVERIFIED; một User không có hai bản chưa archive cùng skill.
2. **Given** kỹ năng của User khác, **When** sửa/ẩn/archive, **Then** bị từ chối và dữ liệu không đổi.
3. **Given** đã VERIFIED, **When** sửa mô tả/level thông thường hoặc ẩn, **Then** approval vẫn được giữ; skillId không được thay trên bản hiện có.
4. **Given** skill INACTIVE/ARCHIVED, **When** thêm Sharing Skill mới, **Then** bị từ chối; lịch sử cũ vẫn đọc được.

### User Story 2 — Tìm người có kỹ năng phù hợp (Priority: P1)

User tìm theo kỹ năng/tag chuẩn, lọc VERIFIED và xem hồ sơ công khai.
**Why this priority**: Đáp ứng FR-SK-06 và bước xem profile của FR-SK-07.
**Independent Test**: Dữ liệu gồm skill hiện/ẩn, tài khoản ACTIVE/LOCKED và các trạng thái xác minh; kết quả chỉ gồm dữ liệu được phép công khai.

**Acceptance Scenarios**:

1. **Given** Sharing Skill visible, chưa archive và chủ tài khoản ACTIVE, **When** tìm theo skill/tag chuẩn, **Then** trả đúng người và trạng thái xác minh, có phân trang.
2. **Given** skill ẩn/archive hoặc chủ tài khoản không ACTIVE, **When** search, **Then** không xuất hiện.
3. **Given** kết quả search, **When** xem profile, **Then** không có email, file bằng chứng, lý do reject hoặc dữ liệu đăng nhập.

### User Story 3 — Gửi bằng chứng và theo dõi kết quả (Priority: P1)

User gửi bằng chứng riêng tư cho kỹ năng của mình; xem lịch sử và lý do từ chối.
**Why this priority**: Xác minh là luồng Must; tải file không đồng nghĩa được duyệt.
**Independent Test**: Gửi file hợp lệ, chờ scan, submit rồi xem trạng thái trước/sau quyết định Staff.

**Acceptance Scenarios**:

1. **Given** Sharing Skill thuộc User và chưa archive, **When** submit 1–5 file sạch, **Then** tạo yêu cầu PENDING, không tự VERIFIED.
2. **Given** đã có bằng APPROVED, **When** gửi bằng mới, **Then** file mới PENDING và bằng cũ vẫn có hiệu lực.
3. **Given** file vượt 10 MB hoặc giả MIME/nhiễm malware/chưa scan sạch, **When** upload hoặc submit, **Then** không được đưa vào yêu cầu duyệt hợp lệ.
4. **Given** yêu cầu REJECTED, **When** chủ sở hữu xem, **Then** thấy lý do; được gửi yêu cầu mới khi không còn yêu cầu PENDING.

### User Story 4 — Staff duyệt và thu hồi (Priority: P1)

Staff/Admin có permission xem hàng đợi, đọc file, approve/reject hoặc thu hồi có lý do và lịch sử.
**Why this priority**: Bảo đảm badge phản ánh quyết định có thẩm quyền.
**Independent Test**: Hai reviewer xử lý cùng yêu cầu; chỉ một quyết định thành công, dữ liệu và audit nhất quán.

**Acceptance Scenarios**:

1. **Given** PENDING với tất cả file sạch, **When** reviewer có quyền approve, **Then** ghi reviewer/time, bằng APPROVED và skill VERIFIED, không tự hết hạn.
2. **Given** PENDING, **When** reject với lý do 10–500 ký tự, **Then** chủ sở hữu thấy lý do; lý do thiếu/sai độ dài bị từ chối.
3. **Given** bằng APPROVED, **When** người có quyền revoke với lý do, **Then** ghi người/time/reason và audit; bằng APPROVED khác vẫn có hiệu lực.
4. **Given** permission bị thu hồi hoặc tài khoản bị khóa, **When** quyết định/read file, **Then** bị từ chối theo quyền hiện tại.

### User Story 5 — Quản trị catalog (Priority: P1)

Admin hoặc Staff được cấp permission riêng tạo/sửa/ẩn/archive skill chuẩn.
**Why this priority**: Catalog nhất quán phục vụ mọi module sau này.
**Independent Test**: Tạo tên trùng theo chuẩn hóa; archive skill đã được dùng; lịch sử không mất.

**Acceptance Scenarios**:

1. **Given** hai tên tương đương theo chuẩn hóa, **When** tạo đồng thời, **Then** chỉ một skill được tạo.
2. **Given** skill được tham chiếu, **When** archive, **Then** không xóa vật lý hoặc mất lịch sử.
3. **Given** Staff chưa được cấp permission catalog, **When** tạo/sửa, **Then** bị từ chối.

### Edge Cases

- Thêm skill cạnh tranh với archive catalog; submit cạnh tranh với archive Sharing Skill.
- Approve/reject cạnh tranh; revoke bằng cuối cùng hoặc một trong nhiều bằng còn hiệu lực.
- Gửi trùng request; file người khác, sai purpose, một file bị dùng lại, file scan lỗi hoặc bị cleanup.
- Đã VERIFIED vẫn có yêu cầu PENDING/REJECTED mới; trạng thái yêu cầu không ghi đè hiệu lực bằng cũ.
- Archive giữ evidence và audit; URL download cũ có thể dùng đến TTL ngắn đã cấp.
- Kết quả search thay đổi giữa các trang; không cam kết snapshot toàn bộ danh sách.

## Requirements

### Functional Requirements

- **FR-001**: Catalog name 2–100 ký tự, unique theo chuẩn hóa; slug lowercase URL-safe unique; description tối đa 500; category tùy chọn phải tồn tại; status ACTIVE/INACTIVE/ARCHIVED. Không hard delete.
- **FR-002**: Chỉ User ACTIVE quản lý Sharing Skill thuộc mình; skillId ACTIVE, level BEGINNER/INTERMEDIATE/ADVANCED/EXPERT; description 20–1500; experienceYears 0–60, tối đa một chữ số thập phân; isVisible mặc định true.
- **FR-003**: Một User chỉ có một Sharing Skill chưa archive mỗi skillId; skillId bất biến; archive/ẩn giữ lịch sử.
- **FR-004**: Search theo skill/tag chuẩn và từ khóa tên skill; lọc verified; trả người ACTIVE có skill visible, chưa archive và catalog ACTIVE; public profile có Sharing Skill và badge, không lộ evidence/private data.
- **FR-005**: Evidence nhận 1–5 file/lần, PDF/DOC/DOCX/JPG/JPEG/PNG/WEBP, **tối đa 10.000.000 bytes/file (10 MB thập phân)** theo quyết định User 2026-10-07; validate MIME/extension thật và scan malware; title tối đa 120, description tối đa 500.
- **FR-006**: Submit chỉ dùng file thuộc người gửi, đúng purpose và scan sạch; một yêu cầu PENDING mỗi Sharing Skill; file mới cần duyệt riêng và không thay thế approval cũ.
- **FR-007**: Owner đọc lịch sử yêu cầu/kết quả; Staff/Admin chỉ đọc/approve/reject/revoke theo permission; public chỉ thấy trạng thái xác minh cần thiết.
- **FR-008**: Quyết định lưu reviewer/time; rejectReason 10–500; revoke có reason và Audit; không tự expiry approval. Approve/reject áp dụng toàn batch file mới của một yêu cầu, không sửa batch cũ.
- **FR-009**: Badge VERIFIED nếu còn ít nhất một evidence APPROVED chưa revoke. Nếu không còn: PENDING khi có yêu cầu chờ; REJECTED khi quyết định cuối bị reject/revoke; nếu chưa từng gửi thì UNVERIFIED. Revoke được giữ trên evidence/history, không thêm trạng thái Sharing Skill ngoài bốn trạng thái SRS.
- **FR-010**: Cập nhật quyết định, trạng thái tổng hợp và audit phải cùng thành công hoặc cùng thất bại; xử lý cạnh tranh/retry không tạo hai quyết định.
- **FR-011**: Kết quả xác minh tạo sự kiện thông báo sau commit, retry không trùng; owner luôn có thể đọc kết quả dù delivery đang lỗi. Không triển khai notification inbox/email nghiệp vụ đầy đủ trong feature này.
- **FR-012**: Evidence chỉ có link download ngắn hạn sau kiểm tra quyền; không trả storageKey hoặc link file trong public/search.
- **FR-013**: Kỹ năng đã học là dữ liệu riêng, chỉ được ghi khi toàn thỏa thuận hoàn tất cho đúng learner/skill; không tự tạo từ Sharing Skill hay approval. Feature này ghi handoff, chưa mở chức năng ghi lịch sử khi module Learning Path chưa có.

### Key Entities

- **Skill**: Catalog chuẩn, tên/slug/category/status.
- **SharingSkill**: Kỹ năng User tự khai, level/kinh nghiệm/visibility/archive và badge tổng hợp.
- **SkillVerification**: Lần gửi bằng chứng, các file mới, trạng thái quyết định và reviewer.
- **SkillEvidence**: File riêng tư, scan/approval/revoke metadata.
- **UserLearnedSkill**: Lịch sử hoàn thành theo learner/plan, thuộc tích hợp tương lai.

## Success Criteria

### Measurable Outcomes

- **SC-001**: 100% kịch bản thêm/sửa/ẩn/archive hợp lệ hoàn thành, không mất lịch sử.
- **SC-002**: 100% kịch bản public/search không hiển thị skill ẩn, evidence hoặc thông tin tài khoản riêng tư.
- **SC-003**: 100% approval/reject/revoke lưu đúng reviewer, thời gian, lý do và lịch sử; cạnh tranh chỉ có một quyết định cho một yêu cầu.
- **SC-004**: Không có badge VERIFIED chỉ từ upload, tự khai hoặc lịch sử đã học; approval cũ vẫn hiệu lực khi submit file mới.
- **SC-005**: Tìm kiếm hiển thị trong 1 giây ở ít nhất 95% lần đo trên tập nghiệm thu 10.000 skill/100.000 Sharing Skill (mục tiêu kiểm chứng feature, không phải SLA sản phẩm mới).

## Assumptions

- Phạm vi backend: catalog + sharing + search/public profile + evidence/Staff Verification. Giữ ưu tiên Must/Should của SRS; P1 ở đây là thứ tự triển khai nội bộ.
- Skill/slug chuẩn đóng vai trò tag trong lượt này; taxonomy alias/multi-tag/category CRUD không cần thiết cho luồng Must, tách feature nếu sản phẩm cần.
- FR-SK-07 chỉ hoàn thành bước xem profile; gửi lời mời/Proposal và chống spam thuộc feature kết nối tiếp theo. FR-SK-05 Should chỉ có handoff.
- Sửa mô tả/level thông thường giữ VERIFIED theo SK-002. Chính sách thay đổi trọng yếu chưa chốt: không triển khai tự động revoke; moderation thủ công có reason/audit là đường thu hồi.
- Batch approve/reject và quy tắc tổng hợp FR-009 là thiết kế thực hiện VER-006; không đặt điều kiện chứng chỉ/chuyên môn mới ngoài việc reviewer quyết định.

## Requirement Traceability

SRS hiện hành: `docs/SRS_SkillHub_V1.6_VietLai_DongBoNghiepVu.docx`, mục 6.2, 6.3, 8.1, 18.8, 18.9, 18.24; BR-02..06. Giới hạn file từ quyết định User nêu trên.

| Nguồn                                | Yêu cầu feature    | Phạm vi                                |
| ------------------------------------ | ------------------ | -------------------------------------- |
| FR-SK-01/02, SK-001..004             | FR-002/003/009     | Implement                              |
| FR-SK-03/04, BR-03..06, VER-001..007 | FR-005..012        | Implement                              |
| FR-STF-01..04                        | FR-007/008/010/012 | Implement                              |
| FR-SK-06, FR-PRO-03                  | FR-004/012         | Implement                              |
| FR-SK-07                             | FR-004             | Profile implemented; Proposal deferred |
| FR-SK-05                             | FR-013             | Handoff tới Learning Path              |
| FR-ADM catalog, CAT-001..003         | FR-001/003/007     | Implement                              |
