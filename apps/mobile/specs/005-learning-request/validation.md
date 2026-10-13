# Validation — Learning Request mobile

Ngày 2026-10-11, nhánh `feat/mobile-learning-request`.

## Checks tự động

- `npm run lint`: pass.
- `npm run check-types`: pass.
- `npm run check-structure`: pass, 315 source files.
- `npm test`: 102/102 pass, gồm 10 test mới cho Learning Request.
- Regression của HTTP/Auth/profile/Proposal chạy cùng suite.

Test mới kiểm tra metadata/cursor; giữ tag và timestamp đến mili giây khi edit;
PATCH chỉ field đổi và explicit clear; Unicode/code points/UUID; slot quá khứ,
ngày không tồn tại, đảo khoảng, quá 5 khoảng; effectiveStatus hết hạn; mutation
503 không retry/fallback; response phiên cũ, ID mẫu và resource ID sai bị chặn;
public projection bỏ field ngoài contract và private owner fields.

## Kiểm tra giao diện bằng fixture riêng

Expo web `localhost:8082` trỏ tới HTTP fixture `127.0.0.1:4315` bằng environment
riêng của process; không đổi `.env`, không ghi backend thật. Tài khoản/dữ liệu
chỉ để kiểm thử; fixture không nằm trong runtime feature.
Viewport 390 × 844, thao tác qua browser UI.

- Hồ sơ có shortcut “Yêu cầu học của tôi”, mở danh sách từ API.
- My Requests → tạo → Back → My Requests → Back → Hồ sơ, không lặp screen.
- Khám phá → Đăng bài → Back quay lại Khám phá.
- Form trống báo lỗi title/skill/description/goal, không POST.
- Chọn React UUID từ danh mục; create 503 hiển thị lỗi và giữ nguyên nội dung.
- Tìm kỹ năng “R” không gửi query một ký tự; “Re” gửi `q=Re` sau debounce.
- Retry thủ công sau dependency phục hồi lưu DRAFT và mở own detail.
- Publish có trạng thái pending, action bị khóa; kết quả API OPEN được hiển thị.
- Editor bài đã đăng khóa kỹ năng; không đổi nội dung thì không PATCH.
- PATCH conflict 409 giữ nội dung đang sửa và chặn gửi lại với version cũ.
- PATCH thành công trở về detail, Back tiếp về Khám phá và không mở lại editor.
- Public detail hiển thị Skill/Tag/owner projection; không gửi request thật vào Proposal mock.
- Recommended 503 hiển thị error/retry, không lấy feed/mẫu thay thế.
- My Requests phản ánh bài vừa tạo/sửa; cancel có confirmation và trạng thái pending;
  kết quả CANCELLED cập nhật detail/list và không còn action sửa/hủy.

## Chỉnh giao diện theo phản hồi

- Hai danh sách dùng Nunito, màu chrome đã đăng nhập và thẻ bài chung; tiêu đề
  form/chi tiết và empty state của Learning Request cũng dùng Nunito. `EmptyState`
  chỉ thêm override tùy chọn, các consumer khác giữ kiểu chữ hiện có.
- Khám phá trở lại bố cục mock: ô tìm kiếm cạnh nút Lọc, bộ lọc mở inline,
  Áp dụng/Đặt lại/Đóng và chip có thể xóa. Chỉ lọc keyword, Skill UUID và scope
  feed/recommended; không thêm bộ lọc Credit, số buổi hoặc Tag chưa có contract.
- Browser fixture 390 × 844 và 360 × 800: chọn kỹ năng gửi đúng `skillId`, xóa
  chip, debounce keyword, empty state, áp dụng recommended và phục hồi từ 503.
- My Requests dùng tab trạng thái ngang, gửi `status=DRAFT`; các tab có selected
  state cho native/web. Font thực tế của tiêu đề danh sách và form là NunitoBold.
- My Requests → tạo → Back giữ trạng thái lọc; Back tiếp về Hồ sơ không lặp form.
- Lint, TypeScript, structure (319 source files), 102 tests và diff whitespace qua.

