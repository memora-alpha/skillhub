# Tài liệu — API mobile

Đối chiếu working tree `a4c43eba`, ngày 2026-11-15: [owner controller](../../../../services/api/src/modules/materials/presentation/http/my-materials.controller.ts), [DTO](../../../../services/api/src/modules/materials/presentation/http/materials.dto.ts), [service](../../../../services/api/src/modules/materials/application/services/materials.service.ts), [view](../../../../services/api/src/modules/materials/application/contracts/material-view.ts), [policy](../../../../services/api/src/modules/materials/domain/material.policy.ts), [catalog/download](../../../../services/api/src/modules/materials/application/services/material-catalog.service.ts), [purchase/refund](../../../../services/api/src/modules/materials/application/services/material-purchase.service.ts), [reviews](../../../../services/api/src/modules/materials/application/services/material-reviews.service.ts). Source/fixture không chứng minh deployed API hoặc native acceptance. Bổ sung spec016 đã có trong BE; mobile nay tiếp nhận review/rating/thumbnail và cover upload.

## Chủ tài liệu

Base `/api/v1`, Bearer owner qua Connections runtime.

| Method/path | Dữ liệu/hành vi |
| --- | --- |
| GET `/me/materials` | Cursor `limit/cursor`, order updatedAt desc/id desc, owner projection, không có total/search/status filter |
| POST `/me/materials` | skillId, title5–150, description10–3000, accessType FREE/PAID, priceCredit chuỗi, distributionRightsConfirmed=true; fileId optional, trả DRAFT |
| PATCH `/me/materials/:id` | expectedListingVersion và field chỉnh sửa; mobile dùng cùng form, giữ draft khi lỗi |
| POST `/me/materials/:id/submit` | Chỉ DRAFT có file CLEAN và quyền phân phối đã xác nhận; trả PENDING_REVIEW |
| POST `/me/materials/:id/archive` | Trả ARCHIVED, ngừng phân phối |
| POST `/me/materials/files` | multipart `file`,20.000.000 bytes; chỉ PDF/DOCX/XLSX/PPTX theo file-policy; theo scan/READY của upload service |
| GET `/me/materials/files/:fileId` | Trạng thái upload thuộc owner |

Các endpoint trên đã có adapter trước lượt UI này. `materialSchema` dùng chung owner/public: id/ownerId/skillId/title/description/accessType/priceCredit/listingVersion/status/file/createdAt/updatedAt. Owner bổ sung scanStatus (nullable), moderationStatus, rejectReason, reviewedAt (nullable), distributionRightsConfirmedAt. Public projection không có các field owner này. Mobile giữ fields owner optional để tương thích public response; parse reviewedAt nếu có, không làm rơi null scanStatus của draft không file. Không nhận hoặc đưa storageKey vào UI.

Mỗi trang owner và receipt submit/archive phải đúng owner, receipt đúng id và trạng thái kết quả. Request mutation không tự replay sau token renewal. Kết quả phiên cũ bị runtime loại; cache theo owner/generation. Sau ghi hủy read cũ, cập nhật cache rồi invalidate, không tự cộng số bán/thu nhập.

## Trạng thái

| State | Sửa | Lưu trữ | Gửi duyệt |
| --- | --- | --- | --- |
| DRAFT | Có | Có | Khi đủ file CLEAN/quyền phân phối |
| PENDING_REVIEW | Có | Có | Không |
| PUBLISHED | Có, chuyển PENDING_REVIEW | Có | Không |
| REJECTED | Có, trở lại DRAFT | Có | Sau sửa thành DRAFT |
| HIDDEN | Không | Không | Không |
| ARCHIVED | Không | Không | Không |

BE quyết định quyền và transition; mobile chỉ hướng dẫn/khóa thao tác tương ứng. Không thêm owner restore/unhide vì BE chưa có route đó. FREE giá0, PAID giá>0, tối đa2 chữ số thập phân theo BR-42.

`MATERIAL_VERSION_CONFLICT`, `MATERIAL_TRANSITION_INVALID`, `MATERIAL_NOT_EDITABLE`, `MATERIAL_FILE_REQUIRED`, `MATERIAL_RIGHTS_CONFIRMATION_REQUIRED` giữ mã backend. Lỗi HTTP xác định không commit cho phép người dùng thử lại; network/5xx/protocol không tự gửi lại. Nút Kiểm tra kết quả đọc owner list qua hết cursor để tìm tài liệu, cập nhật trạng thái hiện tại và mở thao tác; không suy lần POST trước thành công. Đọc kiểm tra lỗi/không thấy target thì giữ khóa uncertain.

