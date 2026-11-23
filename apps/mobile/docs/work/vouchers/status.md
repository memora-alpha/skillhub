# Trạng thái Voucher mobile

## Hiện trạng

- Cập nhật lúc: 2026-11-23T12:58:12+07:00.
- Trạng thái: Ready for review; source complete, native/API acceptance pending.
- Nghiệm thu người dùng: Chưa thực hiện cho phiên bản sau điều chỉnh palette/font.
- Đã có: routes/điểm vào, danh mục, chi tiết/xác nhận, lịch sử, reveal mã, coordinator và native recovery store.
- Giao diện dùng Nunito, nền kem và cam đất; giữ theme và navigation của app.
- Số mệnh giá trên thẻ dùng token heading 17px, chi tiết title 20px và giá Credit body 15px.
- Các màn chính/xác nhận không còn nhãn demo hoặc cảnh báo chưa phát hành; chú thích ngắn theo ngôn ngữ sản phẩm, trạng thái và lỗi vẫn lấy từ BE.
- Lỗi đổi nằm trong vùng footer không co lại, tách riêng khỏi giá/nút đổi; thiếu Credit chỉ báo lỗi và giữ nút Đổi voucher, không thêm nút nạp. Giá thay đổi có nút tải lại. Lỗi của sản phẩm trước không hiện ở sản phẩm khác.
- Chưa kiểm chứng: Android/iOS thật, SecureStore qua app kill/restart, deployed API và provider thật.
- Backend hiện chỉ có provider demo; không sửa backend trong công việc này.

## Bằng chứng hiện hành

| Phạm vi | Kết quả | Giới hạn |
| --- | --- | --- |
| Contract/source | Đã đối chiếu controller, DTO, service | Không chứng minh deployment |
| Focused tests | 20 passed | `rewards.test.ts` + `rewards-footer.test.ts`: contract/coordinator và 4 ca feedback/top-up/price/nhầm sản phẩm; fake transport/store |
| Full mobile tests | 1.263 passed, 0 failed, 0 skipped | `tsx --experimental-test-module-mocks --test tests/**/*.test.ts test/profile.test.mjs`; chạy lại khi dọn code trước commit, gồm focused suite, không cộng hai lần |
| Typecheck | Đạt | `tsc --noEmit` |
| Lint | Đạt | `eslint . --max-warnings 0` |
| Structure | Đạt | Không thay thế native acceptance |
| Web export | Đạt | `expo export --platform web`; không chứng minh native binary |
| Browser fixture | Đạt trong phạm vi presenter | Tìm không dấu, category, empty, detail, history; Nunito/kem–cam, tabs gạch chân; 320px một cột, 390px hai cột. Không gọi API account |
| API/native/provider | NOT_RUN | Cần môi trường và thiết bị tương ứng |

Task và dependency nằm ở [plan](plan.md); API và recovery ở [contract](../../contracts/rewards.md).

## Ảnh kiểm chứng

[Danh mục](evidence/catalog.jpg) và [chi tiết](evidence/detail.jpg) render từ component thật với dữ liệu kiểm thử.
Ảnh ghi rõ preview, không giao dịch; header fixture không thay thế nghiệm thu app shell/native.
Ảnh lưu trước lần giảm cỡ số lúc 01:51 và chỉnh chú thích lúc 02:02; chưa chụp lại các mức 17/20/15px hoặc giao diện đã bỏ nhãn demo.
[Lỗi thiếu Credit trên màn 320px](evidence/credit-error-320.jpg) ghi nhận footer lúc 02:18, trước khi bỏ nút nạp lúc 02:22. Đã kiểm 320×568 và 390×844 bằng component thật với fake error; không gọi API tài chính. Ở 320px, đáy chữ thông báo 411px và đầu dòng Credit 482px, không giao nhau.
Log cục bộ ignored: `apps/mobile/.cache/voucher-tests.log`, `voucher-cleanup-tests.log`, `voucher-export.log`.

## Nhật ký

### 2026-11-23T12:58:12+07:00

Dọn lớp props trung gian phục vụ preview của danh mục sau khi gỡ fixture; giữ các
component thật trong luồng app. Thu hẹp export nội bộ, bỏ tham số bật/tắt query không
có consumer và kết quả giữ thừa trong coordinator. Giữ nguyên layout, chống đổi
trùng và khôi phục bằng key cũ; không sửa source BE. Bộ test mobile đạt 1.263 tests.

### 2026-11-23T02:22:08+07:00

Bỏ nút Nạp Credit khỏi feedback thiếu Credit và dọn callback/helper không còn dùng.
Giữ thông báo và nút Đổi voucher. Bốn regression footer, scoped ESLint và Prettier đạt;
ảnh 02:18 chưa cập nhật cho việc bỏ nút này.

### 2026-11-23T02:18:43+07:00

Chuyển feedback đổi vào footer có vùng riêng và `flexShrink: 0`, tách thông báo dài
khỏi giá và nút thao tác. Rút gọn lỗi thiếu purchased Credit thành yêu cầu nạp thêm,
thêm đường `/wallet/topup`; price-changed có thao tác tải lại. Coordinator giữ productId
cho lỗi đã bị từ chối để không lặp lỗi sang voucher khác. Không đổi điều kiện Credit ở BE.
20 focused tests, typecheck, scoped lint, structure và diff whitespace đạt. Browser
fixture xác nhận không chồng chữ ở 320/390px; ảnh mới ở phần trên. Chưa kiểm lại Android/iOS.

### 2026-11-23T02:02:51+07:00

Bỏ nhãn thử nghiệm/chưa có giá trị thực tế khỏi catalog, lịch sử, chi tiết và xác nhận.
Rút gọn chú thích đổi, xem mã và thông báo tạm ngừng, không đổi trạng thái hoặc điều kiện
giao dịch. Focused ESLint, Prettier và 16 tests rewards đạt; chưa chụp lại giao diện.

### 2026-11-23T01:51:27+07:00

Giảm mệnh giá trên thẻ từ 26px xuống 17px, mệnh giá chi tiết từ 32px xuống 20px,
giá Credit từ 17px xuống 15px, dùng token typography hiện có. Focused ESLint và
Prettier đạt; không thay logic và không chạy lại full suite cho chỉnh sửa cỡ chữ.
Chưa cập nhật ảnh browser/native cho lần thu nhỏ này.

### 2026-11-23T01:37:08+07:00

Hoàn tất source Voucher và kiểm tra tự động; điều chỉnh palette từ xanh sang kem/cam đất,
dùng Nunito cho chữ và số, bổ sung tab gạch chân và ảnh visual QA. Browser fixture đã được
gỡ sau kiểm tra; không có fixture fallback trong app thật. Còn nghiệm thu native,
SecureStore qua app kill/restart và API demo trên thiết bị.
