# Gỡ đăng ký bị giữ sau lỗi thanh toán

Trạng thái: đề xuất cần xác nhận phạm vi backend; chưa triển khai endpoint.

## Vấn đề đã xác minh

Người dùng thấy ví chưa bị trừ Credit nhưng thẻ tiếp tục đăng ký vẫn giữ và chặn
mua mới. Mobile giữ intent khi chưa xác định kết quả do lỗi mạng, 5xx hoặc phản hồi
không hợp lệ. Chưa xác nhận loại lỗi của lần bấm hiện tại; log 500 trước đó từ lịch sử
console bị ẩn endpoint, chưa đối chiếu timestamp. Đọc số dư hoặc membership chưa xác định được kết quả
của đúng yêu cầu đó, nhất là khi request cũ còn xử lý.

Subscription hiện chưa có lookup. Voucher đã có `/rewards/redemptions/lookup`;
backend có `IdempotencyService.retire` để chờ giao dịch đang chạy và khóa một key
chưa thực hiện, ngăn request đến muộn tiếp tục thu tiền.

## Thay đổi đề xuất để duyệt

- Bổ sung `POST /me/subscription/lookup`, quyền `subscription:manage:self`,
  body `{ kind: "purchase" | "upgrade", key: UUID }`, luôn scope theo user đăng nhập.
- Lookup không mua/nâng cấp và không thu Credit. Dùng cơ chế retire/transaction
  hiện có, chờ request đang xử lý; đối chiếu idempotency record và charge đúng key.
- Trả `COMPLETED` cùng `chargeId`, `subscriptionId` khi đã thanh toán; mobile xóa
  intent đúng key, làm mới gói/ví/lịch sử và bỏ thẻ.
- Chỉ trả `NOT_PROCESSED` sau khi xác minh chưa có charge và retire key thành công.
  Mobile xóa intent đúng key và mở lại chọn gói/xác nhận mua với một key mới.
- Timeout, lỗi API, record không nhất quán hoặc lỗi xóa local giữ trạng thái chưa
  rõ; không coi là chưa thu tiền. Request cũ đến muộn phải bị từ chối sau retire.
- Đổi nút recovery thành **Kiểm tra thanh toán**: người dùng chủ động kiểm tra,
  không tự POST lúc vào màn/reconnect, không tự gửi lại giao dịch thu tiền.
- Trước khi quy lỗi cho BE, bắt request mới để xác định HTTP status và lỗi parse
  thực tế; lookup không thay thế việc điều tra/sửa lỗi mua gói hiện tại.

## Kiểm chứng cần có

Charge đã commit nhưng response mất; transaction rollback không charge; lookup
đua với POST đang chạy/đến muộn; lookup lặp; key của user khác; lỗi lookup/lỗi local
cleanup; đổi phiên khi phản hồi về. Chỉ mở mua mới sau kết quả `NOT_PROCESSED`
đã được backend xác nhận và key cũ đã retire.
