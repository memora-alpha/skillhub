# Quickstart validation — Learning Request mobile

Plan checkpoint 2026-10-12. Guide này tách automated/fixture, API thật và native.
Evidence lịch sử ở [validation](validation.md); việc viết guide không chạy lại
checks, không mở gate backend hoặc tick AC. Field/state và recovery xem
[data model](data-model.md), [HTTP](contracts/http.md), [UI](contracts/ui.md).

## 1. Project và dependencies

Chạy Spec Kit trong `apps/mobile`, active feature là specs/005-learning-request.
Giữ Git tại root, branch feat/mobile-learning-request. Không init lại hoặc đổi
spec number. Node theo README (22.13+ trên22.x hoặc24.3+), mobile deps hiện có.
Nếu chưa có dependencies, từ root dùng `pnpm install` theo repository guidance;
không cần thay dependency chỉ để đọc plan.

Từ PowerShell:

```powershell
Set-Location D:\FPTU\Fall2026\WDP\skillhub\apps\mobile
& ./.specify/scripts/powershell/check-prerequisites.ps1 -Json -RequireTasks
```

Expected: FEATURE_DIR trỏ mobile/specs/005-learning-request; plan/tasks tồn tại.
Đây là kiểm artifact prerequisites, không kiểm implementation/readiness API.

## 2. Automated regression trên source

Chạy từ apps/mobile sau khi triển khai phần Mxx:

```powershell
npm run lint
npm run check-types
npm run check-structure
npx tsx --test tests/learning-requests*.test.ts
npm test
```

Expected: checks pass; ghi ngày, commit/working-tree checkpoint và số tests thực
tế vào validation. Không copy số102 từ lần2026-10-11 thành kết quả mới. Checkpoint
implement2026-10-12:48 LR tests và140 full-suite tests; cover recovery M01..M05,
time/pagination/session và fixture M06. Không cover native/live-backend đầy đủ.

Khi bổ sung tests, tập trung failure cases sau; không test mirror từng style:

| Work package | Scenario / expected                                                                                                                                                                                                                                                                                                              |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M01          | Server version đổi ->409; draft giữ nguyên, latest snapshot đọc trong editor; no autoPATCH/version bump; stale session không cập nhật comparison.                                                                                                                                                                                |
| M02          | Cached OPEN/PENDING quá deadline ->GET trước action, editor deep link và PATCH có thay đổi khi form mở qua deadline; EXPIRED/terminal khóa, version đổi đối chiếu M01; GET lỗi giữ draft/khóa mutation,404/403 ẩn snapshot; không local-expire states khác hoặc GET loop do clock lệch.                                          |
| M03          | >=2 pages, old cursor400 INVALID_REQUEST_CURSOR sau snapshot đổi; first-page refetch xây chain mới; query400 khác không retry vòng lặp; transient page fail giữ items.                                                                                                                                                           |
| M03          | Đổi keyword/Skill/scope/account lúc loading, response cũ không replace result; fetchNextPage không cạnh tranh refetch.                                                                                                                                                                                                           |
| M04          | PATCH/publish/cancel trả owner schema đúng nhưng ID khác target ->protocol failure, không sync/toast success/navigate; correct ID vẫn sync.                                                                                                                                                                                      |
| M05          | GET network/503 giữ reason/state last-read với notice; cached own/public detail nhận GET404/403 ẩn content/reason và khóa action đến GET success đúng phiên; mutation403 không tự phủ nhận quyền đọc; successful edit/re-publish bỏ reason cũ theo response.                                                                     |
| M06          | Unknown create không tự POST lại; known mutation đọc kiểm kết quả; double tap/back pending/session switch; submit trễ kiểm time. Negative account không ACTIVE/thiếu grant/policy hạn chế và429 giữ input cùng phiên, không success/auto resend;401 theo Auth. Client chỉ NFKC/trim/code points, sanitizer/moderation do server. |

## 3. Browser fixture UI có thể tái lập

