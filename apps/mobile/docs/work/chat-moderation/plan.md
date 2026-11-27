# Cảnh báo nội dung chat

## Phạm vi và thiết kế

Cảnh báo inline ngay dưới tin chưa gửi, lấy cảm hứng từ TikTok/Messenger: biểu tượng cảnh báo, nền đỏ nhạt và lý do ngắn gọn. Tin bị chặn chỉ báo “Không gửi được tin nhắn”, không có nút sửa/bỏ hoặc gửi lại. Trong lúc chờ gửi chỉ hiển thị “Đang gửi…”, không hiển thị trạng thái kiểm tra nội dung. Dùng theme, font, Icon và composer hiện có của SkillHub; không xác nhận pixel-match với ứng dụng tham khảo.

Thay đổi thuộc mobile. Backend quyết định chặn nội dung, thông tin liên hệ và trạng thái tệp. Theo yêu cầu mới nhất, gỡ NSFW local; không có model hoặc cảnh báo AI phía mobile. Giữ dán ảnh, nén nền, preview/zoom và pipeline kiểm duyệt BE.

## Contract

- `400 CONTACT_INFORMATION_NOT_ALLOWED`: giải thích loại thông tin cần bỏ.
- `422 CONTENT_MODERATION_BLOCKED`: lần gửi bị hủy; không retry cùng ID. Người dùng vẫn có thể soạn và gửi tin khác bình thường.
- `503 CONTENT_MODERATION_TEMPORARILY_UNAVAILABLE`: giữ nội dung và ID để kiểm tra/thử lại đúng lần gửi. Text dùng outbox hiện có; tệp dùng recovery thủ công hiện có.
- Nút Gửi enqueue sau khi chuẩn bị file local; POST dựa trên fresh HTTP `canAttach:true`, legacy thiếu trường mới vẫn cần READY không có moderationStatus. Chỉ AVAILABLE được xem/tải. `REJECTED`/BLOCKED/REVIEW_REQUIRED/FAILED không publish; kiểm duyệt media có thể trả `409 CONTENT_MODERATION_BLOCKED`.
- `409 CONTENT_MODERATION_BLOCKED` từ POST chat xác nhận manifest tệp bị chặn trước commit: mở khóa recovery để người dùng bỏ/đổi tệp và gửi ý định mới với ID mới. Ngoại lệ này chỉ bật cho chat, không áp mọi lỗi 409 ở feature khác.
- POST/retry chat trả `409 FILE_NOT_READY` hoặc media bị chặn sẽ refresh status đúng fileId/conversation/owner. Theo dõi scan chỉ đọc vẫn chạy khi intent đang uncertain; giữ tệp/caption/ID trong recovery và không tự gửi lại mutation.
- Theo BE `2e464e63`, CHAT chỉ upload PDF/DOCX/TXT/JPG/JPEG/PNG/WebP. Status thêm `moderationStatus?`: PENDING tiếp tục đọc, REVIEW_REQUIRED/FAILED dừng chờ tự động và hiển thị đúng kết quả, giữ nguyên state server và quyền gửi. Không sửa scanner, OCR, worker hoặc triển khai backend.

Nguồn: `services/api/src/modules/conversations/presentation/http/conversations.controller.ts`, `services/api/src/modules/conversations/application/services/conversations.service.ts`, `services/api/src/infrastructure/storage/file-content-moderation.ts` và `services/api/docs/content-moderation-rollout.md`.

## Tasks

- [x] Dọn code lặp trong recovery (hủy operation, điều kiện async và trạng thái pending), giữ contract/guards; chạy full mobile và kiểm biến/import không dùng trước commit delta chat đã rà.

- [x] Rà lại delta khôi phục tệp: tái hiện và sửa nút bị kẹt busy khi background→foreground nhanh; hủy operation đồng bộ, giữ chặn POST và không cho phản hồi cũ tác động lần mới. Thêm regression trước/sau sửa, chạy toàn nhóm chat và checks phù hợp; API/native acceptance giữ riêng.

- [x] Đối chiếu BE chat sau fetch `origin/dev@126699c4`, delta `acffedf7` PR #136: canRetry, status tệp đã gửi và POST retry HTTP202. Bổ sung khôi phục lỗi kỹ thuật bằng thao tác thủ công cho outbox/tệp đã gửi của người gửi; GET quyền mới trước POST, giữ file/ID/caption, không replay tự động hoặc mở lại blocked/review/revoked. Cập nhật SSE status theo conversation/file và regression owner/lifecycle/mất phản hồi. Theo yêu cầu người dùng chỉ sửa chat; subscription/recording/whiteboard để sau.

