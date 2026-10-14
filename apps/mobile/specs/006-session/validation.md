# Validation: Session mobile

Baseline: branch `feat/mobile-session`, HEAD `01ced64`, ngày 2026-10-14.
Scope triển khai: T001–T015 và T018. T016/T017/T020 chờ backend; T019 chỉ nghiệm thu khi đủ môi trường.

## Prerequisites

- Node 22.19.0/npm 10.9.3 và dependencies hiện có; không cài package mới.
- Spec Kit chọn đúng 006-session; checklist requirements 16/16, không thay checklist trong implement.
- Ignore/ESLint hiện có đã bỏ node_modules/dist/.expo/env; không cần sửa root tooling.
- Cần hai tài khoản participant và buổi đã khóa để nghiệm thu API thật. Chưa có account/device test trong task này; không tạo dữ liệu backend hoặc dùng credentials thật trong artifacts.

## Dependency còn mở

- GAP-01/GAP-02: thiếu read proposal/version và evidence conflict tại confirm cuối; đổi lịch phải unavailable, không POST.
- GAP-03: cần smoke authenticated GET detail JSON; BigInt là rủi ro source, chưa kết luận runtime fail.
- GAP-04: API cap 100; mobile cảnh báo giới hạn và cho thu hẹp khoảng, không sửa backend.

## Evidence

| Loại                                  | Trạng thái                                                                                           |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Focused tests                         | Pass — 15 Session tests                                                                              |
| lint / types / structure / full tests | Pass — 470 source files, 282/282 tests                                                               |
| Fixture web                           | Pass — 7 scenario groups, 320/375/430 px, zero page errors                                           |
| API thật hai account                  | Pending nghiệm thu đầy đủ — detail smoke hai account 200/404 sau fix BE; completion/native chưa kiểm |
| Android / iOS                         | Pending — chưa có thiết bị nghiệm thu                                                                |

Fixture không chứng minh runtime backend hoặc native. T001–T015 và T018 hoàn thành;
T016/T017/T019/T020 giữ mở. Source thay đổi chưa commit trên baseline HEAD nêu trên.

## Commands và kết quả

```powershell
npx tsx --test tests/sessions-list.test.ts tests/sessions-detail.test.ts tests/sessions-completion.test.ts tests/sessions-reschedule-availability.test.ts
npm run lint
npm run check-types
npm run check-structure
npm test
```

- Focused suite: 15/15 pass. Lần chạy trước implementation fail vì các module mới chưa tồn tại; sau implement các ca hành vi đều chạy và pass.
- Lint/type checking pass; structure 470 files pass, các source mới theo giới hạn file-size trong architecture. Full suite 282/282 pass, bao gồm consumers HTTP/auth/profile và preview.
- Export web pass với `EXPO_PUBLIC_API_URL=https://session-fixture.invalid/api/v1`, `EXPO_NO_DOTENV=1`; output `.expo/sessions-review-web`. Chỉ override env trong process kiểm thử, không sửa `.env` hay dependency/lockfiles.
- Kiểm browser: `node .expo/sessions-browser.cjs` dùng Playwright bundled + Edge headless, chỉ intercept API fixture, không gọi backend thật. 44 fixture requests, đúng 2 completion POST từ hai participant, 0 reschedule/settlement POST, 0 page errors.
- Đã mở và kiểm tra screenshot detail 320 px, đổi lịch 375 px và confirmation chờ đối tác; layout không tràn ngang ở 320/375/430 px.
- Tại thời điểm kiểm tra implementation, probe local `http://localhost:3001/api/health` không truy cập được và chưa có account test để gọi authenticated detail. Đây không phải kết luận server khác hỏng hoặc GAP-03 đã xử lý. API thật/native vẫn Pending.

## Browser journeys đã pass

1. Calendar → Session detail thật: role, thời gian, public partner và layout ở 320/375/430 px.
2. Form đổi lịch: nhập ngày giờ/thời lượng, không reason bắt buộc; disabled submit, zero POST khi chưa read contract.
3. Cached detail → 403 → 503: không hiện lại private data; read hợp lệ mới phục hồi.
4. Profile phụ unavailable không chặn Session; buổi đã endAt nhưng còn CONFIRMED vẫn xác nhận được. Response POST bị mất và double tap không tự resend; explicit reconcile thấy xác nhận đã ghi.
5. Hai participant fixture xác nhận riêng, chỉ lần thứ hai nhận COMPLETED từ server fixture; mở lại sau đăng nhập mới vẫn thấy trạng thái, không settlement.
6. Cap 100 có cảnh báo; empty/refresh error/manual retry đúng, không fallback sample.
7. Gallery Session ID mẫu bị vô hiệu hóa; real screens không lấy preview state.

Web auth hiện memory-only theo contract sẵn có; cold reload cần đăng nhập lại.
Harness dùng navigation thật và relogin khi kiểm tra tải lại, không thêm auth persistence cho feature.
Native SecureStore/bootstrap và Android/iOS keyboard/Back/resume chưa nghiệm thu.

## Evidence local

Harness và screenshots ở ignored `.expo/`: `sessions-browser.cjs`,
`sessions-validation/result.json`, `detail-320.png`, `detail-375.png`,
`detail-430.png`, `reschedule-375.png`, `completion-awaiting.png`.
Tests và implementation được giữ trong source; ảnh/harness là evidence local, không commit output export.

## PostgreSQL fixture — 2026-10-14

