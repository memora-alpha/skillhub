# Kế hoạch Phase 05–06: Proposal → Chat → Plan → Schedule

## Mục tiêu

Phần bổ sung tổng quan Learning Path, vụ việc participant và điều hướng quyết toán ngày 2026-11-08 được theo dõi tiếp tại [plan LP-06–12](../path-cancellation/plan.md) và [status](../path-cancellation/status.md); giữ các task negotiation/editor tại work này.

Tạo hành trình liên tục từ gửi đề xuất đến chốt lịch học. Mỗi bước cho biết ai cần thao tác, đang chờ điều gì và bước tiếp theo; người dùng có thể trở lại Chat khi thương lượng.

Phạm vi Phase 05–06 nằm trong một work với hai mốc bên dưới. Giữ số các phase khác và lịch sử cũ.

## Phạm vi và nguồn đối chiếu

- Triển khai trong `apps/mobile`; backend chỉ đọc để đối chiếu. Không dùng Spec Kit hoặc tự mở rộng API/shared packages.
- Tái sử dụng theme, font, components và HTTP/session/query runtime của app. UI bằng React Native; giữ các thay đổi sản phẩm đã thống nhất.
- [SRS 1.6](../../../../../docs/SRS_SkillHub_V1.6_VietLai_DongBoNghiepVu.docx), [domain rules](../../domain-rules.md), [contract của luồng](../../contracts/proposal-learning-agreement.md) và [workflow mobile](../../workflow.md).
- Đối chiếu source thay vì suy implementation từ tài liệu cũ. Phân biệt dữ liệu API, fixture kiểm thử và nghiệm thu API/native.
- Dạy thử là tính năng tùy chọn dự kiến, chưa có API: chỉ ghi backlog/dependency, không triển khai UI/mock và không chặn luồng hiện tại. Session media, settlement, review/dispute và Wallet top-up ngoài phạm vi.

## Mốc 1 — Proposal & Chat

Luồng: Learning Request hoặc Sharing Skill → gửi proposal → Đã gửi → người nhận accept → Chat.

- [x] Dọn component/props/nhánh UI/style không còn consumer sau thiết kế gọn; khôi phục8 test Proposal cũ và tách test focus mới; full checks, web export và fixture không đổi hành vi. Sau khi kiểm tra mức sẵn sàng, chia commit local theo yêu cầu tiếp của người dùng; giữ API/native acceptance riêng.

- [x] Sửa mobile sau rà liên feature: preflight/gửi/sửa/chấp nhận và recovery Proposal chỉ điều hướng trong lượt mở màn hiện tại, giữ session/idempotency; bỏ giới hạn tổng 100 Path lỗi thời khi danh sách đã phân trang đủ. Đưa Cài đặt thành icon bánh răng cạnh Chỉnh sửa trên hồ sơ riêng và sửa khóa chọn ảnh khi picker hoàn tất lúc màn mất focus.

- [x] Chuyển entry xem hồ sơ sang avatar trong Request/Proposal/Session/Skills và self-preview; giữ ngữ cảnh Back và bỏ nút trùng. Sửa hai entry xem đề xuất dùng route `/proposal/[id]` có thật.

- [x] Kiểm tra nguồn, trạng thái bài/kỹ năng, kỹ năng dạy phù hợp và proposal trùng trước khi cho gửi; đọc lỗi không được coi là đủ điều kiện.
- [x] Quản lý Nhận được/Đã gửi; hiển thị proposal đã gửi trên Request; accept/reject/edit/withdraw theo quyền và version.
- [x] Accept mở đúng conversation. Inbox/chat dùng API, avatar thật, tải tin mới nhất trước, phân trang tin cũ và đồng bộ read/delivery/SSE.
- [x] Chat có một entry mở thỏa thuận, giữ ngữ cảnh bài/kỹ năng để phân biệt các cuộc trò chuyện cùng người. Thẻ lộ trình/form xác nhận mở đúng resource và version.
- [x] Chỉnh thẻ tệp trong hàng tin nhắn và ô tệp đã chọn có × trong composer theo hướng Messenger, dùng chung nút Gửi; giờ Inbox theo hôm nay/tuần lịch/ngày tháng. Rút chú thích thỏa thuận/lộ trình/lịch, dùng font nhỏ hơn nội dung chính; kiểm bố cục component thực ở 320/390px và regression.

## Mốc 2 — Plan & Schedule

