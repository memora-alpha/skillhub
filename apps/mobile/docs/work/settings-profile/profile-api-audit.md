# Rà Profile và API sẵn có

## Cập nhật sau yêu cầu sửa tiếp — 2026-11-10T00:12:50+07:00

- **PRO-GAP-03: source fixed.** Parser `/me` validate moderation record; Profile/Edit Profile hiển thị field, HIDE/REQUEST_EDIT, lý do và thời điểm, action sửa trên Profile. Metadata không project ra public profile. Edit Profile chỉ gửi field thực sự đổi để sửa tên/headline không vô tình gửi lại bio và gỡ moderation.
- **PRO-GAP-04: source fixed.** Self-preview dùng cùng PublicApiProfileScreen và `/profiles/:userId` như người khác; không dùng own saved bio hoặc private metadata làm fallback. Giữ nhãn self-preview và Back đúng context.
- PRO-GAP-01/02 về review summary/danh sách reviews vẫn mở, không được triển khai trong lượt sửa này.
- Regression20 tests trọng tâm và full1077/1077 đạt; TypeScript/ESLint/structure925 và web export đạt. Component notice có web fixture320/390/430px, lý do dài/chữ130%, action edit và empty metadata; chưa có nghiệm thu API triển khai hoặc Android/iOS. Evidence chi tiết tại [status](status.md).

Phần bên dưới là baseline audit trước sửa. Script `.expo/profile-api-audit.ts` cũ tái hiện own data mapping trước khi route self-preview được đổi; helper own projection vẫn giữ bio gốc cho trang Hồ sơ riêng, không còn dùng làm dữ liệu self public-preview.

Thời điểm: 2026-11-10T00:01:06+07:00. Nguồn là working tree `dev@4b588f62` cộng phần Settings/Profile chưa commit. Yêu cầu lượt này: sửa timezone thành chỉ chọn, bỏ entry trung tâm thông báo sai/trùng, kiểm phần Profile chưa triển khai dù backend đã có API. Không triển khai thêm các feature Profile bên dưới trong lượt audit.

## Những phần đã có source tích hợp

- Own profile GET `/me`, chỉnh tên/headline/bio PATCH `/me/profile`; avatar upload/status/delete và thông báo scan qua auth hooks.
- Public profile người khác GET `/profiles/:userId`, public sharing skills endpoint riêng, không dùng nested evidence.
- Uy tín, kỹ năng xác minh, completedLearningPathCount và danh hiệu hiện tại đã hiển thị. Thành tích GET `/me/achievements`, chọn/ẩn danh hiệu PATCH `/me/achievements/selected-title` đã có mobile API/hook/UI và cập nhật account cache.
- Shortcut Tài liệu của tôi đã dùng Materials API; Uy tín có API/hooks/màn riêng. Sự tồn tại source này không chứng minh nghiệm thu API/native đầy đủ của từng module.

## Gaps tại baseline audit

