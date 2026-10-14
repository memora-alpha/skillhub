# Feature Specification: Session và đổi lịch trên mobile

**Feature Branch**: `feat/mobile-session`

**Created**: 2026-10-14

**Status**: Đã triển khai phần mobile có contract; đổi lịch thật và nghiệm thu API/native còn Pending. Xem [tasks](tasks.md) và [validation](validation.md).

**Input**: Làm Session trước, gồm đổi lịch; spec gọn để triển khai nhanh, LiveKit làm riêng.

Nguồn nghiệp vụ: [SRS V1.6](../../../../docs/SRS_SkillHub_V1.6_VietLai_DongBoNghiepVu.docx),
mục 6.7, 18.19, 18.33, FR-SCH-04, FR-SES-07 và AC-07; đối chiếu
[domain rules](../../docs/domain-rules.md) và [state machines](../../docs/state-machines.md).
[Checkpoint tích hợp](contracts.md) ghi source hiện có và dependency; không thay thế nghiệp vụ.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Xem lịch buổi học (Priority: P1)

Người dùng xem các buổi mình dạy hoặc học theo tháng/ngày trong Lịch học.

**Why this priority**: Là điểm vào chính để biết lịch tài khoản thật.

**Independent Test**: Mở lịch với tài khoản có và không có buổi học.

**Acceptance Scenarios**:

1. **Given** tài khoản có buổi học, **When** mở tháng/ngày tương ứng, **Then** thấy đúng buổi, vai trò, thời gian và trạng thái hiện hành.
2. **Given** khoảng ngày không có buổi học, **When** xem lịch, **Then** thấy trạng thái trống và có thể chọn khoảng khác.
3. **Given** tải lịch thất bại, **When** mở lịch, **Then** thấy lỗi và thử lại được; không thay bằng lịch mẫu.

### User Story 2 - Xem chi tiết buổi học (Priority: P1)

Người tham gia mở một buổi để xem đối tác, vai trò, thời gian, trạng thái và xác nhận của hai bên.

**Why this priority**: Cung cấp ngữ cảnh trước khi hoàn thành hoặc đổi lịch.

**Independent Test**: Mở một buổi hợp lệ và một liên kết không được phép truy cập.

**Acceptance Scenarios**:

1. **Given** là người tham gia, **When** mở chi tiết, **Then** thấy lịch có hiệu lực, thời lượng, trạng thái, xác nhận của mình/đối tác và thông tin lộ trình/kế hoạch được cung cấp.
2. **Given** buổi không tồn tại hoặc không có quyền xem, **When** mở liên kết, **Then** không lộ dữ liệu và có đường quay lại lịch.

### User Story 3 - Xác nhận hoàn thành (Priority: P2)

Sau khi buổi kết thúc, mỗi người xác nhận phần của mình và theo dõi xác nhận của đối tác.

**Why this priority**: Ghi nhận đã học đúng nghiệp vụ mà không tự kết toán Credit.

**Independent Test**: Dùng hai tài khoản tham gia một buổi đã kết thúc.

**Acceptance Scenarios**:

1. **Given** buổi đã kết thúc và được phép xác nhận, **When** một người xác nhận, **Then** thấy đã xác nhận phần mình và chờ đối tác; buổi chưa được coi là hoàn thành.
2. **Given** cả hai đã xác nhận, **When** tải lại, **Then** hiển thị hoàn thành theo hệ thống; không thông báo Credit đã được settlement theo buổi.
3. **Given** buổi chưa kết thúc, bị hủy hoặc bị chặn bởi dispute, **When** thao tác, **Then** không báo xác nhận thành công và hiển thị lý do từ hệ thống.

### User Story 4 - Đề xuất và xác nhận đổi lịch (Priority: P2)

Từ chi tiết buổi học, người tham gia đề xuất ngày/giờ mới; hai bên xem và xác nhận cùng phiên bản.

**Why this priority**: Cho phép điều chỉnh buổi đã có, không mở rộng sang tạo lịch ban đầu.

**Independent Test**: Hai tài khoản đề xuất, mở lại đề xuất và xác nhận; kiểm tra cả trước và sau cutoff.

**Acceptance Scenarios**:

1. **Given** buổi được phép đổi lịch, **When** gửi ngày/giờ hợp lệ, **Then** thấy đề xuất chờ xác nhận; lịch cũ vẫn có hiệu lực.
2. **Given** có đề xuất chờ, **When** mỗi bên mở lại buổi, **Then** xem được lịch cũ, lịch đề xuất, phiên bản và xác nhận của từng bên.
3. **Given** cả hai xác nhận cùng phiên bản ít nhất 60 phút trước giờ bắt đầu lịch đang có hiệu lực, **When** hệ thống chấp nhận, **Then** lịch và chi tiết cùng hiển thị giờ mới sau khi tải lại.
4. **Given** thiếu xác nhận, quá cutoff, trùng lịch hoặc phiên bản cũ, **When** gửi/xác nhận, **Then** không coi lịch mới đã có hiệu lực; giữ lịch cũ và hiển thị trạng thái/lỗi được hệ thống cung cấp.

### Edge Cases