- [x] Rà/dọn toàn bộ diff trước commit: bỏ metadata số buổi chưa dùng của thẻ xác nhận, tách thẻ mới khỏi đường gom legacy, bỏ export helper chỉ phục vụ test và reset checked lặp. Tái hiện/sửa sự kiện đổi giờ/phút trước render; kiểm đủ tests/types/lint/structure/export và ba fixture, giữ hai lỗi baseline ngoài scope riêng.

- [x] Theo yêu cầu tiếp về danh sách lộ trình, thay bộ lọc Đã xác nhận dễ hiểu nhầm bằng nhóm đủ vòng đời, tách Chờ quyết toán/Tranh chấp; ưu tiên stage BE, fallback status. Nói rõ phạm vi các trang đã tải, giữ filter khi tải thêm, không báo rỗng toàn danh sách khi còn trang và giữ thứ tự/cursor BE.

- [ ] BE bổ sung chi tiết `INVALID_SCHEDULE_ITEMS` trên final-validation/finalize theo [bàn giao](../../contracts/backend-schedule-validation-gap.md): định danh plan/schedule/version/teacher/learner/buổi, reason, giờ DB và policy; public error filter, OpenAPI và HTTP integration tests. Mobile nối schema/hiển thị sau khi contract BE được chốt/triển khai; chưa thực hiện backend trong work này.
- [x] Mobile xóa kết quả kiểm tra cũ ngay khi bắt đầu finalize để không còn thông báo xanh/nút chốt dựa trên validation đã hết giá trị sau khi bị từ chối; guard cả handler, giữ recovery cho kết quả chưa rõ. Regression tái hiện từ lượt review đã được kiểm lại.
- [x] Theo yêu cầu tiếp, đồng ý lịch từng chiều tự gửi thẻ Chat từ receipt sau confirm thành công; hiển thị người xác nhận/chờ ai/đủ xác nhận nhưng chưa chốt, giữ link đúng version và retry tin riêng. Invalidate list/nhóm/preview sau delivery, không giả chưa đọc. Không gửi thẻ chờ chốt cho receipt LOCKED. Source dùng cơ chế form hiện có, bảo đảm bền khi app tắt vẫn cần BE outbox.

- [x] Sửa chọn giờ Android sang hai cột cuộn ngay trong form tạo/sửa lịch; kiểm tra/chốt lịch báo thời gian không hợp lệ phải chỉ rõ chiều dạy, buổi, giờ và lý do từ snapshot hiện tại. API chưa trả chi tiết thì giữ fallback rõ giới hạn; không đoán người sai khi không có bằng chứng local.

- [x] Rà banner/chú thích liên feature theo phản hồi tranh chấp: sửa warning và lỗi hủy để chỉ rõ Credit chờ xử lý; Hold phản ánh trạng thái hủy/tranh chấp/hoàn thành và đã duyệt hủy; consent đã lưu không lấn át blocker quyết toán. Đối chiếu backend, thêm regression; sửa hướng dẫn editor Learning Request theo trạng thái tại work Phase04. Không đổi quyền hay mutation.

- [x] Rà lại toàn bộ phần UI/điều hướng vừa sửa theo yêu cầu: sửa fallback icon/màu trạng thái khi learningStage null, khóa xác nhận lịch trong refresh/read error cả ở handler. Regression trạng thái, blocked/recovery, nhiều buổi/hai chiều, test quyết toán phù hợp yêu cầu đã bỏ nút chung; kiểm toàn bộ mobile và web export. API/native acceptance giữ riêng.

- [x] Theo lựa chọn rõ của người dùng ngày 2026-11-09, Tình hình học tập chỉ giữ tóm tắt, không render danh sách attention và các nút case/Session riêng. Toàn màn Lịch học giữ một nút Xem tất cả buổi học mở danh sách của cả lộ trình, không đi qua tóm tắt vụ việc. Giữ dữ liệu/route vụ việc hiện có cho các luồng riêng.

- [x] Làm rõ điều hướng theo phản hồi nhiều buổi học: tóm tắt vụ việc phân biệt buổi cụ thể với toàn bộ buổi của lộ trình, CTA tổng dùng nhãn Xem tất cả buổi học. Kiểm danh sách gom đầy đủ cả hai chiều và khác tháng. Bỏ card trạng thái chung bị rỗng, dùng thông báo ngắn có mô tả cho hủy/tranh chấp/hoàn thành. Session screen chỉ chỉnh title/số lượng trong phạm vi người dùng yêu cầu, không sửa API hay policy.