## UI và giới hạn

Màn `/materials/mine` quản lý tài liệu do mình chia sẻ, tách `/materials/library` cho tài liệu đã mua. Search tên/filename và filter trạng thái chạy trên những trang đã tải, ghi rõ trong placeholder khi còn trang; footer tiếp tục tải ngay cả khi filter hiện không khớp. `n+` biểu thị còn dữ liệu, không phải total backend. Chi tiết chứa mô tả, file, ngày xét duyệt/rejectReason; lưu trữ có xác nhận. Loading/error/denied không hiện empty giả. Pull-to-refresh không replay POST. Form cho lưu nháp không file; submit vẫn cần đủ điều kiện server.

Catalog/purchase/orders/refund/download đã có adapter trước khi mở rộng UI; lần mở rộng nối vào Discover, bổ sung skillId filter và đồng bộ toàn hành trình. Giữ ledger, entitlement, giá/fee và quy tắc signed URL của BE. Backend chưa có owner detail-by-id/search/status/total/stats; không dùng public search để đọc draft hoặc tự dựng số lượt tải/doanh thu.

## Khám phá, mua và thư viện

`/materials/mine` là hub Tài liệu của tôi gồm Thư viện/Đã đăng/Đã lưu; `tab=library|posted|saved`, mặc định library. Tab Đã đăng giữ owner list/actions hiện hữu. Thư viện dùng orders BE, route `/materials/library` cũ redirect vào hub. Owner save/back fallback về posted. Từ archive chỉ đổi nhãn thành Ngừng chia sẻ; không thay endpoint hoặc policy.

Người dùng chọn chờ API BE cho yêu thích và lịch sử tải miễn phí, không lưu cục bộ. Đã lưu hiện trạng thái chưa khả dụng; thư viện chỉ liệt kê orders thật và không coi click tải hoặc dữ liệu local là lịch sử server. Chưa có filter/batch trạng thái review trong orders thì không lọc phân trang Chưa/Đã đánh giá bằng dữ liệu viewport.

| Method/path | Mobile dùng và giới hạn |
| --- | --- |
| GET `/materials` | q/accessType/skillId/page/limit20, server total; chỉ PUBLISHED/CLEAN. Discover tab Tài liệu và standalone catalog dùng chung nội dung, search debounce350ms; đổi bộ lọc tạo query key mới |
| GET `/materials/:id` | Public metadata, không có URL/storageKey. Kiểm id/status; khi owner detail404 có thể tìm trong owner list, library preview dùng public-only để không tự đọc owner drafts |
| POST `/materials/:id/purchase` | expectedListingVersion + Idempotency-Key. Quote hiển thị là giá/phiên bản material đã tải; BE kiểm lại nguyên tử, không tự mua sau khi giá thay đổi |
| GET `/me/material-orders` | Owner cursor, order id/materialId/sellerId/listingVersion/grossCredit/feeAmount/sellerNetCredit/status/createdAt. Query ownership chỉ SUCCESS, đi hết các trang cần thiết |
| POST `/me/material-orders/:id/refund` | Receipt phải đúng order id và REFUNDED. BE xét24h, consumedAt, active entitlement và nguồn hoàn trả; MATERIAL_REFUND_ADMIN_REQUIRED là cần Staff/Admin, không mở thao tác đặc quyền ở mobile |
| GET `/materials/:id/download` | Explicit sau nút Tải và xác nhận nếu có order; no renewal replay, URL http/https không credentials và chưa hết hạn. Không giữ URL trong Query cache; lưu file qua adapter nền tảng sau kiểm session |
| POST `/materials/:id/reports` | Dùng Reports feature qua route reports/new có materialId, giữ API/report quyền hiện hữu |

Purchase giữ fingerprint id+listingVersion và exact key/body khi người dùng kiểm tra lại unknown; không replay tự động. API có thể trả receipt REFUNDED của key cũ: UI hiển thị đã hoàn tiền, không điều hướng như mua thành công. SUCCESS cập nhật query ownership trong scope owner/generation rồi trở lại màn chi tiết với nút Tải; Wallet invalidation qua useRefreshWallet/runtime, không set số dư và không chặn xác nhận mua chỉ vì Wallet read gặp lỗi. Các lỗi giá thay đổi, thiếu Credit, refund đã dùng/hết hạn/cần Staff có nhãn Việt.