Theo yêu cầu bổ sung của người dùng, đã seed database PostgreSQL local `skillhub`
ở `NODE_ENV=development`. File script seed tạm đã được gỡ theo yêu cầu bổ sung
không chỉnh sửa BE; không còn thay đổi file trong `services/api`. Dữ liệu đã ghi
vào PostgreSQL được giữ nguyên, không sửa API hay migration.

- Tạo thêm 2 user USER/ACTIVE/emailVerified, timezone Asia/Ho_Chi_Minh; 6 user trước đó được giữ nguyên.
- 3 graph proposal ACCEPTED → conversation → locked path version → confirmed plan/outline → locked schedule → Session/history; 8 Session có liên kết và thời lượng 90 phút.
- Trạng thái: CONFIRMED 3 (1 sắp tới, 2 đã kết thúc ở hai vai), AWAITING_CONFIRMATION 2 (mỗi bên đã xác nhận riêng), COMPLETED 1, CANCELLED 1, DISPUTED 1 trong path DISPUTED.
- Grant credit được đánh dấu DEV_FIXTURE_GRANT/ADJUSTMENT; hold dùng CreditLedgerService hiện có và fee policy ONE_WAY đã APPROVED. Không gọi settle/refund hay tạo chính sách mới. Kiểm tra available/held khớp ledger và allocation cho cả hai ví: pass.
- Argon2 kiểm tra mật khẩu cả hai tài khoản: pass. Chạy script lần hai: existing fixtures preserved, vẫn 2 user fixture/3 path/8 Session, không reset trạng thái đã test.
- Cú pháp `node --check` và focused ESLint qua executable đã cài: pass. `pnpm exec` bị chặn bởi cơ chế pnpm yêu cầu reinstall modules với TTY; không reinstall, dùng executable local.

Credentials và manifest được lưu trong ignored `.expo/session-seed-credentials.json`
và `.expo/session-seed-manifest.json`. Không đưa mật khẩu vào source/spec.
Dữ liệu seed không chứng minh HTTP/auth/native đã hoạt động; T019 vẫn Pending,
các dependency backend T016/T017/T020 và GAP-03 giữ nguyên.

## Smoke HTTP thật — 2026-10-14

Server local đã hoạt động: `/api/health` và `/api/docs-json` trả 200.
Swagger có POST reschedule-proposals và POST schedule-proposals/{id}/confirm,
chưa có GET đọc đề xuất/version/xác nhận. GAP-01 tiếp tục mở.

Dùng teacher fixture đăng nhập: login 200; GET `/api/v1/sessions/mine`
với khoảng tháng 10/2026 trả 200 và 8 buổi. GET
`/api/v1/sessions/00600600-0000-4000-8000-000000000111` trả 500,
`Internal server error`. GAP-03 đã có evidence detail HTTP lỗi, chưa kết luận
nguyên nhân từ log. Không thể sửa lỗi HTTP 500 bằng parser mobile.
Đã logout phiên smoke (204); không log password/token, không gửi mutation Session.
Không thay đổi file BE. T019 vẫn mở vì detail lỗi, chưa kiểm hai account/native.

Đã tái hiện nguyên nhân trên service build hiện có: gọi detail với teacher fixture
đọc Session thành công, nhưng `JSON.stringify(success(session, ...))` ném
`TypeError: Do not know how to serialize a BigInt`. Hai field gây lỗi là
`teacherAttendanceSeconds` và `learnerAttendanceSeconds` (Prisma BigInt).
Controller trả raw Session; chưa thấy response serializer xử lý BigInt trong
bootstrap. Đây là lỗi chuyển response sang JSON, không phải thiếu bản ghi test.
Chỉ kiểm tra đọc/serialize trong process riêng, không sửa BE hay dữ liệu.

## Fix detail JSON — 2026-10-14

Người dùng đã cho phép sửa BE bằng yêu cầu "tạm chỉnh đi", chỉ cho lỗi GET detail.
`LearningSessionsService.detail()` chuyển teacherAttendanceSeconds và
learnerAttendanceSeconds từ BigInt sang decimal string sau kiểm tra participant.
Không thay đổi PostgreSQL/migration, auth, completion hay scheduling.

- Regression `services/api/test/learning-sessions-detail.test.mjs`: trước fix 2/4 fail đúng lỗi BigInt, sau build 4/4 pass. Kiểm serialization teacher/learner, số lớn hơn MAX_SAFE_INTEGER không mất precision, 403 nonparticipant và 404 missing.
- Nest build và focused API ESLint: pass. HTTP thật: cả hai tài khoản fixture đọc detail 200, hai attendance fields là string; missing Session 404. Logout cả hai phiên smoke 204.
- API type check (`tsc --noEmit`): pass. Consumer mobile `tests/sessions-detail.test.ts`: 3/3 pass; allowlist bỏ attendance fields đúng contract, không cần sửa parser/screen.
- Các check dùng executable local đã cài thay cho pnpm exec yêu cầu reinstall. Chưa commit/push.

Serialization của GAP-03 đã được xử lý; API đọc đổi lịch GAP-01 và final-conflict
GAP-02 vẫn giữ mở. Smoke read hai account không phải nghiệm thu completion/native;
T019 và T016/T017/T020 tiếp tục mở.

## Session presentation và pull-to-refresh — 2026-10-14

Theo yêu cầu bổ sung của người dùng, đổi nhãn/hiển thị Session và hỗ trợ kéo xuống
làm mới trên các màn cuộn/danh sách toàn app. Không sửa thêm BE trong thay đổi này.