- [x] Thiết kế lại màn Lịch học theo phản hồi tiếp: đối tác → bốn bước → tổng quan có dữ liệu → lịch từng chiều → hành động chính. Các chiều dùng dòng phẳng với trạng thái, kỹ năng, số buổi/ngày bắt đầu; nút chính nằm trong phần lịch, chat là thao tác phụ. Giữ một link danh sách Session kể cả read lỗi. Màn lịch từng buổi ưu tiên trạng thái trước hình thức và chuyển chú thích múi giờ xuống dưới; không đổi API/quyền/xác nhận.

- [x] Theo phản hồi tiếp 2026-11-09, đối chiếu source giao diện cũ và đưa phần đối tác về trên thanh bước. Card Tình hình học tập chỉ hiện ở bước Lịch học (theo đính chính của người dùng), trước các nội dung lịch; không lặp ở Cách học/Lộ trình/Hoàn tất và không thêm card đầy đủ vào danh sách. Giữ điều kiện chỉ hiện dữ liệu hữu ích.

- [x] Tinh gọn thỏa thuận theo phản hồi tiếp ngày 2026-11-09: bỏ điều hướng lặp với Back/stepper và nút vụ việc chung; cách học dùng các dòng thông tin, Credit và xác nhận. Tổng quan chỉ trình bày dữ liệu có thật, không hiện nhãn giai đoạn chưa xác định/cảnh báo dữ liệu thiếu; bỏ tổng quan trùng khi đã hoàn tất. Giữ các thao tác cụ thể cần xử lý và lỗi mạng có retry.

- [x] Thiết kế lại list lộ trình và bước Lịch học theo yêu cầu ngày 2026-11-09: thẻ chỉ giữ thông tin nhận diện, trạng thái và một cập nhật ưu tiên; đưa tiến trình bốn bước lên đầu, bỏ metadata/chú thích/nút chat trùng. Nguồn thiết kế là yêu cầu hiện tại và pattern/theme SkillHub trong source, không có frame mới. Giữ API, quyền, confirmation và recovery; tổng quan chi tiết đặt sau nội dung bước đang mở.

Luồng: Chat → Cách học → Lộ trình → Lịch học → server validation/finalize.

- [x] Hai bên chọn và xác nhận ONE_WAY/TWO_WAY; hiển thị bước hiện tại và người cần thao tác, không tạo màn trung gian lặp.
- [x] Teacher tạo/sửa lộ trình của mình; learner đọc chi tiết và xác nhận version. Mỗi buổi có tiêu đề và mô tả tùy chọn.
- [x] Chỉ mở đề xuất lịch khi thỏa thuận và các plan đủ xác nhận. Lịch gắn với plan; hai chiều có lịch riêng và trạng thái chờ riêng.
- [x] Hai bên xác nhận cùng version lịch; backend validation và finalize quyết định Hold/lock/tạo Session. Giữ recovery đúng intent khi mất phản hồi.
- [x] Khi kiểm tra điều kiện hoặc chốt lịch báo thiếu Credit, hiển thị nút Nạp Credit mở màn `/wallet/topup` hiện có.
- [x] Đọc chi tiết xung đột lịch và người thiếu Credit từ response 409. Giữ thông báo dự phòng cho API cũ.
- [x] Cách học/lộ trình và đồng ý từng lịch xác nhận thành công gửi form vào Chat theo yêu cầu cập nhật; thẻ lịch từng chiều giữ riêng người/phiên bản. Chốt lịch thành công gửi một thông báo tổng số Session của cả lộ trình, có nút Xem lịch học. Gửi chat lỗi chỉ retry tin, không thực hiện lại xác nhận/chốt lịch.
- [x] Gộp các card lịch cùng conversation/path thành một thông báo gọn trong history; giữ tin thường/tệp và sequence mới nhất cho read watermark. Card cũ chỉ báo đã xác nhận, không suy ra chốt lịch hoặc tổng buổi từ history chưa đầy đủ.
- [x] Card lịch dùng chung ChatWorkflowCard với card cách học/lộ trình: bố cục, avatar, căn phía người gửi, badge và link Xem lịch học thống nhất; giữ nội dung lịch đã gộp.
- [x] Chuẩn hóa Back/footer, polling nền kết hợp kéo tải lại; bỏ fixture khỏi các route đã có API. Preview còn lại chỉ phục vụ các consumer chưa tích hợp ngoài luồng này.
- [x] Hiển thị từng trang lộ trình trong Hành trình của tôi. Chỉ tải hồ sơ đối tác và tên kỹ năng cho thẻ đang thấy.
- [x] Chi tiết lộ trình dùng chung timeline với chi tiết lịch học: chấm cam có viền nhạt, đường nối nét đứt cam và nội dung buổi bên phải; giữ tiêu đề, mô tả và trạng thái, bỏ khung bao/số tròn lặp. Component dùng chung cũng đồng bộ phần lịch từng buổi trong editor. Dây nối đo chiều cao thực tế khi cảnh báo/editor đổi kích thước và dùng đúng gap của từng consumer để nối tới chấm tiếp theo.
- [x] Editor React mobile cảnh báo trực tiếp ngày, số buổi, hai khung giờ và khoảng trùng trong draft/chiều đối ứng. Tự đối chiếu toàn bộ draft với lịch đã chốt ở Path khác của chính người dùng qua Sessions API, kể cả các thẻ thu gọn/sau Áp dụng lịch tuần; chặn submit khi phát hiện trùng. Mở Sửa để xem riêng ngày đó. Giữ draft khi lỗi và nêu rõ giới hạn lịch riêng của người còn lại.
- [x] Làm mới dữ liệu Session khi áp dụng lại cùng ngày/giờ và trước khi gửi; chặn read lỗi/denied/chưa đầy đủ. Kiểm lại scope/draft sau await, hiển thị số Session đã đối chiếu và kiểm consumer Calendar/Session list.
- [x] Gộp cảnh báo thành một khối ở buổi cần sửa, loại lý do trùng lặp và tránh lặp cùng lỗi ở banner tổng/panel lịch bận; hiển thị khung giờ xung đột và hướng sửa.
- [x] Disable nút Gửi/Lưu ngay khi có xung đột đã biết trong draft, chiều đối ứng hoặc Session ở Path khác; vẫn cho sửa giờ/áp dụng lịch tuần và chỉ mở lại nút khi hết trùng cùng các guard khác hợp lệ.
- [x] Đối chiếu chiều đối ứng theo Path mới nhất mà không reset draft; chặn validation/navigation muộn sau rời editor và vô hiệu hóa callback cũ khi quay lại. Đồng bộ hai test helper đổi lịch với export/thông báo cutoff 60 phút hiện hành.

