# Uy tín và xác nhận chính sách khi bị hạn chế

## Nguồn và phạm vi

Đối chiếu backend `ReviewsService.reputation`,
`RestrictionReviewsController.acknowledgePolicy`,
`ReputationService.acknowledgePolicy` và `effectiveRestriction`; adapter mobile
ở `features/community/api/community-api.ts`. Chưa nghiệm thu deployment hoặc
tài khoản thật. Không sửa backend.

## API mobile dùng

| Method/path | Kết quả |
| --- | --- |
| GET `/reputation/me?cursor=UUID` | reputationScore, level, activeRestrictions, policyNotice, restrictionReviews, items, nextCursor |
| POST `/reputation/restrictions/policy-acknowledgement` | Không body; receipt `{ acknowledged: true }` |

API dùng identity/session runtime hiện có. History phải đúng owner và cursor
theo dòng cuối. `policyNotice` là mảng quy tắc không rỗng hoặc null; backend
cũ thiếu field được giữ là undefined, không giả định đã xác nhận.
`restrictionReviews` nhận scope Staff/Admin, decision APPROVED hoặc
FOLLOW_UP_REQUIRED hoặc null, reviewedAt nullable.

## Điều kiện và tương tác

- Khi vào `/requests/new`, GET Uy tín phải thành công mới trong lần mở màn
  trước khi cho soạn. Kiểm activeRestrictions có scope ALL, CREATE_NEW_ACTIVITY
  hoặc learning-request:create; không dùng ngưỡng điểm local hay cache có từ
  trước. Có hạn chế thì hiển thị lý do, thời hạn và bước xác nhận ngay trước
  form; read lỗi cho tải lại, không gửi POST tạo thử. Nếu đã cho soạn rồi quyền
  đổi, giữ form mounted/draft và khóa lưu tới khi đọc lại hợp lệ. Sửa bài đã có
  tiếp tục theo quyền/state của Request riêng.
- GET Uy tín chỉ là kiểm tra sớm hạn chế, không phải endpoint readiness đầy đủ
  cho mọi quyền/quota/điều kiện đăng bài. Create/publish vẫn kiểm lại ở server.

- Điều khoản đăng ký khác với xác nhận chính sách của một đợt hạn chế. Mobile
  chỉ cho xác nhận khi GET trả `policyNotice`.
- BE hiện đặt policyRequired cho hạn chế 3 ngày do LOW_REPUTATION. Hạn chế
  còn hiệu lực khi chưa hết thời gian hoặc còn thiếu xác nhận bắt buộc.
  Tăng điểm/xác nhận không rút ngắn thời hạn. Không tự mở quyền theo điểm
  cached hoặc đồng hồ thiết bị.
- Khi create/publish trả `403 NEW_ACTIVITY_RESTRICTED`, giữ form và tự mở hộp
  thoại. Đóng/mở lại không gửi POST. Mục Uy tín luôn hiển thị chính sách còn
  thiếu và cho xác nhận ngay cả khi chưa hết hạn.
- Chỉ nút “Tôi đã đọc và hiểu chính sách” gửi POST. Preflight GET kiểm lại nội
  dung; nội dung đổi yêu cầu đọc/nhấn lại. Chặn nhấn trùng, focus/owner/session
  cũ; không replay sau renewal/reconnect.
- Sau POST thành công, giữ receipt và đọc lại Uy tín. Đọc lỗi sau khi ghi
  thành công chỉ cho retry GET. POST mất phản hồi yêu cầu kiểm tra trước khi
  người dùng chủ động xác nhận lại; không tự replay POST.
- Receipt không che yêu cầu xác nhận mới: sau một GET thành công đọc lại
  trạng thái chính, nếu server vẫn/trở lại có `policyNotice`, hiện lại nút để
  người dùng chủ động xác nhận, kể cả nội dung quy tắc không đổi. Cache cũ,
  GET lỗi và tải thêm trang lịch sử không đủ để xóa receipt thành công.
- GET mới quyết định còn hạn chế hay đã hết. Ngày đã qua mà còn policyNotice
  được ghi rõ cần xác nhận. Còn restriction không đồng nghĩa đã được mở quyền
  dù ngày đã qua. Tại deadline, màn focus/foreground đọc lại một lần;
  focus/resume, mở lại hộp thoại và làm mới Uy tín tiếp tục dùng trạng thái server.
- Khi backend không còn ghi nhận hạn chế tạo Request, người dùng chủ động
  lưu/đăng lại. Không tự gửi bài. Draft giữ trong route/session hiện có,
  không cam kết khôi phục sau đóng app.

## Giao diện xác nhận

Hộp thoại dùng Nunito và typography/theme hiện có; điểm uy tín, lý do/thời hạn
và quy tắc tách thành nhóm gọn. Nội dung dài cuộn, nút xác nhận ghim ở cuối.
Không có nút Đóng dưới cùng hoặc nút Kiểm tra lại trạng thái. Dấu × đóng hộp
thoại khi không pending; khi có lỗi, feedback hiện Thử lại để chỉ tải GET.
`InfoModal` hỗ trợ footer tùy chọn và ẩn action mặc định cho hộp thoại này.

## Màn lịch sử uy tín

Đường vào: Hồ sơ → Uy tín → Lịch sử điểm & vi phạm. Shortcut Uy tín trên Hồ sơ
dùng `appRoutes` tới `/reputation`; lịch sử ở `/reputation/history`.

Hiển thị điểm hiện tại và các sự kiện đã tải theo ngày, dùng Nunito/token của
app. Mỗi dòng có lý do, mức tăng/giảm, điểm trước → sau và giờ ghi nhận; không
thay thứ tự hoặc tự tính điểm tài khoản từ lịch sử phân trang. Unknown reason
dùng nhãn Điều chỉnh uy tín. Chỉ hiện Xem thêm lịch sử khi có cursor; không có
nút làm mới, Danh hiệu, Báo cáo hoặc xác nhận chính sách trên màn lịch sử.
Màn Uy tín chính giữ link sang lịch sử và phần xử lý hạn chế. Auto focus/resume,
kéo làm mới và retry GET khi lỗi tiếp tục hoạt động.

## Giới hạn

Endpoint xác nhận áp dụng các hạn chế cần policy hiện tại, không có expected
version/ID của đợt hạn chế. Preflight giảm tình huống nội dung stale, không thay
bảo đảm transaction phía server. Recovery missions và thao tác xét duyệt
Staff/Admin nằm ngoài bản sửa này; mobile chỉ hiển thị kết quả xem xét đã có.
