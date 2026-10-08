# Plan: Spec 003 — Profile và Public Profile

Ngày: 2026-10-08. Nhánh: `feat/mobile-profile`, từ local `dev` tại `4b8def4`.
Yêu cầu ở [spec.md](spec.md). Baseline bên dưới ghi lại triển khai UI ngày 2026-10-08.

## Tích hợp sau rebase — 2026-10-09

- Rebase lên `dev` tại `d2f175a`, đã có Auth spec 002. Runtime dùng
  AuthSession/Query/SecureStore/Toast/KeyboardProvider, không dùng MockSession.
- Giữ editor gọi `PATCH /me/profile`, pending guards, toast và cache cập nhật.
  Dùng validation của feature profile; không gửi khi draft không đổi, cho clear
  headline/bio. Form được tạo lại theo session generation khi đổi phiên.
- ProfilePreview chỉ chiếu dữ liệu own account hiện hành, không tạo bản sao
  identity hoặc lưu headline demo. Avatar, reputation và counters lấy từ API;
  reputation null hiển thị dấu gạch. Self-preview dùng dữ liệu đã lưu.
- Thêm route public profile vào auth gate. Public target khác vẫn là fixture;
  skill list của own account chưa được tích hợp, không gán skill mẫu cho tài khoản thật.
- Public projection và UI không suy ra badge toàn tài khoản từ verifiedSkillCount.
- Giữ cả test auth và profile trong `npm test`; `test:profile` chạy riêng profile.
- Mailbox/native acceptance và public-profile API integration vẫn còn cần kiểm chứng.

## Điểm bắt đầu và dependency

Các mục baseline sau mô tả trạng thái trước rebase; phần tích hợp trên là runtime hiện tại.

- Base `dev` có own/edit profile, MockSession và dữ liệu mẫu; chưa có public profile.
  Spec 003 đã thay headline/badge cố định và reputation 142 bằng dữ liệu theo identity.
- **Auth/account shell thuộc spec 002 ở nhánh khác.** UI hiện dùng Auth qua public
  `index.ts`; trước tích hợp API, đọc lại interface khi spec 002 được đưa vào base.
  Không làm lại Auth, tạo HTTP client thứ hai hoặc tự sửa contract Auth.
- UI-first là phạm vi hiện tại; nếu chuyển API thật thì cập nhật plan dựa trên
  Auth đã có và API dev đang chạy, không suy đoán từ mock trên `dev`.
- Chưa thấy reference Public Profile trong checkout. Cần đối chiếu thiết kế hoặc
  thống nhất dùng layout hiện có trước khi xác nhận phần visual hoàn thành.

## Cấu trúc và reuse

Giữ `/profile` và `/edit-profile`; thêm `/profiles/[userId]` ở root stack ngoài tabs.
Route chỉ đọc param/navigation, phần UI và business nằm trong feature profile.

Tái sử dụng ProfileLayout, ProfileSection/ProfileHeading, Avatar, Input, Button,
FormNotice, InfoModal, shell/header và theme hiện có. ProfileHero nhận dữ liệu qua
props và edit callback tùy mode, bỏ fixture identity/badge cố định.

Các phần đã thêm:

- `src/app/profiles/[userId].tsx`
- `src/features/profile/screens/PublicProfileScreen.tsx`
- `src/features/profile/types/profile.ts`
- `src/features/profile/utils/profile-validation.ts`
- `src/features/profile/utils/public-profile.ts`
- `src/features/profile/mocks/public-profiles.ts`
- `src/features/profile/components/ProfileSummary.tsx`
- `src/features/profile/context/ProfilePreview.tsx`
- `test/profile.test.mjs` và script `test:profile`

Sửa ProfileScreen, EditProfileScreen, ProfileHero, ProfileLayout, fixtures và profile `index.ts`.
AppProviders chỉ compose thêm ProfilePreviewProvider trong MockSessionProvider;
Auth source và shared shell không đổi.
Chỉ tách component thực sự dùng chung. Không sửa Auth source để né dependency;
nếu thiếu field/callback thì ghi rõ cần phối hợp với spec 002.
Giới hạn: route <=100 dòng, utils/hooks/API <=250, source khác <=400.

## Dữ liệu và state

- Public display model chỉ gồm userId/fullName/headline/bio/avatarUrl,
  reputationScore/verifiedSkillCount/completedSessionCount và skill preview.
- Skill preview lấy id, tên skill, level, mô tả, experienceYears, verificationStatus;
  không spread raw catalog/identity/evidence. Status BE: UNVERIFIED/PENDING/VERIFIED/REJECTED.
- Own view tách phần private; draft edit tách khỏi dữ liệu đã lưu. Adapter demo
  ProfilePreview dùng `updateProfile` hiện có cho tên/bio, giữ headline trong React
  context thuộc feature vì MockSession chưa có field này. Reset khi đổi identity/logout.
  Không thêm framework; thay adapter này khi tích hợp Auth spec 002.
- Trong UI-first, fixture theo identity; self-preview lấy dữ liệu hiện hành;
  user mới có reputation50, counter0, skills rỗng. Demo IDs không phải UUID để gọi BE.
- Optional field rỗng có nghĩa đã clear; không thay bằng default. Chỉ trim tên.
  Length BE cho headline/bio trừ surrogate pair và presentation selector khỏi
  UTF-16 length; không đồng nhất với `Array.from` của tên.
- View có loading/ready/unavailable/error; reset result/draft/timer khi đổi ID/session.