Backend cấp signed URL cho purchased snapshot và ghi consumedAt khi cấp URL, trước khi client lưu tệp. Nếu issueDownload thất bại trong server, service gỡ dấu consumed vừa tạo; mất kết nối phía app không tự chứng minh chưa dùng. Tải order đã mua có hộp xác nhận tác động consumedAt trước khi cấp URL; Access legacy dùng cùng hook tải. Buyer active entitlement vẫn tải snapshot của order khi material ARCHIVED, HIDDEN bị chặn; owner có quyền file hiện tại. Mobile không yêu cầu public preview thành công để mở order hợp lệ và không dựng file metadata snapshot từ material phiên bản mới.

BE orders chưa trả title/filename snapshot/consumedAt/refund eligibility. Library hydrate public title khi dòng xuất hiện;404 giữ nhãn Tài liệu đã mua và order, không coi mất metadata là mất quyền. Không tính refund eligibility hoàn chỉnh ở client hoặc hứa chắc chắn hoàn tiền. Rating/thumbnail nay lấy từ public catalog/detail; không dựng lượt tải hoặc dùng file snapshot của order làm preview.

API owner/catalog/orders được tách module nhưng giữ createMaterialsApi façade cho consumer hiện có. Material text đếm Unicode code points như policy BE; form mới dùng react-hook-form/Zod và Checkbox @expo/ui native; file upload phải READY trước khi lưu nếu đã chọn file. New form không chờ GET owner list, edit vẫn đọc owner list. Không đổi stack/package hoặc shared Button/Input.

Editor remount theo owner/session và material ID. Khi mở edit, owner read bật freshOnMount và chờ GET thành công trước mount form để baseline không lấy từ cache cũ còn trong staleTime30s; new form không đợi GET owner list. Sau khi form mở không remount theo listingVersion/refetch: giữ nội dung và lựa chọn checkbox, khóa Save khi owner read fetching/error/denied. Bản nháp giữ phiên bản đã đọc để PATCH trả version conflict khi BE đổi tiếp; không tự nâng version hoặc xóa nội dung. Thông báo chỉ nói phiên bản server đã thay đổi, không suy người/thiết bị sửa. Trạng thái readonly mới đọc được vẫn khóa lưu.

Checkbox quyền phân phối khởi tạo theo `distributionRightsConfirmedAt`: timestamp có giá trị mới bật; missing/null/new mặc định tắt. Background refetch không đảo lựa chọn người dùng. Explicit dùng bản máy chủ reset theo timestamp bản đã chọn; giữ draft giữ nguyên checkbox. POST/PATCH vẫn validate distributionRightsConfirmed=true theo form/policy, không giả xác nhận khi server chưa lưu.

Mục tệp hiện chú thích tên ứng dụng/phần mở rộng và giới hạn20MB: PDF(.pdf), Word(.docx), Excel(.xlsx), PowerPoint(.pptx). Không cho chọn DOC/XLS/PPT cũ, ảnh/TXT như danh sách mobile trước đây vốn rộng hơn policy backend. Native asset thiếu MIME hoặc application/octet-stream được chuẩn hóa MIME theo phần mở rộng hợp lệ; giữ URI/bytes, máy chủ vẫn kiểm nội dung. MIME cụ thể không khớp bị chặn tại client.

Thông báo tách lỗi chọn/đọc tệp, dung lượng không đọc được/rỗng/quá giới hạn, định dạng/nội dung/mã hóa không hỗ trợ, kho lưu trữ/policy chưa sẵn sàng và phản hồi không hợp lệ. Không hiển thị raw exception/path/token. Upload không tự replay. Editor tự GET trạng thái sau receipt QUARANTINED/SCANNING: nghỉ1s trong10s đầu,2s đến30s rồi5s, tối đa4phút; chỉ READY mở lưu và dừng đọc ngay. Nhãn phân biệt Đang chờ kiểm tra/Đang quét an toàn theo BE, không giả tiến độ hoặc coi nhịp polling là thời gian scan. Terminal fail dừng, GET error/quá hạn có retry chỉ đọc cùng fileId. Hủy khi blur/background/disabled/bỏ file, không cập nhật phiên cũ. Không còn nút kiểm tra trạng thái thường trực; các consumer reports giữ checkOnSubmit mặc định. Thiếu phản hồi triển khai của lần upload thực thì không suy nguyên nhân scanner/storage chỉ từ thời gian chờ ở app.