## API thật và giới hạn

Read-only `GET http://localhost:3001/api/v1/skills?limit=1` trả success với Skill
UUID/status và `meta.pagination.{limit,hasMore,nextCursor}`. Source controller,
DTO và use cases LR được đối chiếu ở `dev c52ec74`.
Chưa thực hiện create/publish/edit/cancel trên backend thật; Catalog/public owner/
Sharing Skill/lock adapters LR đang trả 503 trong source. Skill HTTP thành công
không chứng minh Catalog reader nội bộ LR đã được nối.

Chưa kiểm tra Android/iOS native, Tag picker/filter hoặc notification/Proposal
thật. Các AC end-to-end vẫn chưa tick trong checklist.

## Implementation checkpoint — 2026-10-12

Working tree `feat/mobile-learning-request`; tiếp tục spec005, không tạo nhánh/spec
mới, không commit/push. Kết quả ở trên là lịch sử; lần chạy mới bên dưới:

| Check                     | Kết quả lần chạy mới                           |
| ------------------------- | ---------------------------------------------- |
| `npm run lint`            | Pass, zero warnings                            |
| `npm run check-types`     | Pass                                           |
| `npm run check-structure` | Pass,328 source files                          |
| `npm test`                | 140/140 pass;48 LR tests (10 baseline +38 mới) |

Suite đầy đủ bao gồm HTTP/Auth/session boundary/profile/Proposal consumers. Shared
AppHeader/AppScreenLayout thêm prop disabled điều hướng tùy chọn, mặc địnhfalse;
không thêm dependency, không thay HTTP/Auth architecture. Browser fixture chứng
minh read/mutation pending khóa Back/header, không lặp editor sau save.

M01..M05 đã triển khai trong source: targeted mutation ID guard, dynamic submit
time validation, inline conflict recovery với explicit baseline choice, expiry
preflight, persistent read denial qua remount, last-read notice và paging footer.
M06 có harness tái lập + automated/web evidence; phần native còn Pending.
Chi tiết dataset, failure-before-fix và UI journeys tại
[fixture evidence](validation/fixtures.md); chạy lại theo [quickstart](quickstart.md).

| AC    | Source / automated / fixture-web đã kiểm                                                                                       | API thật / native còn chờ                                                |
| ----- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| AC-01 | Owner/public parsers, UUID/ID guards, hai actor, cached404/403, mutation403/429, inactive Auth expiry; loginB không còn draftA | T025, readiness/grants trên môi trường thật                              |
| AC-02 | NFKC/trim/code points, markup/entities không bị client strip/decode; boundary tests                                            | Backend sanitizer/raw PATCH validation trong T026                        |
| AC-03 | Skill UUID/ACTIVE mapping, tagIds untouched giữ omission                                                                       | B01/B05, lookup/0-10-11/inactive Tag T021..T024/T029                     |
| AC-04 | Slots max5/end/start/date/time-at-submit; untouched milliseconds; lỗi theo field                                               | T026, timezone/validation server thật                                    |
| AC-05 | Fixture create/save/reopen, double tap, unknown create khóa resend, explicit Mine; Back journeys                               | T026 và native T030/T031; transport exactly-once chưa có guarantee       |
| AC-06 | Projection/state/reason và stale notice; fixture lifecycle lịch sử                                                             | B01/B06, clean/flagged/config/Staff T026                                 |
| AC-07 | Diff/clear/no-change/Skill publishedAt lock và explicit rebase tests                                                           | T026/T029, real re-moderation và Tag clear                               |
| AC-08 | 409 giữ draft, GET lỗi giữ/ẩn đúng loại, latest comparison, explicit choice                                                    | T026, race Staff/thiết bị trên backend thật                              |
| AC-09 | Action/preflight/terminal policy, cancel confirmation lịch sử; negative/wrong ID tests                                         | B04/B06, authoritative lock/race/503 T027                                |
| AC-10 | Cached deadline và editor entry/pre-submit GET; EXPIRED giữ draft, changed version, clock-skew/no loop                         | T027, TTL/expiry worker/re-publish thật                                  |
| AC-11 | Two pages, server order/dedupe, cursor/query400, query race, retry footer, filter/chips                                        | T028/T029, Tag ANY và dữ liệu thật                                       |
| AC-12 | Recommended503 không fallback; snapshot cursor/manual chain fixture                                                            | B03, ranking/snapshot thật T028                                          |
| AC-13 | Network/503 notice, cached404/403/remount denial, reason reset/old generation                                                  | T026, moderation thật                                                    |
| AC-14 | Delayed API/query/HTTP generation tests; inactive A->guest->loginB UI                                                          | T025, logout/publish/cancel pending real runtime; native navigation      |
| AC-15 | Public real-ID fixture action boundary; guest sample route không gọi LR                                                        | T028; Proposal/profile integrations nằm spec riêng                       |
| AC-16 | Web390 journey, editor320/375/430 không overflow ngang                                                                         | T030..T032, Android/iOS device/build, keyboard/font130%/gesture/safearea |

