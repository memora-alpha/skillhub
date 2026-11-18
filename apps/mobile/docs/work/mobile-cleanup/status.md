# Dọn source mobile — hiện trạng

Cập nhật: 2026-11-18T15:46:07+07:00. Trạng thái source: **Ready for review**. Đã refactor các cảnh báo Sonar trong27 file; bộ rule cục bộ và full mobile checks đạt. Nghiệm thu người dùng chưa thực hiện. Phạm vi theo [plan](plan.md).

## Refactor cảnh báo Sonar — 2026-11-18T15:46:07+07:00

- Tách tính quyền/nhãn/trạng thái hiển thị của màn tài liệu và đánh giá thành helper; chuyển các nhánh render dài thành guard return, giảm callback cache lồng nhau. Giữ nguyên hook order, bản nháp, disabled/accessibility, version lifecycle, owner/session guards và explicit recovery; không đổi API, bố cục hoặc nội dung hiển thị.
- Tên tệp dùng codePointAt khi lọc ký tự điều khiển; chuẩn hóa tìm kiếm dùng replaceAll cho đ/Đ. Web prepareMaterialDownload bỏ async không await nhưng vẫn trả Promise của download target. Validator review không capture dữ liệu chuyển ra module; message/độ trễ scan và thứ tự phân loại lỗi upload giữ nguyên.
- SonarJS4.2.2 cục bộ: **27 file,0 errors/0 warnings** với cognitive-complexity≤15, no-nested-functions threshold5, no-nested-conditional, no-nested-template-literals và ESLint require-await. Đối chiếu source cho codePointAt/replaceAll/validator đã hoist; không suppress rule. Công cụ chỉ ở thư mục ignored `.expo/sonar-tools`, script `.expo/check-sonar-reported.cjs`, kết quả `.expo/sonar-reported-results.json`; không thay package.json/lockfile.
- Full mobile **1.239/1.239 PASS**,0 failed/skipped/cancelled; full TypeScript/ESLint, structure **1.056 source files**, Prettier các source thay đổi và whitespace PASS. Regression hiện có bao gồm owner actions/cache/filter/recovery, review editor/draft, download/web saver và upload status/error. Logs ignored `.expo/sonar-fixes-{tests,types,lint}.log`.
- Đây là kiểm chứng source và rule cục bộ, chưa chạy lại Sonar server/quality gate, web preview/export, API có đăng nhập hoặc Android/iOS trong lượt refactor này. Các giới hạn nghiệm thu từ đợt dọn source trước vẫn giữ theo bằng chứng lịch sử bên dưới.

## Đã sửa và dọn — 2026-11-14

- Bỏ sample-files không có consumer; bỏ PathsPreviewProvider/context/types/fixtures không còn nơi đọc. Gỡ ProductPreviewProvider và sở thích onboarding chỉ lưu trong bộ nhớ, thay bằng hướng dẫn mở Discover/đăng yêu cầu thật. LearningProviders chỉ bọc RequestsProvider theo tài khoản. ProfilePreviewProvider vẫn giữ vì dùng projection từ account thật và có consumer.
- Gỡ bộ hồ sơ/yêu cầu guest giả, avatar override theo demo ID, thống kê cộng đồng, testimonial, mentor/lịch học và số dư/giao dịch giả ở màn chào. Giữ ảnh minh họa có credit, theme/font và nội dung giới thiệu trong constants/welcome.ts. Bỏ các nhánh tệp chat mẫu, modal thông báo màn chưa triển khai và cờ demo không còn cần ở FeaturePage/các caller.
- Guest /explore và link profile/request giữ route nhưng yêu cầu đăng nhập, phù hợp contract mobile hiện có. Khi đã có phiên, chuyển tới route thật; ID phải UUID, query được normalize, array/ID mẫu có fallback. Không có guest API contract nên không dựng anonymous catalog bằng fixture.
- Sửa link lỗi trùng lịch trỏ /paths/path-ready/schedules thành /paths. Link Điều khoản/Chính sách ở màn chào mở /policies; danh mục mở Explore với từ khóa, bỏ link mạng xã hội chưa có đích. Header màn chào dùng logo gọn ở màn hẹp để nút Đăng ký không tràn320px.
- Editor tài liệu giữ bản nháp theo owner/session và ID; refresh listingVersion không remount form. Hook giữ phiên bản gốc khi PATCH, nên dữ liệu server đổi sẽ nhận conflict thay vì áp draft cũ lên version mới. Readonly mới đọc được vẫn khóa lưu; không tự replay hoặc tự nâng version.
- Thêm PickerSheetHeader dùng chung cho MaterialSkillSheet và RequestPickerSheet: tiêu đề, vùng nhấn đóng44pt, label và khoảng cách thống nhất. Loading vẫn chỉ che body. GuestAccess dùng chung cho3 màn guest. Không gom cả hai sheet thành một vì Modal cô lập VirtualizedList và lifecycle đóng/keyboard hiện khác nhau.
- Cập nhật architecture và các contract/matrix đang mô tả provider/report preview cũ; lịch sử work/specs giữ nguyên. Không sửa backend, native/media variants, fixture kiểm thử, QA binding tài chính hoặc package/lockfile. Không stage/commit.