- Calendar có filters Sắp tới/Đang học/Chờ xác nhận/Đã hoàn thành/Đã hủy–tranh chấp. Badge phân biệt giờ học đã kết thúc với COMPLETED do server; chỉ server đủ hai confirmation mới là đã hoàn thành.
- Detail hiển thị mô tả trạng thái, xác nhận hoàn thành riêng cho buổi đã kết thúc, lý do/thời điểm hủy khi API có dữ liệu. Buổi sắp tới không hiển thị hai dòng “chưa xác nhận” dễ nhầm. Bỏ placeholder kỹ thuật plan và nút “Tải lại buổi học”; giữ explicit retry khi lỗi.
- Refresh dùng wrappers chung cho page scroll, keyboard-aware form và FlatList, không thêm nested list scroll. Global default đọc active queries; list callback hiện có được giữ. Không gửi save/confirm/upload để làm mới.
- Lint/type check/structure: pass, 478 source files. Full suite: 287/287 pass, gồm 5 ca mới về refresh/state presentation và regression auth/account/profile/Learning Request/skills/Session. Test native-text bổ sung mock import wrapper; vẫn kiểm native Text constraints.
- Web export: pass; 7 fixture browser groups kiểm mouse/touch pull trên calendar, detail/draft/profile, denial và phục hồi, responsive 320/375/430 px. 33 requests, 0 Session POST, 0 page errors. Ảnh detail-320 và ended-detail đã được mở kiểm trực quan. Kết quả cuối nằm trong `.expo/refresh-validation/result.json`; không gọi mutation Session hay API thật từ harness.

Android/iOS gesture/keyboard/inverted chat list chưa nghiệm thu trên thiết bị.
Không lấy fixture web thay thế native acceptance; T019 và các gate đổi lịch giữ mở.

## Calendar HTML reference — 2026-10-14

Theo mẫu HTML người dùng gửi, đã làm lại Calendar bằng React Native:
header 26 px, calendar rounded 24 px/month label bên trái/arrows bên phải,
dot markers, filters rounded 12 px, card title/status cùng hàng, role/time icons,
gradient action và history action có icon. Dùng palette Calendar hiện có;
không thay đổi theme toàn app, thêm dependency hoặc sửa BE.

- Giữ lịch đầy đủ theo tháng thật (bao gồm đầu tháng), timezone, participant-safe API và pull refresh. Month query giữ toàn bộ markers; selected-day query chỉ thu hẹp list. Đây là sửa lỗi markers biến mất khi chọn một ngày.
- Header hỗ trợ optional title style; chỉ Calendar cung cấp override. Type check và tests consumers shell/profile/auth vẫn pass.
- Lint/type checking/structure: pass, 481 source files. Full suite 287/287 pass. Web export `.expo/calendar-review-web`: pass.
- Browser fixture: 9 nhóm pass, 36 requests, 0 Session POST, 0 page errors. Kiểm mouse/touch pull, chọn ngày giữ markers, đổi tháng/empty, list→detail, draft, denial/recovery và profile refresh. Không gọi BE thật trong harness.
- Responsive không tràn ngang ở 320/375/412/430 px. Đã mở kiểm trực quan `calendar-375.png` và `calendar-320.png`; trạng thái/CTA và wrap filters rõ ở màn hẹp. Evidence ignored `.expo/calendar-validation/result.json` và ảnh `calendar-*.png`; harness `.expo/calendar-browser.cjs`.

Không thay đổi acceptance gate native hoặc API đổi lịch; chưa commit/push.

## Calendar refinement — 2026-10-14

Theo yêu cầu tiếp theo: fonts/cỡ chữ Calendar dùng `fonts`/`typography` của app,
bỏ custom header size; filters chuyển sang một hàng scroll ngang. Bỏ nhãn múi giờ
trên Calendar nhưng vẫn dùng timezone thiết bị cho dữ liệu và format.

- Hôm nay dùng nền sáng; mọi ngày có buổi học có vòng tròn mặc định, không tự chọn/filter một ngày. Chọn ngày bất kỳ cũng thêm vòng tròn và lọc list; hôm nay có buổi học/được chọn vẫn giữ nền sáng cùng vòng tròn. Legend khớp hai cách đánh dấu.
- Đã xóa `src/app/learning-history.tsx`, bỏ Stack registration và gallery entry; các link fallback/report cũ về Calendar. Không còn reference `learning-history` trong source. PathSessionsScreen còn dùng bởi route buổi học của lộ trình, chỉ đọc khi có path UUID hợp lệ.
- Lint/type checking/structure pass, 480 source files. Full suite 287/287 pass; web export pass.
- Fixture browser 11 nhóm pass: rings mặc định, nền hôm nay, chọn ngày không có buổi học, horizontal touch scroll không reload, route action/timezone label đã bỏ, chọn ngày giữ month markers, đổi tháng/empty, mouse/touch pull, detail/draft/denial/profile regression. 37 requests, 0 Session POST, 0 page errors.
- Responsive 320/375/412/430 px không tràn ngang trang; đã mở kiểm screenshot 375/320. Evidence ignored `.expo/calendar-refinement-validation/result.json` và `calendar-*.png`, harness `.expo/calendar-refinement-browser.cjs`.

Không sửa thêm BE hoặc mở gate đổi lịch. Android/iOS vẫn chưa nghiệm thu thiết bị;
chưa commit/push.

## Calendar selection reference — 2026-10-14