T001..T020 và T033..T035 hoàn thành theo evidence mobile/source/fixture.
T021..T024 chờ B05 Tag contract; T025..T029 chờ backend prerequisites theo từng
case; T030..T032 chờ device/build native. Toàn bộ checkbox AC end-to-end giữ mở.
Không sửa `services/api`, seed/config backend hoặc phát mutation sang API thật.
Notification và Matching/Proposal/public profile vẫn thuộc scope/gate đã chốt.

Giới hạn được phát hiện: Chromium có thể replay POST khi socket bị cắt trước
response bytes. Harness đã chỉnh để mô phỏng ambiguous partial response và kiểm
app không resend; vẫn không thể hứa exactly-once khi backend chưa có contract
idempotency. Xem evidence transport trong báo cáo fixture.

## Date/time picker amendment — 2026-10-12

Theo yêu cầu user, preferredSlots và hạn yêu cầu đã chuyển từ textarea/chuỗi ISO
sang nút chọn ngày/giờ. Mỗi khoảng có Bắt đầu/Kết thúc, thêm/xóa max5; hạn riêng
có thể bỏ để dùng mặc định. Hủy giữ giá trị cũ; Xong mới cập nhật RHF draft.
iOS/Android dùng Expo UI compatibility DateTimePicker; web dùng calendar tiếng
Việt và hour/minute selects vì compatibility picker trên web trảnull.
Không đổi API, TTL policy, draft recovery hoặc untouched timestamp semantics.

- `npm run check-types`, `npm run lint`: pass.
- `npm run check-structure`: pass,333 source files.
- `npm test`:144/144 pass (52 LR tests);4 tests mới cho incomplete picker row,
  explicit clear, unchanged exact timestamps, date/time merge và local->UTC.
- Expo export iOS: pass,2207 modules; Android: pass,2250 modules, Hermes bundles.
  Build artifacts nằm trong ignored `.expo/lr-date-picker-*`, không publish/build cloud.
- Fixture/web390: chọn/Hủy/Xong, lỗi end=start, max5 và thêm bị khóa, xóa,
  create503 giữ lựa chọn rồi201/reopen đúng; PATCH clear []/null thành công.
- Web calendar320/375/430: không overflow ngang; dates quá khứ và tháng trước
  tháng hiện tại disabled; CTA cuối form có thể focus bằng keyboard.

[UI evidence](validation/fixtures.md) và
[ảnh picker](validation/screenshots/date-time-picker.jpg).
Chưa thao tác picker trên iPhone/Android thật; export không chứng minh native UI,
keyboard/font scale/hardware Back. T030..T032 và AC-16 vẫn Pending.
Dependencies: thêm direct `@expo/ui ~57.0.21` tương thích SDK57, đã có trong
dependency graph; mobile npm lock/root pnpm importer đồng bộ, không thay consumers
web/API hoặc nâng SDK. Không sửa backend trong yêu cầu picker; thay đổi Reputation
trước đó là task backend riêng đã được user giao.

