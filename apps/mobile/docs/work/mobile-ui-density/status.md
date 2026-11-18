# Làm gọn giao diện mobile — hiện trạng

Trạng thái FE: **hoàn tất chỉnh giao diện và kiểm chứng source/browser fixture**, ngày 2026-11-16. Phạm vi theo [plan](plan.md); chưa nghiệm thu trên thiết bị hoặc API có đăng nhập.

## Dọn code và kiểm tra trước commit — 2026-11-16T21:07:54+07:00

- Bỏ **39 style không còn được dùng** ở Home, thành tích, yêu cầu học, báo cáo và Tài liệu; đối chiếu AST/import/consumer và kiểm lại bằng tìm kiếm source trước khi xóa. Giữ các style dùng qua kế thừa hoặc truy cập động. Bỏ props variant/selected không còn consumer của IconAction, nhánh JSX/cỡ icon dư trong RequestCreateButton và giá trị notice undefined dư sau xóa bản nháp. Không đổi route, màu đang dùng, font, API, version/recovery hoặc phạm vi phiên.
- Rà lại hooks/callback, điều khiển bàn phím, accessibility state, vùng chạm và các consumer StyleSheet. Source không thêm fixture/mock hoặc thư viện mới; không sửa BE, root tooling, native variants hoặc lockfile.
- Full mobile **1.224/1.224 PASS**, không fail/skipped/cancelled. TypeScript, full ESLint, structure **1.047 source files**, Prettier code thay đổi, whitespace PASS; bộ kiểm scope commit **6/6 PASS**. Logs ignored `.expo/mobile-precommit-{tests,types,lint,format,format-check}.log`.
- Browser gallery 11 nhóm đại diện **320/390/430px, chữ130%, keyboard và filter PASS**; hồi quy xóa bản nháp **PASS** cho toast đơn, tự ẩn, hủy không ghi, mất phản hồi không báo thành công, recovery explicit cùng ID/version và không lặp toast khi rerender. Logs `.expo/mobile-precommit-gallery.log`, `.expo/mobile-precommit-delete-toast.log`; fixture/ảnh ignored được mô tả ở các mục tương ứng. Không suy thành nghiệm thu API hoặc thiết bị thật.
- Expo web export **PASS** tại `.expo/mobile-precommit-web`, log `.expo/mobile-precommit-export.log`; dùng URL mẫu, tắt dotenv/telemetry và Metro override cục bộ hiện có. Chưa kiểm Android/iOS hoặc giao dịch tài khoản thật; lỗi route miễn phí trên bản triển khai vẫn mở theo status Tài liệu.

## Kết quả

| Nhóm màn | Thay đổi |
| --- | --- |
| Trang chủ, Discover, yêu cầu học | Gom lời chào, giảm khoảng cách giữa nhóm nội dung; thao tác thêm dùng icon có nhãn; bộ lọc nguồn/trạng thái một hàng cuộn ngang. |
| Học tập, lộ trình, đề xuất, tin nhắn | Tab chuyển nội dung dùng gạch dưới; bộ lọc danh sách dùng chung. Đề xuất mở bộ lọc trạng thái trên cùng hàng và vẫn hiện trạng thái đã chọn khi đóng bộ lọc. Giữ cảnh báo chỉ lọc trong phần lộ trình đã tải. |
| Tài liệu | Thư viện một thanh nguồn/trạng thái; bỏ heading quản lý lặp, nút đăng ở header và tìm kiếm trọn chiều ngang tại tab Đã đăng. Form đăng/chỉnh sửa dùng các card như ban đầu; nhấn thẻ Thư viện mở trang chi tiết. Bỏ tiêu đề/lời dẫn phụ trùng ở truy cập, thanh toán và đánh giá. Giá xác nhận, số dư, chính sách hoàn tiền, quyền tải và xử lý kết quả chưa rõ giữ nguyên. |
| Kỹ năng, hồ sơ, cài đặt | Giảm padding nhóm, panel và hàng cài đặt; gom thêm kỹ năng cạnh thanh lọc, giữ guard quyền trước điều hướng. Giữ footer lưu, draft, trạng thái pending/error và nội dung riêng tư. |
| Đánh giá, uy tín, thành tích, báo cáo | Giảm heading/count lặp; metadata gọn, làm mới bằng icon có nhãn; lọc thành tích/báo cáo một hàng. Màn uy tín và các form dùng layout chung gọn hơn. |
| Lịch, buổi học, Ví | Lịch gộp thời gian và số buổi vào dòng metadata; layout chi tiết/session/wallet giảm khoảng trắng. Ví bỏ heading giới thiệu chung; số dư khả dụng/tạm giữ, tỷ giá và cảnh báo tài chính vẫn đầy đủ. |
| Auth, onboarding, pháp lý | Giảm khoảng cách logo/form/nhóm nội dung ở Auth và các màn dùng FeaturePage. Pháp lý giảm lề ngoài; giữ toàn văn và khoảng cách phần đọc. |

`FilterBar` và `IconAction` thuộc components mobile, không gọi API. Bộ lọc giữ accessibility state, vùng chạm từ 44px, cuộn lựa chọn được chọn vào vùng nhìn thấy và bàn phím web. Dùng font/theme hiện hành, chuẩn hóa tiêu đề panel theo `typography.heading`; route, controller nghiệp vụ và dependencies giữ nguyên.

Rà source ghi nhận **91 file route và 95 file screens/views**, có route alias và nhiều view trong cùng luồng. Inventory này không tương đương 95 màn đã chạy nghiệm thu. Đã đối chiếu các nhóm trên cùng notifications, shell, account/connections và product shell; Notifications đã gọn, Chat/Room/QR và nội dung pháp lý dài giữ bố cục chuyên biệt. Inventory cục bộ ignored: `.expo/mobile-density-source-audit.json`.

