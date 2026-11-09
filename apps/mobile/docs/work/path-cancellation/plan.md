# Dừng lộ trình và quyết toán Credit trên mobile React

## Bổ sung tổng quan và vụ việc Learning Path — 2026-11-08

Phạm vi mới theo yêu cầu người dùng: cập nhật plan và sửa mobile cho các thông tin/API BE còn thiếu. Backend chỉ đọc. Tái sử dụng card, FlowPage, Copy, RouteButton và trạng thái đọc hiện có; không thay theme hoặc thêm thư viện. Chi tiết thỏa thuận không tự dựng title vì API detail chưa trả field này.

- [x] LP-06: nhận overview trên list/detail và tích hợp GET overview; hiển thị giai đoạn BE, lý do thiếu dữ liệu, tiến độ học/dạy và buổi tiếp theo. Tách giai đoạn học khỏi trạng thái tranh chấp/quyết toán; giữ workflow editor hiện có.
- [x] LP-07: hiển thị attention, người cần xử lý, hạn và hành động dẫn tới đúng Session/yêu cầu hủy/vụ việc; chỉ điều hướng theo target allowlist, không phát command từ overview.
- [x] LP-08: tích hợp danh sách vụ việc có cursor và participant-safe summary; entry từ thỏa thuận và quyết toán. Không dùng báo cáo cá nhân thay cho vụ việc của đối tác/hệ thống, không nhận nội dung/evidence riêng tư.
- [x] LP-09: giữ relatedItems/nextActionTarget của quyết toán và mở đúng resource; loading/error/denied/refresh, owner/session, focus/foreground và read-only polling.
- [x] LP-10: rà lại luồng liên quan đã có: duyệt hủy/dừng nghĩa vụ, quote Credit, consent, hủy buổi, hạn mức học bù/đổi lịch, lifecycle Request và final validation; sửa phần mobile còn lệch, không viết lại chức năng đã có hoặc tự tính tiền.
- [x] LP-11: regression contract, target/cross-path identity, cursor, quyền đọc/session, UI/navigation và consumer; typecheck/lint/structure/full tests. Ghi rõ giới hạn nghiệm thu API thật/native trong status.
- [ ] LP-12: nghiệm thu API triển khai và Android/iOS với hai participant: ONE_WAY/TWO_WAY, vụ việc đối tác/hệ thống, phân trang, dừng học chờ Credit, hoàn tất chờ quyết toán, logout và Back/deep link.

Contract: source `PathOverviewController`, `path-overview.projection.ts`, `ParticipantCasesReader`, `PathTerminationService`, Session policy và Learning Request lifecycle. Field bổ sung vắng toàn bộ trên server cũ phải có fallback rõ; payload mới sai cấu trúc/identity không được dùng làm dữ liệu hợp lệ. API/native acceptance chưa thuộc bằng chứng local.

## Kế hoạch sửa mobile sau rà soát

Nhánh: `fix/learning-path-flow`. Phạm vi triển khai chỉ `apps/mobile`, theo yêu cầu người dùng. Source LP-01–04 đã sửa và kiểm tra cục bộ; nghiệm thu API thật/Android/iOS còn mở. [Audit chi tiết](learning-path-flow-audit.md) ghi bằng chứng và tiêu chí; [status](status.md) ghi kết quả kiểm chứng.

- [x] LP-01: chặn tạo yêu cầu hủy mới trên mobile khi tất cả buổi bắt buộc đã COMPLETED; thống nhất entry và màn mở trực tiếp, dẫn về bước Hoàn tất. Vẫn xem lịch sử và rút yêu cầu cũ theo quyền API.
- [x] LP-02: nhận `title` từ API và hiển thị trên card “Lộ trình của tôi”, có fallback khi thiếu và xử lý tiêu đề dài.
- [x] LP-03: làm rõ ai đã rút yêu cầu, thời gian gửi/rút từ API và trạng thái không còn hiệu lực.
- [x] LP-04: tách yêu cầu hiện tại khỏi lịch sử hủy; giữ điều hướng từ thông báo cũ rõ ràng.
- [x] Kiểm thử cục bộ cho ONE_WAY/TWO_WAY, deep link, trạng thái form khi gửi/rút/gửi lại, refresh lỗi/chậm, title thiếu/dài; xem fixture lịch sử ở 320px không tràn ngang.
- [x] Thiết kế lại màn hủy theo yêu cầu: bỏ card nhóm bao quanh card request, bỏ card con trong Credit; ưu tiên trạng thái/người gửi → lý do → phản hồi/cảnh báo → thời gian → hành động. Credit đặt trước lịch sử, nhóm lịch sử nằm trực tiếp trên nền màn hình; xem fixture320/390 và chạy regression liên quan.
- [x] Tinh chỉnh thiết kế theo phản hồi tiếp: form có nút gửi màu thương hiệu, badge trạng thái có màu theo kết quả, vùng lý do có vạch phân cách, lịch sử là mục phẳng; Credit mặc định thu gọn, mở/đóng chủ động với accessibility expanded. Giữ quyền, xác nhận và recovery.
- [x] Thiết kế lại list lịch sử khi mở: dòng tóm tắt có icon/trạng thái/người gửi/thời gian và lý do tối đa hai dòng; bấm mở từng mục riêng để xem toàn bộ lý do, phản hồi, timeline và quyết định Credit. Thông báo cũ/receipt mới tự mở đúng mục, không phát command từ lịch sử.
- [x] Sửa cảnh báo require cycle Learning Path ↔ Session theo yêu cầu tiếp: dùng public entry state không tải screen cho đối chiếu lịch và Path read/refresh; kiểm dependency graph và regression các consumer.
- [ ] Nghiệm thu API thật và Android/iOS: title dài/chữ lớn, gửi → rút → gửi lại, Back/keyboard, refresh chậm và mở thông báo cũ.

