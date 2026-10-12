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