Theo ảnh người dùng gửi tiếp: bỏ legend, hôm nay chỉ chữ số cam/đậm (không nền),
ngày có buổi học chấm nhỏ, chỉ ngày đang chọn khoanh tròn. Tháng uppercase dùng
typography caption, số ngày dùng secondary; giảm khoảng cách/lịch gọn hơn.
Quy tắc này thay thế đánh dấu nền hôm nay và khoanh tất cả ngày có buổi học ở
checkpoint trước. Query, timezone dưới UI, lọc và navigation giữ nguyên.

- Lint/type checking/web export pass. Browser 11 groups pass, 38 requests, 0 Session POST, 0 page errors; kiểm computed style hôm nay không background, chữ cam, scheduled dots và ring chỉ khi chọn, không legend.
- Regression browser giữ mouse/touch pull, horizontal filters, chọn ngày/markers, tháng rỗng, detail/draft/denial/profile. Không chạy lại full suite cho thay đổi styling riêng này; full suite gần nhất 287/287 pass ở checkpoint trước.
- Responsive 320/375/412/430 px không tràn ngang; đã mở kiểm `calendar-375.png` có ngày 15 được chọn. Evidence ignored `.expo/calendar-selection-validation/result.json` và ảnh; harness `.expo/calendar-selection-browser.cjs`.

Không sửa BE, dữ liệu hoặc acceptance gate native; chưa commit/push.

## Calendar dot placement — 2026-10-14

Theo yêu cầu tiếp: khi chọn ngày có lịch, chấm chuyển vào trong vòng tròn;
ngày không có lịch không dựng chấm kể cả được chọn. Month markers tiếp tục lấy
từ Session API read. Bỏ nút “Xem cả tháng”; tap lại ngày đang chọn bỏ lọc ngày.

- Lint/type check/web export pass. Browser fixture 12 nhóm pass: đo dot bounds nằm trong selected ring, ngày rỗng chỉ có text/no dot, nút reset không tồn tại, tap ngày lần hai trả list tháng; giữ các regression calendar/read/gesture/draft. 38 requests, 0 Session POST, 0 page errors.
- Kiểm 320/375/412/430 px không tràn ngang và đã mở ảnh 375 px kiểm chấm trong vòng tròn. Evidence ignored `.expo/calendar-dot-validation/result.json`, `calendar-*.png`; harness `.expo/calendar-dot-browser.cjs`.
- Không chạy lại full suite cho thay đổi UI nhỏ này; full suite gần nhất 287/287 pass. Native acceptance/BE gates giữ nguyên; chưa commit/push.

## Calendar local filtering và typography — 2026-10-14

Theo yêu cầu tiếp: bỏ day query trên Calendar, chỉ list query theo tháng.
Nhấn/chạm ngày và đổi status filter chỉ lọc data tháng trong bộ nhớ; chấm được
tạo từ ngày bắt đầu của Session trong response đó. Chọn ngày rỗng không tạo chấm.
Date dots không phụ thuộc thao tác chọn. Cap warning không còn gợi ý day API
lấy thêm records. Các refresh/focus/resume reads hiện có vẫn hoạt động.

Typography CalendarSessionCard dùng Nunito Bold/heading 17 px và Nunito Regular/
secondary 13 px theo signed-in lists; bỏ Fraunces trong card này. Các thành phần
calendar/filter dùng shared font/typography, không đổi theme toàn app.

- Lint/type check/web export và full suite 287/287 pass. Browser 13 groups pass, 35 requests, 0 Session POST, 0 page errors.
- Đếm `/sessions/mine` trước/sau chọn ngày rỗng, bỏ chọn và chọn ngày có buổi học: không tăng. Kiểm style tiêu đề Nunito/17 px và meta 13 px; month navigation và mouse/touch pull vẫn tải lại.
- Kiểm 320/375/412/430 px không tràn ngang, đã mở ảnh 375 px. Evidence ignored `.expo/calendar-local-validation/result.json` và ảnh; harness `.expo/calendar-local-browser.cjs`.

Không sửa BE hay gate đổi lịch/native; chưa commit/push.

## Calendar filtered markers và mặc định hôm nay — 2026-10-14

Chấm trước đây lấy toàn bộ month read trong khi list lọc trạng thái, nên ngày
chỉ có buổi đã kết thúc/hủy vẫn có chấm khi xem “Sắp tới”. Calendar nay tạo
chấm từ cùng tập Session khớp status filter, trước khi lọc ngày; dùng chung
thời điểm đánh giá. Mới mở Calendar mặc định chọn ngày hôm nay và lọc list
theo ngày đó. Ngày không có Session khớp filter không dựng chấm dù được chọn.

- Lint/type check/structure/web export và full suite 287/287 pass.
- Browser fixture 6 nhóm pass: mới mở chọn hôm nay, buổi đã kết thúc hôm nay không có chấm trong “Sắp tới”, đổi “Chờ xác nhận” có chấm/card hôm nay, “Đã hoàn thành” rỗng không có chấm; chọn ngày/status không tăng `/sessions/mine`.
- Bỏ chọn trả list tháng, selected dot vẫn trong vòng tròn; touch refresh giữ ngày chọn, đổi tháng tải range mới. 7 requests, 0 Session POST, 0 page errors.
- Responsive 320/375/412/430 px không tràn ngang; đã mở kiểm ảnh 375 px. Evidence ignored `.expo/calendar-filter-validation/result.json`, `calendar-today-*.png`; harness `.expo/calendar-filter-browser.cjs`.

Chỉ sửa mobile; native acceptance và backend gates giữ nguyên. Chưa commit/push.

## Calendar bỏ bộ lọc trạng thái và sửa font empty — 2026-10-14