## Kiểm chứng đợt dọn source — 2026-11-14

- Baseline full **1.179/1.179 PASS**,0 failed/skipped/cancelled và ESLint PASS; logs ignored .expo/mobile-cleanup-baseline-tests.log và .expo/mobile-cleanup-baseline-lint.log.
- Sau sửa: full **1.180/1.180 PASS**,0 failed/skipped/cancelled; .expo/mobile-cleanup-full-tests.log. Regression gồm guest destination/UUID/array/search, editor expected version và readonly, cả hai sheet, file chat. Các harness cũ được cập nhật để render header đã extract và chấp nhận Text children dạng chuỗi; Wallet navigation đọc provider hiện tại thay file đã xóa.
- TypeScript, full ESLint, structure **1.010 source files**, Prettier các file thay đổi chính và whitespace PASS. Logs .expo/mobile-cleanup-types.log, .expo/mobile-cleanup-lint.log.
- Expo web export PASS .expo/mobile-cleanup-web; .expo/mobile-cleanup-export.log. Tắt dotenv/telemetry, dùng URL localhost cho export; không truy cập tài khoản/API/giao dịch thật.
- Browser PASS320/390/430/1200px: Welcome/guest/AuthLayout/onboarding không tràn; CTA/Điều khoản hoạt động, không số liệu/đánh giá/số dư giả, guest không gọi API, signed-in redirect giữ từ khóa. Script .expo/mobile-cleanup-preview.cjs; đã xem ảnh welcome-390.png và guest-access-390.png trong .expo/mobile-cleanup-preview/.
- Browser editor API fixture: refresh nền đổi version vẫn giữ title/rights, PATCH giữ version gốc, lỗi conflict giữ input và không rời form; .expo/material-editor-version-preview.cjs và .expo/material-editor-version-preview/. Browser form trống/lưu không tệp/giá sai/API lỗi chạy lại PASS bằng .expo/materials-editor-validation-preview.cjs.
- BottomSheet web thật @expo/ui PASS320/390/430px sau extract header: kéo đóng/mở lại, cuộn40 kỹ năng/chọn cuối, đóng icon; .expo/materials-skill-sheet-preview.cjs. Transport/session/native checkbox trong các preview là fixture; component/hook/RHF/Zod/API adapters thật. Không dùng browser fixture thay native acceptance.

## Phần còn cần kiểm chứng hoặc quyết định

| Ưu tiên | Phần còn lại | Bước tiếp và giới hạn |
| --- | --- | --- |
| Cao trước release | Android/iOS gesture sheet, keyboard, upload/download storage và LiveKit | Nghiệm thu trên thiết bị/client đúng SDK; lượt này không có thiết bị kết nối. Native variants không phải dead code. |
| Cao trước release | API triển khai, Wallet/payment/entitlement và scan thật | Kiểm theo contract trên môi trường được cho phép; không suy từ unit/fixture hoặc chạy giao dịch thật trong cleanup. |
| Theo yêu cầu sản phẩm | Danh sách khám phá không đăng nhập | Cần guest API contract; hiện hiển thị hướng dẫn đăng nhập thay mock. |
| Cải thiện UX | Đối chiếu/khôi phục bản nháp khi có version conflict | Hiện giữ input và báo conflict; chưa có UI so sánh hai phiên bản hoặc lưu nháp bền. Không tự merge/nâng version. |
| Có thể gom tiếp | Error row của Input và MaterialFieldError | Cùng icon/text có thể thành FieldError chung khi làm form tiếp; cần kiểm accessibility và consumer toàn app. Chưa thay Input trong lượt này để tránh thêm thay đổi ngoài phần đã kiểm trực quan. |

Rà soát này gồm source/import graph, mock runtime, các vùng thay đổi và bộ test hiện có; không kết luận toàn bộ mobile không còn lỗi. Import graph mặc định chưa bao quát resolution platform nên chỉ là danh sách kiểm tra, không dùng để xóa native code. Các tính năng phụ thuộc backend như mark-all notifications/đổi lịch vẫn theo gate/contract hiện hành.
