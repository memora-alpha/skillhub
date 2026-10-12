# Implementation Plan: Learning Request mobile spec 005

**Branch**: `feat/mobile-learning-request` | **Date**: 2026-10-12
**Spec**: [spec.md](spec.md) | **Project root**: `apps/mobile`
**Input**: Spec 005, [contract checkpoint](contracts.md), [tasks](tasks.md),
[checklist](checklist.md), [validation](validation.md) và source hiện tại.

## Summary

Tiếp tục phần Learning Request đã triển khai, hoàn thiện các tình huống phục hồi
và nghiệm thu còn thiếu. Không tạo spec mới, viết lại feature hoặc bỏ trạng thái
hoàn thành trong tasks. Notification là spec riêng; backend, Proposal, public
profile, Chat, Path/Schedule và Wallet không được kéo vào phạm vi triển khai này.

Rà soát ngày 2026-10-12 xác nhận các task đã tick đều có source tương ứng.
HTTP/Auth, projection, form, lifecycle actions, Discovery/search, Profile shortcut,
Back và UI chung đã tồn tại. Fixture/web đã có evidence lịch sử; runtime LR thật
và Android/iOS vẫn chưa được nghiệm thu. Backend Catalog/public owner/matching/lock
còn adapter 503; Tag lookup chưa có HTTP contract xác minh.

Kết quả planning: Phase 0 và Phase 1 đủ căn cứ cho phần mobile không phụ thuộc
contract mới. Các phần phụ thuộc bên ngoài có điều kiện mở khóa cụ thể; không
coi hoàn thành tài liệu là hoàn thành AC-01..16.

Artifacts bổ sung: [research](research.md), [data model](data-model.md),
[HTTP integration](contracts/http.md), [UI behavior](contracts/ui.md) và
[quickstart validation](quickstart.md).

### Implementation checkpoint 2026-10-12

T001..T020/T033..T035 đã hoàn thành trong mobile. M01..M05 có source/regression
và fixture UI; M06 có harness/automated/web, phần native vẫn chờ device/build.
Các nhận định thiếu source và line references trong audit/planning bên dưới là
baseline trước implement, được giữ để truy vết; trạng thái hiện tại theo
[tasks](tasks.md), [validation](validation.md), [fixture evidence](validation/fixtures.md).
Lần chạy mới:140/140 tests, lint/typecheck pass, structure328 files.

T021..T024 B05, T025..T029 API thật và T030..T032 native vẫn mở. Không sửa
backend hoặc thay dependency; shared header/layout thêm disabled navigation
state mặc địnhfalse, có kiểm consumers trong full suite. Không thêm provider,
polling, offline draft, idempotency key hay Notification vào005.

Infinite-query refetch đã được chứng minh xây cursor chain mới qua test production
options/TanStack+HTTP; không thêm cache reset tự động. Query metadata chỉ giữ
read-denial guard cùng resource/session để remount sau404/403->503 không lộ cache;
logout/session cleanup xóa query/marker. Draft vẫn chỉ nằm trong mounted form.
Backend chưa có replay guarantee; transport replay quan sát được và giới hạn
exactly-once được ghi trong evidence, không thay contract để làm fixture xanh.

## Technical Context

UI amendment2026-10-12: thay nhập timestamp bằng date/time picker cho preferredSlots
và expiresAt. Dùng `@expo/ui ~57.0.21` theo bundledNativeModules của SDK57, không
nâng SDK. Native picker được bọc trong feature, web adapter dùng lịch tiếng Việt
và danh sách chọn giờ/phút
vì Expo UI compatibility picker trên web trảnull. Draft/diff/recovery và API
timestamp semantics giữ nguyên; không thêm business policy hoặc backend work.
Mobile package/npm lock và root pnpm importer được đồng bộ; package đã có trong
dependency graph nên không đổi dependency của web/API/shared workspaces.