Theo yêu cầu mới, bỏ các chip lọc trạng thái và component CalendarFilters.
Calendar vẫn mặc định chọn hôm nay, hiển thị tất cả Session của ngày đang chọn,
trạng thái nằm trên từng card. Chấm lấy tất cả Session trong month read trước
bước lọc ngày. Quy tắc này thay thế filtered markers ở checkpoint trước.
Empty title dùng Nunito Bold/shared heading 17 px, line height 24 px qua
titleStyle có sẵn; copy “Chưa có buổi học trong ngày này” hoặc “…trong tháng này”.

- Lint/type check/structure/web export pass; không chạy lại full suite cho thay đổi UI này (gần nhất 287/287 pass).
- Browser fixture 5 nhóm pass: không còn radio/status controls; ngày hôm nay có cả ended/completed/cancelled cards; chọn ngày khác chỉ lọc local, không tăng `/sessions/mine`; ngày rỗng không có chấm.
- Kiểm computed font empty Nunito Bold/17/24, selected dot trong vòng tròn, bỏ chọn trả tất cả buổi trong tháng; touch refresh giữ ngày chọn và month navigation tải range mới. 7 requests, 0 Session POST, 0 page errors.
- 320/375/412/430 px không tràn ngang; đã mở kiểm ảnh empty 375 px. Evidence ignored `.expo/calendar-simple-validation/result.json`, `calendar-empty-*.png`, `calendar-today-375.png`; harness `.expo/calendar-simple-browser.cjs`.

Chỉ sửa mobile; native acceptance vẫn pending. Chưa commit/push.

## Session detail theo HTML và bỏ icon mở buổi học — 2026-10-14

Bỏ icon video trong CTA CalendarSessionCard. Màn detail chuyển từ generic Panel
sang status pill/card thông tin theo mẫu HTML, dùng Nunito/shared typography:
avatar/tên/vai trò đối tác thật, giờ/ngày, duration/GMT offset và status guidance.
Dock cố định ngoài scroll giữ navigation đổi lịch/completion/results hiện có.
Giữ hai confirmation cho ended sessions, cancel reason/time, denial guard và
pull refresh. Room ghi “Chưa khả dụng”; không thêm command/backend/LiveKit hay
dữ liệu giả về online/xác minh/số buổi/mã học/giờ mở phòng.

- Lint/type check/structure/web export pass; full mobile suite 290/290 pass. Thêm 3 tests formatter: giờ GMT+7, qua nửa đêm giữ hai ngày, DST đổi offset giữ cả hai.
- Browser fixture 8 nhóm pass: CTA không có SVG; detail Nunito/17 px/card radius 28; upcoming không hiện completion; action dock nhìn thấy ở 320/375/412/430 px, không tràn ngang.
- Partner tên dài xuống dòng, public profile 404 fallback; refresh 503 giữ cache/cảnh báo rồi hồi phục; 403 ẩn toàn bộ private card/dock rồi pull phục hồi.
- Đổi lịch dẫn draft hiện có/Back về detail; ended dẫn completion mà không POST; COMPLETED có nút kết quả, CANCELLED/DISPUTED không dock. 50 requests, 0 Session POST, 0 page errors.
- Đã mở kiểm ảnh upcoming 375 px và tên dài 320 px. Evidence ignored `.expo/detail-design-validation/result.json`, `detail-upcoming-*.png`, `detail-long-name-320.png`, `detail-ended-320.png`; harness `.expo/detail-design-browser.cjs`.

Không sửa BE; gate reschedule/native giữ nguyên. Chưa commit/push.

## Session detail màu sáng, badge trong card và bỏ line — 2026-10-14

Theo yêu cầu tiếp, chuyển status pill vào góc phải của card, cùng hàng nhãn
Lịch 1-kèm-1; ended badge rút gọn “Chờ xác nhận” và giữ guidance về đã kết thúc.
Nền màn dùng signed-in chrome, các ô partner/metadata/guidance/room dùng canvas
sáng hơn; neutral badge và nút đổi lịch dùng surfaceLow thay surfaceInset.
Bỏ đường kẻ ngang ở header, confirmation và dock.

- Lint/type check/structure/web export pass. Không chạy lại full suite cho thay đổi styling này; gần nhất 290/290 pass.
- Browser fixture 9 nhóm pass: đo badge nằm trong card/căn mép phải, partner/metadata dùng màu canvas, header/footer không border ngang. Giữ 8 nhóm regression layout, refresh, profile fallback, 503/403 recovery và navigation/status ở checkpoint trước. 50 requests, 0 Session POST, 0 page errors.
- Responsive 320/375/412/430 px không tràn ngang; đã mở kiểm upcoming 375 px và ended 320 px. Evidence ignored `.expo/detail-bright-validation/result.json` và ảnh; harness `.expo/detail-bright-browser.cjs`.

Chỉ sửa mobile; native acceptance vẫn pending. Chưa commit/push.

## Session detail bỏ múi giờ và phân biệt nền các khối — 2026-10-14

Bỏ ô/nhãn múi giờ, gộp duration ngay dưới giờ/ngày trong cùng khối lịch.
Timezone thiết bị vẫn dùng để format đúng giờ và ngày; bỏ tính GMT offset
không còn được UI sử dụng. Partner nền kem/canvas, lịch nền surfaceLow,
duration pill xanh nhẹ, guidance nền warningLight, phòng trực tuyến nền
errorLight với title/icon đỏ. Badge phải, font Nunito, dock và không line giữ nguyên.

