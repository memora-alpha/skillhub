# Tài liệu — Discover, đăng, mua và thư viện

## Phạm vi

Theo yêu cầu ban đầu và mở rộng: đồng bộ toàn bộ màn tài liệu trên Expo, gồm owner list, đăng/chỉnh sửa, mục Tài liệu trong tab Discover, catalog/chi tiết, xác nhận mua Credit, thư viện/hoàn tiền và mở tệp. Đối chiếu API để bổ sung khả năng chưa dùng. Không thay source BE, ledger, chính sách phí/quyền hoặc shared tooling.

## Nguồn

- SRS1.6: FR-MAT-01..06, BR-42; [UI guide](../../guides/ui-and-styling.md), theme Nunito/appColors và shared Button/Input/InfoModal/RefreshableFlatList.
- [Contract](../../contracts/materials.md), controller/service/policy/view thật được dẫn trong contract.
- Tham khảo [Google Drive search/filter chips](https://support.google.com/drive/answer/2375114?co=GENIE.Platform%3DAndroid&hl=en), [Drive list/grid](https://support.google.com/drive/answer/2375177?co=GENIE.Platform%3DAndroid&hl=en), [Dropbox mobile preview](https://learn.dropbox.com/video-library/how-to-use-the-dropbox-mobile-app). Không lấy assets của các app này.
- Luồng xem/mua/thư viện tham khảo [Gumroad Library](https://gumroad.com/help/article/199-how-do-i-access-my-purchase); chỉ dùng nghiệp vụ Credit/entitlement của SkillHub.
- Checkout tham khảo [Gumroad — payment form](https://gumroad.com/help/article/191-a-guide-to-buying-on-gumroad) và [Kobo — giỏ hàng/checkout](https://help.kobo.com/hc/en-us/articles/360017767333-Buy-eBooks-and-audiobooks-on-Kobo-com): tách sản phẩm đã chọn, phương thức thanh toán và hành động xác nhận. Bố cục sticky/footer, màu và font dùng pattern SkillHub; không lấy assets, thẻ ngân hàng, coupon, subscription hoặc chính sách thanh toán của app tham khảo.
- Phần đánh giá tham khảo [Google Play Books — Ratings and reviews](https://play.google.com/store/books/details/Atomic_Habits_An_Easy_Proven_Way_to_Build_Good_Hab?hl=en-US&id=lFhbDwAAQBAJ) và [Apple Books — Rate and Review](https://support.apple.com/en-ie/guide/books/ibks7c0a2e26/mac): điểm tổng/sao/số lượng một cụm, viết theo thao tác rõ ràng. Bố cục rút gọn là lựa chọn cho SkillHub, giữ Nunito/theme hiện hữu, không sao chép assets hoặc chính sách của app tham khảo.

## Hiện trạng trước sửa

Owner list đã nối cursor/submit/archive nhưng dùng Panel và nhiều nút lớn, trạng thái raw English. BE có reviewedAt chưa parse; nullable scanStatus của draft chưa file bị schema từ chối; minePage thiếu owner check. Mobile khóa sửa/ngừng PENDING_REVIEW sai, lại cho ngừng HIDDEN. Command uncertain không có luồng đọc để mở khóa. Form bắt file mặc dù create nhận fileId optional.

## Task

- [x] Đổi Xem chi tiết từ hộp thông tin sang màn owner riêng đọc private detail, hiển thị đủ nội dung/tệp/người chia sẻ/kỹ năng/trạng thái/kiểm duyệt. Đưa toàn bộ nút quản lý về thẻ và xóa modal/style/state thừa; chi tiết chỉ giữ tải an toàn.
- [x] Xử lý ARCHIVED với trạng thái/cảnh báo ở đầu trang; HTTP404 của owner/public detail có màn không còn khả dụng và đường về Đã đăng/Thư viện. Không suy chắc chắn đã xóa từ404, không hiển thị nội dung cache hoặc footer mua/tải, giữ lỗi mạng/quyền riêng và quyền tải theo đơn mua.

- [x] Đưa Xóa bản nháp/Xóa tài liệu ra thẻ DRAFT/ARCHIVED, bỏ nút lặp trong hộp thông tin; dùng lại xác nhận và controller/version/recovery hiện có. Nút đơn căn giữa, kiểm mở/hủy không DELETE và chỉ xác nhận mới gửi.

- [x] Làm rõ lời giải thích khi xem tài liệu đã ngừng chia sẻ và xác nhận ngừng/đăng lại/xóa; gộp chú thích lặp, bỏ số phiên bản khỏi UI owner detail, giữ rule/API và kiểm preview/regression.

- [x] Rà source/import graph và mock runtime; bỏ helper/style/tham số adapter không còn consumer, gom điều kiện quyền lặp. Chạy full mobile tests, TypeScript/lint/structure, web export, định dạng/whitespace và commit-scope checks.

- [x] Căn lại nhóm nút owner: nhóm thao tác chia đều/wrap, nút đơn căn giữa; mọi nút quản lý nằm trên thẻ, footer chi tiết chỉ giữ tải, xác nhận Hủy/action đều chiều rộng. Đưa Đăng tài liệu mới xuống cuối form bị khóa thay nút Lưu vô hiệu hóa; kiểm preview và regression quyền/lifecycle.

- [x] Đồng bộ BE PR109 `origin/dev@8d89ee25`: parse bộ quyền hasBeenPublished/canEdit/editBlockedReason, khóa sửa sau lần đăng đầu và PENDING_REVIEW; giữ lifecycle độc lập với edit, gửi expectedListingVersion cho submit/archive, xử lý conflict mà không replay và giữ draft. Nội dung/giá mới dùng ID mới.

- [x] Giữ màn chỉnh sửa sau Lưu thay đổi/Lưu bản nháp cho tài liệu hiện có; nhận version/metadata từ receipt, reset form/file/cover đã lưu và toast. Kiểm lưu tiếp, lỗi/phiên cũ và giữ recovery xung đột; tạo mới vẫn về danh sách như trước.
- [x] Ghi luồng mục tiêu tách Ngừng chia sẻ và Xóa mềm, đối chiếu source và lập [danh sách BE cần bổ sung](status.md#be-cần-bổ-sung--tách-ngừng-chia-sẻ-và-xóa-mềm) trước khi sửa runtime.
- [x] Đối chiếu BE PR108 `origin/dev@a4b13dc9`: deletedAt/legacyArchiveUnclassified, DELETE/replay, status filter/owner detail, submit ARCHIVED, withdraw và buyer download/thumbnail.
- [x] Nối owner list theo status, query/cursor riêng; thêm Đã ngừng chia sẻ trong thanh lọc, khóa đổi khi mutation pending/uncertain, cache gỡ row khỏi filter cũ sau transition.
- [x] Nối GET owner detail cho editor/recovery và legacy detail fallback; bỏ helper quét hết owner list không còn consumer.
- [x] Nối đăng lại ARCHIVED nguyên nội dung cùng ID, xóa DRAFT/ARCHIVED có xác nhận/toast, rút duyệt đúng version; thay nội dung/giá của tài liệu từng đăng cần ID mới theo PR109.
- [x] Làm rõ mỗi bài một file nội dung, dùng Thay tệp; bỏ tệp mới giữ file đã gắn, không gửi fileId:null. Ảnh bìa là mục riêng.
- [ ] Nghiệm thu luồng lifecycle mới với API có đăng nhập, migration dữ liệu cũ và Android/iOS; source/fixture không thay nghiệm thu triển khai.

- [x] Đồng bộ phần nhận diện thẻ đã mua với listing hiện tại như Chi tiết; ghi rõ thông tin lúc mua, giữ snapshot/quyền tải/hoàn tiền và giới hạn đọc metadata theo dòng visible/focus; kiểm lỗi metadata, cập nhật và màn nhỏ.
- [x] Làm gọn thẻ đơn mua ở Thư viện: bìa nhỏ, gộp trạng thái/giá, tải/đánh giá cùng hàng; bỏ xổ thông tin, hiện Tệp đã mua và Hoàn tiền trực tiếp với eligibility/chú thích, giữ xác nhận và kiểm màn nhỏ/chữ lớn.
- [x] Đối chiếu quyền người mua cũ khi archive/đăng lại nguyên trạng hoặc thay tệp/giá; giữ snapshot/giá gốc và không tự mua lại/nâng cấp. Thẻ Thư viện giữ thông tin lúc mua; Chi tiết trong Khám phá bỏ khối Bản bạn đã mua và dùng nhãn Tải tài liệu.
- [x] Thiết kế lại màn mua tài liệu: thẻ bìa/nội dung đã chọn, phương thức Ví Credit, chính sách hoàn tiền và tổng/xác nhận cố định dưới; kiểm giá đổi, thiếu Credit, pending/unknown/retry, đơn đã hoàn tiền và màn nhỏ/chữ lớn.
- [x] Bổ sung modal xác nhận mua và gửi duyệt DRAFT; giữ giá/version lúc mở, chặn bấm trùng/giá đổi, hủy không ghi. Rà modal xóa/ngừng chia sẻ/rút duyệt/đăng lại/hoàn tiền; hiển thị tên tài liệu khi xóa và nút Hủy/danger rõ ràng cho xóa tài liệu/đánh giá.
- [x] Chuyển thông báo thành công owner/hoàn tiền/tải tệp sang toast tự ẩn; bỏ banner/state success, giữ lỗi/uncertain và không thông báo thành công từ kết quả chưa rõ hoặc phiên cũ.

- [x] Đổi phản hồi xóa bản nháp thành toast dùng chung, bỏ banner thành công trong danh sách; chỉ thông báo sau receipt hợp lệ, giữ recovery và scope phiên.

- [x] Chỉ cho Ngừng chia sẻ ở PUBLISHED, chặn archive DRAFT/PENDING_REVIEW/REJECTED; bản nháp giữ sửa/gửi duyệt/xóa có xác nhận. ARCHIVED dùng lựa chọn Đã ngừng chia sẻ và Đăng lại theo contract mới.

- [x] Khôi phục card nhóm trong form đăng/chỉnh sửa; thẻ đơn mua ở Thư viện mở trang chi tiết, giữ thao tác tải explicit và snapshot/eligibility; kiểm màn nhỏ/chữ lớn và điều hướng.

- [x] Bỏ tiêu đề Thư viện của bạn và gom nguồn/trạng thái thành một thanh lọc ngang; thu gọn Khám phá thành icon, giữ lọc đơn/chuyển miễn phí/khóa mutation và kiểm màn nhỏ/chữ lớn/keyboard.

- [x] Fetch/đối chiếu toàn bộ origin và probe lại API cấu hình: `origin/dev@cdeea82f` không đổi contract API; endpoint thư viện miễn phí nay trả401 khi không đăng nhập, không còn404 ở lần probe mới.
- [ ] Nghiệm thu thư viện miễn phí có đăng nhập nhận200: tab/list/empty/pagination/refresh và quyền tải. Bằng chứng404 cũ,401 mới và điều kiện nghiệm thu tại [status](status.md#lỗi-đang-mở--api-thư-viện-miễn-phí-chưa-khả-dụng-trên-bản-triển-khai).

- [x] Phân biệt route thư viện miễn phí chưa triển khai (404 không mã nghiệp vụ) với lỗi quyền thật; giữ retry và không fallback dữ liệu local. Probe mới đã nhận401, còn chờ nghiệm thu có đăng nhập; bằng chứng ghi trong status.

- [x] Đồng bộ BE `origin/dev@8a8230aa`: thư viện miễn phí phân trang theo grant, canEdit/editReasonCode cho đánh giá, xóa DRAFT theo version và thông báo lỗi mới; kiểm retry/session/cache và UI nhỏ. Thẻ miễn phí vẫn đọc ownership và xác nhận purchased snapshot khi có đơn mua.

- [x] Đưa bookmark Đã lưu lên góc phải thẻ, bỏ nút dài; giữ chevron mở thông tin trên thẻ bản nháp. Ngừng chia sẻ PUBLISHED dùng eye-off, đồng bộ hộp xác nhận; xóa bản nháp dùng trash qua DELETE/version.

- [x] Làm gọn preview ảnh bìa đã lưu/mới: không hiện tên/link, nút × trên ảnh, Hoàn tác và giữ upload/session/version guards.

- [x] Làm rõ thay tệp đã lưu/giữ bản hiện tại; hiện trạng thái BE trong editor. Bỏ Hủy đăng dùng archive; rút duyệt về DRAFT, đăng lại cùng ID theo contract mới.
- [x] Nối rút PENDING_REVIEW về DRAFT qua withdraw/expectedListingVersion; conflict giữ lỗi/đọc mới, unknown chỉ GET không replay POST.
- [x] Khớp archive PUBLISHED, delete DRAFT/ARCHIVED và submit DRAFT/ARCHIVED; kiểm receipt/session/version, unknown DELETE retry explicit cùng ID/version.

- [x] Rà trước commit: bỏ style placeholder/chế độ review inline cũ/state gỡ cover không còn UI và return dư; kiểm không có mock/fixture trong runtime, giữ test isolation và chạy lại checks/bundle.
- [x] Rà hồi quy lifecycle: khóa chuyển tab/đăng mới khi owner mutation hoặc hoàn tiền pending/uncertain, chặn Bỏ bộ lọc vượt khóa, xử lý ID edit không hợp lệ và bỏ hook/API đọc toàn bộ đơn mua không còn consumer; kiểm source, full suite và browser fixture.
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
- [x] Giữ một file nội dung/bài; thay tệp khi chọn sai, xóa bản nháp/ngừng chia sẻ khi không cần bài. Không yêu cầu BE bổ sung gỡ fileId:null.
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

Dữ liệu owner thật, không fallback fixture khi API lỗi. Search/filter không tự nhận bao phủ chưa tải, không invent total/stats/download count. Luồng mục tiêu: DRAFT xóa mềm; PUBLISHED ngừng chia sẻ thành ARCHIVED; ARCHIVED chưa xóa vẫn quản lý, gửi duyệt lại cùng ID hoặc xóa mềm. Pending rút về DRAFT; HIDDEN giữ moderation guard. Đơn mua/snapshot/quyền/đánh giá không bị xóa hoặc gắn lại sang ID khác. Mutation chưa rõ giữ khóa, recovery theo contract BE đã xác nhận. Source ready không thay nghiệm thu native/deployed API; các transition mới đã nối PR108, còn chờ nghiệm thu có đăng nhập và thiết bị.

Catalog chỉ có PUBLISHED/CLEAN từ BE; list/chi tiết không cấp quyền tải. Mua explicit bằng expectedListingVersion và Idempotency-Key; receipt SUCCESS mới trở lại detail cho phép tải explicit, REFUNDED không coi là đã sở hữu. Retry unknown giữ key/body, không tự POST khi focus/mount/reconnect. Wallet chỉ invalidation/read, không cộng/trừ client. GET download chỉ sau nút Mở/tải, vì cấp URL có thể đánh dấu consumedAt. Thư viện không phụ thuộc public metadata để giữ đơn đã mua, kể cả material archived; BE quyết định tải/refund cuối cùng.