UI correction2026-10-12: user thay chọn ngày cụ thể bằng thứ trong tuần và giờ
rảnh lặp tuần. RequestSlotFields dùng ChoiceGroup + clock controls; weekly draft
ở RHF, validation max5/end>start/no overlap cùng thứ. HTTP chưa lưu weekly: Save
disabled khi có choices và draftToInput guard, không đổi thành ngày giả hoặc bỏ dữ liệu.
PreferredSlots cũ chỉ hiển thị/giữ/xóa, exact timestamps/recovery vẫn giữ. B08/GAP-09
chặn tích hợp weekly; không sửa backend. Expiry dùng RequestCalendar chung native/web
font ngày12/thứ11/tháng13, clock vẫn Expo UI trên native. Chú thích rút gọn.
T030..T032 vẫn chờ nghiệm thu font scaling/keyboard/Back trên native.

- **Language/Version**: TypeScript `~6.0.3`, React `19.2.3`, React Native `0.86.3`,
  Expo `~57.0.26`; theo [package.json](../../package.json).
- **Primary Dependencies**: Expo Router `~57.0.24`, TanStack React Query
  `^5.104.1`, Axios `^1.20.0`, React Hook Form `^7.89.0`, Zod `^4.6.5`;
  HTTP/Auth/Query providers và UI/theme đang có. Không cần dependency mới để plan.
- **Storage**: Entity do backend quản lý. Mobile giữ Query cache theo user/session
  generation và draft trong memory; credentials dùng hạ tầng SecureStore hiện có.
  Không thêm database mobile, offline draft hoặc cache private bền vững.
- **Testing**: `tsx --test`, Node test runner, kiểm tra HTTP bằng transport fixture;
  browser/mobile-device scenarios theo [quickstart](quickstart.md).
- **Target Platform**: Android/iOS; Expo web chỉ dùng kiểm tra bổ sung. SDK hiện có
  được giữ nguyên; minimum OS/device matrix cần theo build/dev-client đang dùng.
- **Project Type**: Frontend mobile trong pnpm/Turborepo monorepo.
- **Performance Goals**: Không có SLA latency/FPS hay quy mô concurrent user đã
  chốt cho feature. Giữ FlatList, cursor paging, debounce search hiện có, dedupe
  query và chặn fetch/mutation lặp; không phát sinh chỉ tiêu benchmark tùy ý.
- **Constraints**: Authenticated `/api/v1`, UUID thật, server state/version/expiry,
  không fallback mock khi lỗi. UI dùng Nunito/theme; font scale 130% và width
  320/375/430 cần nghiệm thu; web 360/390 trước đây chưa thay các trường hợp đó.
- **Scale/Scope**: Own list/create/detail/edit, Discovery/Search/public detail;
  recommended P2. LR page size hiện dùng 20; không suy total/count từ API.

## Constitution Check

Đối chiếu [mobile constitution](../../.specify/memory/constitution.md).
Cột trước/sau là gate của thiết kế, không phải đánh dấu nghiệm thu runtime.

| Nguyên tắc                     | Trước research | Sau design | Căn cứ và điều kiện còn mở                                                                                              |
| ------------------------------ | -------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------- |
| 1. Mobile scope                | Pass           | Pass       | Chỉ thêm artifacts trong spec 005; backend chỉ đọc để xác minh dependency.                                              |
| 2. Existing architecture       | Pass           | Pass       | Tái sử dụng feature/public index, route mỏng, HTTP/Auth; không chuyển thư mục hoặc thêm lớp rỗng.                       |
| 3. API/cache/recovery          | Pass           | Pass       | Thiết kế giữ session boundary, không replay mutation; M01..M04 bổ sung phục hồi/validation. Chưa tuyên bố chúng đã sửa. |
| 4. UI/accessibility/navigation | Pass           | Pass       | Giữ font/token/layout/Back đã làm; M05/M06 và AC-16 bổ sung evidence chưa có.                                           |
| 5. Authority/privacy           | Pass           | Pass       | Không tính state/settlement ở client, không dùng owner DTO cho public; Tag và matching chờ contract.                    |
| 6. Verification evidence       | Pass           | Pass       | Source audit tách khỏi fixture/web/API/native; các AC và dependency pending vẫn mở.                                     |
| Governance/Git                 | Pass           | Pass       | Giữ branch và các artifact gốc; không commit/push, không nâng task completion bằng plan.                                |

Không có exception kiến trúc mới cần duyệt. Readiness API thật, Tag và native
acceptance là Pending, không phải exception cho phép bypass dependency.

## Project Structure

### Documentation