- Buổi đi qua nửa đêm hoặc người dùng đổi timezone: ngày, giờ và bộ lọc phải thống nhất.
- Còn đúng 60 phút đến giờ cũ: thuộc ranh giới được phép; thời gian hệ thống quyết định, không tin tuyệt đối đồng hồ thiết bị.
- Đề xuất thay đổi khi đang xem: tải lại và yêu cầu xem phiên bản mới trước khi xác nhận.
- Mất mạng/timeout sau khi gửi: không báo thành công hoặc tự gửi lại; kiểm tra trạng thái hiện hành trước khi cho thử lại.
- Đăng xuất/đổi tài khoản trong khi tải hoặc gửi: không hiển thị dữ liệu hay áp dụng kết quả của tài khoản cũ.
- Không đọc được đề xuất hoặc chưa có đủ thông tin xác nhận: báo chức năng chưa khả dụng, không suy ra từ dữ liệu cục bộ.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Chỉ hiển thị buổi của tài khoản hiện tại; danh sách hỗ trợ chọn tháng/ngày và mở chi tiết.
- **FR-002**: Chi tiết hiển thị vai trò dạy/học, đối tác khi có dữ liệu, thời gian có timezone, thời lượng, trạng thái và xác nhận hai bên; không bịa tên hoặc nội dung thiếu.
- **FR-003**: Dùng trạng thái do hệ thống cung cấp, không tự chuyển READY/ONGOING/COMPLETED từ đồng hồ hoặc thao tác mở màn hình.
- **FR-004**: Cho người tham gia xác nhận hoàn thành sau khi buổi kết thúc và được hệ thống cho phép; đã xác nhận thì không khuyến khích gửi lại.
- **FR-005**: Chỉ hiển thị hoàn thành sau khi hệ thống ghi nhận đủ hai xác nhận; không tự thay đổi Credit hoặc suy ra toàn lộ trình đã hoàn thành.
- **FR-006**: Cho người tham gia đề xuất đổi ngày/giờ của buổi được phép đổi; lịch đề xuất ở tương lai và thời lượng 60–180 phút. Không đổi số buổi, người tham gia hoặc thỏa thuận Credit trong luồng này.
- **FR-007**: Hiển thị lịch cũ và đề xuất riêng, phiên bản hiện hành và xác nhận từng bên; chỉ xác nhận đúng phiên bản đang được xem. Gửi đề xuất không được mặc định là đã xác nhận.
- **FR-008**: Lịch mới chỉ có hiệu lực khi cả hai xác nhận cùng phiên bản trước giờ bắt đầu lịch đang có hiệu lực ít nhất 60 phút và được hệ thống chấp nhận. Thiếu xác nhận/quá hạn giữ lịch cũ.
- **FR-009**: Tải lại dữ liệu liên quan sau thao tác; lỗi phiên bản, trùng lịch, cutoff và quyền truy cập có thông báo dễ hiểu, không báo thành công giả.
- **FR-010**: Có loading, empty, error/retry; giữ thông tin form khi lỗi, chặn bấm gửi lặp và không tự phát lại thao tác khi nối mạng lại.
- **FR-011**: Dữ liệu riêng và kết quả đang chờ phải gắn với tài khoản hiện tại; lỗi tải dữ liệu thật không được âm thầm thay bằng mock.
- **FR-012**: Back trở về nơi mở buổi; nếu không có lịch sử thì về Lịch học. Các thao tác có nhãn rõ và dùng được trên Android/iOS.

### Key Entities _(include if feature involves data)_

- **Session**: Buổi thuộc Learning Path/Plan, hai vai trò dạy/học, giờ bắt đầu/kết thúc, trạng thái và xác nhận hoàn thành từng bên.
- **Đề xuất đổi lịch**: Phiên bản lịch mới cho buổi đã có, lịch đang có hiệu lực, thời gian đề xuất và xác nhận từng bên.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Với bộ dữ liệu nghiệm thu ở hai timezone, 100% buổi hiển thị đúng thời gian, vai trò và ngày lọc; mở chi tiết chỉ cần chọn một buổi từ danh sách.
- **SC-002**: Trong tất cả kịch bản hoàn thành, một xác nhận không làm buổi thành COMPLETED; đủ hai xác nhận hiển thị đúng kết quả hệ thống sau khi tải lại.
- **SC-003**: Trong tất cả kịch bản đổi lịch hợp lệ, thiếu xác nhận, quá cutoff và phiên bản cũ, giờ có hiệu lực luôn đúng sau khi mở lại bằng cả hai tài khoản.
- **SC-004**: Tất cả kịch bản lỗi, bấm lặp và đổi tài khoản không báo thành công giả, không làm lộ dữ liệu tài khoản trước; kết quả Android và iOS được ghi riêng với bản xem thử web.

## Assumptions

- Scope gồm đúng bốn luồng trên trong `apps/mobile`, giữ nhánh hiện tại và tái sử dụng giao diện/hạ tầng đã có. Không thay đổi backend hoặc spec 005.
- Ngoài scope: LiveKit/phòng gọi, tạo lịch ban đầu, sửa Learning Path/Plan, hủy/no-show, report/dispute mới, settlement và notification. Chỉ hiển thị trạng thái liên quan đã có.
- Backend quyết định quyền, thời gian, phiên bản, xung đột và kết quả. Không đặt completion timeout hoặc tự xử lý khi đối tác không phản hồi.
- Đổi lịch đầu cuối cần đọc được đề xuất hiện hành sau khi tải lại bằng cả hai tài khoản; source hiện tại chưa cung cấp đủ. Đây là dependency tích hợp, không phải lý do mở rộng mobile sang backend.
- Spec xác định hành vi đích. Checklist chất lượng không chứng minh đã implement hoặc nghiệm thu; kiểm chứng thật cần buổi đã tạo/khóa lịch hợp lệ và hai tài khoản tham gia.
