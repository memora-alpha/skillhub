# Profile avatar và public projection

## Nguồn

Đối chiếu working tree tại HEAD ed5a17dd9f1a6d5e45e1b6af33b17dd4518b46fd: [identity HTTP](../../../../services/api/specs/002-user-identity/contracts/http.md), [UsersController](../../../../services/api/src/modules/users/presentation/http/users.controller.ts), [Users responses](../../../../services/api/src/modules/users/presentation/http/users.responses.ts), [account-api](../../src/features/account/api/account-api.ts), [avatar schemas](../../src/features/account/api/avatar-contracts.ts), [public-profile-api](../../src/features/profile/api/public-profile-api.ts). Backend có source; own/edit/avatar và other UUID public đã có mobile API source; deployment/native evidence tách riêng.

## Routes

| Method/path                     | Auth/input                                                 | Response cần dùng                                                           |
| ------------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------- |
| GET /me                         | Bearer owner                                               | Identity có nested profile                                                  |
| PATCH /me/profile               | Bearer owner, subset fullName/headline/bio/timezone/locale | 200 profile trực tiếp trong data; Edit Profile sửa fullName/headline/bio, Settings lưu timezone/locale |
| GET /profiles/:userId           | Authenticated UUID target                                  | 200 public profile, target ID phải khớp;404 nonpublic/missing               |
| POST /me/avatar                 | Owner, multipart field image, JPG/PNG/WebP <=5MB           | 202 {assetId,status:QUARANTINED}                                            |
| GET /me/avatar/uploads/:assetId | Owner                                                      | 200 assetId/status;404 sai owner/missing                                    |
| DELETE /me/avatar               | Owner                                                      | 204 bodyless                                                                |

OwnProfile: userId,fullName,headline,bio,timezone,locale,avatarUrl,reputationScore,verifiedSkillCount,completedSessionCount,completedLearningPathCount,selectedTitle và profileModeration riêng tư. Public chỉ allowlist userId/fullName/headline/bio/avatarUrl/reputationScore/verifiedSkillCount/completedSessionCount/completedLearningPathCount/selectedTitle; skills tải riêng theo [skills contract](skills-evidence.md), không forward sharingSkills lồng trong raw DTO hoặc metadata kiểm duyệt.

Empty headline/bio clear; validation Unicode dùng [profile validation](../../src/features/profile/utils/profile-validation.ts), không thay toàn bộ cách đếm bằng grapheme. 400 validation,401 session,403 quyền,404 không khả dụng,413 size,415 format,503 unavailable. Avatar không dùng JSON idempotency key. Profile có thể đã lưu khi ảnh lỗi: giữ draft ảnh và báo kết quả riêng, không save lại mù. Only CLEAN công bố avatar; REJECTED/DELETED không publish. Poll bound/session source nằm tại [avatar monitor](../../src/features/auth/hooks/use-avatar-monitor.ts); không coi malware scan là Staff duyệt từng ảnh. SRS PRO-004 moderation vi phạm là bước riêng.

## Hiện trạng và khác biệt

Self-preview và another UUID đều đọc GET `/profiles/:userId` cùng public Skills API. Trang Hồ sơ riêng vẫn lấy account `/me` để chủ hồ sơ xem/sửa bản gốc. Không dùng own account bio làm fallback cho public-preview khi public read lỗi hoặc bị từ chối. ID demo/không hợp lệ hiển thị không khả dụng, không fallback hồ sơ hoặc kỹ năng mẫu. Route /user/:id dùng cùng màn hồ sơ với /profiles/:userId. GET403/404 loại snapshot cũ;503 retry không fallback mock. Back giữ history hoặc context request; self fallback Hồ sơ, other-user fallback Discover. [Spec003](../../specs/003-profile-public-profile/spec.md) giữ lịch sử trước các amendment.

GET `/me` có `profileModeration:null|{bio?,avatar?}`; mỗi record `{action:HIDE|REQUEST_EDIT,reason,at}`. Mobile validate enum/reason/timestamp; thiếu field hoặc null tương thích response cũ, record sai shape là protocol error. Profile riêng và Edit Profile hiện notice theo từng field, lý do/thời điểm và nút sửa trên Profile. Đây là kiểm duyệt Staff, tách khỏi notice quét avatar. Lý do không đưa vào DTO/public UI. Edit Profile chỉ PATCH các field thực sự đổi, tránh gửi lại bio khi chỉ sửa tên/headline: backend gỡ moderation bio khi PATCH có bio; avatar moderation theo kết quả API/refetch, không tự xóa khi chọn ảnh cục bộ.