## Weekly UI correction và calendar font — 2026-10-12

Thay thế yêu cầu chọn một ngày cho availability bằng thứ trong tuần + giờ rảnh.
Chú thích form rút gọn. Weekly draft chỉ nằm trong mounted RHF; max5/end>start/
no overlap cùng thứ, không áp duration Session. API chưa lưu weekly (B08/GAP-09):
Save disabled khi có choices và draftToInput từ chối trước HTTP; không silent drop
hoặc tạo ngày giả. Bỏ hết weekly choices mở lại Save. preferredSlots cũ vẫn hiển thị
riêng, exact timestamps khi untouched, xóa explicit[]; expiry clearnull giữ nguyên.

Calendar expiry thay native graphical picker bằng component RN chung để kiểm soát
font ngày12/lineHeight18, thứ11, tháng13, ô ngày cao tối thiểu44. Native clock vẫn
Expo UI (iOS wheel/Android compatibility); web clock selects13. Chưa nghiệm thu
font scaling/touch/keyboard/hardware Back trên thiết bị; T030..T032/AC-16 pending.

- `npm test`:153/153 pass;6 tests weekly mới, bỏ1 test cho UI ngày chung đã hủy.
- Final lint/typecheck pass; structure338 source files.
- Fixture/web390: chọn thứ trước clock, Thứ2 19–21h đổi Thứ7 giữ giờ; Hủy giữ clock;
  max5/add disabled, weekly Save disabled; bỏ5 rows mở lại Save. Expiry chọn14/10/
  confirm/clear; số ngày computed font12px, cao44. Back về Mine, legacy editor
  giữ13/10 09–16h và không tự chuyển thành weekly. Không ghi API thật.
- Final Expo export iOS2320/Android2254/web1784 modules pass, Hermes native bundles;
  ignored output `.expo/lr-weekly-preview`, không publish/build cloud.

[Weekly UI](validation/screenshots/weekly-availability.jpg),
[calendar nhỏ](validation/screenshots/expiry-calendar-small-font.jpg).
Lịch sử144 tests và picker cũ phía trên giữ để truy vết; không đại diện layout mới.
Weekly save/reopen/public/matching chưa nghiệm thu, T036 pending B08.

## Form redesign — 2026-10-13

Theo mẫu HTML user cung cấp: năm section/card bo tròn, input có placeholder,
section icon và CTA lưu cố định. Không hứa autosave hoặc thay flow lưu nháp rồi đăng.
Kỹ năng dạy thu gọn về chips; mở picker có search không dấu, xem thêm từng sáu mục,
search đọc tiếp pages. Timezone mới theo thiết bị, hiện caption GMT; edit giữ zone đã lưu.

- `npm run check-types`, `npm run lint`, `npm run check-structure`: pass (438 source files).
- `npm test`: 258/258 pass; gồm hai regression mới cho search tiếng Việt và timezone caption.
- Expo web export: pass, ignored `.expo/lr-form-redesign-web`; process dùng API fixture riêng,
  không sửa `.env`, không ghi backend thật.
- Browser390: fixture có 26 offerings; tìm `tieng nhat` tìm đúng item26 ở page sau;
  chọn rồi thu gọn giữ chip; mở lại/search không kết quả không mất lựa chọn.
- Form Thứ2 19:00–21:00 theo GMT+7; POST503 giữ title/description/goal/skill/offering/lịch;
  retry tạo DRAFT thành công, mở editor lại đúng chip và giờ.
- Width320/375/430: document.scrollWidth bằng viewport width, CTA nằm trong viewport.
- Lịch timezone khác thiết bị/no-change/explicit clear được kiểm trong suite; chưa thao tác
  native Android/iOS, font scale130%, keyboard/gesture/hardware Back trên thiết bị thật.

Không dùng bằng chứng fixture để tick real API/native acceptance.

## Request detail redesign — 2026-10-13