Chênh lệch source BE cần xử lý riêng: upload/attach MATERIAL cho20MB nhưng StorageModule khởi tạo ClamAvScanner với15MB; tệp vượt scanner max trả UNKNOWN, retry rồi SCAN_FAILED, không được tự coi CLEAN ở mobile. Lượt mobile chỉ sửa tự đọc trạng thái/UI, không thay giới hạn BE.

Picker kỹ năng của form đăng/chỉnh sửa dùng BottomSheet @expo/ui có thanh kéo, nằm trong native React Native Modal trong suốt: Modal reset cả ScrollView.Context và VirtualizedListContext, danh sách chỉ mount khi mở. Sheet chỉ present sau Modal.onShow, cao80% màn hình/tối đa640 và giữ chiều cao trong một lần mở để tránh nhảy khi keyboard đổi kích thước. Header có padding riêng và nút icon đóng44pt, nằm ngoài ScreenLoadingBoundary của list; kéo xuống/nhấn nền/Back/chọn kỹ năng đều đóng và hủy read qua cancelOnDisable. Native Modal không tự reset ScreenLoadingContext của ứng dụng. Trước sửa nesting, BottomSheet/RNHostView nằm trực tiếp trong React scroll context của form dù native presentation ở sheet riêng, gây warning VirtualizedList line1168. Không tắt scroll, virtualization hoặc LogBox để che cảnh báo.

Discover/detail nhận `thumbnail` từ catalog/detail: `GENERATED` có smallUrl/largeUrl/expiresAt, `PLACEHOLDER` có format. Chỉ render URL HTTP(S) còn hạn; lỗi tải/hết hạn dùng bìa định dạng code-native. expo-image không lưu disk cache thumbnail. Không gọi GET download để sinh ảnh; thumbnail là ảnh bìa, không khẳng định preview trang đầu. Owner projection chưa có metadata cover nên editor giữ nguyên khi không chọn mới hoặc thay; UI đã bỏ gỡ ảnh bìa đã lưu theo yêu cầu người dùng.

Cover upload dùng `POST /me/materials/cover-files`, multipart file, JPEG/PNG/WEBP tối đa 10.000.000 bytes; BE kiểm ảnh tĩnh ít nhất 640×360 và scanner. Đọc READY qua `GET /me/materials/files/:id` trước lưu. POST create gửi coverFileId UUID optional; PATCH omit giữ nguyên, UUID thay, null gỡ. File/cover upload đang busy hoặc chưa READY đều chặn lưu; lỗi giữ draft. Conflict đọc lại có thể giữ draft hoặc bỏ draft, gồm cả lựa chọn cover. Việc render thumbnail phụ thuộc worker BE sau lưu.

Bộ lọc catalog dùng trực tiếp SkillSelector qua public entry learning-requests, cùng component với RequestFeedFilters và runtime/API skills đã có; chỉ lấy kỹ năng ACTIVE theo selector. RequestPickerSheet cô lập loading ở body để header đóng vẫn dùng được. Form editor giữ MaterialSkillPicker native Modal riêng. Total catalog dùng metadata13px theo theme, vẫn lấy giá trị server.

Thanh search catalog theo pattern Yêu cầu học; FREE/PAID và skillId nằm trong sheet Lọc (@expo/ui), chỉ gửi query sau Áp dụng. Đóng bỏ draft; Đặt lại chờ Áp dụng. Hai tab Discover dùng underline, nội dung có loading boundary riêng để không khóa tab; catalog đã bỏ shortcut Đã mua/Của tôi. Detail dùng badge ngắn Đã mua/Chưa mua theo SUCCESS entitlement hoặc null đã xác nhận, kèm Miễn phí/Tài liệu của bạn cho các trường hợp tương ứng. Undefined/pending và lỗi hiển thị kiểm tra/chưa xác minh, không giả định chưa mua. Report là icon trên phải header, chỉ material của người khác. Download dialog trên detail/library và Access legacy đều xác nhận trước khi cấp URL cho order. Không đổi contract/API/financial logic.

