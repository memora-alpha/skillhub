# Trạng thái Voucher mobile

## Hiện trạng

- Cập nhật lúc: 2026-11-23T14:14:17+07:00.
- Trạng thái: Ready for review; source complete, native/API acceptance pending.
- Nghiệm thu người dùng: Chưa thực hiện cho phiên bản sau điều chỉnh palette/font.
- Đã có: routes/điểm vào, danh mục, chi tiết/xác nhận, lịch sử, reveal mã, coordinator và native recovery store.
- Giao diện dùng Nunito, nền kem và cam đất; giữ theme và navigation của app.
- Số mệnh giá trên thẻ dùng token heading 17px, chi tiết title 20px và giá Credit body 15px.
- Các màn chính/xác nhận không còn nhãn demo hoặc cảnh báo chưa phát hành; chú thích ngắn theo ngôn ngữ sản phẩm, trạng thái và lỗi vẫn lấy từ BE.
- Lỗi đổi nằm trong vùng footer không co lại, tách riêng khỏi giá/nút đổi; thiếu Credit chỉ báo lỗi và giữ nút Đổi voucher, không thêm nút nạp. Giá thay đổi có nút tải lại. Lỗi của sản phẩm trước không hiện ở sản phẩm khác.
- Đã đồng bộ BE `090a1386`: chú thích dùng Credit khả dụng (nạp, kiếm được từ dạy và thưởng); lookup bằng key cũ thay việc gửi lại lệnh đổi. Kết quả 200 mở giao dịch đã có; 404 đúng mã xác nhận key đã bị khóa mới cho xóa intent và xác nhận lần đổi mới. Lỗi mạng/quyền/protocol hoặc lỗi xóa record vẫn giữ recovery.
- Voucher đã đổi không còn nút Làm mới trạng thái hoặc chú thích yêu cầu bấm làm mới; giữ kéo xuống làm mới, thử lại khi lỗi và kiểm tra yêu cầu chưa rõ kết quả.
- Tab Của tôi không còn link Khám phá voucher ở cuối danh sách; footer chỉ hiện Xem thêm khi còn trang lịch sử.
- Danh mục bỏ banner giới thiệu và tên category lặp trong số đếm; ẩn bộ lọc khi không có category. Chi tiết bỏ khối Trước khi đổi/link ví; xác nhận vẫn có tên, giá và thông tin trừ Credit khả dụng. Receipt chỉ hiện hạn sử dụng khi có dữ liệu, giữ badge hết hạn và bỏ cảnh báo lặp; rút gọn hướng dẫn/trạng thái/recovery. Đã dọn style banner không còn dùng.
- Tìm kiếm đã chuẩn hóa cả Đ/đ trước khi so khớp hoa/thường, có dấu/không dấu. Receipt tự đọc metadata khi chờ: 10 giây ISSUING, 30 giây MANUAL_REVIEW; tạm dừng background/blur, dừng khi có kết quả/đổi phiên, giữ nguyên thao tác reveal chủ động.
- Chưa kiểm chứng: Android/iOS thật, SecureStore qua app kill/restart, deployed API và provider thật.
- Backend hiện chỉ có provider demo; không sửa backend trong công việc này.

## Bằng chứng hiện hành

| Phạm vi | Kết quả | Giới hạn |
| --- | --- | --- |
| Contract/source | Đã đối chiếu controller, DTO, service | Không chứng minh deployment |
| Focused tests | 33 passed | `rewards.test.ts`, `rewards-footer.test.ts`, `rewards-refresh.test.ts`: contract/lookup/recovery/footer và Đ/đ, lịch đọc trạng thái, kết quả cuối, blur/background, phiên, không chồng request, mất mạng/429; fake transport/store/timers/AppState |
| Full mobile tests | 1.276 passed, 0 failed, 0 skipped | Chạy lại toàn bộ trước commit: `tsx --experimental-test-module-mocks --test tests/**/*.test.ts test/profile.test.mjs`; gồm focused suite, không cộng hai lần |
| Typecheck | Đạt | `tsc --noEmit` |
| Lint | Đạt | `eslint . --max-warnings 0` |
| Structure | Đạt | Không thay thế native acceptance |
| Web export | Đạt ở baseline trước cập nhật lookup | `expo export --platform web`; chưa export lại, không chứng minh native binary |
| Browser fixture | Đạt ở baseline trước cập nhật lookup | Tìm không dấu, category, empty, detail, history; Nunito/kem–cam, tabs gạch chân; 320px một cột, 390px hai cột. Chưa kiểm giao diện thông báo recovery mới; không gọi API account |
| API/native/provider | NOT_RUN | Cần môi trường và thiết bị tương ứng |