- Mobile-only source: compact detail cards, grouped goal, exchange/Credit and weekly
  schedule; normal reload removed; draft publish footer; secondary edit/cancel.
  Compact feed preferences and backend contracts remain the existing consumers.
- TypeScript, lint, structure442 and web export pass; mobile suite258/258 pass.
- Loopback fixture4328/static preview8098 with fake accounts only: draft detail has
  zero normal reload buttons. Width320/375/430 have document width equal viewport;
  publish button stays within844px viewport. Summary and schedule timestamps are real
  fixture projections, not HTML sample/status-bar values.
- Edit opens existing values; Cancel then Keep makes zero cancel POSTs. Publish503
  shows visible footer error/reconcile, GET retry clears it; explicit publish succeeds
  to OPEN and removes publish footer. Exactly two publish POSTs (503,200), no auto resend.
- Native keyboard/safearea/font scaling/Back still require Android/iOS device checks;
  this fixture evidence does not establish real backend or native acceptance.

## Detail typography and layout follow-up — 2026-10-13

- Shared Nunito ramp now used for title20/28, headings17/24, body15/22 and supporting
  information13/18; removed all-caps labels and NOT_REQUIRED moderation badge.
  Actual moderation statuses and reject reason remain visible.
- Summary separates skill/level from dates. Exchange orders teaching description,
  offering name/level/verification then Credit; weekday/time rows omit duplicate day chips.
  Shared RequestSection compact heading now uses the same17px heading as forms;
  detail and inline cancel confirmation are affected, feed layout is unchanged.
- TypeScript/lint/structure442, mobile tests258/258 and Expo web export pass.
- Loopback fixture: computed title NunitoBold20/28, heading NunitoBold17/24,
  body NunitoRegular15/22, secondary NunitoRegular13/18. Width320/375/430 has no
  horizontal document overflow; draft publish remains in844px viewport. Draft
  has no NOT_REQUIRED badge; rejected detail retains badge, reason and edit/cancel.
- Web/fixture verification only; native text scaling, safe area and device acceptance
  remain pending. No backend changes or real request mutations in this follow-up.

## Subsection emphasis and compact skill cards — 2026-10-13

- Detail subsection labels now use shared NunitoBold/body15 and primary color.
  Selected skill cards use a wrapping row with name, level and verification,
  8px vertical padding and control radius; short Python card is about40px tall
  at390px, previously about74px. Other inset goal/credit/schedule layouts unchanged.
- TypeScript, lint, structure442 and web export pass. Pure visual follow-up;
  no new tests or API/mutation changes, previous258-test result remains above.
- Loopback fixture web widths320/375/430 have no horizontal document overflow.
  At320px a long Vietnamese skill name wraps to two lines and retains level and
  verification; card expands to about88px instead of truncating the name.
- Native device/font-scale acceptance remains pending.

## Compact request list cards — 2026-10-13

- Following the supplied screenshot and owner-specific correction: private cards
  omit identity/avatar and keep creation age/status, two-line title, up to3 chips,
  hourly desired Credit and detail affordance. Remove goal/preferences/expiry from
  list only; detail content and existing navigation/actions remain intact.
- TypeScript, lint, structure442, Expo web export and diff whitespace check pass.
  Presentation-only change; no new API contracts or tests, previous258-test run
  remains recorded above.
- Loopback fixture: mine cards contain no owner identity, teaching/goal/schedule;
  50.00 projects to50 CR/giờ; missing Credit says Chưa đặt Credit. Cards about168px
  for one-line title,190px for two-line title at320. Width320/375/430 does not overflow.
  Opening draft restores all description/goal/offering/credit/weekdays in detail.
  Shared public feed retains owner identity and compact tags/footer.
- No real backend mutations; native font scaling/device acceptance remains pending.

## Learning hub header create action — 2026-10-13

- Removed the own-list intro title, description and full-width create button.
  RequestCreateButton exported through the feature API; MyLearningScreen uses
  compact header rightAction only for requests tab, legacy own screen also gets
  header create action. Existing public feed create button uses default styling.