SRS PRO-001..004 có path count/title. Backend hiện trả `completedLearningPathCount` trong Own/PublicProfile; mobile parse, project và hiển thị số lộ trình riêng với `completedSessionCount`. Nếu server cũ chưa trả count, hiển thị `—`, không thay bằng số buổi hoặc số 0. `selectedTitle` tiếp tục từ API và màn Thành tích hiện có.

Settings dùng PATCH profile cho timezone IANA và locale vi/en, khởi tạo từ account thật, chỉ gửi field đang sửa và giữ draft khi lỗi. Lưu locale không đồng nghĩa mobile đã có bản dịch English đầy đủ; giao diện hiện vẫn tiếng Việt. Lưu timezone không đổi thời điểm/lịch đã xác nhận, không tự thay múi giờ từng lịch hoặc formatter toàn app. Website/learned-taught counts chưa có contract mobile. Review summary có trong backend response nhưng chưa được đưa vào phần thống kê hồ sơ ở lượt này. Native Text không chứng minh backend đã sanitize bio. Privacy theo [security](../guides/security-and-privacy.md), không phát private evidence/download từ public UI kể cả self.

## Settings thông báo

Đối chiếu [controller](../../../../services/api/src/modules/notifications/presentation/http/notification-preferences.controller.ts), [service](../../../../services/api/src/modules/notifications/application/services/notification-preferences.service.ts) và [policy](../../../../services/api/src/modules/notifications/domain/notification-preferences.ts): GET/PATCH `/me/notification-preferences`, Bearer owner, `{learning:boolean,credit:boolean,community:boolean}`. PATCH subset trả đủ ba boolean; không tự dựng giá trị bật khi GET lỗi. Policy backend áp dụng theo nhóm, auth/security và unknown event giữ hành vi gửi hiện có; không coi preference là quyền push của hệ điều hành hay đăng ký native push token.

Mobile có loading/error/reload, draft, Save rõ ràng, gửi nhóm thay đổi; query key gắn owner/generation theo Connections runtime. Đổi phiên loại completion cũ; hủy read cũ trước khi cập nhật cache sau PATCH; mutation không tự retry. Privacy Settings mở self public-preview bằng ID owner và quản lý hiển thị kỹ năng, không tạo privacy toggle ngoài contract.

UI Settings hiện dùng layout/group cùng theme app, Save bar cố định cho locale/notifications, language radio rows, native timezone Picker/Switch và Privacy tách public/private. Help nằm trong feature Settings, Back về Cài đặt; FAQ/search/accordion giữ nội dung hiện có. Native/API acceptance tách riêng trong [status](../work/settings-profile/status.md).

Follow-up 2026-11-10: timezone chỉ chọn trong Picker (gỡ ô nhập); preset giữ thêm giá trị account đang lưu nếu ngoài danh sách. Gỡ entry “Trung tâm thông báo” trùng inbox khỏi Settings, không xóa `/notifications`. [Audit Profile/API](../work/settings-profile/profile-api-audit.md) ghi summary sao, danh sách review, notice moderation và self-preview chưa áp public bio moderation. Sau yêu cầu sửa tiếp, PRO-GAP-03/04 đã có source fix và regression; PRO-GAP-01/02 vẫn mở. Nghiệm thu deployed API/native tách riêng trong status.

## Điều hướng hồ sơ qua avatar

Các entry xem hồ sơ trong yêu cầu học, chi tiết đề xuất, chi tiết buổi học,
tìm người chia sẻ và khám phá mẫu dùng avatar làm vùng nhấn. Tên và hàng
metadata không mở hồ sơ; nút xem hồ sơ trùng được gỡ. Avatar trên trang Hồ sơ
của mình mở self-preview; avatar trên self-preview/public profile giữ dạng
hiển thị để tránh đẩy lặp cùng màn. Điều hướng Back, tab Hồ sơ và chỉnh sửa
tài khoản giữ chức năng riêng. Khi đi từ yêu cầu học, giữ `requestId` cho Back
fallback. Avatar lỗi ảnh vẫn giữ initials và hành động mở hồ sơ.

## Evidence và việc còn mở

[Checklist003](../../specs/003-profile-public-profile/checklist.md), [tasks003](../../specs/003-profile-public-profile/tasks.md), [validation003](../../specs/003-profile-public-profile/validation.md) là nguồn lịch sử: có Android14/Pixel7/LAN save/reopen/font130% cho revision cũ; pending Back trong request chậm, iOS/thiết bị thật, Public Profile Figma riêng vẫn mở. Web avatar202/QUARANTINED và ClamAV PING/INSTREAM không chứng minh full API CLEAN. Native gallery/upload và Settings recovery/email thật còn thiếu. Amendment other-user profile2026-10-13 có fixture/51 focused tests được ghi nhận ở lần trước; API/native acceptance cho amendment chưa được chạy. Không chạy lại các checks này trong migration.