```text
specs/005-learning-request/
├── spec.md                # Giữ nguyên yêu cầu/AC đã chốt
├── contracts.md           # Giữ checkpoint HTTP đã có
├── tasks.md               # Giữ nguyên task history và tất cả checkbox
├── checklist.md           # Giữ AC/contract readiness còn mở
├── validation.md          # Giữ evidence lịch sử
├── plan.md                # Plan tiếp tục, không tái triển khai phần đã có
├── research.md            # Quyết định, source audit và các giới hạn
├── data-model.md          # API projections, draft và state authority
├── quickstart.md          # Kiểm tra tái lập và các gate
└── contracts/
    ├── http.md            # Chỉ dẫn tích hợp, retry/cursor/readiness
    └── ui.md              # Hành vi screen, recovery và boundary
```

### Existing source

```text
src/app/requests/{index,new}.tsx
src/app/requests/[id]/{index,edit}.tsx
src/app/request/[id].tsx
src/app/(tabs)/discover.tsx
src/features/learning-requests/
├── api/requests-api.ts
├── context.tsx
├── types.ts
├── preferred-slots.ts
├── schemas/request-form.ts
├── hooks/{use-requests,use-request-form,use-request-back}.ts
├── components/            # Card, fields, section, filters, state, page, Skill selector
├── screens/               # Mine, feed, detail, editor
├── utils/request-policy.ts
└── index.ts
src/features/{profile,discovery,product-shell}/
src/lib/http/
tests/learning-requests.test.ts
```

**Structure Decision**: Giữ cấu trúc feature hiện có. Những helper phục hồi mới
chỉ tách trong learning-requests khi có trách nhiệm riêng; không sửa shared HTTP
hoặc Auth nếu feature-level handler đủ. Check consumer/regression nếu sau này
cần thay shared mobile component. `services/api` là dependency ngoài scope.

## Source đã có và mức evidence

| Phần đã tick trong tasks | Source đã đối chiếu                                                    | Evidence/giới hạn                                                                       |
| ------------------------ | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| HTTP/Auth/session cache  | `context.tsx`, `api/requests-api.ts`, shared `lib/http`                | Có session-generation guard và private cache cleanup; kiểm tra hai account thật còn mở. |
| Projection/pagination    | `types.ts`, `api/requests-api.ts`                                      | Parse owner/public/meta, opaque cursor, dedupe; paging recovery cần thêm case.          |
| Mine/form/lifecycle      | Mine/editor/detail screens, form schema/hooks/policy                   | Có create/edit/publish/cancel thực gọi HTTP; không chứng minh backend trả success.      |
| Discovery/search/filter  | Feed screen/filter controls, product-shell Search                      | Keyword/Skill/scope thật; không Credit/session/sort giả.                                |
| Profile/Back/UI          | Profile shortcut, request-back/form hooks, shared cards/sections/theme | Web evidence có; pending gesture/hardware Back/native vẫn mở.                           |
| Preview boundary/tests   | Fixture links `/explore/requests/[id]`, 10 LR tests                    | Real detail không vào Proposal/profile mock; suite 102 pass là checkpoint lịch sử.      |

Giữ tags khi sửa hiện được thực hiện bằng việc không gửi `tagIds`. Chưa có Tag
picker/filter/clear UI; test encode tag query không chứng minh Tag đã tích hợp.

## Mobile còn làm được trước khi backend phục hồi

Các mã Mxx đã được chi tiết hóa trong T001..T035 của tasks.md. Bổ sung sau analyze
chỉ làm rõ recovery/negative cases trong task pending, không đổi task hoàn thành,
phạm vi hay trạng thái readiness backend/native.