Tải trực tiếp tại Detail/Library qua useMaterialDownload: native chọn Directory trước issueURL, tải cache riêng rồi copy tên/MIME snapshot thực sang nơi lưu đã chọn; xóa temp/file mới dở khi thất bại, abort theo session/unmount, không dùng Linking để giả lập lưu file. Web dùng Blob/objectURL/download anchor, cần storage CORS để fetch. Không prefetch/cache/replay URL; hủy chọn đích hoặc hủy xác nhận không cấp URL. Access route giữ để tương thích link cũ/metadata order archived, không còn bước chuyển bắt buộc từ detail/purchase. Nghiệm thu OS file picker/storage vẫn pending.

Đề xuất dùng GET materials?skillId trên trang đầu, loại chính tài liệu, tối đa4 item public. Không phải xếp hạng cá nhân hóa; không thêm endpoint recommendation. Xem tất cả chuyển Discover tab materials kèm skillId đã validate.

## Đánh giá tài liệu

Detail dùng summary điểm/sao/count một cụm và public reviews dạng hàng phẳng có avatar; chỉ đọc, không có form/eligibility request. Own VISIBLE review xuất hiện một lần với nhãn Bạn và không có self-report; hidden review không xuất hiện ở public list. Bỏ ngày/banner thành công và nút tải lại thường trực; error/retry và pull refresh giữ lại.

Thư viện đọc eligibility cho các dòng đang nhìn thấy, mở `/materials/:id/review` qua Viết đánh giá/Xem đánh giá theo canReview/currentReview. Màn riêng tự đọc eligibility trong đúng owner/session, không tin order hoặc route là quyền ghi. Create mở form trực tiếp, own review có Sửa/Xóa; hidden chỉ xem/xóa. Footer gửi/lưu cố định, counter2.000 code points, metadata dùng public hiện tại khi khả dụng chứ không nhận là snapshot bản đã mua. Refresh/error khóa ghi; reconciliation không làm mất exact key của create chưa rõ kết quả. Route free cũng áp eligibility thật; chưa có danh sách free download để làm điểm vào thư viện.

- `GET /materials/:id/reviews?limit=20&cursor=...`: public VISIBLE-only, cursor opaque; meta.ratingSummary là `{average:string|null,total,stars:{1..5}}`. Không dùng ví dụ Swagger `distribution` thay implementation `stars`; parser kiểm tổng/trung bình với phân bố. Reviewer có userId/fullName/avatarUrl, verifiedPurchase/version và timestamps. Không dùng review người theo lộ trình thay thế.
- `GET /materials/:id/review-eligibility`: canReview/reasonCode/currentReview. Owner không tự đánh giá; FREE cần grant FREE_PUBLIC/ISSUED, PAID cần active entitlement. UI theo eligibility BE, không lấy order hoặc click tải làm bằng chứng quyền. Cấp download thành công invalidates eligibility, kể cả bước lưu tệp sau đó thất bại. Hidden review vẫn xem riêng/xóa, không sửa.
- `POST /materials/:id/reviews`: rating 1..5, comment optional tối đa 2.000 Unicode code points, Idempotency-Key. Unknown giữ nguyên nội dung/key, chỉ explicit retry; GET chưa thấy review không đủ để đổi key. Không replay khi renewal/focus/reconnect.
- `PATCH /material-reviews/:id`: expectedVersion và rating/comment; comment rỗng clear. `DELETE /material-reviews/:id?expectedVersion=...` nhận review deletedAt và replayed. Sửa/xóa unknown khóa tiếp và đọc eligibility trước gửi lại; version thay đổi từ nơi khác giữ draft nhưng chặn ghi cho tới khi người dùng đọc bản mới. Không âm thầm áp draft cũ lên version mới.
- `POST /material-reviews/:id/reports`: mô tả 10..2.000 ký tự, UI dùng reasonCode=OTHER; không báo cáo chính mình. Timeout không tự gửi lại; BE chặn open report trùng.
- Queries/callbacks/drafts thuộc owner/generation/material; reads khi focus và foreground, denial 403/404 ẩn dữ liệu. Mutation success invalidates materials, list/summary/eligibility cùng cập nhật. Notification created/hidden/restored đã Việt hóa và dẫn tới materialId đã validate.

Kiểm chứng và phần chưa nghiệm thu tại [work status](../work/materials-ui/status.md).