- Source/typecheck confirms navigation stays /requests/new; compact control
  minHeight36, horizontal padding10, gap4, icon14, text13 and hitSlop4.
  TypeScript, lint, structure442 and Expo web export pass. No API/state changes.
- Browser sign-in was rejected by automatic approval review. User explicitly
  declined fixture sign-in/visual checks and will test the UI themselves; no
  screenshots, responsive rendering or click-through acceptance claimed for
  this header follow-up. Native/device acceptance remains pending.

## Learning hub card width correction — 2026-10-13

- Own list now receives embedded layout in MyLearningScreen: list horizontal
  padding20 becomes0 inside the existing16px hub gutter. Source layout removes
  compounded36px gutters, aligning cards/filter/summary with the hub tab edges.
  Standalone own screen and public feed retain default list padding.
- TypeScript, lint, structure442 and diff whitespace checks pass. Only layout
  changed; card content, header create action, tab behavior and request API unchanged.
- User requested self-testing in the preceding turn; no browser sign-in, screenshot
  or responsive/native acceptance claimed for this correction.

## Shared public/owner detail design — 2026-10-13

- Rebuilt detail from the user's HTML reference with shared round24/padding18 cards:
  status-first hero/topic tags, learning description/goal, forest skill exchange,
  weekly schedule grouped by weekday, separate hourly Credit and public-only owner
  identity. Existing Nunito typography and real app chrome retained.
- New detail section/tag/credit/public components are feature-local. Owner tag
  catalog lookup/paging/retry retained in hero. No invented REQ code, session count,
  duration, roadmap total, reputation, membership age or verification data.
- Owner edit moved into fixed footer: draft edit+publish, other editable states edit;
  cancel confirmation remains in content. Existing pending/blocked, effective status,
  read denial, version/session and GET reconciliation protections remain in source.
  Public profile/contact buttons explicitly disabled; no mock route or external action.
- TypeScript/lint pass; structure447 pass after formatting;259/259 tests pass. Added
  a regression for multiple intervals on one weekday, weekday/time ordering, preservation
  of all intervals and non-mutation of saved input, including an empty schedule.
- Expo export web/iOS/Android passes to ignored `.expo/lr-shared-detail-preview`;
  native Hermes bundles generated. No dependency, backend, migration or API changes.
- User opted to test UI themselves: no browser sign-in, new screenshots, tap-through,
  width/font-scale or device acceptance claimed. Previous detail screenshots document
  earlier layouts and do not represent this redesign. Android/iOS acceptance remains pending.

## Detail hashtag layout — 2026-10-13

- Skill name now has a separate book-icon row; current level follows it. Tags
  appear in an optional Chủ đề group, using shared compact neutral chips for
  owner/public detail. Owner catalog lookup, pagination, retry and unresolved
  labels are preserved. No API, mutation or business-rule changes.
- `npm run lint`, `npm run check-types` and `npm run check-structure` passed
  (447 source files); `npm exec -- tsx --test tests/learning-requests-tags.test.ts`
  passed 4/4 existing tag regressions. Root pnpm dispatch attempted an automatic
  dependency reinstall and aborted without a TTY; npm ran the workspace scripts
  against the installed dependencies successfully.
- Separate fixture API4315 / Expo web8082, fake account A only: own detail with
  10 selected tags displayed the separate skill/level/topic layout. At320px,
  tags wrapped into four rows and document scrollWidth equaled viewport width320;
  no horizontal overflow. Native font scaling/device acceptance remains pending.
- Preview used disposable fixture data and no real API/database mutations.

## Compact Skill/Tag picker badges — 2026-10-13

- Skill choices, available Tags and offered Sharing Skills now wrap as compact
  badges rather than full-width rows. Selected multi-select chips use the same
  spacing/size, preserve full labels and removal controls. Main picker buttons,
  lookup/error/retry/paging,10-item limits and selection IDs remain unchanged.
- npm lint/check-types/check-structure passed (447 files);13 existing regressions
  passed across learning-requests-tags, form-ui and preferences. Prettier formatted
  only the three affected source files.
