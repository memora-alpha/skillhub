# Feature Specification: Credit & Payment

**Feature Branch**: `feat/credit-payment`

**Created**: 2026-10-15

**Status**: Draft — đặc tả nền tảng; các nhánh cần policy/provider trong [policies.md](policies.md) chưa được bật.

**Input**: “Bắt đầu sử dụng speckit để plan phần tiếp tục : credit & payment”.

## User Scenarios & Testing _(mandatory)_

### User Story 1 — Xem ví và lịch sử giải thích được (Priority: P1)

User xem Credit khả dụng, đang giữ và giao dịch của chính mình; mỗi thay đổi có nguồn nghiệp vụ và số dư sau giao dịch.

**Why this priority**: Người dùng cần biết số dư có thể sử dụng và lý do khoản Credit bị giữ trước khi nạp hoặc chốt học.

**Independent Test**: Với ví có lịch sử nạp/giữ/hoàn thành, đối chiếu từng biến động với số dư; người khác không đọc được ví hoặc giao dịch.

**Acceptance Scenarios**:

1. **Given** User đã xác thực, **When** mở ví/lịch sử, **Then** xem đúng Available/Held với hai chữ số thập phân, nguồn và thời gian; không xuất hiện khả năng rút tiền.
2. **Given** User chưa có ví và chưa có lịch sử, **When** mở ví, **Then** nhận số dư 0 và lịch sử rỗng; không được tạo Credit tặng ngầm.
3. **Given** nhiều giao dịch cùng thời điểm, **When** chuyển trang, **Then** thứ tự ổn định, không bỏ sót/trùng trong cùng phạm vi ảnh chụp lịch sử.
4. **Given** một giao dịch của người khác, **When** cố đọc chi tiết, **Then** không lấy được dữ liệu tài chính đó.

### User Story 2 — Nạp và theo dõi kết quả chính xác (Priority: P1)

User tạo yêu cầu nạp VND, nhận hướng dẫn thanh toán của cổng được hỗ trợ và theo dõi trạng thái. Chỉ kết quả được backend xác minh mới cộng Credit.

**Why this priority**: Đây là nguồn Credit mua của sản phẩm; cộng thiếu hoặc hai lần đều gây sai lệch ví.

**Independent Test**: Thanh toán 100.000 VND thành công tạo đúng 100,00 Credit; gửi lại kết quả nhiều lần vẫn chỉ có một lần cộng.

**Acceptance Scenarios**:

1. **Given** cổng và cấu hình nạp đã được duyệt/bật, **When** User nạp 100.000 VND, **Then** yêu cầu lưu số tiền và tỷ lệ 1.000 VND/Credit; Credit được tính từ số tiền bởi backend.
2. **Given** yêu cầu chưa được xác minh, **When** trình duyệt chuyển về trang thành công, **Then** ví không tăng chỉ vì điều hướng đó.
3. **Given** kết quả thành công xác thực và khớp đơn/số tiền/VND/tài khoản merchant, **When** ghi nhận, **Then** Payment thành công, ví và lịch sử cùng được lưu hoặc cùng rollback.
4. **Given** cùng giao dịch cổng được gửi lại hoặc gán cho đơn khác, **When** xử lý đồng thời, **Then** không cộng lần thứ hai, không chuyển người nhận.
5. **Given** sự kiện sai thông tin xác thực cổng, sai số tiền hoặc đơn không xác định, **When** nhận, **Then** không cộng Credit và có dấu vết vận hành an toàn để điều tra.
6. **Given** kết quả đến muộn hoặc trạng thái mâu thuẫn, **When** chưa thể xác định kết quả chắc chắn, **Then** giữ hồ sơ đối soát; không tự đánh dấu đã trả tiền hay xóa bằng chứng.
7. **Given** SePay chưa được bật hoặc chưa đủ cấu hình, **When** yêu cầu nạp, **Then** trả trạng thái dịch vụ chưa sẵn sàng; đọc ví/lịch sử vẫn dùng được.

### User Story 3 — Giữ, giải phóng và quyết toán đúng thỏa thuận (Priority: P1)

Người tham gia chỉ bị giữ Credit khi các điều kiện thỏa thuận/lộ trình/lịch đã đủ; nhận kết quả quyết toán theo loại trao đổi sau toàn bộ buổi học và kiểm tra dispute.