## Tiêu chí nghiệm thu

### Đồng bộ sửa đổi trước chốt theo BE `187beab`

- [x] Nhận `unchanged: true` và version cũ khi lưu y nguyên; chỉ chấp nhận version tăng đúng một khi có thay đổi, vẫn kiểm resource identity.
- [x] Sửa plan giữ thỏa thuận/xác nhận cách học và plan đối ứng; chỉ learner xác nhận lại plan sửa. Không gửi thêm form Chat khi lưu y nguyên phần đã xác nhận.
- [x] Teacher sửa lịch chưa chốt qua PATCH cùng `expectedVersion`, điền sẵn lịch hiện có; giữ draft và chặn gửi mới khi kết quả chưa rõ.
- [x] Đọc được lịch thiếu buổi ở `NEEDS_REVISION` sau đổi số buổi; chặn confirm/finalize đến khi đủ lịch hợp lệ. Lịch sửa đủ buổi cần hai bên confirm lại.
- [x] Regression cho no-op, version/role, plan revision, lịch giữ/xóa xác nhận đúng phần và schedule editor; cập nhật contract/status theo kết quả thật.

Các quy tắc chi tiết đối chiếu [BE amendments](../../../../../services/api/specs/008-connections/agreement-amendments.md). Backend chỉ đọc; không thay đổi nguồn BE hoặc tạo fixture thay API.

### Điều kiện giữ xuyên suốt

1. Accept proposal chỉ mở Chat, chưa Hold và chưa tạo Session.
2. ONE_WAY có một plan; TWO_WAY có hai plan đối ứng. Người dùng không tạo/sửa thay teacher của chiều còn lại.
3. Learner xác nhận đúng version plan đã đọc; thay đổi phải được xử lý theo snapshot và quy tắc reset xác nhận của backend.
4. Tạo lịch chỉ mở khi thỏa thuận và toàn bộ plan đủ xác nhận. Mỗi lịch thuộc đúng plan, có đủ buổi và hai xác nhận cùng version trước khi chốt.
5. Validation không tự finalize. Chỉ kết quả backend mới xác nhận Hold/Session; retry mất phản hồi dùng đúng intent/key cũ, không tự replay khi reconnect/focus.
6. Loading/error/empty/unknown có hành vi rõ; lỗi refresh chặn mutation phụ thuộc snapshot, không xóa draft tùy tiện. Dữ liệu bị denied hoặc của session cũ không được hồi sinh.
7. Chat/form và Back giữ đúng conversation/resource; API lỗi hoặc route sai không rơi sang fixture. UI dùng theme/font và avatar thống nhất với app.
8. Checks source đạt và giới hạn bằng chứng được ghi trong status. Chỉ đóng phase sản phẩm sau nghiệm thu API/native; không suy từ fixture hoặc web export.

