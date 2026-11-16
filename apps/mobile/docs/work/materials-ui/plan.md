# Tài liệu — Discover, đăng, mua và thư viện

## Phạm vi

Theo yêu cầu ban đầu và mở rộng: đồng bộ toàn bộ màn tài liệu trên Expo, gồm owner list, đăng/chỉnh sửa, mục Tài liệu trong tab Discover, catalog/chi tiết, xác nhận mua Credit, thư viện/hoàn tiền và mở tệp. Đối chiếu API để bổ sung khả năng chưa dùng. Không thay source BE, ledger, chính sách phí/quyền hoặc shared tooling.

## Nguồn

- SRS1.6: FR-MAT-01..06, BR-42; [UI guide](../../guides/ui-and-styling.md), theme Nunito/appColors và shared Button/Input/InfoModal/RefreshableFlatList.
- [Contract](../../contracts/materials.md), controller/service/policy/view thật được dẫn trong contract.
- Tham khảo [Google Drive search/filter chips](https://support.google.com/drive/answer/2375114?co=GENIE.Platform%3DAndroid&hl=en), [Drive list/grid](https://support.google.com/drive/answer/2375177?co=GENIE.Platform%3DAndroid&hl=en), [Dropbox mobile preview](https://learn.dropbox.com/video-library/how-to-use-the-dropbox-mobile-app). Không lấy assets của các app này.
- Luồng xem/mua/thư viện tham khảo [Gumroad Library](https://gumroad.com/help/article/199-how-do-i-access-my-purchase); chỉ dùng nghiệp vụ Credit/entitlement của SkillHub.
- Phần đánh giá tham khảo [Google Play Books — Ratings and reviews](https://play.google.com/store/books/details/Atomic_Habits_An_Easy_Proven_Way_to_Build_Good_Hab?hl=en-US&id=lFhbDwAAQBAJ) và [Apple Books — Rate and Review](https://support.apple.com/en-ie/guide/books/ibks7c0a2e26/mac): điểm tổng/sao/số lượng một cụm, viết theo thao tác rõ ràng. Bố cục rút gọn là lựa chọn cho SkillHub, giữ Nunito/theme hiện hữu, không sao chép assets hoặc chính sách của app tham khảo.

## Hiện trạng trước sửa

Owner list đã nối cursor/submit/archive nhưng dùng Panel và nhiều nút lớn, trạng thái raw English. BE có reviewedAt chưa parse; nullable scanStatus của draft chưa file bị schema từ chối; minePage thiếu owner check. Mobile khóa sửa/ngừng PENDING_REVIEW sai, lại cho ngừng HIDDEN. Command uncertain không có luồng đọc để mở khóa. Form bắt file mặc dù create nhận fileId optional.

## Task

- [x] Đổi phản hồi xóa bản nháp thành toast dùng chung, bỏ banner thành công trong danh sách; chỉ thông báo sau receipt hợp lệ, giữ recovery và scope phiên.

- [x] Bỏ lưu trữ ở bản nháp trên mobile, chặn cả dispatch archive DRAFT; giữ sửa/gửi duyệt/xóa có xác nhận và các thao tác ở trạng thái khác.

- [x] Khôi phục card nhóm trong form đăng/chỉnh sửa; thẻ đơn mua ở Thư viện mở trang chi tiết, giữ thao tác tải explicit và snapshot/eligibility; kiểm màn nhỏ/chữ lớn và điều hướng.

- [x] Bỏ tiêu đề Thư viện của bạn và gom nguồn/trạng thái thành một thanh lọc ngang; thu gọn Khám phá thành icon, giữ lọc đơn/chuyển miễn phí/khóa mutation và kiểm màn nhỏ/chữ lớn/keyboard.

- [ ] Đóng lỗi API thư viện miễn phí trên bản triển khai: xác minh BE có GET `/api/v1/me/material-library/free`, kiểm tra có đăng nhập nhận200 và nghiệm thu tab/list/empty/pagination/refresh. Bằng chứng404 và điều kiện đóng lỗi tại [status](status.md#lỗi-đang-mở--api-thư-viện-miễn-phí-chưa-khả-dụng-trên-bản-triển-khai).

- [x] Phân biệt route thư viện miễn phí chưa triển khai (404 không mã nghiệp vụ) với lỗi quyền thật; giữ retry và không fallback dữ liệu local. Probe API cấu hình ghi trong status, nghiệm thu có đăng nhập chờ BE triển khai route.

- [x] Đồng bộ BE `origin/dev@8a8230aa`: thư viện miễn phí phân trang theo grant, canEdit/editReasonCode cho đánh giá, xóa DRAFT theo version và thông báo lỗi mới; kiểm retry/session/cache và UI nhỏ. Thẻ miễn phí vẫn đọc ownership và xác nhận purchased snapshot khi có đơn mua.

- [x] Đưa bookmark Đã lưu lên góc phải thẻ, bỏ nút dài; giữ chevron mở thông tin trên thẻ bản nháp. Lưu trữ REJECTED nằm trong hộp thông tin, dùng icon archive; hủy đăng dùng ×, ngừng chia sẻ dùng eye-off, đồng bộ cả hộp xác nhận. DRAFT chỉ giữ xóa có xác nhận qua DELETE/version, không có lưu trữ.

- [x] Làm gọn preview ảnh bìa đã lưu/mới: không hiện tên/link, nút × trên ảnh, Hoàn tác và giữ upload/session/version guards.

- [x] Làm rõ thay tệp đã lưu/giữ bản hiện tại; hiện trạng thái BE trong editor và phân biệt hủy đăng khi chờ duyệt với ngừng chia sẻ khi đã đăng, giữ archive không khôi phục.

- [x] Rà trước commit: bỏ style placeholder/chế độ review inline cũ/state gỡ cover không còn UI và return dư; kiểm không có mock/fixture trong runtime, giữ test isolation và chạy lại checks/bundle.
- [x] Chặn form edit khởi tạo từ owner cache cũ: fresh read trước mount, giữ draft khi refresh sau đó và khóa lưu lúc read pending/error; khôi phục quyền phân phối theo timestamp BE, không tự bật/tắt khi người dùng đang sửa, dùng thông báo version conflict trung tính.
- [x] Giảm trễ đọc trạng thái scan ở app: đọc1s trong10s đầu,2s tới30s rồi5s; tách nhãn chờ hàng đợi/quét thực, kiểm regression phát hiện READY nhanh và giữ bounded timeout/terminal guards. Không coi tối ưu polling là rút ngắn thời gian quét BE.
- [x] Làm gọn upload trong editor: bỏ nút kiểm tra trạng thái thường trực/note lặp/gỡ cover đã lưu; tự GET trạng thái có giới hạn thời gian, hủy theo lifecycle/session và chỉ mở lưu khi BE READY. Giữ retry chỉ đọc khi lỗi/chậm và không tự upload lại.
- [x] Đồng bộ các tiêu đề empty/dialog của phần tài liệu sang Nunito và typography chung; bỏ fallback Fraunces ở Đã lưu, invalid review, xóa/báo cáo review và xác nhận tải.
- [x] Đổi Tài liệu của tôi thành hub Thư viện/Đã đăng/Đã lưu; mặc định Thư viện, giữ route library cũ bằng redirect, save/back owner trở về Đã đăng và đổi archive thành Ngừng chia sẻ.
- [x] Đưa viết/xem/sửa/xóa review vào route riêng mở từ thư viện; detail chỉ đọc nhận xét, bao gồm own review VISIBLE và không cho tự report. Giữ policy/version/idempotency/recovery.
- [x] Nối API yêu thích mới theo tài khoản: detail lưu/bỏ lưu, tab Đã lưu có cursor/loading/error/retry; không lưu cục bộ, không suy trạng thái từ trang đầu.
- [x] Nhận purchasedMaterial/review/refundEligibility trên orders; hiển thị bản đã mua, khóa hoàn tiền theo BE, giảm đọc từng dòng và cập nhật sau cấp URL; giữ policy review sau hoàn tiền/mua lại.
- [x] Nhận owner cover projection, hiển thị bìa đã lưu, đổi/gỡ khi Lưu và giữ draft/version/recovery.
- [x] Danh sách tài liệu miễn phí đã tải dùng API BE theo grant ISSUED, có phân trang/refresh/loading/error/retry; không lưu cục bộ.
- [ ] Gỡ file nội dung đã gắn: BE từ chối fileId:null bằng MATERIAL_FILE_REMOVAL_UNSUPPORTED; giữ khả năng thay tệp, không thêm thao tác gỡ chưa được hỗ trợ.
- [x] Gom loading chi tiết tài liệu: skeleton chung khi mở, bỏ spinner từng section, tải nền review/đề xuất và giữ nội dung khi refresh; giữ khóa quyền mua/tải và error/retry.
- [x] Rút gọn UI đánh giá: summary một cụm, form đóng mặc định, hàng nhận xét phẳng có avatar; bỏ nhãn/ngày/nút tải lại/banner lặp và không hiện review của mình hai lần. Giữ error/recovery, version/idempotency và xác nhận xóa.
- [x] Kiểm tác động compact rating picker tới consumer cũ, browser nhỏ/chữ lớn và cập nhật contract/status.

- [x] Đồng bộ spec016 BE: review list/summary, eligibility, tạo/sửa/xóa/báo cáo; giữ version, idempotency và recovery theo session.
- [x] Nhận thumbnail signed có hạn, fallback khi lỗi/hết hạn; upload/thay/gỡ cover theo policy JPEG/PNG/WEBP 10MB và scanner READY.
- [x] Kiểm regression API/upload/lifecycle, workspace checks và cập nhật contract/status theo kết quả thực tế.

- [x] Đọc SRS, controller/DTO/service/policy và fetch origin/dev để đối chiếu owner API.
- [x] Thiết kế list ảo hóa, card tệp, trạng thái Việt, search/filter cam, chi tiết và xác nhận lưu trữ, empty/error/pull refresh.
- [x] Parse nullable/reviewedAt, kiểm ownership/receipt; giữ cursor và session scope.
- [x] Khớp sửa/lưu trữ với BE, lưu nháp không file, gửi duyệt theo file CLEAN/quyền phân phối.
- [x] Có read reconciliation khi kết quả POST không rõ; không replay POST.
- [x] Kiểm tra adapter, editor, controller/session, browser nhỏ/chữ lớn và workspace checks; cập nhật contract/status.
- [x] Thêm tab Tài liệu trong Discover, giữ RequestsFeed ở chế độ embedded với logic cũ; catalog thật có q/accessType/skillId/page và total server.
- [x] Thiết kế form theo nhóm, picker kỹ năng dạng modal riêng, checkbox xác nhận quyền, giá điều kiện; giữ upload/scan20MB và bản nháp khi lỗi.
- [x] Đồng bộ chi tiết/người chia sẻ, xác nhận mua/Wallet read, thư viện/refund và mở file; không prefetch signed URL.
- [x] Giữ version/key mua khi retry explicit, xử lý receipt REFUNDED, refresh Wallet đúng runtime scope; test browser toàn hành trình và các ca lỗi tài chính.
- [x] Sửa cảnh báo VirtualizedList lồng trong ScrollView: native Modal cô lập context và chỉ mount danh sách khi mở; test hồi quy boundary/chọn/đóng.
- [x] Thiết kế lại Discover/detail với bìa định dạng mặc định và thẻ ngang, thu gọn header; không dùng signed download hoặc ảnh mẫu làm preview tài liệu.

- [x] Làm gọn detail, bỏ note đã mua/shortcut catalog; tab Discover gạch chân cam. Search cùng pattern Yêu cầu học; gom giá/kỹ năng vào sheet Lọc có draft/Đặt lại/Áp dụng.
- [x] Tách loading context của modal kỹ năng, giữ đóng/Back hoạt động khi read pending/error; kiểm hồi quy browser editor/Discover.
- [x] Sửa nội dung danh sách kỹ năng dùng flexGrow thay flex để cuộn được danh mục dài trong modal đăng tài liệu.
- [x] Kiểm tra lưu nháp không tệp, chặn form thiếu thông tin; Việt hóa lỗi giá, thêm tổng hợp lỗi và thống nhất báo lỗi kỹ năng/quyền phân phối.
- [x] Chuyển picker kỹ năng thành sheet kéo xuống đóng, hạ header dưới thanh kéo; giữ Modal cô lập danh sách và kiểm cuộn/chọn/đóng.
- [x] Khớp định dạng upload với policy PDF/DOCX/XLSX/PPTX, chú thích phần mở rộng/20MB và báo lỗi từng bước; chuẩn hóa MIME chung của native DOCX, kiểm hồi quy retry và READY.

- [x] Dùng trực tiếp SkillSelector của Yêu cầu học qua public entry cho bộ lọc Tài liệu; kiểm consumer/shared sheet, giữ đóng khi loading và giảm total xuống metadata13.

- [x] Detail theo bố cục Apple Books/Kobo; report góc phải header, badge mua/miễn phí/owner và pending/error dựa vào API, không false Chưa mua khi chưa rõ.

- [x] Tải trực tiếp trên detail/library, purchase trở lại detail; chọn nơi lưu/confirm trước issue URL, save và session/cancel/double-tap guards.
- [x] Thêm đề xuất cùng kỹ năng từ catalog, link lọc Discover, placeholder đánh giá/bình luận Sắp có; không giả lập API/sao/count.

- [x] Chặn tải khi quyền mua chưa đọc xong/khi đọc lỗi, kể cả listing miễn phí; chuẩn hóa File MIME trên web, giữ đuôi Office khi tải và thêm đối chiếu/khôi phục form khi xung đột phiên bản.

## Tiêu chí nghiệm thu

Dữ liệu owner thật, không fallback fixture khi API lỗi. Search/filter không tự nhận bao phủ chưa tải, không invent total/stats/download count. Đọc được draft không file, pending sửa/lưu trữ được, hidden/archived chỉ đọc; POST chưa rõ giữ khóa và kiểm tra bằng GET. Chưa có API restore thì không thêm nút phục hồi. Source ready không thay nghiệm thu native/deployed API.

Catalog chỉ có PUBLISHED/CLEAN từ BE; list/chi tiết không cấp quyền tải. Mua explicit bằng expectedListingVersion và Idempotency-Key; receipt SUCCESS mới trở lại detail cho phép tải explicit, REFUNDED không coi là đã sở hữu. Retry unknown giữ key/body, không tự POST khi focus/mount/reconnect. Wallet chỉ invalidation/read, không cộng/trừ client. GET download chỉ sau nút Mở/tải, vì cấp URL có thể đánh dấu consumedAt. Thư viện không phụ thuộc public metadata để giữ đơn đã mua, kể cả material archived; BE quyết định tải/refund cuối cùng.
