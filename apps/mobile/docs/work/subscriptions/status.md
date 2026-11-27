# Trạng thái Gói thành viên

- Cập nhật: 2026-11-28T02:39:16+07:00.
- Source: Ready for review; nghiệm thu native/API còn mở.
- Giao diện dùng Nunito/theme/component hiện có. Hai thẻ Creator/Pro cạnh nhau;
  gói được chọn có nền cam nhạt, viền và dấu chọn; quyền lợi dạng lưới hiển thị một lần.
- Lịch sử ở góc phải header; giá và nút hành động cố định phía dưới. Thẻ gói hiện tại mở
  `/membership/manage` để xem quota/phút ghi hình và quản lý gia hạn. Bỏ tagline,
  mô tả lặp, ghi chú cuối; thông tin xác nhận thu Credit/gia hạn vẫn giữ.
- Web radio có checked state rõ và bàn phím mũi tên; chọn gói/chu kỳ không gửi POST.
  Chữ lớn chuyển thẻ/quyền lợi về một cột; chưa nghiệm thu font scale trên thiết bị.
- Giảm số giá trên thẻ 25→20px, số quyền lợi 20→17px, số tiền ở footer/lịch sử 17→15px;
  dùng token typography hiện hành, giữ font Nunito và font scaling. Ảnh evidence giữ bố cục trước lần giảm số này.
- Quản lý gói dùng style riêng: thẻ trắng với chu kỳ/hạn dùng, progress tài liệu/ghi hình,
  nhóm gia hạn/thanh toán và thay đổi đã hẹn. Giữ số 15px; nút Đổi gói chỉ có ở gói trả phí,
  không có Xem gói ở Free. Dùng dòng thao tác Hủy tự động gia hạn/Tiếp tục gia hạn
  có xác nhận ở cuối nhóm thanh toán, thay nút Bật/Tắt ngắn. Không thay PATCH/version guard.
- Có entry Hồ sơ/Ví/account, danh sách gói, usage, mua/nâng cấp và quản lý gia hạn,
  lịch sử, notification target, wallet nhãn/filter và lỗi material quota.
- Mua/nâng cấp dùng native durable intent, same-key resume chủ động và owner/session guards.
- Bỏ FormNotice/banner trong feature. Kết quả mua/nâng cấp/PATCH/resume dùng toast chung
  khi màn và phiên còn hoạt động; read/storage/recovery/quota dùng chữ gọn, giữ retry.
- Rà lỗi tiếp: PATCH hoàn tất/mất phản hồi sau blur vẫn invalidate dữ liệu đúng phiên;
  blur/refocus không hiện toast kết quả cũ. Xác nhận gắn ID subscription cùng version,
  tránh áp xác nhận cũ vào row mới trùng version. Nội dung GRACE phân biệt hủy/tiếp tục
  gia hạn, không hứa dùng đến termEnd đã qua hoặc giữ nguyên toàn bộ grace sau khi hủy.
- Gap còn lại: API read giá/phút add-on và capability bán gói; không hardcode để lấp gap.

## Chẩn đoán đăng ký trên điện thoại

- Người dùng xác nhận đang thử trên app điện thoại và gửi câu “Tạm thời chưa thể đăng ký
  hoặc nâng cấp gói. Bạn vẫn có thể quản lý gia hạn.” Câu này chỉ được map từ
  `SUBSCRIPTIONS_DISABLED` trong mobile; `SubscriptionsService.assertEnabled` phía BE
  phát lỗi khi `subscription.enabled` không bật. Đây là chặn bán gói, không phải nút hoặc
  SecureStore của bản web. Cần API owner kiểm tra/bật cờ ở đúng môi trường phục vụ app.
- Kiểm tra read-only DB cấu hình bởi `services/api/.env`: chưa có bảng
  `subscription_plan_versions`, chưa có row cấu hình `subscription.enabled`. Không suy DB
  này là DB của API điện thoại: endpoint mobile cấu hình trả 401 khi gọi catalog không token.
- Không có thiết bị ADB kết nối để lấy raw response; không gửi giao dịch thật, chạy migration,
  seed, chỉnh cấu hình hoặc thay backend. Chưa xác nhận đăng ký thành công sau khi mở cờ.