**Why this priority**: Phần này kế thừa source hiện có nhưng cần chứng minh tính nguyên tử và không chi tiêu trùng với nạp/điều chỉnh.

**Independent Test**: TWO_WAY giữ 20,00 mỗi người, hoàn 19,20 mỗi người và phí 0,80 mỗi người; ONE_WAY giữ learner 100,00, teacher 0,00 và cuối cùng teacher nhận 96,00, phí 4,00.

**Acceptance Scenarios**:

1. **Given** TWO_WAY hợp lệ, **When** chốt lịch cuối cùng, **Then** Hold cả hai ví, khóa các lịch bắt buộc và tạo Session cùng thành công; một ví thiếu tiền khiến toàn bộ rollback.
2. **Given** ONE_WAY hợp lệ với negotiatedCredit > 0, **When** chốt, **Then** chỉ learner bị Hold; không yêu cầu teacher có 20 Credit.
3. **Given** mới xong một phần Session hoặc có dispute chặn, **When** yêu cầu quyết toán, **Then** Credit vẫn Held và chưa ghi nhận thu nhập/phí cuối thỏa thuận.
4. **Given** mọi Session bắt buộc đã hoàn tất và được phép quyết toán, **When** retry hoặc yêu cầu đồng thời, **Then** chỉ có một kết quả; tổng hoàn/thu nhập cộng phí bằng chính khoản Held.
5. **Given** quyết định giải phóng Held đã được owner có thẩm quyền phê duyệt, **When** thực thi, **Then** chỉ giải phóng phần còn lại đúng allocation một lần, có lịch sử và lý do; không tự đặt tỷ lệ hủy/no-show.
6. **Given** người dùng đang thương lượng Proposal/Chat, **When** accept Proposal, **Then** không phát sinh Hold hay Session.

### User Story 4 — Quản trị có đối soát và trách nhiệm (Priority: P2)

Admin có quyền xem đối soát và điều chỉnh sai lệch bằng bút toán mới có lý do, tham chiếu và nhật ký; không sửa giao dịch thành công cũ.

**Why this priority**: Cần hỗ trợ xử lý sai lệch mà vẫn truy được nguồn tiền và người thực hiện.

**Independent Test**: Admin điều chỉnh có reason/reference chỉ một lần; User/Staff thiếu quyền bị từ chối; lỗi lưu audit khiến cả thay đổi số dư thất bại.

**Acceptance Scenarios**:

1. **Given** Admin có quyền hiện hành, **When** điều chỉnh Available với lý do/tham chiếu, **Then** số dư, bút toán và nhật ký cùng được lưu; Held không bị sửa bởi điều chỉnh Available.
2. **Given** cùng yêu cầu được thử lại, **When** quyền hiện tại vẫn hợp lệ, **Then** trả kết quả cũ; cùng mã yêu cầu nhưng nội dung khác bị từ chối.
3. **Given** tổng ví/lịch sử/allocation không khớp, **When** chạy đối soát, **Then** tạo phát hiện có tham chiếu; không tự sửa số dư hoặc sửa lịch sử.
4. **Given** giao dịch đã thành công, **When** xử lý đảo hợp lệ, **Then** ghi giao dịch đối ứng liên kết bản gốc theo policy được duyệt; không cho rút tiền hay chuyển Credit tùy ý.

### Edge Cases