- Lint/type check/structure/web export và full mobile suite 290/290 pass. Tests formatter vẫn kiểm local time, qua nửa đêm giữ hai ngày và local time qua DST.
- Browser fixture 9 nhóm pass: không có MÚI GIỜ/GMT label, duration nằm cùng nhóm ngày giờ, bốn vùng partner/lịch/guidance/room có màu nền khác nhau; room đúng errorLight và title đỏ.
- Giữ regression responsive 320/375/412/430 px, badge phải/no line, long-name/profile fallback, pull refresh, 503/403 recovery, navigation đổi lịch/completion và terminal status. 50 requests, 0 Session POST, 0 page errors.
- Đã mở kiểm ảnh upcoming 375 px và tên dài 320 px. Evidence ignored `.expo/detail-layout-validation/result.json` và ảnh; harness `.expo/detail-layout-browser.cjs`.

Chỉ sửa mobile; native acceptance vẫn pending. Chưa commit/push.

## Session detail tăng thứ bậc thị giác — 2026-10-14

Theo phản hồi màn nhạt/lồng nhiều khối nền, đổi bố cục thành một card trắng:
badge phải, ô ngày terracotta, giờ dùng Nunito Bold/title 20 px, ngày/thời lượng
bên dưới; partner là hàng avatar/tên không bọc card. Guidance nằm ngoài card,
phòng học giữ khối đỏ nhạt riêng và icon tile đỏ đậm. Confirmation cho ended
nằm trong card riêng. CTA dock dùng cam chính/chữ trắng; không thêm line/múi giờ.

- Lint/type check/structure/web export và full suite 291/291 pass. Thêm regression ô ngày phải lấy ngày/tháng local khi UTC vẫn là ngày trước.
- Browser fixture 9 nhóm pass: ô ngày cam/chữ trắng, month caption không xuống dòng, giờ 20 px xuất hiện trước partner không nền/viền, guidance ngoài main card, room đỏ nhạt và CTA cam. Giữ regression mobile widths/refresh/profile/error recovery/navigation/status; 50 requests, 0 Session POST, 0 page errors.
- Responsive 320/375/412/430 px không tràn ngang; đã mở kiểm upcoming 375 px, tên dài và ended 320 px. Evidence ignored `.expo/detail-hierarchy-validation/result.json` và ảnh; harness `.expo/detail-hierarchy-browser.cjs`.

Chỉ sửa mobile; native acceptance vẫn pending. Chưa commit/push.

## Session confirmation và lý do hủy liền mạch — 2026-10-14

Người dùng xác nhận phần lý do cần sửa là lý do hủy trên detail, không phải
form hủy lộ trình. Đưa confirmation vào cuối card thông tin chính với nền
surfaceLow, title Nunito Bold/body và hai hàng clock/check/unknown theo trạng thái.
Lý do/thời điểm hủy gom vào nhóm nền errorLight có tiêu đề “Thông tin hủy” trong
cùng card chính, không còn text/card đứng rời. Giữ nguyên dữ liệu và action gates.

- Lint/type check/structure/web export pass. Không chạy lại full suite cho thay đổi presentation này; gần nhất 291/291 pass.
- Browser fixture 11 nhóm pass: confirmation nằm trong main card, title Nunito Bold/15 px, status labels từng bên giữ đúng; cancellation reason/time cùng nhóm đỏ trong main card, CANCELLED không hiện confirmation/action.
- Giữ 9 nhóm regression layout/refresh/profile fallback/503/403 recovery/navigation/status; 50 requests, 0 Session POST, 0 page errors. Đã mở kiểm ended và cancelled 320 px.
- Evidence ignored `.expo/detail-outcome-validation/result.json`, `detail-ended-320.png`, `detail-cancelled-320.png` và ảnh responsive; harness `.expo/detail-outcome-browser.cjs`.

Chỉ sửa mobile; native acceptance vẫn pending. Chưa commit/push.

## Reschedule chọn ngày/giờ và typography — 2026-10-14

Thay input ISO bằng DateTimeField chọn ngày/giờ; UI tách card lịch hiện tại và
card lịch mới, dùng Nunito/shared heading 17/body 15/hint 13. Tái sử dụng bộ
picker Learning Request bằng cách đưa component/helpers vào components/utils
chung trong mobile và giữ re-exports ở feature cũ. Web dùng lịch và selects
giờ/phút, Android dùng Expo UI picker, iOS dùng SwiftUI wheel; không thêm package.
Giữ bản nháp/RHF, duration số, eligibility notice và disabled submit khi thiếu BE.

- Lint/type check/structure/web export và full suite 291/291 pass, gồm các tests dates/form của consumer Learning Request.
- Browser fixture 15 nhóm pass: không input ISO, chọn ngày/19:45 rồi Xong cập nhật, Hủy không ghi đè; chọn hôm nay 00:00 chặn commit, draft cũ giữ nguyên.
- Pull refresh giữ ngày/giờ và duration; submit vẫn disabled, Back về detail. Form Nunito/17/15, 320/375/412/430 px không tràn ngang. Kiểm consumer Learning Request qua UI tạo yêu cầu: deadline field vẫn chọn/Xong/hiển thị 23:59 đúng sau extraction.
- Giữ regression Session detail/confirmation/cancellation/profile/read errors/status; 60 requests, 0 Session POST, 0 page errors. Đã mở kiểm form 375 px và calendar picker 430 px.
- Evidence ignored `.expo/reschedule-picker-validation/result.json`, `reschedule-*.png`, `reschedule-calendar-430.png`, `reschedule-time-430.png`; harness `.expo/reschedule-picker-browser.cjs`.