Task và dependency nằm ở [plan](plan.md); API và recovery ở [contract](../../contracts/rewards.md).

## Ảnh kiểm chứng

[Danh mục](evidence/catalog.jpg) và [chi tiết](evidence/detail.jpg) render từ component thật với dữ liệu kiểm thử.
Ảnh ghi rõ preview, không giao dịch; header fixture không thay thế nghiệm thu app shell/native.
Ảnh lưu trước lần giảm cỡ số lúc 01:51 và chỉnh chú thích lúc 02:02; chưa chụp lại các mức 17/20/15px hoặc giao diện đã bỏ nhãn demo.
[Lỗi thiếu Credit trên màn 320px](evidence/credit-error-320.jpg) ghi nhận footer lúc 02:18, trước khi bỏ nút nạp lúc 02:22. Đã kiểm 320×568 và 390×844 bằng component thật với fake error; không gọi API tài chính. Ở 320px, đáy chữ thông báo 411px và đầu dòng Credit 482px, không giao nhau.
Log cục bộ ignored: `apps/mobile/.cache/voucher-tests.log`, `voucher-cleanup-tests.log`, `voucher-lookup-tests.log`, `voucher-status-tests.log`, `voucher-final-tests.log`, `voucher-export.log`.

## Nhật ký

### 2026-11-23T14:14:17+07:00

Rà diff cuối trước commit: 19 source files của feature, không còn style banner
hoặc callback/helper cũ không dùng. Toàn bộ 1.276 tests mobile đạt, typecheck,
ESLint workspace, structure, Prettier và diff whitespace đạt. Phạm vi chỉ mobile,
không thay BE/shared package. Native/deployed API acceptance vẫn chưa thực hiện.

### 2026-11-23T14:10:35+07:00

Sửa hai lỗi đã rà: tìm kiếm Đ/đ và receipt không tự cập nhật sau phát hành.
Thêm vòng đọc owner metadata khi đang chờ, không sửa shared runtime/BE hoặc
tự replay lệnh đổi. Dừng ở kết quả cuối, rời màn, nền và phiên hết hiệu lực;
không gửi chồng read, 429 chờ retry và lỗi mạng có thể phục hồi. 33 focused tests,
typecheck, scoped ESLint, structure (1.080 source files), Prettier và diff check
đạt. Bằng chứng là unit/hook harness; chưa nghiệm thu native/deployed API.

### 2026-11-23T13:56:55+07:00

Dọn nội dung và thao tác dư ở danh mục, chi tiết/xác nhận và receipt. Giữ giá,
điều kiện sử dụng, chống nhấn lặp, lookup và trạng thái theo BE. Scoped ESLint,
typecheck, structure, Prettier và diff whitespace đạt. Không chạy lại tests cho
thay đổi trình bày; 27 tests logic/contract ở mốc lookup vẫn là bằng chứng trước đó.
Chưa chụp lại giao diện web hoặc kiểm native cho bố cục gọn mới.

### 2026-11-23T13:53:34+07:00

Bỏ link Khám phá voucher ở footer tab Của tôi và wrapper trống khi hết trang.
Giữ nút Xem thêm để tải lịch sử. Scoped ESLint, Prettier và diff whitespace đạt;
không chạy lại tests cho thay đổi chỉ xóa link.

### 2026-11-23T13:52:47+07:00

Bỏ nút Làm mới trạng thái ở receipt và rút gọn chú thích đang phát hành. Giữ
nguyên các thao tác mã voucher và recovery. Scoped ESLint, Prettier và diff
whitespace đạt; không chạy lại tests cho thay đổi chỉ xóa nút/chỉnh nội dung.

### 2026-11-23T13:45:50+07:00

Đồng bộ source BE `090a1386`, không sửa backend. Đổi mô tả sang Credit khả dụng,
bỏ lỗi purchased-only cũ. Nút kiểm tra yêu cầu gọi lookup với key đã lưu, không
gửi lại lệnh đổi; chỉ xóa intent sau kết quả xác nhận và cleanup thành công.
Nếu chưa tạo giao dịch, hiển thị thông báo và tải lại giá/ví; lần đổi tiếp cần
xác nhận mới với key mới. Lookup/cleanup thất bại vẫn chặn đổi tiếp và hiện lỗi.
27 focused tests, typecheck, lint và structure đạt. Chưa gọi deployed API, chưa
nghiệm thu native/SecureStore restart; BE cần migration `20261123000000_voucher_redemption_lots`.

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