API hiện chưa chặn tạo yêu cầu sau khi học xong; đây là giới hạn ngoài phạm vi sửa mobile. Việc sửa mobile không bảo đảm chặn request từ client khác hoặc race trên server. Không đưa sửa API, transaction, migration, policy tài chính hoặc tự đóng yêu cầu cũ vào checklist này. LP-05 (bộ lọc mới) là đề xuất chưa chốt, chưa triển khai.

## Bối cảnh triển khai trước đó

Phạm vi: `apps/mobile`, nhánh `feat/mobile-path-cancellation` từ `origin/dev@14880432`. Backend chỉ được đọc để đối chiếu; không sửa API, migration hoặc policy.

Đối chiếu tiếp trên `origin/dev@aefd324f` (PR79): chỉ bổ sung phần hủy/quyết toán lộ trình. Người dùng yêu cầu không chỉnh Session; các thay đổi liên quan hạn mức học bù/đổi lịch được ghi là ngoài phạm vi lượt này. Wallet chỉ thêm public hook làm mới read cache theo owner/generation sau khi backend trả kết quả tài chính terminal, không tự cập nhật số dư.

Lượt hiện tại: BE `b4d5ed65` (PR82), đã có trên baseline mobile `0cb0636d`. Tiếp nhận quote và ngữ nghĩa duyệt hủy mới trong phạm vi Path; không sửa Session, Backend, cấu hình/migration hoặc công thức tài chính.

Nguồn nghiệp vụ: SRS1.6 §18.20 và quy tắc Held/ONE_WAY/TWO_WAY. Backend đã có `specs/013-learning-cancellation/contracts.md`, `PathTerminationController`, `PathSettlementStatusService`, `LearningChangeState`, `PathTerminationLedgerService` và publisher thông báo. Đây là bằng chứng source, chưa xác nhận deployment.

Thiết kế: tái sử dụng FlowPage/FlowSection, Button/Input/FormNotice, theme/font và pattern xem lại trước khi gửi trong luồng thỏa thuận hiện có. Không có frame thiết kế mới được cung cấp.

## Công việc