Không sửa BE hoặc mở gửi đổi lịch; Android/iOS picker và keyboard/hardware Back
cần nghiệm thu trên thiết bị thật. Chưa commit/push.

## Session detail ngày/tháng chữ cam, bỏ nền — 2026-10-14

Bỏ background/borderRadius của ô ngày bên trái; ngày và nhãn tháng dùng màu
primary cam thay chữ trắng. Giữ font, size, alignment và các hành vi hiện có.

- Lint/web export pass; browser fixture 15 nhóm pass, đo ô ngày transparent và cả ngày/tháng có chữ cam. Regression detail/picker/Learning Request vẫn pass: 60 requests, 0 Session POST, 0 page errors.
- 320/375/412/430 px không tràn ngang; đã mở kiểm detail 375 px. Evidence ignored `.expo/detail-date-text-validation/result.json` và ảnh; harness `.expo/detail-date-text-browser.cjs`.
- Không chạy lại full suite/type check cho thay đổi màu này; gần nhất 291/291 và type check pass. Native acceptance vẫn pending; chưa commit/push.

## Session detail tăng nhẹ chữ ngày/tháng — 2026-10-14

Theo yêu cầu, số ngày tăng 20 → 24 px (line height 30), nhãn tháng caption
11 → secondary 13 px. Giữ Nunito Bold, chữ cam, không nền và bố cục.
Focused lint/web export pass; browser 15 nhóm pass, đo font 24/13 và month
không xuống dòng. 320/375/412/430 px không tràn ngang, đã mở kiểm ảnh 375 px.
60 requests, 0 Session POST, 0 page errors; evidence ignored
`.expo/detail-date-size-validation/result.json` và ảnh, harness
`.expo/detail-date-size-browser.cjs`. Full suite/type check gần nhất pass ở
checkpoint trước; native acceptance vẫn pending. Chưa commit/push.

## Đồng bộ các màn Session còn lại — 2026-10-14

Completion, PathSessions và Room preview dùng SessionPage/panel/copy/button scoped
cho feature: Nunito, heading 17/body-button 15/secondary 13. Empty/error/retry
qua SessionFeedback cũng dùng bộ này, không đổi typography toàn app. List có
month bar compact, badge phải, metadata gọn và bỏ timezone label. Cap warning
không còn gợi ý day selection lấy thêm data. Completion gom lịch/status/action
trong một card, dùng SessionConfirmations chung với detail; COMPLETED ẩn submit.
Room chỉ đổi presentation và tiêu đề “Phòng học”; giữ explicit preview/local controls.

- Lint/type check/structure/web export và full suite 291/291 pass (completion preflight, single-submit, ambiguous POST/reconcile và read guards giữ nguyên).
- Browser fixture 19 nhóm pass: completion Nunito 17/15/13 và layout ở 320/375/412/430; list hai Session có badge phải, chuyển tháng/empty/cap, không timezone label; room mẫu toggle camera/mic, enter/leave/cancel vẫn local, UUID thật unavailable.
- Fixture completion gửi đúng 1 POST, authoritative confirmation cập nhật và khóa gửi lại; future disable và server COMPLETED ẩn submit. 85 requests, 1 Session POST **chỉ đến route fixture**, 0 page errors; không mutation backend thật.
- Các route list/room không có link từ Session thật được mở bằng Expo Router imperative API trong harness, không bật liên kết preview trong app. Giữ regression Calendar/detail/picker/profile/errors/Learning Request từ checkpoint trước.
- Đã mở kiểm completion 375 px, list 375 px và room preview 320 px. Evidence ignored `.expo/session-ui-validation/result.json`, `completion-*.png`, `path-sessions-*.png`, `room-preview-320.png`; harness `.expo/session-ui-browser.cjs`.

Không sửa BE, không tích hợp LiveKit hay đổi gate backend/native. Chưa commit/push.

## Completion hỏi lại bằng modal và khóa nút đã xác nhận — 2026-10-14

Nút gửi ở màn confirmation mở modal Nunito 17/15 với Hủy/Xác nhận; chỉ nút
Xác nhận trong modal gọi action hiện có. Đóng modal không POST; blur/đổi Session
hoặc mất điều kiện gửi đóng dialog. Sau receipt thành công, own confirmation
hoặc COMPLETED đọc từ server, nút hiện “Đã xác nhận” disabled; không dựa việc
chạm nút để báo thành công. Nút kiểm tra trạng thái chỉ còn khi cần reconcile
hoặc refresh lỗi. Giữ preflight/double-submit/account guards, không POST replay.

- Lint/type check/structure/web export và full suite 295/295 pass. Thêm 4 tests presentation: đúng người xác nhận, receipt matching, pending/unknown outcome và server COMPLETED.
- Browser fixture 22 nhóm pass: mở/Hủy/Escape không POST; double tap Xác nhận gửi đúng một lần, modal đóng và nút disabled “Đã xác nhận”; mở lại vẫn giữ theo detail server. Future disabled, COMPLETED có nút Đã xác nhận disabled.
- Lost POST response không hiện Đã xác nhận trước khi biết kết quả; action.refresh đọc trạng thái đã ghi nhận và đổi nhãn mà không gửi lại. 92 requests, 2 Session POST chỉ đến fixture (1 success + 1 simulated lost response), 0 page errors.
- Modal 320/375/412/430 px không tràn ngang, hai nút nhìn thấy; giữ các regression Session/picker/Learning Request trước. Đã mở kiểm modal và trạng thái đã xác nhận 375 px.
- Evidence ignored `.expo/completion-dialog-validation/result.json`, `confirm-dialog-*.png`, `completion-confirmed-375.png` và các ảnh regression; harness `.expo/completion-dialog-browser.cjs`.