- Hai lệnh Hold/adjustment cùng dùng một số dư; nạp đồng thời với settlement; teacher cũng là chủ một allocation khác.
- Ví chưa tồn tại khi hai lệnh đầu tiên đến; dữ liệu ví/ledger lịch sử mâu thuẫn; khoản tiền vượt miền giá trị.
- Timeout tạo order: cổng đã tạo nhưng API chưa nhận phản hồi; retry phải tra cứu theo mã đơn cũ.
- Callback lặp, đến đảo thứ tự, khác event nhưng cùng gatewayTransactionId; success đến sau expiry hoặc failure; cổng trả kết quả không xác định.
- Crash sau nhận webhook, trước/sau commit, trước ACK hoặc trước phát thông báo; audit/outbox không ghi được.
- Số VND quy đổi không biểu diễn chính xác với 0,01 Credit; fee của khoản rất nhỏ bằng 0; không chuyển qua số thực nhị phân.
- Account bị khóa sau khi đã trả tiền: không tạo đơn mới, vẫn bảo toàn hồ sơ và quyền lợi của giao dịch đã xác minh; access được kiểm tra riêng.
- Dispute và settlement tranh cùng thỏa thuận; release retry sau settlement hoặc vượt phần Held còn lại.
- Điều chỉnh âm vượt Available; phản hồi HTTP chứa giá trị quá giới hạn số nguyên an toàn; cursor bị đổi bộ lọc/chủ ví.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Hiển thị Available/Held và lịch sử/chi tiết thuộc ví hiện tại; phân trang ổn định và không lộ dữ liệu người khác.
- **FR-002**: Credit chính xác tới 0,01; VND là số nguyên; mọi số tiền có thể truy vết nguồn, không tự làm tròn số tiền nạp không biểu diễn được.
- **FR-003**: Mọi biến động số dư có bút toán với thay đổi Available/Held, số dư sau và tham chiếu nghiệp vụ; lịch sử thành công không bị sửa/xóa.
- **FR-004**: Tạo yêu cầu nạp theo cổng/cấu hình được bật; tính Credit tại backend theo snapshot 1.000 VND = 1 Credit; không nhận creditAmount do client quyết định.
- **FR-005**: Chỉ cộng tiền sau xác minh kết quả cổng và đối chiếu đầy đủ danh tính đơn, merchant, số tiền, tiền tệ; redirect không phải bằng chứng.
- **FR-006**: Payment thành công, cộng ví, bút toán và bằng chứng xử lý được ghi nguyên tử; cùng giao dịch cổng không cộng cho hai đơn.
- **FR-007**: Yêu cầu nạp/điều chỉnh/thao tác tài chính retry an toàn; cùng mã và nội dung trả lại cùng kết quả, mã cũ với nội dung khác bị từ chối.
- **FR-008**: Có trạng thái chờ/không rõ kết quả, khôi phục và đối soát; ghi nhận trễ hoặc mâu thuẫn không làm giảm trạng thái PAID hay tạo Credit ngầm.
- **FR-009**: TWO_WAY Hold >=20 Credit/User/thỏa thuận; ONE_WAY chỉ Hold negotiatedCredit >0 của learner. Giữ nguyên điều kiện xác nhận và rollback lịch/Session.
- **FR-010**: Chỉ quyết toán một lần sau toàn bộ Session hoàn thành, không có dispute chặn; TWO_WAY hoàn chính holder, ONE_WAY trả teacher; phí 4%, tổng bảo toàn theo policy precision đã duyệt.
- **FR-011**: Giải phóng/hoàn/phạt theo quyết định owner và policy đã chốt, không vượt allocation và không quyết toán lại phần đã giải phóng; không tự đặt cancellation/no-show policy.
- **FR-012**: Adjustment chỉ theo quyền hiện hành, có reason/reference/audit; không gây Available/Held âm, không sửa giao dịch cũ hoặc rút tiền.
- **FR-013**: Đối soát Payment ↔ TOP_UP, ví ↔ ledger, Held ↔ allocations và phí ↔ settlement; chỉ phát hiện sai lệch, không auto-repair.
- **FR-014**: Thông báo thay đổi chỉ phản ánh giao dịch đã commit, phát lại không nhân đôi, không lộ số tiền/thông tin cổng cho người không liên quan.
- **FR-015**: Daily/Feedback bonus, quyền đọc của Staff, refund/cancel/no-show và cổng thật chỉ mở khi policy/tích hợp tương ứng hoàn tất; chính sách chưa chốt có trạng thái rõ ràng trong policies.md.
- **FR-016**: Không cung cấp withdrawal/cash-out, chuyển Credit tùy ý hoặc tự dùng phí học 4% cho PAID material.

### Key Entities