## Kiểm chứng

- Full mobile **1.224/1.224 PASS**, không fail/skipped/cancelled. Có regression cho bộ lọc chung: semantics chọn/disabled và cuộn tới lựa chọn; cập nhật harness Inbox, kỹ năng, lộ trình và Ví theo boundary presentation mới, giữ kỳ vọng điều hướng/quyền/phân trang.
- TypeScript, full ESLint, structure **1.047 source files**, Prettier các file code thay đổi và whitespace **PASS**. CLI đã cài chạy qua Node do pnpm đang yêu cầu đồng bộ lại dependencies; không sửa lockfile/dependencies.
- Browser fixture **320/390/430px, chữ 130% PASS**: 7 màn cài đặt; thành tích; thư viện mua/miễn phí; và gallery 11 nhóm đại diện (Home, lịch, báo cáo, AuthLayout, kỹ năng, đề xuất, Inbox tabs, My Learning, yêu cầu, Ví, chính sách). Không pageerror/tràn ngang ngoài vùng cuộn chủ đích. Đã xem ảnh Home, cài đặt, thành tích, đề xuất, báo cáo và chữ lớn ở Auth/kỹ năng.
- Kiểm thao tác: lọc nguồn/trạng thái, Space/mũi tên radio/tab, giữ nhãn trạng thái đề xuất đang áp dụng, khóa thêm kỹ năng khi bị từ chối quyền, chuyển vùng học tập/tin nhắn, điều hướng thêm/nạp Credit; cài đặt lưu/ngăn nhấn lặp/giữ draft khi lỗi, tìm câu hỏi, accordion và sticky save. Thư viện giữ xử lý API chưa khả dụng và điểm vào khám phá.
- Expo web export **PASS** tại `.expo/mobile-density-web`; tắt dotenv/telemetry, dùng URL mẫu và Metro override cục bộ để loại scratch artifacts. Không deploy.

Logs/scripts/ảnh ignored: `.expo/mobile-density-{types,lint,full-tests,export,format}.log`, `.expo/mobile-density-gallery.cjs` và thư mục cùng tên, `.expo/mobile-density-settings.cjs`, `.expo/mobile-density-achievements.cjs` và các thư mục ảnh tương ứng; `.expo/materials-library-toolbar-preview.cjs` với log `.expo/mobile-density-library.log`. Gallery dùng screen/layout/control thật và dữ liệu/hooks/navigation/native adapter mô phỏng; Auth dùng form layout mẫu, Inbox/kỹ năng/đề xuất/yêu cầu/Ví kiểm presentation đại diện. Không suy từ fixture sang API hay giao dịch thực.

## Điểm nhấn nút đăng tài liệu

Nút “+ Đăng tài liệu” nằm bên phải title Tài liệu của tôi, dùng chung cho các tab; bỏ nút cạnh tìm kiếm để ô tìm kiếm trọn chiều ngang. Header giữ khóa tạo ở tab Đã đăng khi list đang đọc/lỗi, command pending/uncertain hoặc runtime chưa sẵn sàng; rời tab/reset phiên không giữ trạng thái mở khóa cũ. Nút tại header và Discover dùng `signedInChrome.accent` (#EF653D), cùng màu nền nút Tạo yêu cầu; dấu cộng/chữ trắng, vùng chạm từ 44px và route tạo giữ nguyên.

TypeScript, lint/Prettier scoped, structure 1.047 source files và whitespace PASS; regression hub 1/1 PASS cho vị trí action tại header, route, khóa tạo và account scope. Browser fixture header 320/390/430px/chữ 130% PASS: nút nằm bên phải title, không lặp nút ở content, tìm kiếm đủ chiều ngang, khóa lúc đọc rồi mở khi có dữ liệu, chuyển tab và điều hướng tạo đúng. Đã xem ảnh390px và320px/chữ lớn. Browser Discover so màu nền trực tiếp giữa Tạo yêu cầu/Đăng tài liệu ở ba kích thước PASS. Artifacts ignored `.expo/material-create-header-preview/`, `.expo/material-create-color-preview/` và `.expo/material-create-{header-tests,header-browser,color-browser}.log`. Không chạy lại full suite cho phần trình bày này; browser dùng transport/session fixture.

## Nút header Tin nhắn và Khám phá

Tinh chỉnh header Tin nhắn/Khám phá: khôi phục nút Đề xuất có chữ/nền cam nhạt và nút + Tạo yêu cầu nền cam; giữ vùng chạm tối thiểu 44px, route và phần bố cục gọn. TypeScript, lint/Prettier scoped và whitespace PASS; test Inbox 5/5 PASS; browser hai màn thật với fixture 320/390/430px/chữ 130% PASS, điều hướng `/proposals` và `/requests/new` đúng. Artifacts ignored `.expo/restore-header-actions-preview/`, `.expo/restore-header-actions-{tests,browser}.log`. Không chạy lại full suite cho phần trình bày này.

## Giới hạn còn mở

Android/iOS, bàn phím thiết bị, TalkBack/VoiceOver và luồng tài khoản thật **NOT_RUN**. Chưa xác minh scanner/storage hoặc giao dịch Credit trên hệ thống triển khai. Lỗi thư viện miễn phí trên API cấu hình vẫn theo [status Tài liệu](../materials-ui/status.md#lỗi-đang-mở--api-thư-viện-miễn-phí-chưa-khả-dụng-trên-bản-triển-khai): source BE có route nhưng bản triển khai được probe trả 404; chỉnh mật độ giao diện không giải quyết việc triển khai route này.