Harness test-only đã có trong `tests/fixtures/learning-requests-api.ts` và data
ở `learning-requests-data.ts`. Server chỉ bind loopback; không dùng backend thật.
Hai account giả: `learner-a@example.test`, `learner-b@example.test`; password
test `FixtureOnly123!` (login fixture không xác thực password). Không dùng credential thật.

Terminal 1, từ `apps/mobile`:

```powershell
npx tsx tests/fixtures/learning-requests-api.ts
```

Terminal 2, từ `apps/mobile`, environment chỉ áp cho process preview:

```powershell
$env:EXPO_PUBLIC_API_URL = 'http://127.0.0.1:4315/api/v1'
npx expo start --web --port 8082
```

Mở `http://localhost:8082`, login account fixture. Dừng cả hai terminal bằng
Ctrl+C; bỏ biến process bằng `Remove-Item Env:EXPO_PUBLIC_API_URL` trước khi chạy
API thật. Không chỉnh `.env`. Port4315 có thể đổi bằng `LR_FIXTURE_PORT`.

Control test-only: `POST http://127.0.0.1:4315/__fixture` JSON, reset bằng
`{"reset":true}`; `rules` là danh sách `{kind,method?,path?,actor?,cursor?,times?}`.
Kind: `http` (+status/code), `network`, `delay` (+delayMs), `conflict`, `wrong-id`,
`unknown-commit`. Rule mặc định dùng một lần; path là pathname `/api/v1/...`.
`update` sửa snapshot fixture theo UUID; `matchingVersion` đổi snapshot cursor.
`GET /__fixture` đọc event method/path/actor/status (không log body/token/reason).
Đây là simulation response, không phải contract Tag/eligibility/moderation thật.

`unknown-commit` commit fixture rồi gửi status/partial JSON và cắt response;
client phải coi kết quả chưa xác nhận, không resend. Không mô phỏng bằng zero-byte
socket close để khẳng định exactly-once: Chromium có thể replay ở transport level.
Contract backend chưa có idempotency guarantee; xem [evidence](validation/fixtures.md).

Validation2026-10-11 dùng process fixture tạm ngoài repo. T001/T002 đã thay bằng
harness test-only có thể chạy lại như trên; không giả định fixture vẫn đang chạy.
Harness không được thành runtime fallback/provider của app.

Harness cần own/public UUIDs, >=2 cursor pages, conflict, create503, delayed
responses/unknown outcome, expired effectiveStatus và recommended snapshot đổi.
Đăng nhập bằng identity fixture riêng; giữ API thật và fixture ở origin/port khác.
Không dùng credentials/API data thật để kiểm mutation fixture.

Khi harness đã sẵn sàng, mở terminal Expo riêng và đặt URL của fixture cho process:

```powershell
$env:EXPO_PUBLIC_API_URL = 'http://localhost:4315/api/v1'
npm run web -- --port 8082
```

Expected: transport vào fixture vừa khởi động, không đổi .env hoặc ghi API thật.
Kiểm tra host/URL trước mutation; dừng process test sau khi thu evidence.

UI journey cơ bản: Profile -> Mine -> New -> Back -> Mine -> Back -> Profile;
Discovery -> New -> save -> own detail -> edit/save -> detail -> Back -> Discovery.
Không quay lại editor đã save. Filters Apply/Close/Reset/clear và error/empty/page
failure đúng contracts/ui. Không giả là recommended khi snapshot503.

## 4. Môi trường API thật và gate B01..B06

API owner cung cấp migrations/grants/data/config và xác nhận các reader thật.
Health success, Skills success hoặc feed200[] không đủ chứng minh LR readiness.
Không sửa services/api hoặc triển khai adapter từ quickstart mobile.

Tài khoản kiểm thử ACTIVE có grant đúng, hai owner khác nhau, một reviewer Staff
riêng cho moderation, Skill ACTIVE và Tag canonical nếu B05 đã mở. Nội dung clean/
flagged cần lấy từ rule đã cấu hình, không đoán keyword. Dữ liệu kiểm thử phải
được cho phép tạo/sửa/hủy trên môi trường nghiệm thu.

Trên máy dev, dùng terminal mới tại apps/mobile:

```powershell
$env:EXPO_PUBLIC_API_URL = 'http://localhost:3001/api/v1'
npm run web
```

Trên thiết bị/emulator, URL phải reach được máy API: physical device dùng LAN IP,
không dùng localhost của điện thoại. Cấu hình CORS/network cần API owner xác nhận.
EXPO_PUBLIC variables không chứa secrets; token từ login/Auth chung.

| Case      | Expected / gate                                                                                                                                                                                                                                                                                                                          |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-01,14  | Hai account own list/private404/deep links, cached detail ->GET404/403, account không ACTIVE/thiếu grant/policy hạn chế và429 theo response backend; mutation không success/auto resend, input giữ nếu phiên hợp lệ,401/logout theo Auth, không lẫn state/cache/toast. Auth/DB/grants và negative test data do API owner cung cấp (B06). |
| AC-02..04 | Unicode/markup/raw PATCH boundaries, Skill ACTIVE/inactive, Tag0/10/11/duplicate, slots/timezones; B01/B05/B06. Tag cases vẫn blocked nếu chưa có lookup.                                                                                                                                                                                |
| AC-05..08 | Create201DRAFT, reopen, publish clean/flagged, Staff external approve/reject, edit/re-publish/conflict; B01/B06 và M01/M04.                                                                                                                                                                                                              |
| AC-09     | Cancel các allowed state; NEGOTIATING unlocked/locked/race cần B04. Không kết luận mọi cancel blocked khi B04 chưa mở.                                                                                                                                                                                                                   |
| AC-10     | Default/custom TTL/DB time, worker chậm nhưng GET effectiveStatusEXPIRED, edit không gia hạn; editor deep link/form mở qua deadline/pre-PATCH GET lỗi hoặc version đổi/terminal giữ draft, khóa/đối chiếu đúng; B06/M02, B01 cho PATCH/edit cases.                                                                                       |
| AC-11     | Feed có item của account khác, >=2 pages, search/Skill/Tag ANY, page failure/race/cursor recovery; B01/B02/B05/M03.                                                                                                                                                                                                                      |
| AC-12     | Recommended có ranked items/snapshot version thật, snapshot đổi,503; B01/B02/B03/M03.                                                                                                                                                                                                                                                    |
| AC-13     | Network/503 giữ last-read với notice; cached detail nhận GET404/403 ẩn snapshot/reason và khóa action; sửa/re-publish không tái dùng reason cũ; B06/M05.                                                                                                                                                                                 |
| AC-15     | Real public detail không vào Proposal/profile mock; preview không gọi LR; không demo budget/số buổi/badge.                                                                                                                                                                                                                               |

Ghi mỗi case Passed/Failed/Blocked và prerequisite cụ thể, không tick toàn bộ AC
do một happy path hoặc fixture pass. Notification delivery và Proposal/profile
thật nghiệm thu riêng; giữ DEP-01 trong mô tả coverage SRS.

## 5. Native AC-16

Android cần emulator/physical device với Expo Go/dev client tương thích SDK57.
iOS simulator cần macOS/Xcode hoặc thiết bị/dev build thích hợp. Chưa có native
evidence trong checkpoint hiện tại; chưa quyết định dùng dịch vụ cloud simulator.

Chạy app theo [mobile README](../../README.md); Android local:

```powershell
npm run android
```

Trên cả Android và iOS: keyboard/scroll/multiline, safearea/orientation, hardware
Back hoặc gesture trong lúc pending/after save, long Vietnamese text và font
scale130%; layouts width320/375/430. Verify field/action disabled cả touch và
accessibility; các state phải có text label. Chụp evidence viewport/device/OS và
ghi fixture hay real API; web360/390 không thay các kiểm tra này.

## 6. Kết thúc nghiệm thu

Giữ task history, bổ sung evidence thực chạy rồi mới tick checklist thích hợp.
Nếu source đổi chạy focused checks và affected regressions; nếu only docs kiểm
links/consistency/preservation. Sau implement dùng speckit-converge, các backend/
Tag/native prerequisite chưa đáp ứng vẫn ghi Blocked/Pending, không fake complete.
