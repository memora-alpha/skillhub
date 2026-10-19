# Profile avatar và public projection

## Nguồn

Đối chiếu working tree tại HEAD ed5a17dd9f1a6d5e45e1b6af33b17dd4518b46fd: [identity HTTP](../../../../services/api/specs/002-user-identity/contracts/http.md), [UsersController](../../../../services/api/src/modules/users/presentation/http/users.controller.ts), [Users responses](../../../../services/api/src/modules/users/presentation/http/users.responses.ts), [account-api](../../src/features/account/api/account-api.ts), [avatar schemas](../../src/features/account/api/avatar-contracts.ts), [public-profile-api](../../src/features/profile/api/public-profile-api.ts). Backend có source; own/edit/avatar và other UUID public đã có mobile API source; deployment/native evidence tách riêng.

## Routes

| Method/path                     | Auth/input                                                 | Response cần dùng                                                           |
| ------------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------- |
| GET /me                         | Bearer owner                                               | Identity có nested profile                                                  |
| PATCH /me/profile               | Bearer owner, subset fullName/headline/bio/timezone/locale | 200 profile trực tiếp trong data; UI hiện chủ yếu sửa fullName/headline/bio |
| GET /profiles/:userId           | Authenticated UUID target                                  | 200 public profile, target ID phải khớp;404 nonpublic/missing               |
| POST /me/avatar                 | Owner, multipart field image, JPG/PNG/WebP <=5MB           | 202 {assetId,status:QUARANTINED}                                            |
| GET /me/avatar/uploads/:assetId | Owner                                                      | 200 assetId/status;404 sai owner/missing                                    |
| DELETE /me/avatar               | Owner                                                      | 204 bodyless                                                                |

OwnProfile: userId,fullName,headline,bio,timezone,locale,avatarUrl,reputationScore,verifiedSkillCount,completedSessionCount. Public chỉ allowlist userId/fullName/headline/bio/avatarUrl/reputationScore/verifiedSkillCount/completedSessionCount; skills tải riêng theo [skills contract](skills-evidence.md), không forward sharingSkills lồng trong raw DTO.

Empty headline/bio clear; validation Unicode dùng [profile validation](../../src/features/profile/utils/profile-validation.ts), không thay toàn bộ cách đếm bằng grapheme. 400 validation,401 session,403 quyền,404 không khả dụng,413 size,415 format,503 unavailable. Avatar không dùng JSON idempotency key. Profile có thể đã lưu khi ảnh lỗi: giữ draft ảnh và báo kết quả riêng, không save lại mù. Only CLEAN công bố avatar; REJECTED/DELETED không publish. Poll bound/session source nằm tại [avatar monitor](../../src/features/auth/hooks/use-avatar-monitor.ts); không coi malware scan là Staff duyệt từng ảnh. SRS PRO-004 moderation vi phạm là bước riêng.

## Hiện trạng và khác biệt

Self-preview lấy saved account allowlist; another UUID dùng public API/skills; demo targets vẫn explicit fixtures. GET403/404 loại snapshot cũ;503 retry không fallback mock. Request-context Back giữ history hoặc fallback theo request/Discover. Amendment2026-10-13/source thay mô tả fixture-only cũ; [spec003](../../specs/003-profile-public-profile/spec.md) giữ lịch sử.

SRS PRO-001..004 có path count/title; completedSessionCount không thay completedLearningPathCount, UI không gán số buổi sang số lộ trình. Timezone/locale/title/notifications settings chưa đủ triển khai; website/rating/learned-taught counts chưa có contract dùng cho profile. Native Text không chứng minh backend đã sanitize bio. Privacy theo [security](../guides/security-and-privacy.md), không phát private evidence/download từ public UI kể cả self.

## Evidence và việc còn mở

[Checklist003](../../specs/003-profile-public-profile/checklist.md), [tasks003](../../specs/003-profile-public-profile/tasks.md), [validation003](../../specs/003-profile-public-profile/validation.md) là nguồn lịch sử: có Android14/Pixel7/LAN save/reopen/font130% cho revision cũ; pending Back trong request chậm, iOS/thiết bị thật, Public Profile Figma riêng vẫn mở. Web avatar202/QUARANTINED và ClamAV PING/INSTREAM không chứng minh full API CLEAN. Native gallery/upload và Settings recovery/email thật còn thiếu. Amendment other-user profile2026-10-13 có fixture/51 focused tests được ghi nhận ở lần trước; API/native acceptance cho amendment chưa được chạy. Không chạy lại các checks này trong migration.