## Bằng chứng

| Phạm vi | Kết quả | Giới hạn |
| --- | --- | --- |
| Contract/source | Đối chiếu BE `126699c4` | Không chứng minh deployment |
| Focused tests cuối | 20 đạt | 16 subscription/storage + 4 material editor. API/schema, idempotency, recovery, cleanup/write errors, session, version, lịch đổi gói, notification/wallet, native store mock theo owner/environment. Có overlap với full suite, không cộng tổng. |
| Regression sau redesign | 16 đạt | Subscription/storage suite chạy lại; không cộng với các bộ trên. Không đổi API/coordinator/ledger. |
| Sửa feedback lỗi | 16 đạt; TypeScript, scoped ESLint, formatting và structure đạt (1109 files) | Bổ sung `SUBSCRIPTIONS_DISABLED` 403: giữ lỗi để báo toast, xóa intent bị từ chối, không tự gửi lại; auth/403 khác vẫn giữ recovery. Chưa nghiệm thu toast trên điện thoại. |
| Rà lỗi lifecycle/xác nhận | 23 đạt; TypeScript, scoped ESLint, formatting và structure đạt | Test trước sửa tái hiện PATCH bỏ qua invalidate khi blur, toast cũ khi refocus và xác nhận chấp nhận row khác trùng version. Sau sửa kiểm tra cả mất phản hồi, đổi phiên và nhấn lặp. Native/API còn mở; không thêm field DTO BE. |
| TypeScript | Đạt | `tsc --noEmit`, binary cục bộ tương ứng script mobile |
| ESLint/structure | Đạt, 1109 source files | Rà lỗi cuối: ESLint toàn mobile max-warnings 0, structure và formatting các file sửa đạt. Không sửa config để bỏ qua source. |
| Full tests | 1299 đạt, 0 failed/skipped | Chạy sau các sửa lifecycle/xác nhận/GRACE, gồm test regression mới. Không thay nghiệm thu API/native. |
| Web export sau redesign | Đạt | `expo export --platform web --max-workers 2`, gồm route quản lý mới. Không chứng minh native binary/API. |
| Browser component preview sau redesign | 390×844 và 320×568 đạt | AppHeader, CurrentPlanLink, PlanSelection, PlanActionFooter, MembershipOverview và confirmation thật; host riêng có nhãn, notification count/ảnh/API/account được tách. Không phải full app shell hoặc API thật. |
| Preview tương tác sau redesign | Chọn Pro/Creator, 30/365 ngày, giá/quyền lợi/footer khớp; mũi tên và checked state; quản lý/gia hạn/lịch sử và dialog 320px; không tràn ngang | Fixture chỉ trình bày, không gọi financial API; không thay nghiệm thu mutation hook/native |
| Quản lý gói chỉnh lại | Preview 390×844/320×568: gói đang dùng, Free, đã hẹn thay đổi; xác nhận gia hạn/bỏ lịch, không tràn ngang. TypeScript, scoped ESLint, structure, formatting đạt | Component thật/host thử, chưa API/native. Không chạy lại full tests/export cho thay đổi trình bày. Ảnh chụp trước khi bỏ nút Xem gói ở Free; ảnh paid không bị ảnh hưởng. |
| API/native/provider/store release | NOT_RUN | Cần API/thiết bị, SecureStore restart, quyết định IAP và release gates |

Ảnh redesign: [390px](evidence/redesign-390.jpg), [320px](evidence/redesign-320.jpg),
[quản lý 320px](evidence/manage-320.jpg), đều là component preview có nhãn dữ liệu thử.
Quản lý gói mới: [390px](evidence/manage-refined-390.jpg), [320px](evidence/manage-refined-320.jpg).
Ảnh quản lý giữ bố cục ba nhóm, chụp trước lần thay nút Bật/Tắt bằng dòng Hủy/Tiếp tục gia hạn.
Logs cục bộ `.cache/subscription-*.log` (ignored). Preview và export tạm đã dọn sau kiểm tra;
không có route/fixture fallback trong app thật. App entry luôn dùng API/session hiện hành.
Đầu vào và tiêu chí ở [plan](plan.md); contract/gap ở [subscriptions](../../contracts/subscriptions.md).
