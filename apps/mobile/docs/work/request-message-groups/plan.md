# Tin nhắn theo Yêu cầu học

## Phạm vi

Triển khai trong `apps/mobile` trên nhánh `feat/mobile-proposal-chat-groups`, tạo từ
`dev` ở `42cbc1bb`. Không đổi backend hoặc schema nghiệp vụ.

Người dùng xác nhận nhóm cha là **Learning Request**. Một bài có nhiều Proposal
từ các đối tác; mỗi Proposal được chấp nhận vẫn gắn với một Conversation riêng.
Không chuyển Proposal thành nhóm nhiều người hoặc trộn tin nhắn giữa các đối tác.

## Thiết kế và hành vi

- Inbox gom các cuộc chat và đề xuất nhận được theo UUID của bài Yêu cầu học.
  Bài chỉ có đề xuất đã từ chối vẫn có entry lịch sử. Inbox chia hai tab không số:
  Theo yêu cầu học / Trao đổi trực tiếp; lời mời trực tiếp giữ entry conversation
  trong tab riêng. Quản lý đề xuất trực tiếp/đã gửi mở từ nút Đề xuất
  gọn ở header. Bỏ banner Đề xuất và nhãn Cuộc trò chuyện khỏi đầu danh sách.
- Thẻ bài theo [ảnh tham chiếu người dùng](references/inbox-request-cards.png):
  icon tài liệu cam, tên bài, dòng tổng đề xuất nhận được/đoạn chat, tin nhắn gần
  nhất có tên người gửi, chấm chưa đọc và chevron. “Đề xuất nhận được” đếm toàn bộ
  lịch sử (kể cả accepted/rejected/withdrawn/expired), không chỉ pending. Tin gửi
  bởi viewer giữ “Bạn:”, không thêm tên đối tác; SYSTEM không gán tên đối tác.
- Bấm bài mở màn riêng `/messages/request/[id]`, không xổ xuống và không thêm
  nhãn “Theo proposal”. Theme Nunito/nền kem, navigation và tokens của app hiện tại.
- Hai tab: **Đề xuất nhận được** / **Đoạn chat**, không hiển thị số. Dùng pattern
  `ProposalListFilters`: nút viền mảnh, selected nền cam nhạt/chữ cam.
- Nhận được mặc định `PENDING`; bộ lọc hiện tại cho xem `REJECTED`, các trạng thái
  khác và tất cả. Thẻ gọn mở detail/accept/reject hiện có; không tạo mutation mới.
- Đoạn chat liệt kê conversation của bài, theo đối tác. Chat Back về tab này.
  Mỗi cuộc chat giữ lịch sử, read/delivery/outbox và thỏa thuận riêng.
- Danh sách có phân trang. Không kết luận rỗng khi còn trang; không tải preview
  tin nhắn của bài khác khi mở một bài cụ thể. Số còn thiếu trang là cận dưới có
  dấu `+`; chưa có dữ liệu dùng `…`, không khẳng định 0 hoặc tổng chính xác.
- Chỉ người đăng bài đọc danh sách đề xuất nhận được. Dữ liệu cache bị denied
  không được dùng làm bằng chứng sở hữu; participant vẫn mở chat được cấp quyền.
- Tên bài ưu tiên Request detail được phép đọc. Khi detail bị denied/missing,
  dùng kỹ năng từ Proposal liên kết đã authorize và mã bài; không lấy tiêu đề cũ
  từ cache. Mã nằm riêng ở mép thẻ để không bị cắt cùng tên dài. Lỗi/chờ tải chưa
  có kỹ năng cũng có mã phân biệt, không cùng rơi về nhãn “Yêu cầu học”.
- Kéo làm mới Inbox tải lại các Request detail đang được quan sát trong đúng
  phiên người dùng, giúp khôi phục tiêu đề sau lỗi mạng. Không refetch toàn bộ
  feed/list hoặc dữ liệu của tài khoản khác để sửa một tên bài.
- Tối ưu tên bài: query trang `mine` trước preview, tái sử dụng owner projection
  trong cache đúng phiên để không GET detail từng bài đã có tên. Khi trang mine
  đang cập nhật thì không phát đồng thời các GET detail dư thừa. Inbox chỉ làm
  mới detail còn thiếu/stale, hủy transport khi blur; các consumer detail cũ giữ
  chế độ đọc mặc định. Bài ngoài trang mine vẫn dùng detail được authorize.

Nguồn đối chiếu: thiết kế tham khảo và các điều chỉnh người dùng trong chat
2026-11-02; [hướng dẫn UI](../../guides/ui-and-styling.md),
[contract](../../contracts/proposal-learning-agreement.md),
[work thỏa thuận](../phase-05-proposal-learning-agreement/plan.md).

## Tasks

- [x] Đối chiếu schema/adapter và xác nhận nhóm theo Learning Request.
- [x] Group Inbox, route và hai tab theo theme hiện tại.
- [x] Nhận được có lọc trạng thái và thẻ gọn; giữ detail/accept/reject.
- [x] Lọc conversation, bảo toàn phân trang/quyền và Back vào đúng bài.
- [x] Hoàn tất regression, lint/types/structure, export web và review diff.
- [x] Đồng bộ thẻ Inbox theo ảnh và đếm toàn bộ lịch sử theo xác nhận người dùng.
- [x] Phân biệt nhóm khi không đọc được tiêu đề và retry tên qua pull refresh.
- [x] Giảm N+1 detail tên bài, reuse cache mới và nối AbortSignal tới HTTP.
- [x] Dùng Inbox của BE cho metadata nhóm và lọc chat/đề xuất đã gửi theo bài.
- [x] Hiện danh sách từ API nhóm, chỉ tải preview/profile cho hàng đang thấy và đọc tin nhắn song song với detail khi mở chat.
- [x] Tách logic nhóm/vai trò và các biểu thức lồng nhau trong danh sách cảnh báo Sonar của Inbox/Proposal.
- [x] Tách hai loại Inbox theo tab, giữ phân trang chung của BE, chỉ tải preview đúng tab và Back từ direct chat về tab trực tiếp.
- [ ] Nghiệm thu UI/API/native trên Android/iOS với hai tài khoản test.
