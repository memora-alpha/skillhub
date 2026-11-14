# Tài liệu — API mobile

Đối chiếu source ngày2026-11-13, origin/dev `5a70621d`: [owner controller](../../../../services/api/src/modules/materials/presentation/http/my-materials.controller.ts), [DTO](../../../../services/api/src/modules/materials/presentation/http/materials.dto.ts), [service](../../../../services/api/src/modules/materials/application/services/materials.service.ts), [view](../../../../services/api/src/modules/materials/application/contracts/material-view.ts), [policy](../../../../services/api/src/modules/materials/domain/material.policy.ts), [catalog/download](../../../../services/api/src/modules/materials/application/services/material-catalog.service.ts), [purchase/refund](../../../../services/api/src/modules/materials/application/services/material-purchase.service.ts). Source không chứng minh deployment; financial behavior mới có fixture/unit evidence, chưa nghiệm thu PostgreSQL/provider/native thật.

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

BE orders chưa trả title/filename snapshot/consumedAt/refund eligibility. Library hydrate public title khi dòng xuất hiện;404 giữ nhãn Tài liệu đã mua và order, không coi mất metadata là mất quyền. Không tính refund eligibility hoàn chỉnh ở client hoặc hứa chắc chắn hoàn tiền. Chưa có API stats/rating/thumbnail riêng cho tài liệu nên dùng bìa định dạng mặc định và metadata thật; không gán ảnh mẫu như preview thật hoặc dựng lượt tải/rating.

API owner/catalog/orders được tách module nhưng giữ createMaterialsApi façade cho consumer hiện có. Material text đếm Unicode code points như policy BE; form mới dùng react-hook-form/Zod và Checkbox @expo/ui native; file upload phải READY trước khi lưu nếu đã chọn file. New form không chờ GET owner list, edit vẫn đọc owner list. Không đổi stack/package hoặc shared Button/Input.

Editor remount theo owner/session và material ID, không remount theo listingVersion khi refresh nền. Bản nháp giữ phiên bản gốc để PATCH trả version conflict nếu dữ liệu server thay đổi; không tự nâng version hoặc xóa nội dung đang nhập. Trạng thái readonly mới đọc được vẫn khóa lưu.

Mục tệp hiện chú thích tên ứng dụng/phần mở rộng và giới hạn20MB: PDF(.pdf), Word(.docx), Excel(.xlsx), PowerPoint(.pptx). Không cho chọn DOC/XLS/PPT cũ, ảnh/TXT như danh sách mobile trước đây vốn rộng hơn policy backend. Native asset thiếu MIME hoặc application/octet-stream được chuẩn hóa MIME theo phần mở rộng hợp lệ; giữ URI/bytes, máy chủ vẫn kiểm nội dung. MIME cụ thể không khớp bị chặn tại client.

Thông báo tách lỗi chọn/đọc tệp, dung lượng không đọc được/rỗng/quá giới hạn, định dạng/nội dung/mã hóa không hỗ trợ, kho lưu trữ/policy chưa sẵn sàng và phản hồi không hợp lệ. Không hiển thị raw exception/path/token. Upload không tự replay; user retry rõ ràng và trạng thái đã upload vẫn được kiểm qua nút Kiểm tra trạng thái tệp. Lỗi DOCX được báo từ iPhone chưa có HTTP status/code thực tế để kết luận nguyên nhân.

Picker kỹ năng của form đăng/chỉnh sửa dùng BottomSheet @expo/ui có thanh kéo, nằm trong native React Native Modal trong suốt: Modal reset cả ScrollView.Context và VirtualizedListContext, danh sách chỉ mount khi mở. Sheet chỉ present sau Modal.onShow, cao80% màn hình/tối đa640 và giữ chiều cao trong một lần mở để tránh nhảy khi keyboard đổi kích thước. Header có padding riêng và nút icon đóng44pt, nằm ngoài ScreenLoadingBoundary của list; kéo xuống/nhấn nền/Back/chọn kỹ năng đều đóng và hủy read qua cancelOnDisable. Native Modal không tự reset ScreenLoadingContext của ứng dụng. Trước sửa nesting, BottomSheet/RNHostView nằm trực tiếp trong React scroll context của form dù native presentation ở sheet riêng, gây warning VirtualizedList line1168. Không tắt scroll, virtualization hoặc LogBox để che cảnh báo.

Discover dùng bìa định dạng code-native (PDF/DOC/XLS/PPT/TXT/ẢNH), thẻ ngang và tên/mô tả/giá thật. Detail dùng cover lớn bên trái và metadata/giá/trạng thái mua bên phải, avatar/người chia sẻ ở dưới. Đây là bìa mặc định, không phải preview trang đầu. BE hiện không có coverUrl/thumbnail, API upload ảnh bìa hoặc pipeline tạo preview công khai. Ảnh bìa thật nên là optional field/pipeline BE riêng; không gọi GET download để sinh thumbnail vì có thể tiêu thụ quyền hoàn tiền hoặc lộ file trả phí.

Bộ lọc catalog dùng trực tiếp SkillSelector qua public entry learning-requests, cùng component với RequestFeedFilters và runtime/API skills đã có; chỉ lấy kỹ năng ACTIVE theo selector. RequestPickerSheet cô lập loading ở body để header đóng vẫn dùng được. Form editor giữ MaterialSkillPicker native Modal riêng. Total catalog dùng metadata13px theo theme, vẫn lấy giá trị server.

Thanh search catalog theo pattern Yêu cầu học; FREE/PAID và skillId nằm trong sheet Lọc (@expo/ui), chỉ gửi query sau Áp dụng. Đóng bỏ draft; Đặt lại chờ Áp dụng. Hai tab Discover dùng underline, nội dung có loading boundary riêng để không khóa tab; catalog đã bỏ shortcut Đã mua/Của tôi. Detail dùng badge ngắn Đã mua/Chưa mua theo SUCCESS entitlement hoặc null đã xác nhận, kèm Miễn phí/Tài liệu của bạn cho các trường hợp tương ứng. Undefined/pending và lỗi hiển thị kiểm tra/chưa xác minh, không giả định chưa mua. Report là icon trên phải header, chỉ material của người khác. Download dialog trên detail/library và Access legacy đều xác nhận trước khi cấp URL cho order. Không đổi contract/API/financial logic.

Tải trực tiếp tại Detail/Library qua useMaterialDownload: native chọn Directory trước issueURL, tải cache riêng rồi copy tên/MIME snapshot thực sang nơi lưu đã chọn; xóa temp/file mới dở khi thất bại, abort theo session/unmount, không dùng Linking để giả lập lưu file. Web dùng Blob/objectURL/download anchor, cần storage CORS để fetch. Không prefetch/cache/replay URL; hủy chọn đích hoặc hủy xác nhận không cấp URL. Access route giữ để tương thích link cũ/metadata order archived, không còn bước chuyển bắt buộc từ detail/purchase. Nghiệm thu OS file picker/storage vẫn pending.

Đề xuất dùng GET materials?skillId trên trang đầu, loại chính tài liệu, tối đa4 item public. Không phải xếp hạng cá nhân hóa; không thêm endpoint recommendation. Mục Đánh giá & bình luận chỉ placeholder Sắp có do BE chưa có material review/comment/summary; không dùng review người theo lộ trình thay thế. Xem tất cả chuyển Discover tab materials kèm skillId đã validate.

Kiểm chứng và phần chưa nghiệm thu tại [work status](../work/materials-ui/status.md).
