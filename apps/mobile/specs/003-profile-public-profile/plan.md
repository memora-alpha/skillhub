# Plan: Spec 003 — Hồ sơ cá nhân và hồ sơ công khai

**Ngày cập nhật:** 2026-10-09. **Nhánh:** `feat/mobile-profile`.
Yêu cầu và tiêu chí nghiệm thu nằm trong [spec.md](spec.md).
Plan mô tả runtime sau rebase; các kết quả trước rebase chỉ là bằng chứng lịch sử.

## 1. Baseline và phạm vi

- Mobile Foundation thuộc spec 001; Auth/account shell thuộc spec 002 và đã có
  trên base `dev` sau rebase ngày 2026-10-09.
- Runtime dùng AuthSession, QueryClient, SecureStore, Toast và KeyboardProvider.
  Profile không dùng MockSession để xác định tài khoản đang đăng nhập.
- Own/edit profile giữ API đã có; self-preview dùng account thật đã lưu. Target
  khác dùng fixture, không bổ sung public API/skill-list API trong phạm vi này.
- Artifact gồm spec, plan, [tasks](tasks.md), [checklist](checklist.md) và
  [validation](validation.md); giữ nội dung ngắn và tránh lặp yêu cầu.
- Không thêm dependency, sửa backend, root/shared tooling hoặc feature ngoài profile.

## 2. Cấu trúc và phần tái sử dụng

| Phần                                                       | Trách nhiệm                                                                         |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `src/app/(tabs)/profile.tsx`                               | Route own profile trong tabs.                                                       |
| `src/app/edit-profile.tsx`                                 | Route editor ngoài tabs.                                                            |
| `src/app/profiles/[userId].tsx`                            | Đọc target param và mở public screen ngoài tabs.                                    |
| `src/features/profile/screens`                             | Own/edit/public UI và điều phối state của màn hình.                                 |
| `src/features/profile/context/ProfilePreview.tsx`          | Chiếu account đã lưu từ AuthSession; không lưu bản sao identity hoặc headline demo. |
| `src/features/profile/utils/public-profile.ts`             | Allowlist profile/skill và đọc target ID.                                           |
| `src/features/profile/utils/profile-validation.ts`         | Validation draft và so sánh với dữ liệu đã lưu.                                     |
| `src/features/profile/mocks/public-profiles.ts`            | Resolver target demo, unavailable và retry fixture.                                 |
| `src/features/account`, public API của `src/features/auth` | Own-account contracts, HTTP adapter, session và mutation/cache hiện có.             |

Tái sử dụng ProfileLayout, ProfileSummary, ProfileHero, ProfileAbout/ProfileSkills,
Avatar, ControlledInput, Button, InfoModal, shell/header, theme và toast.
Public view không truyền edit/manage callback cho target. Account menu nhận
session của viewer, tách khỏi profile đang hiển thị.

Routes giữ thin; feature exports qua `index.ts`; không deep-import backend hoặc
private files của feature khác. Giới hạn theo AGENTS.md mobile: routes ≤100 dòng,
utils/hooks/API ≤250, source khác ≤400. Không đổi layout thư mục hiện có.

## 3. Dữ liệu và state

### Own account và self-preview

Auth spec 002 tải `GET /api/v1/me`; profile đọc `account.profile` và tạo public
projection tường minh. Avatar/reputation/counters giữ giá trị server; reputation
`null` hiển thị dấu gạch. Không thay optional field rỗng bằng dữ liệu demo.

`toOwnProfilePreview` trả `sharingSkills: []` vì mobile chưa tích hợp skill list.
UI phải dùng trạng thái chưa kết nối thay vì kết luận user không có kỹ năng;
`verifiedSkillCount` vẫn giữ số server và không suy ra skill/badge toàn tài khoản.

### Editor

Avatar bổ sung: dùng `expo-image-picker` chọn một ảnh JPG/PNG/WebP ≤5MB, preview
trong draft và upload multipart field `image` qua `POST /me/avatar` khi Lưu.
Theo dõi `GET /me/avatar/uploads/:assetId` ở provider theo generation của phiên;
chỉ refresh own-account/avatar sau CLEAN. DELETE `/me/avatar` dùng khi Lưu thao tác
xóa ảnh. Hủy draft không gọi các endpoint avatar. Các endpoint profile/avatar
độc lập: nếu avatar lỗi sau khi profile đã lưu, giữ draft ảnh và báo phần đã lưu.