- [x] Đồng bộ PR82 (`b4d5ed65`): participant quote, approval receipt trước phân bổ tiền, dừng nghĩa vụ khi duyệt và worker quyết toán sau blockers.
- [x] Bổ sung approvedAt/terminationApprovedAt, khóa thao tác sau duyệt; thay copy chờ Admin, phân biệt đã duyệt với APPLIED.
- [x] Preview Credit theo chủ khoản, giữ chuỗi BE, thông báo snapshot cũ/kết luận buổi/tranh chấp/policy, không tính công thức ở mobile.
- [x] Dọn quote read model còn dữ liệu mobile sử dụng và bỏ tham số hook luôn true; giữ validation tiền/identity, retry và query scope.
- [x] Xác minh API, trạng thái, quyền participant, version, idempotency và giới hạn policy.
- [x] Adapter có validation boundary cho danh sách yêu cầu, gửi/phản hồi/rút/chuyển nhân viên và trạng thái quyết toán.
- [x] Thay màn chưa hỗ trợ bằng luồng thật; thêm entry từ thỏa thuận đã khóa, bước xem lại, loading/error/empty/recovery, scope theo user/generation và refresh chỉ đọc.
- [x] Việt hóa thông báo thay đổi, điều hướng bằng UUID tới yêu cầu liên quan và xử lý trường hợp thông báo hủy buổi không có trong danh sách dừng.
- [x] Hiển thị blockers/quyết định phân bổ Credit chính xác bằng chuỗi, dẫn đến sổ ví; không tính mức phạt hoặc gọi Admin execute từ mobile.
- [x] Regression API, policy, thông báo, UI xác nhận/retry/đổi session và consumer điều hướng.
- [x] Hoàn thành kiểm tra tự động và ghi evidence cuối trong [status](status.md).
- [x] Đối chiếu contract BE mới: API termination participant không đổi; settlement-status thêm locked version, deadline và consent của hai bên.
- [x] Tích hợp xác nhận quyết toán sớm riêng với xác nhận completion; đọc mới trước POST, retry chỉ theo thao tác rõ ràng, không tự coi HTTP200 là tiền đã chuyển.
- [x] Đồng bộ trạng thái Path/list và làm mới read ví theo đúng phiên khi backend xác nhận SETTLED/TERMINATED; regression quyền đọc và scope.
- [x] Giữ nguyên source/test Session theo phạm vi người dùng đã chốt.
- [x] Tinh gọn UI: nút “Hủy lộ trình”; bỏ card/nút kiểm tra quyết toán ở màn đang học; chỉ hiện tổng kết nổi bật sau khi đủ các buổi hoàn thành.
- [x] Đếm thời gian dự kiến từ deadline BE; thiết kế lại thẻ trắng, xác nhận quyết toán sớm trong hộp riêng, ghi chú quan trọng đỏ và cảnh báo vàng; nút hủy lộ trình đỏ. Không thay quy tắc tài chính.
- [x] Kiểm bản xem trước component ở390px/320px: mở/đóng xác nhận, màu ghi chú, trạng thái đã quyết toán; fixture không gửi giao dịch thật.
- [x] Thống nhất CTA xem buổi học sau chốt lịch trong progress/Hold sang `/paths/[id]/sessions`; giữ review lịch trước chốt và source Session.
- [x] Thống nhất thanh bốn bước Cách học/Lộ trình/Lịch học/Hoàn tất; đủ buổi mở bước4, xem lại ba bước đầu chỉ đọc trên cùng thanh; bỏ mục thu gọn riêng. Tách học xong và đã quyết toán.
- [x] Thiết kế gọn màn hủy, xác nhận gửi bằng modal có lý do/lưu ý vàng và đỏ; giữ immutable intent/recovery, chỉ mở ghi chú hỗ trợ khi người dùng chọn chuyển nhân viên.
- [x] Tách thao tác theo vai trò: người nhận chỉ đồng ý/không đồng ý, hỗ trợ chỉ cho người gửi PENDING; ẩn sau ACCEPTED/STAFF_REVIEW, modal riêng cho các phản hồi và cập nhật card từ receipt BE.
- [x] Gộp blockers thành một banner nói rõ yêu cầu đã gửi/chưa hủy; entry và form đổi nhãn theo request BE đang mở, vẫn mở được chi tiết và không tạo thêm yêu cầu.
- [ ] Nghiệm thu API đích hai participant và Android/iOS.

## Tiêu chí

Gửi yêu cầu chưa dừng lịch học hay thay đổi ví. Theo PR82, partner đồng ý hoặc Staff/Admin duyệt thì BE dừng các buổi tương lai và thử quyết toán; ACCEPTED/approvedAt còn chờ khác APPLIED/operationId đã xử lý Credit. Không đồng ý chuyển STAFF_REVIEW. Chỉ người gửi được rút trước duyệt; sau ACCEPTED/approvedAt không có thao tác participant tiếp. Khi không rõ kết quả, giữ nguyên ý định và chỉ kiểm tra/gửi lại khi người dùng bấm; focus/reconnect/polling chỉ GET. Khi quyền đọc bị từ chối, không hiển thị cache riêng tư. Giao dịch và trạng thái terminal chỉ lấy từ backend.

Quyết toán sớm: dùng `pathVersion` và `immediateSettlement.canApprove` từ BE; thiếu fields mới thì không hiện quyền đồng ý. Đọc lại quyền/version ngay trước gửi. Cả hai đồng ý chỉ bỏ thời gian chờ, không vượt tranh chấp/yêu cầu dừng hoặc điều kiện tài chính. Hiện trạng thái từng bên và `autoSettlementAt`; báo cáo mới có thể xóa consent nên lần đồng ý mới vẫn phải do người dùng thực hiện. Receipt WAITING/RETRYING/NEEDS_REVIEW không là bằng chứng đã chuyển tiền.

Không hard-code tỷ lệ phạt/refund hoặc dùng 96%/4% của completion cho termination. Policy chưa được operator duyệt phải hiện `awaitingPolicy`. Blocker tranh chấp, thời hạn khiếu nại, retry và cần hỗ trợ phải được phân biệt.

## Giới hạn đã xác minh

- API danh sách trả tối đa 100 yêu cầu gần nhất, không có pagination/detail participant cho yêu cầu cũ hơn.
- `learning-path.change.updated` chỉ gửi Path/request IDs, không có kind hoặc Session ID; không thể xác định hủy buổi hay dừng cả lộ trình chỉ từ payload. Mobile ưu tiên yêu cầu dừng khớp ID; nếu không có thì chỉ dẫn xem các buổi học.
- Quote và quyết định mới có userId của khoản tạm giữ; hiển thị theo chủ khoản. Quyết định cũ thiếu userId giữ nhãn trung lập; sổ ví là nguồn giao dịch đã ghi nhận.
- Backend ghi RELEASE/ADJUSTMENT/PLATFORM_FEE khi dừng, không bảo đảm có transaction `PENALTY`; mobile không suy phí hoặc toàn bộ phần chuyển đối tác thành một mức phạt đã chốt.