- [x] Dọn phần lặp trước review commit: dùng chung điều kiện chặn preview local, ổn định callback giải phóng ảnh, gộp import và dùng chung kích thước toolbar; siết type moderationStatus và cập nhật guide theo luồng bytes xác thực/preview/thu hồi hiện hành. Chạy checks toàn mobile, giữ nguyên index và chưa commit/push.

- [x] Sửa ba lỗi qua rà soát mobile: lỗi tải ảnh đi theo attachment vào viewer đang mở với retry tải riêng; lỗi decode nguồn local native có validation/timeout 10 giây và retry, không đổi modal/toolbar khi lỗi; PDF REVIEW_REQUIRED hiện “Tệp cần kiểm tra thêm.” và không có download/nhãn tải vô hạn. Giữ guard owner/revoked, thêm regression cho status, forwarding lỗi và callback native đến muộn/timeout.

- [x] Sửa toolbar viewer nhảy cao/thấp: native giữ một modal ImageView xuyên loading/ready/error, không đổi giữa hai Modal; chụp safe-area padding từ màn chat lúc mở, tắt cộng inset động bên trong modal và giữ HeaderComponent cùng identity qua rerender/pending. Loading/error chuyển vào feedback trong modal hiện hữu, không che vùng nút. Kiểm thay đổi inset 48→0, loading/ready/error và trạng thái nút mới vẫn cập nhật.

- [x] Hạ cụm nút X/tải của viewer xuống thêm 20 px (padding top 8 → 28), vẫn cộng safe area; áp dụng chung native/fallback và giữ nguyên thao tác.

- [x] Chỉnh viewer theo tương tác Messenger: nền đen toàn màn hình, nút X/tải dạng icon tròn trắng hai góc trên trong safe area, bỏ hai nút chữ lớn. Bấm tải giữ viewer mở, spinner/disabled chống lặp; close/Back/retry tiếp tục dùng handler hiện có, native giữ pinch/double tap/swipe-close. Kiểm toolbar/loading/error và consumer của card, không đổi download API hoặc thêm thư viện.

- [x] Đổi nhãn pending ảnh/tệp từ kiểm tra/xử lý sang “Đang tải lên…”, giữ preview người gửi. REVIEW_REQUIRED hiển thị “Ảnh cần kiểm tra thêm.” thay vì trạng thái tải vô hạn. Đánh thức status/delivery GET trên cả chat.attachment.updated và chat.attachment.availability.updated; không chờ đủ timer 2 giây khi đã có event, không tin payload làm verdict hay replay POST. Kiểm với clock không tiến và regression mobile; thời gian quét BE chưa đo từ mobile fixture.

- [x] Giữ preview local của người gửi khi tin chuyển từ outbox sang message PENDING_SCAN và trong lúc tải thumbnail AVAILABLE. Bàn giao ownership cleanup sang cache chỉ trong phiên, độc lập outbox reconcile; hỗ trợ SSE đến trước receipt, không cấp preview cho người nhận. Thay ảnh bằng bytes có auth trước khi dọn bản local; thu hồi/verdict cuối/đổi owner dọn cache, vẫn không replay mutation. Kiểm outbox/hook/UI và full mobile.

- [x] Sửa card ảnh lỗi báo tải vô hạn: chỉ hiện “Đang tải ảnh…” khi request thật đang chờ; ảnh bị từ chối/mất quyền qua content API chuyển ngay sang khung không khả dụng trước khi history/SSE cập nhật, unmount fetch/viewer và dọn tệp. Giữ retry cho lỗi mạng; kiểm regression từ fail trước sửa sang pass.

- [x] Đưa thao tác dán vào menu hệ thống của ô nhập bằng expo-paste-input 0.2.2; menu + chỉ Ảnh/Tệp, bỏ nút Dán ảnh và expo-clipboard. Text paste không chèn hai lần, ảnh lấy từ event gốc qua preparation/outbox; native cũ/Expo Go giữ nhập chữ, dán ảnh native cần rebuild binary. Web xử lý paste event tại ô nhập.
- [x] Giữ kiểu ảnh qua local send, PENDING_SCAN, AVAILABLE, REVOKED và UNAVAILABLE: placeholder ảnh không lộ pixels/tên tệp hoặc action xem/tải khi mất quyền, recipient giữ caption/vị trí. Lỗi mạng giữ ảnh local để thử lại; ảnh bị chặn dùng placeholder. Kiểm regression và bundle, native/API acceptance vẫn riêng.