## Kiểm chứng và việc còn lại

- [x] Rà và sửa tiếp trên `fix/mobile-proposal-chat-learning-path` từ `dev`: khóa gửi proposal xuyên suốt preflight/POST, yêu cầu pending read hoàn tất và chặn edit/accept sau lỗi refresh.
- [x] Theo SRS 1.6 mục 18.12/CHAT-002, mở bộ chọn tệp thiết bị trực tiếp từ Chat, upload/scan và gửi ngay tại Chat; giữ caption, file và clientMessageId khi recovery, không tự replay mutation. Giữ route đính kèm cũ tương thích bằng cùng controller.
- [x] Giữ cách nhập lịch “ngày/giờ bắt đầu + học trong bao lâu”; dùng DateTimeField chung với Learning Request và ô nhập số phút 60–180 trực tiếp cho lịch tuần/từng buổi, giữ validation và payload hiện hành.
- [x] Review polling: editor lộ trình/lịch giữ key theo resource, snapshot và draft của bản đã mở; revision mới khóa gửi kể cả callback cũ/validation đang chạy. Chỉ nút mở bản mới reset form; pending/unknown không được bỏ intent để reload. Khi thỏa thuận tạm chưa cho sửa, giữ editor cũ ở chế độ chỉ đọc; khi mất dữ liệu được cấp quyền thì unmount draft.
- [x] Audit source, route, API contract và SRS; ghi dependency thay vì tự sửa backend.
- [x] Review lại toàn luồng: chặn save plan/lịch khi read lỗi giữa lúc validate, kiểm trùng theo timestamp sau giữ phần giây, báo link tệp hết hạn thay vì im lặng; có ca tái hiện và regression giữ draft.
- [x] Rà sau đồng bộ BE avatar: phân biệt trạng thái tệp REJECTED/SCAN_FAILED/UPLOAD_FAILED/CLEANUP_PENDING/DELETED với đang quét; hiện lý do, giữ thao tác bỏ/chọn lại và không gợi ý GET status có thể khởi động lại scan. Giữ recovery cho tin đã được nhận và chặn gửi mọi trạng thái khác READY.
- [x] Regression cho quyền/version, ONE_WAY/TWO_WAY, proposal preflight, chat/form, pagination, read receipts, recovery và navigation; chạy lint, typecheck, structure, tests và web export.
- [ ] **P05-S99-T02 — Nghiệm thu API/native:** hai tài khoản test, cả nguồn Request/direct và ONE_WAY/TWO_WAY; kiểm accept → Chat → plan → lịch → finalize, concurrent edits/version conflict, thiếu Credit/trùng lịch, mất phản hồi, logout/focus, keyboard/picker/Back trên Android và iOS. Chỉ thao tác tài khoản/ví test được cho phép.

## Dependency và ranh giới xử lý

| Hạng mục                                                                                        | Hướng xử lý                                                                                                                                                                                                                                                                                 |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P05-API-DEP-T78:** phát hiện trùng lịch giữa hai chiều trước confirm                          | Mobile đã cảnh báo/chặn gửi overlap đã biết trong Path và tự đối chiếu toàn bộ draft với lịch đã chốt của chính mình ở Path khác. Lịch riêng của người đối diện, conflict phát sinh đồng thời và lỗi BE chi tiết vẫn cần contract/evidence BE; giữ final-validation/finalize authoritative. |
| Tạo path/plan/lịch chưa có server idempotency; tìm path theo conversation bị giới hạn danh sách | Giữ draft/intent và đọc đối chiếu; chặn tạo mới khi kết quả chưa rõ hoặc danh sách đầy, không tự replay.                                                                                                                                                                                    |
| Dạy thử tùy chọn                                                                                | Backlog tương lai cùng dependency backend, không là blocker phase này.                                                                                                                                                                                                                      |
| Hủy/quyết toán và tổng quan sau chốt | Đã có source mobile ở [work Path](../path-cancellation/status.md); giữ nguồn BE authoritative và chưa nghiệm thu API/native. |

Kết quả kiểm tra và bước bàn giao ở [status](status.md). Các task ID, thiết kế trung gian và bằng chứng cũ được giữ trong [history](history.md); không tiếp tục thêm nhật ký lượt sửa vào plan này.