Không sửa BE, không commit/push. Native modal/Back/font scaling vẫn cần nghiệm thu thiết bị thật.

## Modal xác nhận ngay tại Chi tiết buổi học — 2026-10-14

Theo yêu cầu mới nhất, modal/action/notices và read reconciliation chuyển vào
LearningSessionScreen. Bỏ CompletionScreen, route /learning-sessions/[id]/completion,
Stack entry và export; liên kết gallery/activity mẫu trỏ về detail. Các checkpoint
completion page trước đây là lịch sử, được thay thế bằng bố cục hiện tại.
Nút footer buổi đã kết thúc mở modal ngay tại detail; sau receipt hoặc own
confirmation/COMPLETED từ server hiện “Đã xác nhận” disabled. Buổi sắp tới vẫn
đi đến draft đổi lịch. CANCELLED/DISPUTED/denied không có dock.

- Lint, TypeScript, structure (492 source files), web export và full suite 295/295 pass.
- Browser fixture 21 nhóm pass: URL giữ nguyên detail khi mở modal; mở/Hủy/Escape không POST; double tap xác nhận chỉ gửi một lần, nút khóa và mở lại vẫn đúng theo server.
- Lost POST response không báo thành công trước khi biết kết quả; read reconciliation cập nhật nút mà không gửi lại. 91 requests, 2 Session POST chỉ đến fixture, 0 page errors; không mutation backend thật.
- Modal/footer ở 320/375/412/430 px không tràn ngang; giữ regression Calendar/detail/errors/reschedule/picker/Learning Request/Path list/Room preview. Đã mở kiểm modal và detail đã xác nhận 375 px.
- Evidence ignored: .expo/detail-confirmation-validation/result.json, confirm-dialog-*.png, detail-confirmed-375.png; harness .expo/detail-confirmation-browser.cjs.

Không sửa BE, không LiveKit, không commit/push. Native modal/Back/font scaling
vẫn cần nghiệm thu thiết bị thật; T019 và các dependency backend giữ nguyên.

## Mở hồ sơ đối tác và màu tab Ngày/Giờ — 2026-10-14

Hàng đối tác trong detail là button có nhãn truy cập và chevron; điều hướng đến
/profiles/[userId] theo participant ID của Session, không phụ thuộc tên/avatar
đã tải được. Dùng route/API profile hiện có; Back về detail.
DateTimeField thêm tabVariant solid cho reschedule: primary/chữ trắng khi chọn,
surfaceInset khi chưa chọn; default soft giữ nguyên cho các consumer khác.

- TypeScript, focused ESLint 4 file thay đổi, structure 492 files và web export pass.
- Browser fixture 5 nhóm pass: teacher → learner profile và learner → teacher profile, Back về đúng detail; missing profile vẫn mở đúng ID và hiện unavailable; tab màu đúng ở cả hai selection, Done commit và Cancel giữ draft; Learning Request giữ màu soft và picker hoạt động.
- 320/375/412 px không tràn ngang; đã mở kiểm ảnh reschedule 375 px. 30 fixture requests, 0 Session POST, 0 page errors.
- Evidence ignored: .expo/session-partner-validation/result.json, reschedule-tabs-*.png; harness .expo/session-partner-browser.cjs. Full suite 295/295 đã pass ở checkpoint trước, không chạy lại cho thay đổi UI này.

Không sửa backend, không thêm package, không commit/push. Native acceptance và
dependency gửi đề nghị đổi lịch giữ nguyên.

## Rà soát và chia commit mobile — 2026-10-14

User cho phép commit nhỏ theo chức năng và loại trừ toàn bộ BE; quyền này
thay thế giới hạn không commit ở các checkpoint trước, không cho phép push.
Rà source lần lượt: picker/shared consumer, Session API/cache/private read guard,
completion preflight/receipt/reconcile, refresh, detail/routes/profile link và Calendar.
Sửa React key trùng ở gallery khi các link completion cùng trỏ về detail;
chuẩn hóa dòng trắng cuối Room preview. Không thay đổi nghiệp vụ hoặc backend.

- Chạy tuần tự: check-structure (492 source files), check-types, lint, full npm test (295/295), web export, browser detail/confirmation (21 nhóm) và partner/picker (5 nhóm); đều pass.
- Browser evidence mới: .expo/pre-commit-export.log, .expo/pre-commit-detail-browser.log (91 requests/2 fixture POST), .expo/pre-commit-partner-browser.log (30 requests/0 POST); 0 page errors. POST chỉ đến fixture, không mutation BE thật.
- Commit-scope tests 6/6 pass. pnpm máy này tự kiểm dependencies rồi thử reinstall khi chạy script; override pnpm_config_verify_deps_before_run=false chỉ trong process commit/check để dùng dependencies hiện có. Không sửa pnpm config/lockfile, không cài dependencies và không bỏ qua hook.
- 6 nhóm commit: shared date/time picker; Session API/policy/action/tests; pull-to-refresh và consumer; Session detail/confirmation/reschedule/routes; Calendar; tài liệu/spec/validation. Review staged paths và diff-check trước từng commit; lint-staged và commitlint chạy bình thường. Export, ảnh, harness, data/credentials local vẫn ignored.
- Backend service và test detail giữ ngoài index/commit, kiểm hash nội dung so với trước commit. Không push. T016/T017/T020 chờ backend và T019 native acceptance giữ mở.

Kết quả fixture/web và source checks không thay thế nghiệm thu Android/iOS thật.