| Mã  | Kết quả cần bổ sung                                                                             | Source hiện tại / AC                                                          | Điều kiện                                                         |
| --- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| M01 | Refetch và đối chiếu conflict trong editor, giữ draft memory                                    | `use-request-form.ts:63`, `request-editor-screen.tsx:95`; FR-18, AC-08        | Làm bằng fixture trước; không cần endpoint mới.                   |
| M02 | Expiry GET trước action, editor deep link và PATCH có thay đổi khi deadline OPEN/PENDING đã qua | detail/editor screens, `use-request-form.ts`, request-policy; FR-14/22, AC-10 | GET lỗi khóa; version đổi qua M01; giữ draft và server authority. |
| M03 | Kiểm chứng cursor phục hồi và tách lỗi page sau                                                 | `use-requests.ts:23`, mine/feed footer; FR-24, AC-11/12                       | Test refetch hiện có trước; chỉ bổ sung restart đầu nếu thiếu.    |
| M04 | Reject edit/publish/cancel response có ID sai target                                            | `requests-api.ts:90-107`; FR-29/30, AC-14/15                                  | Parse schema + ID equality trước sync/toast/navigation.           |
| M05 | Network/503 giữ last-read với notice; GET404/403 ẩn snapshot/reason, khóa action                | detail/editor screens, request-state/content; FR-04/13/32, AC-01/13           | Không dùng cache làm quyền đọc; mutation403 phân biệt với GET403. |
| M06 | Regression recovery + native accessibility/navigation                                           | `tests/learning-requests.test.ts`, screens/form/Back; AC-04/05/08/10..16      | Fixture kiểm logic; native cần device/build có thể chạy.          |

### Quyết định recovery

- **409 edit**: Giữ form và bản snapshot/version gốc trong cùng phiên. Đọc bản
  server mới bằng GET; cho xem khác biệt và chọn bỏ draft hoặc tiếp tục sửa có
  chủ ý dựa trên bản mới. Không auto nâng expectedVersion hoặc PATCH lại. Khi
  state mới không cho edit, giữ nội dung để đối chiếu nhưng khóa mutation.
- **Unknown mutation outcome**: Chặn resend. ID đã biết thì đọc detail; create
  chưa có ID thì hướng dẫn kiểm tra Mine. Không nhận diện bài vừa tạo bằng title,
  tự POST lại hoặc thêm Idempotency-Key mà contract không hỗ trợ.
- **Expiry**: Đồng hồ thiết bị chỉ kích hoạt refresh khi cached OPEN/PENDING có
  deadline đã qua; không tự ghi EXPIRED. Đọc thất bại thì chặn action dựa snapshot
  đó; đọc thành công xét effectiveStatus/version mới. Không làm NEGOTIATING,
  MATCHED hoặc CLOSED hết hạn cục bộ. Bao phủ editor deep link và kiểm lại ngay
  trước PATCH có thay đổi khi form mở qua deadline. Giữ guard pending suốt read/
  action; effectiveStatus mới không editable thì khóa và giữ draft cùng phiên.
  Version đổi phải đối chiếu M01/explicit choice, không auto rebase rồi PATCH.
  Một GET cho mỗi thao tác preflight; clock lệch không gây refresh loop.
- **Resource read denial**: GET detail404 -> unavailable; GET detail403 -> không
  được phép. Cả hai ẩn cached server content/reason, chặn action; chỉ GET thành
  công đúng phiên mới phục hồi quyền hiển thị/thao tác. Editor giữ draft trong
  bộ nhớ cùng phiên, không trình bày baseline/reason như vẫn được quyền đọc.
  Network/503 được giữ snapshot last-read với notice; expiry preflight lỗi vẫn
  khóa action. Mutation403 không đồng nghĩa detail mất quyền đọc.
- **Text/error boundaries**: Client chỉ NFKC/trim/code points; không mô phỏng
  HTML sanitizer/entity decoding hoặc moderation server. M06 fixture và T025/
  T026 nghiệm thu account không ACTIVE, thiếu grant, policy hạn chế hoạt động mới
  và429: giữ input cùng phiên, không success/auto resend;401 theo shared Auth.
- **Cursor**: `INVALID_REQUEST_CURSOR` khác `INVALID_REQUEST_QUERY`. Giữ filter,
  scope và session, đọc lại từ page đầu bằng flow phục hồi có kiểm soát. Query
  refetch của TanStack đã xây lại chain từ trang đầu, cần test để tránh kết luận
  sai rằng mọi refetch dùng cursor cũ. Lỗi mạng/503 page sau giữ dữ liệu đã tải;
  không gọi fetchNextPage trong lúc background refetch đang chạy.

## Phần chờ backend hoặc feature khác