- [x] Theo yêu cầu mới, gỡ toàn bộ NSFW phía mobile: hook/UI, engine, model/license, test riêng, dependency TFLite/Nitro/jpeg-js và cấu hình Metro/plugin/asset type. Giữ dán ảnh, chuẩn bị/nén nền, preview/zoom và các trạng thái kiểm duyệt từ BE; điều chỉnh regression của preparation và chạy checks mobile.

- [x] Giữ Dán ảnh qua expo-clipboard, preview ngay/nén nền qua expo-image-manipulator và viewer native pinch/double-tap zoom qua react-native-image-viewing. NSFW local từng được thêm theo yêu cầu trước, nay đã gỡ theo yêu cầu mới; các kiểm tra native thật vẫn pending.

- [x] Đồng bộ mobile với BE dev `ac3dbb7a` (PR #134/#135): schema moderation/accessStatus/canAttach và metadata ảnh; gửi thẻ pending theo canAttach; key upload ổn định theo intent; bytes thumbnail/preview/content qua HTTP xác thực, lưu tệp theo platform và cleanup khi thu hồi/đổi phiên/unmount. Kiểm regression và ảnh hưởng HTTP client dùng chung, giữ generic upload ngoài chat.

- [x] Hiển thị ảnh local/đã xuất bản trực tiếp trong bubble, mở lớn/tải qua URL có quyền, tài liệu giữ card riêng; copy lỗi và inbox phân biệt ảnh/tệp. Kiểm pending/revoked/unavailable, URL hết hạn/đến muộn, đổi phiên/unmount và tải lại preview. Giữ bộ chọn Tệp PDF/DOCX/TXT do API chưa lưu kiểu trình bày ảnh gửi dạng tệp.

- [x] Lưu mã lỗi trong outbox tương thích dữ liệu version 1, giữ cảnh báo qua restart.
- [x] Cảnh báo đỏ cho tin bị chặn, không có thao tác sửa/bỏ/retry; giữ composer hiện hành.
- [x] Chặn retry ID đã bị từ chối, cho phép gửi tin mới với ID mới.
- [x] Trạng thái “Đang gửi…” khi chờ kiểm duyệt; không hiển thị bước kiểm tra nội dung.
- [x] Recovery từ lỗi không rõ kết quả sang `422` được mở khóa; các lỗi permission sau lần gửi không rõ kết quả vẫn giữ reconciliation.
- [x] Kiểm tra outbox qua restart, session cũ, outage và cảnh báo không có nút thao tác.
- [x] Đặt tin lỗi theo thời điểm gửi thay vì ghim cuối danh sách, giữ vị trí/identity của tin mới khi chuyển từ outbox sang lịch sử và giữ thứ tự sequence của backend.
- [x] Đồng bộ thông báo hệ thống/xác nhận lịch bằng khung nền nhạt, icon theo nội dung và nút xem lịch hiện có; giữ nguyên dữ liệu xác nhận, actor và hướng học.
- [x] Tự cập nhật trạng thái ảnh/tệp bằng monitor chung; bỏ nút kiểm tra khi đang chờ hoặc gửi bình thường, chỉ hiện retry khi có lỗi hoặc cần recovery.
- [x] Hiển thị đúng lỗi chọn/tải/đọc trạng thái tệp; nhãn không tiếp tục báo đang xử lý sau lỗi/timeout. Tự thử lại tối đa hai lần đọc trạng thái khi lỗi mạng/5xx, giữ nguyên trạng thái server và không tải/gửi lại mutation.
- [x] Hoàn tất checks sau khi giản lược UI và ghi kết quả trong [status](status.md).
- [x] Rà code dư thừa và lỗi hiện tại: giản lược wrapper/props retry và helper chỉ dùng một lần; sửa monitor chạy lại khi cùng tệp chuyển từ READY về chờ kiểm tra, xóa cảnh báo sau trạng thái cuối; đồng bộ test UI và chạy full checks.
- [x] Mở khóa recovery khi media chat bị chặn bằng 409, refresh trạng thái tệp sau lỗi POST/retry; kiểm giữ nguyên payload/ID, giới hạn owner/file và không mở khóa các lỗi permission/conflict khác.
- [x] Thêm biểu tượng tròn dấu chấm than đỏ gọn cạnh phải, gần đáy bubble tin gửi thất bại theo tham chiếu Messenger; chỉ tin lỗi chừa chỗ cho icon, tin thường giữ mép phải ban đầu. Giữ lý do bên dưới và không hiển thị lỗi cho tin đang gửi/đã gửi.
- [x] Đồng bộ định dạng chat và trường moderationStatus xuyên adapter/monitor/cache/UI; dừng poll khi cần xem xét hoặc thất bại, giữ tương thích response cũ, kiểm READY thật và không tự upload/gửi lại.
- [x] Rà BE PR #127 (`7a7e705d`) giảm lỗi timeout ảnh: không đổi contract mobile; kiểm monitor/status hiện hữu, ghi giới hạn tệp FAILED cũ và deployment chưa xác minh.
- [x] Đồng bộ PR #128: kiểm event kết quả kiểm duyệt đã có hydration, bổ sung đọc lại trạng thái tệp khi SSE resume dù không replay event; regression HTTP/cache/cursor/owner và không tự gửi tin. Fix JPG byte 0 đệm thuộc BE, không đổi bytes tệp ở mobile.
- [x] Theo yêu cầu người dùng, cho gửi tệp vào bubble cục bộ ngay: chọn tệp không upload, Gửi enqueue và giải phóng composer; worker riêng upload → scan → fresh READY → POST; pending chỉ “Đang gửi…”, failed có ! đỏ. Giữ text worker độc lập, persistence theo owner/scope và recovery ID/payload thủ công; dừng khi offline/background/restart, không tự replay mutation. Kiểm chống bấm lặp, READY race, rejected/review/failed, 202, mất phản hồi, storage/phiên cũ và màn 320/390px.
- [x] Đồng nhất và làm gọn cảnh báo lỗi text/tệp/network: chung khung đỏ nhạt, chỉ hiện lý do secondary 13/18 dễ đọc và retry cùng hàng nếu được phép; bỏ tiêu đề lặp trên giao diện nhưng giữ accessibility label, ! đỏ và quy tắc retry hiện hữu. Padding 10×6/radius 10 theo phản hồi không làm quá nhỏ.
- [x] Viết lại chú thích chat dễ hiểu, nêu lỗi và bước tiếp theo; dùng copy theo mã cho cả bản ghi lỗi đã lưu. Phân biệt tệp bị từ chối/cần kiểm tra thêm, lỗi kiểm tra kỹ thuật, gián đoạn và chưa xác nhận kết quả; không đổi giao diện hoặc quyền retry.
- [x] Đồng bộ BE PR #129: parse availability ở status/history/delivery, khóa/ẩn tải theo bốn trạng thái cho hai phía, hỗ trợ SSE availability + reconnect và tin tệp ở trang cũ. Không mở URL đến muộn sau thu hồi; snapshot thread mới thắng receipt cũ; giữ legacy mode, không đổi BE/deployment.

- [x] Kiểm lại hai yêu cầu trong ảnh bàn giao: bốn availability và SSE/reconnect đã có trong source; làm gọn UI lỗi theo pattern !/retry của Apple Messages, lý do 13/18 không nền khung, nút thử lại riêng có trạng thái mất mạng rõ ràng. Giữ các lỗi từ chối/scan thất bại không retry và kiểm lại bằng regression/fixture hẹp.

- [x] Rút gọn nội dung lỗi theo kiểu chat: bỏ câu “tệp hoặc nội dung kèm theo không được chấp nhận”, dùng “Không thể gửi nội dung này” và bước sửa phù hợp; lỗi gián đoạn chỉ “Chưa gửi được tệp” cạnh retry. Giữ riêng kết quả gửi chưa xác nhận và availability của tệp đã xuất bản, không đổi retry/state.

## Nghiệm thu

- [x] Rà lại chat và sửa race phản hồi gửi đến muộn ghi đè REVOKED/readAt mới hơn: snapshot thread/preview hiện có thắng receipt cùng sequence, vẫn thêm tin mới và giữ cursor/revision/unread. Thêm regression dùng QueryClient thật, xác nhận fail trước sửa và pass sau sửa; chạy lại checks mobile.

- [x] Đổi câu REVOKED phía nhận và inbox thành “Tệp không còn khả dụng.”; phía gửi dùng “Tệp chứa nội dung không phù hợp.” cho lý do/outbox/lỗi tải. Bỏ từ thu hồi khỏi nhãn hiển thị để không gợi chức năng người gửi tự thu hồi; giữ layout/quyền tải/retry.

- [x] Theo lựa chọn cuối của người dùng, thay card REVOKED phía nhận bằng “Tệp không còn khả dụng.” màu xám/nghiêng, viền mảnh khi chỉ có thông báo; bỏ tên/metadata/! /lỗi đỏ. Giữ caption/tệp khác, hàng/sequence/phân trang và lỗi phía gửi; preview dùng câu thu hồi. Không sửa cache server, chặn URL trả muộn sau unmount. Chỉ thay sau khi nhận REVOKED, không thu lại tệp đã tải hoặc thông báo BE đã phát.

- [x] Tách nguồn chọn trong nút + thành Ảnh/Tệp, native menu và web dialog, thumbnail ảnh local trước gửi; giữ worker chung, giới hạn một mục/15 MB, chống bấm lặp/phiên cũ và tương thích deep link cũ. Làm nổi nút + bằng nền cam nhạt/icon cam 24px theo phản hồi người dùng; kiểm menu/composer/picker/thumbnail và full mobile.

- [x] Làm gọn khung lỗi có retry: nền đỏ nhạt chỉ ôm lý do, Thử lại nằm ngoài nền cùng hàng, giữ vùng chạm 44×44px, quyền retry và trạng thái mất mạng.

- [x] Bỏ đuôi “chọn tệp khác/chọn lại tệp” khiến khung lỗi đọc tệp dài; dùng một ý ngắn “Không đọc được tệp.”/“Tệp sai định dạng.” và kiểm độ rộng thực tế tại 320/390px, giữ font và vùng retry.

- [x] Thêm ! đỏ cạnh tệp REVOKED/UNAVAILABLE cả phía gửi/nhận, căn lại khung thu hồi theo bubble và giữ tin bình thường không chừa chỗ lỗi. Rút các lỗi kỹ thuật còn lại về câu ngắn, kiểm hẹp 320/390px và regressions.

- [x] Áp dụng bộ câu ngắn như trạng thái chat: gửi lỗi chung, text/tệp bị chặn, tệp thu hồi và lỗi đọc tệp; bỏ hướng dẫn soạn/sửa tin hoặc nhờ bên gửi. Kiểm text/tệp bị từ chối không vào lịch sử chung hoặc tạo thông báo người nhận; giữ phân biệt timeout chưa xác nhận và tệp đã xuất bản rồi thu hồi.

- [x] Đổi copy tin bị chặn về cách diễn đạt trước, hướng dẫn soạn tin mới thay vì sửa tin cũ; chuyển nhãn kiểm tra an toàn từ trong card xuống dưới bubble cho cả hai phía, giữ loại/dung lượng và khóa tải.

- [x] Đồng bộ copy REJECTED với mẫu nguyên nhân/hướng dẫn của REVOKED; kiểm tệp bị từ chối trước gửi chỉ có bubble lỗi phía gửi, không publish/làm mới lịch sử chung hoặc rò outbox sang người nhận. Giữ riêng tệp đã xuất bản rồi bị thu hồi.

- [x] Đồng nhất ghi chú REVOKED với lỗi tệp khác: khung đỏ nhạt dưới bubble, nêu rõ thu hồi do nội dung không phù hợp và hướng dẫn bên gửi chọn tệp khác/bên nhận nhờ người gửi chọn tệp khác; giữ khóa tải và không có retry.

- [x] Theo yêu cầu người dùng, bổ sung ghi chú mặc định “Nội dung không phù hợp.” dưới nhãn REVOKED, đồng bộ lỗi tải/outbox thu hồi và accessibility cho cả hai phía; giữ khóa tải và retry policy.

- [x] Theo lựa chọn người dùng, khôi phục khung lỗi đỏ nhạt và chữ đỏ như trước, retry cùng hàng không có nền nút riêng; giữ copy ngắn gọn, ! đỏ và quyền retry.

Source đáp ứng contract và focused/full tests, typecheck, lint, structure. Kiểm tra màn hẹp bằng web harness từ component thật; đây là bằng chứng presentation với dữ liệu mẫu. Native/API thật cần kiểm tra riêng bằng tài khoản test trên môi trường có bật `chat:enforce` và `media:enforce`.
