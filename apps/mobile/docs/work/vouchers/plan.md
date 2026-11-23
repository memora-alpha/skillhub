# Voucher trên mobile

## Mục tiêu và phạm vi

Thêm mục Voucher từ Ví Credit và Hồ sơ, gồm khám phá, chi tiết, xác nhận đổi,
lịch sử và mã voucher. Chỉ sửa `apps/mobile`; giữ backend và thanh tab chính hiện có.

## Nguồn thiết kế và contract

- Pattern SkillHub: FeaturePage, FilterBar, Input, Button, InfoModal và theme hiện hành.
- Tham khảo cách tổ chức Ưu đãi/Quà của tôi trong [MoMo](https://www.momo.vn/hoi-dap/toi-kiem-tra-the-qua-tang-o-dau); không sao chép asset hoặc giao diện thương hiệu.
- Chỉ dẫn thiết kế hiện hành: Nunito cho chữ và số, nền kem/trắng, cam đất làm điểm nhấn; không dùng mảng xanh lớn. Thẻ voucher có logo, mệnh giá, tên và Credit cần đổi; giới thiệu ngắn, không dùng heading trang trí lớn.
- [Contract đã đối chiếu source BE](../../contracts/rewards.md), [UI guide](../../guides/ui-and-styling.md), [state/session](../../guides/state-and-session.md).
- SRS 1.6 chưa mô tả đổi voucher ra giá trị bên ngoài; phạm vi demo kế thừa spec 018 của BE. Production/provider thật chưa sẵn sàng.

## Task

- [x] Đối chiếu API và phân biệt demo/provider thật.
- [x] Thêm routes được bảo vệ và điểm vào từ Ví/Hồ sơ/account menu.
- [x] Danh mục tìm kiếm không dấu, category, loading/error/empty và layout chữ lớn.
- [x] Chi tiết giá/version, điều kiện và xác nhận đổi trước POST.
- [x] Coordinator chống nhấn lặp, lưu intent trước POST, giữ recovery cùng key qua chuyển màn; không tự replay.
- [x] Lịch sử cursor, trạng thái và reveal mã không lưu vào query cache; xóa mã khi blur/background.
- [x] Điều chỉnh typography và palette theo app: Nunito, kem, cam đất.
- [x] Thu nhỏ số theo token mobile: mệnh giá trên thẻ 17/24, chi tiết 20/28, giá Credit 15/22 (font size/line height).
- [x] Nội dung trình diễn như app hoàn chỉnh: bỏ nhãn demo trên catalog/detail/receipt/xác nhận; rút gọn chú thích, giữ đúng trạng thái và lỗi giao dịch.
- [x] Tách lỗi đổi voucher vào vùng footer riêng, không đè dòng Credit; giữ một nút đổi khi thiếu Credit, tải lại khi giá thay đổi, giới hạn lỗi theo sản phẩm và regression tests.
- [x] Hoàn tất focused tests, lint, typecheck, structure, web export và visual QA.
- [x] Dọn lớp props phục vụ preview, export/tham số chưa dùng và state kết quả thừa trước khi commit.
- [ ] Nghiệm thu Android/iOS, SecureStore/app restart và API đã triển khai trong môi trường demo.

## Tiêu chí nghiệm thu

- Tìm/lọc/mở chi tiết và quay lại đúng ngữ cảnh; link hỏng, dữ liệu rỗng và lỗi API có trạng thái rõ ràng.
- Giá thay đổi sau khi mở xác nhận thì khóa xác nhận cũ; backend vẫn kiểm tra version.
- Nhấn lặp chỉ gửi một POST. Timeout/protocol/5xx giữ key, chặn đổi tiếp và chỉ kiểm tra lại khi người dùng chủ động.
- Logout/account switch không cho kết quả cũ thay UI/cache mới. Không cộng/trừ số dư ở client.
- Danh sách không chứa mã; mã hiện khi yêu cầu và ẩn khi rời màn/đưa app về nền.
- Phân biệt source/unit/browser fixture với nghiệm thu API/native; không dùng fixture fallback trong account app.

## Kiểm tra dự kiến

`tests/rewards.test.ts` cho contract, metadata/secret, số học hiển thị, coordinator,
storage failure và session changes; checks workspace và production web export.
Visual QA bằng presenter thật với dữ liệu kiểm thử tách biệt, màn 390px/320px và các trạng thái tìm/lọc/rỗng/chi tiết/lịch sử.

## Dependency

Native cần Expo development client tương thích SDK58, API truy cập được từ thiết bị,
voucher migration/config/permissions và catalog đã seed ở local hoặc staging.
Không chạy giao dịch thật để nghiệm thu UI. Giá và hạn mức do BE quyết định.