| Mã / gap đã có       | Blocker                                              | Điều kiện mở khóa và phạm vi tác động                                                                                                                                                                |
| -------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B01 / GAP-01         | Catalog assert/read chưa nối                         | API owner bind real reader; create/publish/edit và public feed/detail có item chạy bằng UUID ACTIVE. Skills HTTP success chưa đủ.                                                                    |
| B02 / GAP-01,05      | Public owner projection chưa nối                     | Reader trả `{id,displayName}` đúng owner; feed có bài của account khác và private allowlist qua real API.                                                                                            |
| B03 / GAP-03         | Sharing Skill snapshot chưa nối                      | Recommended có ranking/snapshot version thật, loại bài own; snapshot đổi kiểm cursor recovery.                                                                                                       |
| B04 / GAP-03         | Path/Schedule lock reader chưa nối                   | Cancel NEGOTIATING unlocked/locked/race qua authority thật. Cancel các state khác không gọi reader này.                                                                                              |
| B05 / GAP-02         | Canonical Tag lookup chưa có HTTP contract           | Chốt endpoint/query/projection/paging/ACTIVE policy; mới triển khai picker/filter/clear. Không đoán `/tags`, không dùng Skill ID thay Tag.                                                           |
| B06 / GAP-04,06,08   | Migrations, grants, moderation/config/expiry rollout | Môi trường nghiệm thu có DB/migration, quyền đúng, rule clean/flagged hợp lệ, worker/config; raw PATCH/markup/Unicode kiểm qua HTTP.                                                                 |
| B07 / GAP-07, DEP-01 | Proposal/public profile/Notification                 | Nghiệm thu ở feature/spec riêng. Spec 005 giữ boundary và owner reject reason; không tuyên bố Matching hoặc notification delivery đã hoàn tất.                                                       |
| B08 / GAP-09         | HTTP/DB chưa lưu lịch rảnh lặp tuần theo yêu cầu mới | Chốt weekday/HH:mm/IANA timezone, max/overlap/overnight policy, DTO/persistence/projections/migration và compatibility preferredSlots. Mobile chỉ draft UI; T036 pending, không tự sửa services/api. |

Mine/own detail có thể hoạt động với dữ liệu sẵn có dù các adapter trên chưa nối,
nhưng vẫn phụ thuộc auth/quyền/DB/migration. Feed rỗng có thể trả 200 mà không gọi
projection reader. Không gắn nhãn mọi route blocked hoặc coi health/empty feed là
bằng chứng feature ready. Backend wiring chỉ được cập nhật bởi task backend riêng.

## Thứ tự tiếp tục và nghiệm thu

1. Review artifact và task pending T001..T035; giữ nguyên baseline hoàn thành
   và gate Tag B05. Không tạo spec 004/006 thay005 hoặc task trùng.
2. `$speckit-analyze` đối chiếu scope/AC/work packages. C1/C2/A1/U1/I1 đã được
   làm rõ trong tài liệu; các thay đổi source/tests tương ứng vẫn pending, không
   dùng việc sửa tài liệu để tick implementation hoặc API/native acceptance.
3. Implement M01/M04, sau đó M02/M05 và M03/M06 với regression có failure case.
   Giữ HTTP/Auth/Back/no-change/timestamp/tag behavior đã có.
4. Backend owner cung cấp B01..B06; mobile nối Tag chỉ sau B05. Chạy real API
   acceptance theo quickstart, ghi kết quả từng AC thay vì tick hàng loạt.
5. Native Android/iOS, width/font/keyboard/Back/pending; xử lý các lỗi UI phát hiện
   trong scope. `$speckit-converge` kiểm phần còn lại; dependency chưa mở vẫn Pending.

**Verification policy**: Source audit của plan không chạy lại suite, live mutation
hoặc native UI. [Validation](validation.md) vẫn là checkpoint lịch sử 2026-10-11.
Ở bước này chỉ kiểm artifact links, template completeness, mobile root/feature
resolution và bảo toàn lịch sử task. Lần bổ sung sau analyze chỉ sửa tài liệu,
giữ task IDs/checkbox và evidence cũ. Khi sửa source, chạy các
checks phù hợp trong quickstart; không báo lại 102 pass như evidence mới.

## Complexity Tracking

Không có exception mới. Không thêm database, offline sync, provider/service mới,
package dùng chung, backend stub hay Git extension. Các task recovery xử lý trong
feature hiện có; nếu cần abstraction mới, chứng minh trách nhiệm riêng khi implement.
