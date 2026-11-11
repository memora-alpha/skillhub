# Đồng nhất giao diện Report

## Phạm vi

Theo yêu cầu người dùng trên `fix/mobile-session-ui`: thiết kế lại tạo báo cáo, danh sách, chi tiết và trao đổi riêng; giữ palette/Nunito, Button/Input/ChoiceGroup, keyboard-aware scroll và API/owner guards hiện có. Không sửa backend, contract, dependency hoặc tự thêm SLA/hoàn Credit/quyền download.

Nguồn UI: pattern hiện tại của Session/Profile, hướng chọn lý do → mô tả → bằng chứng tùy chọn theo [Airbnb](https://www.airbnb.com/help/article/3598), [Google](https://support.google.com/websearch/answer/6223687?co=GENIE.Platform%3DAndroid&hl=en). Chỉ tham khảo cấu trúc, không sao chép assets hoặc tuyên bố pixel-match.

Source là căn cứ hiện trạng: `features/reports/api/reports-api.ts`, hooks và PrivateCaseThread đã nối API; chỉ mục/feature matrix cũ còn mô tả preview nên không dùng làm bằng chứng implementation.

## Task

- [x] REPORT-UI-01 Rà source/route, ranh giới SESSION/MATERIAL và writable/uncertain/owner.
- [x] REPORT-UI-02 Tạo báo cáo theo app: bỏ UUID khỏi UI, chọn loại vấn đề có thể thu gọn, mô tả/counter và bằng chứng riêng, back về đúng ngữ cảnh.
- [x] REPORT-UI-03 Danh sách/card/filter và detail/trạng thái/phản hồi/trao đổi riêng đồng nhất, giữ closed-case read-only và settlement notice.
- [x] REPORT-UI-04 ServerFilePicker thêm `compact`/`onBusyChange` tùy chọn, chỉ Report bật; giữ mặc định cho consumer khác. Khóa submit khi upload chưa xong và tệp chưa READY, giữ payload/permission/không replay.
- [x] REPORT-UI-05 Type/lint/structure, web export, browser flow gồm validation, upload/scan, success, uncertain, filters, closed case và material; ghi kết quả/giới hạn trong status.
- [x] REPORT-UI-06 Sửa thông báo chung HTTP 409 đang che lý do gửi thất bại; dùng message đã biết, thêm lý do buổi đã hủy/bằng chứng trùng và lối mở báo cáo đang xử lý. Giữ fallback lỗi chưa biết, quyền truy cập và không tự gửi lại.
- [x] REPORT-UI-07 Đã triển khai kiểm tra trước bằng API hiện có, sau đó được người dùng thay bằng REPORT-UI-08; source kiểm tra trước đã được gỡ.
- [x] REPORT-UI-08 Theo quyết định mới: bỏ hẳn precheck/banner/khóa form theo hạn hoặc báo cáo đang xử lý, bỏ hook/component/helper và public entry chỉ phục vụ precheck. Báo sự cố mở editor trực tiếp; lý do từ chối chỉ hiện sau POST, giữ draft, chống double-submit và uncertain recovery. Không bổ sung backend eligibility; REPORT-DEP-01 không còn là dependency của phạm vi hiện tại.
- [x] REPORT-AUDIT-01 Đối chiếu API Session/Report và consumer hiện hành, phân biệt thiếu FE/metadata BE/policy cần chốt/API staff-provider; ghi nguồn và giới hạn trong [audit](session-report-api-audit.md). Chưa triển khai các phát hiện.
- [x] REPORT-FIX-01 Theo yêu cầu sửa audit rồi giới hạn lại **chỉ mobile**: thêm NO_SHOW_LATE cho Session; nối entry thread và bốn loại notification; dùng handlerId hiện có để tách gửi message/evidence; đọc số tệp từ API private evidence; theo join.closesAt/AWAITING_CONFIRMATION của BE. Không sửa services/api, không thêm endpoint/field giả hoặc khôi phục Report precheck. Giới hạn dữ liệu BE được giữ rõ trong status/audit.
- [x] REPORT-UI-09 Bỏ liên kết “Mở chi tiết buổi học” và lời nhắc hủy/học bù ở cuối form báo cáo buổi học theo yêu cầu người dùng; dọn style chỉ dùng cho khối này.
- [x] REPORT-UI-10 Thêm Chọn ảnh từ thư viện vào bằng chứng khi tạo/bổ sung Report, giữ chọn tệp. ServerFilePicker có allowPhotos mặc định false để Material không đổi; dùng picker sẵn có, không crop/chủ động nén, định dạng JPG/PNG/WebP, giới hạn count/size/scan và owner guard hiện hành. Không sửa BE; cập nhật permission copy cho ảnh báo cáo.
- [x] REPORT-UI-11 Đặt Chọn ảnh/Chọn tệp cạnh nhau, cùng độ rộng trên một hàng khi allowPhotos bật; giữ giao diện mặc định cho consumer khác. Không thêm menu hoặc đổi luồng upload.
- [x] REPORT-UI-12 Khi bấm gửi, tự đọc/poll trạng thái tệp tới READY rồi mới POST báo cáo/bổ sung bằng chứng. Bỏ kiểm tra thủ công ở Report, thêm X bỏ riêng từng tệp draft. Giữ mặc định Material, không sửa BE; giới hạn polling, khóa gửi lặp, giữ draft khi lỗi, dừng khi đổi owner/rời màn/background và không tự POST khi quay lại.

Phần giờ phòng dựa trên quyết định đã ghi ở `services/api/specs/010-session-livekit/spec.md` và `services/api/docs/livekit-sessions.vi.md`: cửa sổ 10 phút trước/sau, không phải tự chọn rule mới. FE dùng mốc server trả, không hard-code thêm 10 phút. Với case không thuộc reporter và summary không có handler, POST vẫn quyết định quyền gửi; notification thiếu path chỉ mở thread đọc theo viewer, không giả quyền ghi khi chưa biết trạng thái.

## Consumer và kiểm chứng

ServerFilePicker dùng chung với các feature khác: prop mới additive, callback mặc định không có, giao diện mặc định giữ nguyên. PrivateCaseThread phục vụ cả owner report và support case từ Path; không đổi endpoint/status resolution/gating.

Connection feedback dùng chung: lỗi 409 có mã đã biết dùng catalog hiện có; map riêng của Connections vẫn ưu tiên, lỗi 403/404 và 409 chưa biết giữ cách hiển thị cũ. Không đổi policy hoặc điều kiện gửi báo cáo ở backend.

Editor không đọc Session/reports mine để kiểm tra eligibility trước khi gửi. Session detail có link trực tiếp tới editor, kể cả buổi đã hủy; backend quyết định khi POST và app hiển thị đúng lý do, không tự tính hạn. Giữ validation nội dung/target/tệp, khóa upload/scan, owner guards, no-replay và xử lý kết quả chưa rõ. Public state/structure tooling trở lại trước precheck; import-graph test vẫn kiểm Session limits không kéo các screen khác.

Fixture browser không thay nghiệm thu API/native/provider. Không gửi báo cáo thật, tin nhắn thật hoặc upload dữ liệu người dùng trong task UI.
