# Đồng nhất giao diện Report

## Phạm vi

Theo yêu cầu người dùng trên `fix/mobile-session-ui`: thiết kế lại tạo báo cáo, danh sách, chi tiết và trao đổi riêng; giữ palette/Nunito, Button/Input/ChoiceGroup, keyboard-aware scroll và API/owner guards hiện có. Không sửa backend, contract BE, dependency hoặc tự thêm SLA/hoàn Credit/quyền download. Parser mobile cập nhật theo contract BE đã có khi được yêu cầu đồng bộ.

Nguồn UI: pattern hiện tại của Session/Profile, hướng chọn lý do → mô tả → bằng chứng tùy chọn theo [Airbnb](https://www.airbnb.com/help/article/3598), [Google](https://support.google.com/websearch/answer/6223687?co=GENIE.Platform%3DAndroid&hl=en). Chỉ tham khảo cấu trúc, không sao chép assets hoặc tuyên bố pixel-match.

Trao đổi hỗ trợ tham khảo vùng soạn tin và cách tổ chức tệp của [Intercom Messenger](https://www.intercom.com/help/en/articles/12130647-sharing-files-and-images-in-the-messenger), [Zendesk Messaging](https://developer.zendesk.com/documentation/zendesk-web-widget-sdks/sdks/android/supported_message_types/) và ChatComposer đang có trong app. Không sao chép giới hạn upload/quyền hoặc thay API SkillHub theo các sản phẩm tham khảo.

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
- [x] REPORT-UI-13 Đồng bộ mobile với BE `1c706f9d`: nhận capabilities theo viewer ở case list/summary, tách quyền message/evidence và quota; dùng evidenceCount/metadata legacy + current; routing canonical relatedPathId; giữ snapshot reporting/reportBy trên Session. Không sửa BE hoặc khôi phục precheck eligibility trước form.
- [x] REPORT-UI-14 Theo yêu cầu mới, dùng reporting BE để hiện hạn/khóa CTA Session và kiểm tra trước form; đọc lại trước gửi và sau scan, refresh ở boundary theo interval server, giữ draft khi bị khóa. Không thêm rule chỉ được report sau buổi học; Material không lấy hạn Session.
- [x] REPORT-UI-15 Nối notification xác nhận lịch; bỏ auto TEXT khi confirm/finalize vì BE đã phát SYSTEM, giữ đọc thẻ lịch sử và share nội dung khác; nhận lastActivityAt và reset toàn bộ owner-scoped pages khi cursor cũ bị từ chối.
- [x] REPORT-UI-16 Dọn trạng thái hết hạn: nhãn Đã hết hạn cùng hàng với Báo sự cố, bỏ dòng giải thích lặp phía dưới; giữ CTA disabled và hạn hiển thị khi còn được gửi.
- [x] REPORT-UI-17 Theo chỉnh sửa tiếp, thống nhất hạn gửi/hết hạn/các lý do khóa trong một khối nhắc bên dưới Báo sự cố, căn theo nhãn; chữ nhỏ màu info, nền infoSoft, bỏ badge riêng để hai trạng thái cùng bố cục.
- [x] REPORT-UI-18 Khóa Gửi báo cáo ngay tại mốc hết hạn từ snapshot BE và tuổi cache, không chờ GET cập nhật xong; ưu tiên copy hết hạn trong lúc recheck, dừng scan và giữ draft. Khi còn hạn vẫn gửi theo quyền BE.
- [x] REPORT-UI-19 Session có báo cáo của caller thì thay Báo sự cố bằng một Xem báo cáo mở đúng chi tiết (ưu tiên case mở, rồi báo cáo gần nhất), bỏ các hàng CTA trùng. Rút hạn thành Gửi trước HH:mm · dd/MM/yyyy. Dọn owner detail: bỏ link Session/Path dư, xếp nội dung trước phản hồi, giữ trao đổi/bằng chứng; Material giữ link tài liệu.
- [x] REPORT-UI-20 Thêm nhóm Hỗ trợ trong Hồ sơ trước Đăng xuất, với Báo cáo của tôi mở /reports và Trung tâm trợ giúp mở /help qua navigation hiện có; giữ theme/ProfileSection và shared Button.
- [x] REPORT-UI-21 Thu gọn trao đổi hỗ trợ: đúng thứ tự cũ → mới, mặc định ba tin gần nhất và xem tin trước/pagination; composer/nút gửi cùng hàng, evidence accordion gọn. Tách pull indicator khỏi background refetch để không đẩy khung khi gửi hoặc cập nhật dữ liệu.
- [x] REPORT-UI-22 Theo chỉnh sửa tiếp, đưa giờ ra ngoài bubble, căn trái/phải theo người gửi; ngày tách ở giữa hội thoại, giữ timestamp/accessibility và owner/command guards.
- [x] REPORT-UI-23 Rà toàn bộ mobile diff trước commit, chuyển phần tạo tin lịch chỉ dùng trong test sang fixtures và giữ parser lịch sử. Dọn field hạn dài không có consumer, fragment/link Session dư trong editor và Session preview provider không có người đọc; cập nhật test Hold theo BE SYSTEM. Chạy full suite, workspace checks, export và browser; không tự commit.
- [x] REPORT-UI-24 Sửa danh sách Sonar người dùng cung cấp: giảm Cognitive Complexity, bỏ ternary lồng nhau, readonly/prop thừa, await trong loop và state chỉ để kích render. Tách request card/feedback, giữ payload/owner guards/polling hai worker; kiểm SonarJS cục bộ, regression/full suite và browser. Không sửa BE hoặc tự commit/đánh dấu đóng issue trên SonarCloud.

Phần giờ phòng dựa trên quyết định đã ghi ở `services/api/specs/010-session-livekit/spec.md` và `services/api/docs/livekit-sessions.vi.md`: cửa sổ 10 phút trước/sau, không phải tự chọn rule mới. FE dùng mốc server trả, không hard-code thêm 10 phút. Case có Path dùng quyền từ summary BE mới; không cần lộ handlerId. Notification cũ thiếu path tìm context qua báo cáo của viewer nếu có; case đối tác/system chưa có context vẫn read-only. Case không có Path dùng status/handler/count đã đọc, POST giữ quyền quyết định cuối cùng.

## Consumer và kiểm chứng

ServerFilePicker dùng chung với các feature khác: prop mới additive, callback mặc định không có, giao diện mặc định giữ nguyên. PrivateCaseThread phục vụ cả owner report và support case từ Path; không đổi endpoint/status resolution/gating.

Connection feedback dùng chung: lỗi 409 có mã đã biết dùng catalog hiện có; map riêng của Connections vẫn ưu tiên, lỗi 403/404 và 409 chưa biết giữ cách hiển thị cũ. Không đổi policy hoặc điều kiện gửi báo cáo ở backend.

Editor Session hiện đọc GET Session qua public sessions/state để kiểm tra reporting trước khi nhập; không đọc reports mine để đoán eligibility. Session detail hiện hạn hoặc lý do khóa ngay bên ngoài. Khi gửi đọc lại điều kiện trước scan và sau scan có tệp; BE quyết định cuối qua POST. Hết hạn/lỗi read giữ draft và không POST. Dùng interval reportBy/evaluatedAt cùng tuổi cache để refresh, không tự cộng cửa sổ cố định hoặc lấy giờ tuyệt đối thiết bị để cấp quyền. Material giữ luồng riêng. Giữ validation, upload/scan/owner guards, no-replay và uncertain recovery; import-graph test kiểm cả editor không kéo Session/Learning Path screens qua barrel.

reports/state chỉ cung cấp read caller-scoped để tìm report ID cho Session, không import Report screens. GET reports/mine kiểm reporterId bằng runtime; selector không lấy report của buổi khác/Material, không mutate cache. Entry mới được khai báo rõ trong checker thay vì nới private import rule. Eligibility vẫn do reporting BE; lookup chỉ phục vụ điều hướng và lựa chọn hiển thị theo yêu cầu người dùng.

Fixture browser không thay nghiệm thu API/native/provider. Không gửi báo cáo thật, tin nhắn thật hoặc upload dữ liệu người dùng trong task UI.