| ID | Hiện trạng mobile | API/source sẵn có | Việc cần hoàn thiện |
| --- | --- | --- | --- |
| PRO-GAP-01 | Profile không hiển thị số đánh giá, sao trung bình hay phân bố sao; public parser loại bỏ `reviewSummary`, own preview cũng không project field này | GET `/me` → `profile.reviewSummary`, GET `/profiles/:userId` → `reviewSummary`; [response](../../../../../services/api/src/modules/users/presentation/http/users.responses.ts), [reader](../../../../../services/api/src/modules/users/application/services/profile-reader.service.ts) | Parse/validate summary, hiển thị đúng trạng thái chưa có đánh giá (`averageRating:null`); không dùng reputationScore thay số sao |
| PRO-GAP-02 | “Đánh giá về tôi” trỏ `/reviews`, nơi tải lộ trình đã COMPLETED để xem/viết đánh giá từng lộ trình; chưa có danh sách nhận được/đã gửi hay review công khai trên hồ sơ | GET `/me/reviews?direction=received|sent`, GET `/profiles/:userId/reviews`; [controller](../../../../../services/api/src/modules/reviews/presentation/http/public-reviews.controller.ts), [service](../../../../../services/api/src/modules/reviews/application/services/public-reviews.service.ts) | Adapter/schema đúng DTO public, cursor/pagination và summary; nối đúng shortcut, hiển thị người đánh giá và xử lý account không ACTIVE. Giữ luồng viết đánh giá theo lộ trình riêng |
| PRO-GAP-03 | Hồ sơ riêng/chỉnh sửa không báo bio/avatar bị ẩn hoặc yêu cầu sửa; AvatarUploadNotice hiện chỉ xử lý scan/upload, không phải kiểm duyệt Staff | GET `/me` → `profile.profileModeration`; shape `{bio|avatar:{action:HIDE|REQUEST_EDIT,reason,at}}` do [service kiểm duyệt](../../../../../services/api/src/modules/users/application/services/profile-moderation.service.ts) ghi | Type/validate metadata riêng tư, notice lý do/thời điểm và action chỉnh sửa cho chủ hồ sơ; không đưa reason lên public profile |
| PRO-GAP-04 (P2) | Self public-preview dùng own account projection nên vẫn hiện bio bị Staff HIDE, khác hồ sơ người khác thấy | GET `/profiles/:userId` áp dụng `publicOnly`; [reader](../../../../../services/api/src/modules/users/application/services/profile-reader.service.ts) chỉ trả bio rỗng trong public projection khi HIDE | Dùng public endpoint cho self-preview hoặc projection có policy tương đương; giữ own Edit Profile xem được nội dung để sửa |

API review trả `{items,summary}` và pagination trong meta; item public có reviewer `{userId,displayName}|null`, không có private pathId. Không tái dùng schema review-by-path của mobile để ép DTO này, không mở link lộ trình riêng từ public review.

## Bằng chứng source và tái hiện

- [Public parser](../../../src/features/profile/api/public-profile-api.ts): schema thiếu reviewSummary; [own projection](../../../src/features/profile/utils/public-profile.ts) không project summary/moderation và sao chép bio trực tiếp.
- [Own public-preview](../../../src/features/profile/screens/public-profile-preview-screen.tsx) dùng `profile` từ ProfilePreviewProvider cho target là chính mình, không gọi public API. [Profile reader backend](../../../../../services/api/src/modules/users/application/services/profile-reader.service.ts) giữ own bio và chỉ ẩn khi `publicOnly && bioModeration.action === HIDE`.
- [Navigation](../../../src/constants/navigation.ts) ánh xạ “Đánh giá về tôi” về `/reviews`; [ReviewsScreen](../../../src/features/community/screens/review-screens.tsx) dùng `useLearningPaths` và lọc COMPLETED. Mobile source không có call `/me/reviews` hoặc `/profiles/:userId/reviews` tại thời điểm rà.
- Script synthetic local ignored `.expo/profile-api-audit.ts` chạy parser/projection/public adapter thật với account fixture, không gọi server: `selfPreviewStillShowsHiddenBio:true`, `moderationNoticeDataProjected:false`, `ownSummaryProjected:false`, `publicSummaryProjected:false`. Đây là tái hiện data mapping, không phải nghiệm thu backend/deployment.

PRO-GAP-04 làm chủ hồ sơ hiểu sai bản xem trước; chưa có bằng chứng người khác đọc được bio bị ẩn. Backend public projection có logic lọc riêng. Đề xuất ưu tiên sửa PRO-GAP-04/03 trước, rồi PRO-GAP-01/02 chung một lát cắt review-profile.

## Điều chỉnh Settings trong lượt này

- Xóa TextInput “Múi giờ khác”; chỉ còn native Picker, danh sách preset và giá trị đã lưu nếu nằm ngoài preset. Không đổi timezone tài khoản một cách ngầm định khi mở màn.
- Bỏ entry “Trung tâm thông báo” khỏi Notification Settings. `/notifications` hiện là inbox thật; không có màn trung tâm riêng để entry này trỏ tới. Giữ route/inbox và các điểm vào Thông báo khác của app.
- Không thêm bản dịch English; i18n toàn app vẫn là phần việc riêng được trao đổi trước đó.

Không sửa backend/shared/dependency hoặc commit/push. Phạm vi audit xác nhận API đã có trong source; chưa xác minh các endpoint trên môi trường triển khai hay Android/iOS.
