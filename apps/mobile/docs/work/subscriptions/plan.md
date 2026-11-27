# Gói thành viên mobile

## Phạm vi và thiết kế

Hồ sơ → Gói thành viên → xem quyền lợi, mua/nâng cấp, quản lý gia hạn và lịch sử.
Chỉ `apps/mobile`, giữ tab chính, shared HTTP/session/Query, theme và component hiện có.
Contract: [subscriptions](../../contracts/subscriptions.md).

Tham khảo [Notion pricing](https://www.notion.com/pricing) cho so sánh gói,
[Spotify quản lý gói](https://support.spotify.com/us/article/change-premium-plans/)
cho entry tài khoản và [Google One](https://one.google.com/about/) cho cách đặt dung lượng cạnh quyền lợi.
Đây là tham khảo tổ chức nội dung; không sao chép assets, giá hoặc thương hiệu.
Nunito, nền kem/trắng, cam đất, thẻ Pro nền cam nhạt; header, Button, FilterBar,
InfoModal dùng component SkillHub. Hai thẻ chọn gói cạnh nhau, quyền lợi hiển thị một lần theo gói đang chọn;
chữ lớn chuyển thẻ/quyền lợi thành một cột. Thanh hành động cố định phía dưới,
Lịch sử trên header; quản lý gia hạn/mức sử dụng ở màn riêng.

## Task

- [x] Đối chiếu controller/service/DTO và ghi chênh lệch response/gap.
- [x] Thẻ entry trên shortcut Hồ sơ, entry Ví/account, protected routes.
- [x] Gói hiện tại, usage/phút ghi hình, storage/quota, trạng thái Free/ACTIVE/GRACE.
- [x] Thẻ Creator/Pro và chu kỳ 30/365 ngày; giá/quyền lợi theo BE.
- [x] Xác nhận mua/nâng cấp; khóa snapshot cũ, báo giá BE, idempotency và durable recovery.
- [x] Bật/tắt gia hạn, hẹn đổi gói/chu kỳ, bỏ lịch thay đổi bằng version guard.
- [x] Lịch sử cursor, wallet nhãn/filter, notifications và lỗi storage quota.
- [x] Focused API/coordinator tests; visual component preview 320/390px.
- [x] Đưa Lịch sử lên header cố định, gộp gia hạn vào thẻ gói hiện tại; bỏ giới thiệu/chú thích lặp và link ví cuối trang.
- [x] Thiết kế lại màn chọn gói theo Notion/Google One: thẻ lựa chọn cạnh nhau, quyền lợi dạng lưới, footer hành động, màn Quản lý gói và bàn phím/checked state web.
- [x] Giảm cỡ số theo typography: giá thẻ 20px, quyền lợi 17px, tiền footer/lịch sử 15px.
- [x] Thiết kế lại Quản lý gói: thẻ hiện tại gọn, hai mức sử dụng có progress, nhóm gia hạn/thanh toán; bỏ Xem gói ở Free, dùng hành động Hủy/Tiếp tục gia hạn qua xác nhận.
- [x] Bỏ banner lỗi/thành công: dùng toast chung sau thao tác; read/storage/recovery dùng chữ gọn và retry. Đối chiếu lỗi không đăng ký được với cờ bán gói BE.
- [x] Rà lỗi sau feedback: regression PATCH khi blur/refocus, xác nhận theo ID+version và nội dung hủy/tiếp tục gia hạn khi GRACE; giữ refresh đúng owner và không replay mutation.
- [x] Hoàn tất checks toàn mobile, web export và review source cuối.
- [ ] Android/iOS + SecureStore app kill/restart + API demo đã triển khai.

## Tiêu chí

- Không hiển thị Free/empty từ request còn pending/failed; loading/error/empty/content có feedback.
- Giá và quyền lợi từ BE; không hardcode add-on hoặc tỷ lệ phí. Không tự triển khai recording/whiteboard trong scope subscription.
- Không nhấn lặp/trừ hai lần; không tự replay khi focus/reconnect. Intent chưa rõ kết quả chặn giao dịch mới; resume cùng body/key và mô tả đúng khả năng có thu Credit.
- Đổi phiên/blur không để báo giá hoặc kết quả cũ thay UI/cache chủ mới.
- Tắt gia hạn giữ gói đến hết kỳ, không hứa hoàn tiền; hẹn đổi không tự bật gia hạn.
- Không tràn ngang ở 320px, nội dung/nút xác nhận cuộn được; giữ font scaling.

## Phụ thuộc

API owner áp migration, cấp quyền `subscription:manage:self`, approve plan/config trong môi trường demo.
Không mở rộng BE để bù gap; mua phút add-on chờ read contract.
Production/IAP và giá/quota approval theo spec BE, không tự bật flag.