React Hook Form/Zod hiện có quản lý draft, sử dụng validation của feature profile.

Own profile khôi phục kiểu dáng commit `ac4590d`: thẻ trắng, avatar 64px, nút public
preview riêng; grid hai cột trước bio/skills (Ví Credit, Tài liệu của tôi, Thành tích,
Xác minh kỹ năng, Đánh giá, Cài đặt). Theo audit SRS 1.6, bỏ huy hiệu mẫu, số dư
demo và số buổi hoàn thành; giữ reputation/verified skill count từ server.
Ô Lộ trình hoàn thành chỉ hiển thị “—”/“Sắp có”; danh hiệu own cũng ghi “Sắp có”.
Giá trị/chọn danh hiệu thật cần contract riêng. Thông tin riêng tư ở Cài đặt. `features/settings` giữ account
details, Trợ giúp gộp thông tin công khai, Giới thiệu riêng, version ở footer và entry point
bảo mật. Header mobile dùng tab Hồ sơ thay menu avatar; web ≥640px giữ menu. Tái sử dụng
AppScreenLayout, InfoModal, LogoutDialog và theme; nút đăng xuất phiên hiện tại
có nền đỏ nhạt, viền/icon đỏ. Không thêm UI dependency hoặc thay đổi API.
Auth giữ OTP recovery, mở recovery routes cho cả guest/signed-in sau các nhóm
protected để không đổi landing page sau login. SessionController deduplicate
reset theo proof/generation và clear credential sau reset signed-in thành công.
Tham khảo: [Airbnb profile](https://www.airbnb.com/help/article/3386) và
[LinkedIn settings](https://www.linkedin.com/help/linkedin/answer/a1337839/managing-your-account-and-privacy-settings?lang=en).
Tên trim và đếm code points. Headline/bio dùng helper tương thích validator BE:
UTF-16 length trừ surrogate pairs và presentation selectors được helper nhận diện.
Không đồng nhất cách đếm này với tên hoặc tự đổi sang grapheme count.

Không mutate khi draft không đổi/không hợp lệ. `useUpdateProfile` gọi adapter
account hiện có, cập nhật cache từ response và invalidate own account.
Pending khóa controls với cả mutation state và khóa đồng bộ chống lưu trùng;
Android hardware back bị chặn trong lúc lưu. Thành công toast và dismiss về
`/profile`; lỗi giữ draft và hiển thị FormNotice, kết quả không rõ yêu cầu kiểm tra
hồ sơ trước khi lưu lại. Callback chỉ điều hướng/toast khi editor còn focus và
cùng session generation.
Form được tạo lại theo session generation. HTTP/session và mutation phải bỏ
response cũ, không replay request của account A bằng credentials của account B.

### Public target

Auth gate do AuthNavigator cung cấp. Content được reset theo session generation
và target ID; cleanup timer khi unmount/đổi target. Resolver chọn self trước,
sau đó lookup fixture; ID thiếu/không rõ không fallback sang viewer.

Các trạng thái: loading → ready/unavailable/error; retry quay về loading rồi
resolve lại. Ready có kỹ năng rỗng khác với skill list chưa kết nối.
Back dùng history, không có history thì replace `/profile`.

Fixtures hiện có:

- `demo-mentor-an`: có kỹ năng VERIFIED và UNVERIFIED.
- `demo-learner-linh`: bio/headline rỗng, reputation 50, counter 0, skills rỗng.
- `demo-retry`: lỗi lần đầu, retry trả hồ sơ mentor mẫu; chỉ phục vụ kiểm thử demo.
- ID khác: unavailable. Demo IDs không phải UUID và không gửi tới API.

## 4. Contract đã đối chiếu

Source tham chiếu read-only:
[mobile account adapter](../../src/features/account/api/account-api.ts),
[mobile contracts](../../src/features/account/api/account-contracts.ts),
[UsersController](../../../../services/api/src/modules/users/presentation/http/users.controller.ts),
[DTO](../../../../services/api/src/modules/users/presentation/http/users.dto.ts),
[response](../../../../services/api/src/modules/users/presentation/http/users.responses.ts) và
[ProfileReader](../../../../services/api/src/modules/users/application/services/profile-reader.service.ts).

| Endpoint                                                                                       | Contract và trạng thái mobile                                                                                                                                         |
| ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET `/api/v1/me`                                                                               | Có auth; identity chứa email/account metadata và nested `data.profile`. Mobile dùng qua spec 002.                                                                     |
| PATCH `/api/v1/me/profile`                                                                     | Có auth; các field optional `fullName/headline/bio/timezone/locale`; trả OwnProfile trực tiếp ở `data`, không có expectedVersion. Editor chỉ gửi ba field trong spec. |
| GET `/api/v1/profiles/:userId`                                                                 | Có auth; target UUID và ACTIVE; không tồn tại/inactive trả 404; projection public. Mobile chưa gọi.                                                                   |
| GET `/api/v1/profiles/:userId/skills`                                                          | Public skill list, cursor opaque, limit 1–50/default 20, pagination trong `meta.pagination`. Mobile chưa gọi; list không chứng minh target tồn tại.                   |
| POST `/api/v1/me/avatar`, GET `/api/v1/me/avatar/uploads/:assetId`, DELETE `/api/v1/me/avatar` | Đã nối chọn/upload/status/xóa; 202 QUARANTINED, chỉ CLEAN refresh avatar, delete 204 không body.                                                                      |

Envelope success `{success:true,message,data,meta?}`. Lỗi hiện tại không bảo đảm
`code` hoặc `fieldErrors`; giữ parser/error feedback hiện có. Backend profile có
skill preview dạng `sharingSkills.data/pagination`; không cast trực tiếp sang array
`PublicProfile.sharingSkills` của mobile khi tích hợp sau này.

Các contract gaps và giới hạn nghiệp vụ theo GAP-01..06 trong spec. Đặc biệt không
ánh xạ session count thành path count, không suy ra title/rating và không coi native
Text là bằng chứng backend sanitize bio.

## 5. Trạng thái triển khai đã kiểm tra trong source

- [x] Own account/real Auth và editor `PATCH /me/profile` đã được nối.
- [x] Public projection, profile validation, own/self-preview và target fixtures.
- [x] Auth gate, target/session reset, timer cleanup, loading/error/retry/unavailable.
- [x] Own skill list báo chưa kết nối; target mẫu được nhận diện là dữ liệu mẫu.
- [x] Helper tests cho Unicode, clear/no-change, privacy, target, self-preview/retry.
- [ ] Kết nối API public profile và skill list: ngoài phạm vi hiện tại.
- [x] Avatar chọn/preview/upload/status/xóa, multipart và session guards.
- [ ] Timezone/locale setup, title/achievement: ngoài phạm vi hiện tại.
- [x] Kiểm chứng own/edit với API local và browser fixtures sau rebase.
- [x] LAN/CORS trực tiếp và Android emulator keyboard/Back bỏ draft, save/reopen, chữ lớn 130%.
- [ ] Pending Back native, iOS/thiết bị thật và đối chiếu Public Profile Figma riêng.

Các dấu đã hoàn thành ghi nhận source hiện có, không thay thế AC UI/API trong spec.
Theo dõi công việc tiếp theo ở [tasks.md](tasks.md); đánh dấu nghiệm thu tại
[checklist.md](checklist.md) khi có bằng chứng trong [validation.md](validation.md).

## 6. Kế hoạch kiểm chứng

Từ `apps/mobile`, chạy `npm run check-types`, `npm run lint`,
`npm run check-structure` và `npm test` khi thay đổi implementation.
`npm run test:profile` chạy riêng helper/fixture tests.

Kiểm tra UI theo AC-01..11 của spec: own/new/null values; edit/save/clear/cancel;
pending/errors; đổi account trong request; own/self và target demo; privacy và badge;
target invalid, retry/back/deep link; native safe area/keyboard/large text và width
320/375/430. Dùng API thật để xác minh own-profile persistence; không dùng fixture
tests làm bằng chứng API integration.

Kết quả checks ngày 2026-10-09, bằng chứng lịch sử trước rebase và phần còn chưa
kiểm chứng được tập trung trong [validation.md](validation.md).