## Contract BE đã kiểm tra

Source: [UsersController](../../../../services/api/src/modules/users/presentation/http/users.controller.ts),
[DTO](../../../../services/api/src/modules/users/presentation/http/users.dto.ts),
[response](../../../../services/api/src/modules/users/presentation/http/users.responses.ts),
[ProfileReader](../../../../services/api/src/modules/users/application/services/profile-reader.service.ts),
[SkillSearchController](../../../../services/api/src/modules/sharing-skills/presentation/http/sharing-skills.controller.ts).
Đây là reference, chưa có adapter mobile trong feature này.

| Endpoint                                                                          | Contract cần lưu ý                                                                                                                                                               |
| --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET `/api/v1/me`                                                                  | Có auth; own identity chứa email/account metadata và nested `data.profile`.                                                                                                      |
| PATCH `/api/v1/me/profile`                                                        | Có auth; fullName/headline/bio/timezone/locale tùy chọn, body không rỗng, không null. Trả OwnProfile trực tiếp ở `data`; không có expectedVersion.                               |
| GET `/api/v1/profiles/:userId`                                                    | Có auth; target UUID và ACTIVE, không tồn tại/inactive trả404; chỉ projection public.                                                                                            |
| GET `/api/v1/profiles/:userId/skills`                                             | Handler hiện không gắn auth guard; lọc public, limit1–50/default20, cursor opaque; page ở `meta.pagination`.                                                                     |
| Avatar: POST `/me/avatar`, GET `/me/avatar/uploads/:assetId`, DELETE `/me/avatar` | Đều dưới `/api/v1`, có auth. Multipart `image`, JPEG/PNG/WebP <=5,242,880 bytes; upload202 là QUARANTINED, chỉ CLEAN có URL; delete204 không body. Upload thật chưa thuộc scope. |

Envelope success `{success:true,message,data,meta?}`; lỗi hiện trả
`{success:false,message,statusCode}`, không đảm bảo code/fieldErrors.
Profile có skill preview tối đa20 trong `sharingSkills.data/pagination`; không
nhầm với endpoint list riêng. Public list không đảm bảo404 khi user không tồn tại.

Gap cần giữ rõ:

- Website, rating, learned/taught totals và title/achievement chưa có profile field.
- `completedSessionCount` không phải `completedLearningPathCount` trong SRS.
- SRS yêu cầu sanitize bio nhưng chưa thấy sanitizer trong update path đã đọc.
  Native Text không chứng minh backend đã đáp ứng yêu cầu này.
- Full skill pagination, avatar thật và API/cache integration để feature sau hoặc
  cập nhật scope; không tự thêm endpoint/field hay sửa BE.

## Checklist triển khai

- [x] Kiểm tra interface Auth trên base dev, reuse UI và giới hạn file impact.
- [x] Thêm model/projection/fixtures, validation và sửa stats/badge mẫu sai.
- [x] Chuyển ProfileHero và section dùng chung sang props theo own/public mode.
- [x] Hoàn thiện own/edit: save/cancel/clear, đồng bộ identity, tách draft/session.
- [x] Thêm public screen/route, target lookup, state và back fallback.
- [x] Thêm self-preview từ own profile; giữ discovery/chat ngoài phạm vi.
- [x] Automated tests cho privacy, biên validation, target và retry.
- [x] Kiểm tra luồng web, quality checks và cập nhật README theo source thực tế.
- [ ] Đối chiếu Public Profile với Figma riêng, kiểm tra native device/large text.
- [ ] Tích hợp Auth spec 002/API khi dependency sẵn sàng và scope được mở.

## Kiểm chứng và handoff

Từ `apps/mobile`, dùng `npm run web` hoặc `npm start` để preview khi có code.
Chạy `npm run check-types`, `npm run lint`, `npm run check-structure` và
`npm run test:profile`. Bộ test dùng Node test runner và TypeScript đã có, không thêm dependency.

Fixtures để preview: `demo-mentor-an` (có kỹ năng), `demo-learner-linh` (rỗng),
`demo-retry` (lỗi lần đầu rồi retry thành công), ID khác (unavailable).
Self-preview mở từ own profile; cần demo session, reload xóa session.

Kết quả ngày 2026-10-08:

- `npm run check-types`, `npm run lint`, `npm run check-structure`: pass;
  structure kiểm tra 109 source files, không vượt giới hạn dòng.
- `npm run test:profile`: 7 tests pass; kiểm tra biên Unicode, clear/no-change,
  public projection có dữ liệu private cố tình chèn vào, target thiếu/không rõ,
  self-preview, fixture rỗng và retry.
- Expo web bundle pass. Browser smoke bằng Playwright có sẵn trong runtime:
  save/invalid/cancel/clear, tự xem hồ sơ, viewer menu, public target khác,
  đổi target/unavailable/retry, back theo lịch sử và fallback không có lịch sử,
  logout khi đang edit, đổi account, user mới và signed-out deep link đều pass;
  không có page runtime error.
- Kiểm tra overflow và screenshot own/edit/public ở width 320/375/430;
  đã xem ảnh public và own/edit 320/430, không thấy tràn ngang.
  Screenshot nằm trong `.expo/` ignored, không thêm tài liệu nghiệm thu riêng.

Chưa kiểm tra iOS/Android device, native keyboard/large text và pixel-match với
reference Public Profile riêng. Chưa gọi API thật, kiểm tra Auth spec 002 sau merge
hoặc upload avatar. Web/mock tests không được coi là API E2E.
