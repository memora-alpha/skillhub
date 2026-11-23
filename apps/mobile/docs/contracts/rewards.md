# Voucher mobile

Đối chiếu controller, DTO và service tại BE commit `090a1386` trong `services/api/src/modules/rewards`.
Mobile dùng HTTP/session/Query infrastructure đang có; không thay đổi backend.

## API đang dùng

| Endpoint dưới `/api/v1` | Hành vi mobile |
| --- | --- |
| `GET /rewards/products?locale=vi` | Danh mục ACTIVE, có giá, tối đa 200 sản phẩm; tìm tên/thương hiệu và lọc category trên danh mục đã tải. |
| `GET /rewards/products/:id?locale=vi` | Giá Credit và `priceVersion` hiện tại trước khi xác nhận. |
| `POST /rewards/redemptions` | Gửi `{productId, expectedPriceVersion}` và `Idempotency-Key`; không tự replay sau refresh token. |
| `POST /rewards/redemptions/lookup` | Tra cứu chủ động bằng `Idempotency-Key` cũ, không có body đổi voucher; 200 trả metadata, 404 `VOUCHER_REDEMPTION_NOT_FOUND` xác nhận key đã bị khóa và không thể trừ Credit. Không tự replay sau refresh token. |
| `GET /rewards/redemptions?limit=20&cursor=…` | Lịch sử của owner, mới nhất trước; lọc trạng thái trên các trang đã tải và tiếp tục tải khi còn cursor. |
| `GET /rewards/redemptions/:id` | Chi tiết owner và mã voucher nếu được phát hành; BE ghi audit khi đọc mã. |

Nguồn: [User controller](../../../../services/api/src/modules/rewards/presentation/http/rewards.controller.ts),
[DTO](../../../../services/api/src/modules/rewards/presentation/http/rewards.dto.ts),
[redemption service](../../../../services/api/src/modules/rewards/application/services/redemption.service.ts).

## Nghiệp vụ và recovery

- Credit khả dụng từ cả PURCHASED, EARNED (dạy học) và BONUS được đổi voucher theo Q2 đã chốt ở BE ngày 2026-11-23. BE dùng lot cũ trước, lưu phân bổ và hoàn đúng lot/nguồn khi cần; mobile không tự phân bổ hoặc đổi nguồn Credit. BE quyết định số dư, hạn mức, giá và kết quả; thiếu số dư trả `INSUFFICIENT_AVAILABLE_CREDIT`.
- Phân biệt ISSUING, ISSUED, FAILED_REFUNDED, MANUAL_REVIEW, REFUNDED_MANUAL. Không tự đặt trạng thái USED, không tự đánh dấu đã dùng hoặc hoàn Credit.
- Chỉ trạng thái ISSUED là đã phát hành. POST trả 202 có thể đang xử lý hoặc đã hoàn; UI luôn theo `status`, không suy từ HTTP success.
- Lưu intent `{key, productId, expectedPriceVersion}` trong SecureStore trước POST, phân vùng bằng hash của API URL và owner. Không lưu mã/PIN/link trong record này.
- Root provider giữ coordinator qua các lần chuyển màn. Khởi tạo, focus và reconnect không tự POST. Có intent chưa rõ kết quả thì chặn đổi mới; người dùng chủ động gọi lookup bằng key cũ, kể cả sau khi mở lại ứng dụng. Lookup chờ yêu cầu cũ còn chạy và không tạo yêu cầu đổi mới.
- Lookup 200: làm mới đúng owner rewards/wallet, xóa record khớp key rồi mở giao dịch đã có. Chỉ lookup 404 đúng mã `VOUCHER_REDEMPTION_NOT_FOUND` mới cho xóa intent và báo chưa trừ Credit; lần đổi sau cần xác nhận lại giá với key mới. Không coi 404 từ endpoint khác, 401/403, lỗi mạng/timeout, protocol hoặc 5xx là kết quả chưa trừ. Lỗi lookup hoặc xóa record giữ trạng thái chưa xác định, không mở khóa đổi mới.
- Lỗi ghi record chặn POST; lỗi xóa record sau phản hồi vẫn giữ đường khôi phục cùng key. Native store serialize các thao tác cùng owner/environment và chỉ xóa record khớp key.
- Web preview không có durable store tương ứng nên chỉ duyệt được danh mục/lịch sử; thao tác đổi bị khóa với thông báo rõ ràng.
- Response metadata được Zod loại bỏ `voucher` trước khi vào Query cache. Chỉ nút Hiện mã gọi reveal vào state tạm của màn; blur/background/session change hủy request và xóa state. Chỉ cho mở link HTTPS không chứa username/password.
- Lookup trả metadata-only, không trả mã/PIN/link. GET chi tiết theo ID vẫn trả mã từ BE rồi mobile loại bỏ ngay khi đọc metadata; audit BE vẫn có thể ghi một lần reveal. Không prefetch chi tiết/mã.
- Khi có kết quả POST thì invalidate đúng owner rewards/wallet; không tự tính lại số dư. Làm mới receipt không phát sinh yêu cầu đổi mới.
- Receipt tự refetch metadata qua GET theo ID mỗi 10 giây khi ISSUING, mỗi 30 giây khi MANUAL_REVIEW. Chỉ chạy khi màn focus, app active, ID hợp lệ và phiên hiện hành; không chồng request đang chạy. Dừng khi ISSUED/đã hoàn, rời màn, logout hoặc lỗi không thể tự phục hồi; lỗi mạng/5xx được đọc lại, 429 tôn trọng thời điểm retry. Không tự POST đổi/lookup hoặc gọi reveal. Giới hạn GET chi tiết có thể ghi audit reveal ở BE vẫn như đã nêu trên.
- Lỗi debit bị từ chối giữ productId trong state phiên (record durable đã xóa) để feedback chỉ hiện trên đúng voucher. Thiếu Credit khả dụng chỉ hiển thị thông báo, không thêm nút nạp ví; lỗi price version có đường tải lại giá, không tự replay POST.

## Giới hạn tích hợp

BE hiện chỉ gắn MockVoucherProvider; tên thương hiệu thật không biến voucher thành voucher thật.
UI không hiển thị nhãn demo hoặc cảnh báo chưa phát hành trong các màn chính, phù hợp bản trình diễn sản phẩm; trạng thái/lỗi giao dịch vẫn theo BE. Chưa có notifications phát hành, provider Got It thật,
API đánh dấu đã sử dụng hoặc signal capability bật/tắt đổi trong catalog.
Không thêm billing/subscription/gói nạp mới trong luồng này.

BE cần áp migration `20261123000000_voucher_redemption_lots` trước khi chạy phiên bản mới. Không áp migration từ mobile.

Native SecureStore, app kill/restart, deployed API/provider và giao dịch thật cần nghiệm thu riêng;
unit tests và web fixture không thay thế các bằng chứng đó.
