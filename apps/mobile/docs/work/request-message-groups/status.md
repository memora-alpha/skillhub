# Trạng thái tin nhắn theo Yêu cầu học

Cập nhật: 2026-11-04T00:31:13+07:00.

**Ready for review — source complete; API/native acceptance pending.**
Nghiệm thu người dùng trên app thật: chưa thực hiện.

## Tích hợp API Inbox của BE

- `GET /conversations/inbox` cung cấp phân trang, thứ tự, tiêu đề, vai trò và tổng số theo nhóm. Lịch sử đề xuất của chủ bài được tính cả khi chưa có chat. Phần mô tả luồng ghép tại mobile bên dưới là hiện trạng trước tích hợp.
- Tab Đoạn chat lọc `GET /conversations` theo `learningRequestId`. Tab Đã gửi lọc `GET /proposals` theo cùng ID và mặc định hiện mọi trạng thái. Tiêu đề và vai trò lấy từ nhóm đã đọc trong phiên hiện tại.
- Thẻ yêu cầu học chỉ hiện tiêu đề, số đếm và chấm cam với nền cam nhạt khi phát hiện tin chưa đọc từ các cuộc chat đã tải. Xem trước từng tin nằm ở tab Đoạn chat. API nhóm chưa trả trạng thái chưa đọc.
- Inbox sắp xếp theo hoạt động gần nhất của BE và dùng giờ tin đã tải nếu mới hơn. Thay đổi trạng thái đã đọc không ảnh hưởng thứ tự.
- Nghiệm thu cần môi trường BE đã áp dụng migration và backfill của PR #68.

## Hiện trạng

- Nhánh `feat/mobile-proposal-chat-groups` từ `dev@42cbc1bb`; chỉ sửa mobile.
- Inbox hợp nhất Conversation và Proposal nhận được theo `learningRequestId`.
  Giữ nhóm chỉ có lịch sử từ chối; lời mời trực tiếp và Đã gửi vẫn truy cập được.
- Thẻ theo [ảnh người dùng](references/inbox-request-cards.png): title, tổng
  đề xuất mọi trạng thái/đoạn chat và preview có tên người gửi. Bỏ giờ trên thẻ,
  banner Đề xuất và nhãn Cuộc trò chuyện; quản lý Đề xuất chuyển thành nút nhỏ
  ở header. Tin outgoing giữ “Bạn:” và SYSTEM không gán tên đối tác.
- Màn `/messages/request/[id]` đã đăng ký trong authenticated stack. Hai tab
  không số, dùng style filter đang có; Nhận được mặc định Chờ phản hồi.
- Bộ lọc trạng thái đọc server, gồm Đã từ chối/Tất cả. Thẻ nhận được dạng gọn,
  mở detail với đúng request context; không thay logic accept/reject/idempotency.
- Tab Đoạn chat chỉ tải previews cho bài đang mở. Mỗi người/conversation giữ ID,
  history, receipt, recovery và workflow. Back từ Chat dùng request ID server.
- Có regression nhóm khác đối tác/cùng đối tác khác bài, rejected-only history,
  outbox failed/unread, route validation, denied/public request, chuyển tab/lọc
  trạng thái và chỉ đọc preview đúng scope.
- Đã bỏ nhãn fallback chung gây nhiều thẻ “Yêu cầu học”: dùng tiêu đề thật khi
  đọc được; denied/missing dùng skill từ Proposal được authorize + mã Request.
  Mã đặt riêng để không bị cắt cùng tên dài. Header thiếu metadata có mã Request.
  Pull refresh retry Request detail active trong phiên hiện tại; hook mới trong
  learning-requests không đổi hành vi các consumer cũ hoặc replay mutation.
- Đã tối ưu N+1 tên bài: trang mine có sẵn title được đọc trước previews, thẻ
  dùng owner snapshot đúng session/version, không GET detail từng bài trong trang
  còn mới. Inbox không ép refetch fresh cache khi focus và có hủy AbortSignal
  khi blur. Pull refresh đọc mine trước rồi chỉ retry detail còn cần thiết.

## Kiểm chứng hiện có

- Focused 16/16 cho title/cache/performance/UI/lifecycle và full mobile 937/937 đạt, không fail/skip/cancel; gồm đếm toàn bộ
  lịch sử, không đếm trùng ID, cận dưới khi chưa đủ trang và attribution preview.
  TypeScript `--noEmit`, ESLint và structure 807 source files đạt. Regression
  Inbox kiểm tiếp trang trước khi báo rỗng; có ca title denied/cache, mã fallback
  và pull refresh đúng active Request detail/owner/session.
- Kiểm thử performance tái hiện 20 tên từ một page mine + 0 GET detail; focus cache
  mới không đọc lại, chỉ ID ngoài page mới GET detail. Có ca stale-list refresh,
  denial/cross-user cache và signal abort transport. Đây là số request trong test,
  chưa có đo latency API production/thiết bị.
- Catalog title là query first-page riêng, không kéo refetch mọi trang mine đã
  browse trước đó. Hết TTL không tự tạo N GET detail: thẻ readonly giữ snapshot
  own hợp lệ và cập nhật qua query mine khi focus/pull/invalidation.
- Expo export web đạt: `.expo/request-chat-export`; log
  `.expo/request-chat-export.log`. Bundle không thay nghiệm thu UI/API/native.
- Full test log ignored: `.expo/request-chat-tests.log`.
- Commands chạy trực tiếp bằng Node với CLI đã cài trong root `node_modules`,
  tương đương scripts mobile. `pnpm exec` tự gọi cài đặt và dừng ở
  `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`; không purge/cài lại dependencies.

## Giới hạn và bước tiếp

- Backend chưa có endpoint group/batch context hoặc filter conversation theo
  request. Mobile dùng API đã có, đọc các trang Conversation rồi lọc theo UUID;
  tên bài dùng Request detail. Còn trang hoặc lỗi đọc thì số có `+`, chưa có số
  dùng `…`; số chính xác chỉ sau khi đọc đủ. Không công bố tổng unread.
- Nguồn chậm trong code: GET detail riêng cho từng thẻ tranh queue GET concurrency4
  với history/profile; GET Request detail backend lấy user row lock và projection
  đầy đủ. Không sửa API/locking. Fast path mine chỉ bao phủ các trang đã có của
  chính chủ; bài ngoài trang hoặc của người khác vẫn cần detail riêng. Backend
  summary/batch context còn cần nếu muốn loại N+1 cho toàn bộ Inbox.
- Với đối tác không còn quyền đọc Request detail, mobile không khôi phục tiêu đề
  gốc của bài đóng/ẩn. Fallback dùng metadata skill còn được phép đọc và mã bài;
  tên gốc trong các trường hợp này cần một authorized summary contract từ backend.
- Chỉ các bài có Proposal nhận được hoặc Conversation trong dữ liệu đã tải có
  mặt trong Inbox; bài chưa có hoạt động tiếp tục thuộc màn Yêu cầu học của tôi.
- Cần nghiệm thu hai tài khoản, nhiều Proposal/cùng bài, lịch sử từ chối, bài
  đóng/private, các trang dữ liệu, Back, chữ lớn và bố cục 320/390px trên thiết bị.
- Chưa commit/push/deploy.