- Separate fixture API4315 / Expo web8082, fake accountA: React/Python appeared on
  one row; selecting React closed its picker and retained selection. Twenty Tag
  choices occupied a wrapping group rather than20 rows. Selecting10 disabled
  remaining choices; removing Dự án reenabled them; load-more added Tags20–24.
  Offered-skill choices retained level/verification text within compact badges.
- At320px document scrollWidth equaled viewport width and no choice exceeded the
  viewport. Browser exercise made no real API mutation and did not submit a draft.
  Native touch target/font scaling and real-API acceptance remain unverified.

## View Profile integration — 2026-10-13

User selected the View Profile link from request detail only. Footer now sends the
owner UUID and originating requestId to the profile feature's authenticated public
API screen. Fixture navigation, public skill detail, Back and503/404 recovery passed;
51 focused tests and lint/typecheck/structure passed. Profile implementation/evidence
is in spec003. B07 remains open for Proposal/chat and real/native acceptance; no
profile request list or Notification scope was added.

## Proposal CTA handoff — 2026-10-13

User reserved Proposal screens/integration for another branch. Existing
/send-proposal and SendProposalScreen are present but still use mock discovery,
profile and proposal state. This branch only renames the disabled detail CTA to
Gửi đề xuất and explains that exchange follows acceptance. No Proposal source,
route, API adapter or sending behavior is changed; real requests cannot enter the
mock submit flow. View Profile stays enabled with its existing API integration.

## Explicit Proposal mock link — 2026-10-13

User explicitly requested linking the existing mock screen after reserving real
Proposal integration for another branch. Gửi đề xuất now opens /send-proposal with
mode=mock-request and public title/owner/skill context. The form and success view
state clearly that submission is local-only. Mock store request/party identifiers
use preview prefixes; the real request ID only supports Back navigation. Real
Proposal/chat API integration remains outside this branch.

Fixture API4315/Expo web8082 with fake actorA: B request -> mock form retained
B/title/React; empty message validation worked, valid message submitted locally,
Back returned to the same real-detail route and reopening showed duplicate pending
state with Send disabled. Fixture events confirmed zero /proposals HTTP calls.
9 preview/lifecycle tests passed; lint/typecheck/structure passed (451 source files).
Native devices and real backend Proposal submission were not exercised.

## Development readiness review — 2026-10-13

- Full mobile test suite passed 266/266; lint, TypeScript and structure checks
  passed (451 source files). Expo web export succeeded to ignored
  `.expo/review-dev-web`. Changed source/docs passed Prettier and Git whitespace
  checks after formatting corrections. Root commit scope tests passed 6/6.
- After fetching `origin/dev`, the current branch includes its latest commit
  (`25ce9be`): zero commits behind and nine commits ahead. No merge conflict is
  indicated by ancestry; this does not include uncommitted work.
- The existing index contains only part of the implementation. Include intended
  unstaged/new dependencies when preparing the commit; checks above validate the
  complete working tree, not the current staged snapshot. No commit or push was
  performed. Native acceptance remains pending; Proposal submission remains mock.

## PR25 Sonar annotation remediation — 2026-10-14

- Addressed the user's pasted snapshot of 50 annotations across 35 mobile source
  and fixture files: readonly component props, independent conditional branches,
  matching state/setter names, catch naming, explicit Error constructors/messages,
  duplicate imports and the offering retry callback's conditional void expression.
- Split request detail rendering into footer/body states and editor read-state
  rendering into a separate component. Form submission now separates validation,
  expiry/version preflight, persistence and error mapping. Draft retention, read
  denial, stale content, session checks and mutation recovery are preserved.
- Local lint, TypeScript, structure (451 files) and the full 266-test suite passed
  after the refactor. The suite also passed 266/266 after the final fixture/profile
  cleanup. Changed files passed Prettier and Git whitespace checks.
- This is source/local verification of the supplied annotations; a fresh SonarCloud
  analysis of the fix revision is required to confirm issue closure and Quality Gate.