- **CreditWallet**: Ví của User, Available/Held và phiên bản chống ghi đè.
- **CreditOperation / CreditTransaction**: Một nghiệp vụ và các bút toán bất biến của nó; liên kết nạp/thỏa thuận/điều chỉnh/đảo.
- **HeldCreditAllocation**: Phần Credit đang giữ theo thỏa thuận đã khóa, chủ ví, người thụ hưởng, số còn lại.
- **Payment**: Yêu cầu nạp VND, Credit/tỷ lệ đã chốt, cổng, tham chiếu duy nhất, trạng thái và kết quả xác minh.
- **PaymentReceipt / ReconciliationFinding**: Bằng chứng nhận/xử lý sự kiện cổng và sai lệch cần đối soát, có trạng thái khôi phục.
- **FeePolicyVersion**: Công thức/làm tròn đã duyệt và snapshot gắn với thỏa thuận; thay đổi policy không sửa kết quả cũ.
- **Audit record**: Người/hệ thống thực hiện, hành động, lý do và tham chiếu, cùng kết quả tài chính.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 100% giao dịch nạp thành công trong bộ nghiệm thu có đúng một TOP_UP và đúng người nhận; 0 lần cộng từ callback giả/redirect/sai số tiền.
- **SC-002**: Trong mọi ca song song/retry/crash của bộ nghiệm thu, có 0 số dư âm, 0 chi tiêu trùng, 0 kết quả tài chính commit thiếu lịch sử/bằng chứng bắt buộc.
- **SC-003**: Toàn bộ ví/lịch sử fixture đối soát chính xác tới 0,01 Credit; các sai lệch được cài vào fixture đều được phát hiện, không auto-repair.
- **SC-004**: Các ca TWO_WAY/ONE_WAY cho đúng bên nhận và bảo toàn tổng Credit; hoàn thành từng Session không tự giải ngân; dispute chặn thành công trong mọi ca race được kiểm thử.
- **SC-005**: Mọi ca User khác/Staff thiếu quyền/phiên bị thu hồi trong bộ nghiệm thu không đọc hoặc điều chỉnh được tài chính ngoài phạm vi.
- **SC-006**: 95% thao tác đọc ví/lịch sử thông thường hoàn tất trong 2 giây trong tải kiểm thử được ghi nhận; thời gian xử lý của cổng đo riêng.

## Assumptions

- SRS V1.6 là nguồn nghiệp vụ: FR-CR-01..09; mục 10.3, 18.14–18.17, 18.19–18.20, 18.40–18.41; model v3/source chỉ là bằng chứng cấu trúc và hành vi hiện có.
- Phạm vi backend `services/api`; kế thừa identity/permission, transaction/idempotency/audit/outbox/config và SSE. Không sửa frontend/mobile, triển khai cổng thật hoặc di chuyển tiền trong lần plan.
- User xác nhận ngày 2026-10-15: chọn **SePay**. Thiết kế tích hợp chọn Cổng thanh toán one-time checkout/IPN; phương thức BANK_TRANSFER là baseline kỹ thuật, không tự mở thêm thẻ/recurring. SePay merchant/sandbox cần được cấu hình và kiểm thử trước activation.
- User xác nhận ngày 2026-10-15: **làm tròn xuống phí 4% tại đơn vị 0,01 Credit; người nhận lấy phần còn lại**. Fee + net = gross; nếu đổi cần policy version mới.
- Purchased/bonus là các field lịch sử chưa có semantics được chứng minh; không cộng chúng vào Available/Held để hiển thị tổng tiền. Các nhánh cần phân nguồn chờ policy.
- Daily/Feedback bonus, material purchase, dispute adjudication/cancel/no-show và cash refund không thuộc MVP này. Owner contracts phục vụ tích hợp, không cấp quyền tự đặt policy.

## Traceability

| SRS V1.6                         | Phạm vi đặc tả                                                    |
| -------------------------------- | ----------------------------------------------------------------- |
| FR-CR-01, FR-CR-09               | US1, US4; FR-001..003, FR-012..013                                |
| FR-CR-02                         | US2; FR-004..008                                                  |
| FR-CR-03..04                     | US3; FR-009: điều kiện Credit và Hold theo loại trao đổi          |
| FR-CR-05..07; 18.40              | US3; FR-010..011: không settle từng Session, settlement đúng loại |
| FR-CR-08; PAY-005                | FR-016, không cash-out                                            |
| PAY-001..004; CR-001..010        | FR-002..013                                                       |
| 18.41                            | Chỉ ranh giới owner; PAID material/fee policy riêng ngoài MVP     |
| Policy bonus chưa chốt trong SRS | FR-015; gate G04, không tự bật Daily/Feedback reward              |
