# Phase04 Learning Request và Discovery — nghiệm thu phần đang có

## Mục tiêu scope và nguồn

Người dùng own quản lý nháp/publish/edit/cancel, outsider tìm OPEN và mở profile trong context request. Kế thừa source/API hiện có, không xây từ đầu. Lần migration chỉ tiếp nhận task/evidence; implementation hoặc API/native UAT thực hiện khi có yêu cầu về sau. Giữ theme/routes/auth/cache, không sửa backend/shared/config/dependencies.

Nguồn: [spec005](../../../specs/005-learning-request/spec.md), [tasks005](../../../specs/005-learning-request/tasks.md), [resume](../../../specs/005-learning-request/resume.md), [validation](../../../specs/005-learning-request/validation.md), [fixture evidence](../../../specs/005-learning-request/validation/fixtures.md), [contract hiện hành](../../contracts/learning-requests.md), [domain/SRS](../../domain-rules.md). Thiết kế kế thừa Complete SkillHub Product Design/Figma Make và existing Request controls; chưa xác minh frame mới, không tự nhận được duyệt.

Baseline: API own/feed/recommended/detail/mutations, Skill/Tag/offering lookup, weekly/overview/hourly Credit và profile context đã có. T001..T024/T033..T036 có source/evidence lịch sử; không tick lại task cũ. T037 chỉ được resume nhắc, không có dòng task T037 trong tasks.md; FR-35 và source thực tế được giữ làm acceptance input, không giả lập task lịch sử.

## Sub-phase và dependency

| Mốc                            | Kết quả                                                      | Phụ thuộc                                                | Task kế thừa                  |
| ------------------------------ | ------------------------------------------------------------ | -------------------------------------------------------- | ----------------------------- |
| S01 Baseline/Contract          | Readiness môi trường theo case, không blanket503 cũ          | B01–B08 tương ứng, API owner                             | Điều kiện T025..T029 bên dưới |
| S03/S05 Integration acceptance | Đủ source/real API cases đã cam kết                          | User/test accounts/grants/config/data/migration          | spec005/T025..T029            |
| S04/S06 Native verification    | Layout/lifecycle/hardware Back từng platform                 | Device/build SDK57; có thể fixture-native trước API thật | spec005/T030..T032            |
| S99 Review/UAT                 | Evidence tổng hợp Technical/UI/Product, không tick dựa suite | Các case hoàn tất hoặc scope adjustment có xác nhận      | Acceptance AC-01..16/FR-35    |

S02 không cần setup lại design system; S03 implementation đã có, chỉ sửa lỗi có evidence trong phạm vi được giao. Không yêu cầu làm UI fixture toàn bộ trước API. API gates từng case không buộc thứ tự tuyến tính hoặc mọi task đợi lock NEGOTIATING.

## Task còn mở, giữ ID gốc

### Đồng bộ owner avatar theo BE 232cb6ba

Follow-up ngày 2026-10-27 trên `fix/mobile-proposal-chat-learning-path`, sau khi fetch/đối chiếu `origin/dev` 79d4bb1f; không merge hoặc sửa BE/shared/dependencies. Tái sử dụng Avatar và profile read/cache/session hiện có, giữ thiết kế card/detail.

- [x] AV-01: Đồng bộ field bắt buộc nullable `owner.avatarUrl` ở public feed/recommended/detail và fixture; giữ validation HTTP(S)/private stripping.
- [x] AV-02: Hiển thị URL response trực tiếp, không gọi profile khi URL còn hạn hoặc null; giữ viewability của card và profile navigation/context.
- [x] AV-03: Xử lý hạn 60 giây/lỗi Image bằng profile query hiện có, bỏ URL cached đã hết hạn; không timer/polling/replay hoặc tăng cache TTL. Callback Avatar tùy chọn giữ behavior các consumer khác.
- [x] AV-04: Regression schema/expiry/hook/card/detail/initials và compatibility Proposal; chạy checks mobile, ghi evidence trong status.

Real API/native acceptance tiếp tục thuộc T025..T032, chưa tự ghi hoàn thành từ host tests/export.

### Tích hợp proposedTags theo BE dev ngày 24/10/2026

Nhánh `fix/mobile-learning-request-proposed-tags` từ origin/dev0318bf7e. Nguồn contract: BE commit9d356167 và amendment `services/api/specs/007-learning-request/proposed-tags.md`; chỉ sửa mobile, không chạy migration/seed hoặc sửa BE.

Sau push nhầm, dev được hoàn tác bằng6a847121 và feature được đưa lại thành4 commit trên base đó để review qua PR; xem [ghi nhận khôi phục](status.md). Không dùng lại nhánh feature cũ ở ancestor của revert để mở PR trống.

- [x] PT-01: Owner schema/input/form/PATCH/recovery giữ proposedTags; normalize NFC/whitespace,1–80 code points, không control/duplicate keys, tổng tagIds+proposedTags<=10; omission giữ và[] clear.
- [x] PT-02: Form chọn tag có sẵn hoặc thêm/xóa tag đề xuất; giới hạn chung, pending disabled, giải thích duyệt cùng bài. Owner detail/mine thấy trạng thái chưa duyệt; public projection không lộ proposedTags.
- [x] PT-03: Regression form/API serialization/owner-public boundaries/conflict-rebase và UI combined limit; focused/full tests, types/lint/structure/export. Native/API acceptance riêng tại PT-04.
- [ ] PT-04: Real API/native acceptance khi BE đã deploy migration20261024000000: create/edit/reopen, publish chờ duyệt, Staff duyệt/từ chối và owner reload; không suy host tests thành nghiệm thu này.
- [x] PT-05: Theo yêu cầu thu gọn giao diện, dùng một nhãn/bộ đếm, input+nút thêm cùng hàng, chip xóa từng tag và chú thích duyệt ngắn có điều kiện; giữ giới hạn/validation và kiểm các consumer selector dùng chung.
- [x] PT-06: Theo yêu cầu đồng bộ cả form, dùng bảng chọn kỹ năng, thu gọn các mục tùy chọn với tóm tắt/tự mở khi có lỗi, ô nhiều dòng theo nội dung và lịch tuần dạng dòng sửa được; gộp tìm/thêm tag, phân biệt chip Mới và giữ phần tag đang nhập khi Save/conflict. Kiểm host regression, web tương tác dữ liệu mẫu, types/lint/structure/export; native/API vẫn thuộc PT-04 và acceptance gốc.
- [x] PT-07: Khắc phục ba lỗi tìm thấy khi review PT-06: xóa row lịch đang mở picker không giữ draft giờ sang row khác; query tag đồng nhất normalization với exact-match/giới hạn catalog; cho phép thay proposed tag bằng canonical ở tổng10 nếu không tăng số lượng. Đã bổ sung regression và kiểm web fixture; native/API acceptance vẫn thuộc PT-04.
- [x] PT-08: Theo yêu cầu tối ưu list mobile, đồng bộ quiet loading/cached content và focus, giảm lookup kỹ năng/refresh lịch sử đề xuất, thu gọn card/tag+N, đưa filter vào sheet/chip tên tag xóa từng mục, auto-pagination có guard/error recovery và đổi Đăng thành Tạo yêu cầu. Full830/830, focused4/4 sau bổ sung giữ tên tag khi mở lại sheet, types/lint/structure777/export Android/iOS/web và preview fixture đạt; không sửa BE/avatar contract. Native/API acceptance vẫn mở.

- [x] PT-09: Đã sửa GET403/404 sau cache: ẩn list ngay và evict data mà giữ lỗi, refetch/next-page denial chuyển recovery về full read;503 sau denial không hồi sinh cache. Cache rỗng gặp429/network hiện loading. Optional offering chỉ GET khi mở picker hoặc cần resolve selected labels, có AbortSignal. Regression actual hook/TanStack và UI đạt; API/native acceptance vẫn mở.
- [x] PT-10: Theo yêu cầu, nút đóng bộ lọc là icon X có accessible label/vùng chạm44; sheet giữ mounted, giữ chiều cao/snap trong lúc đóng và thay đổi bàn phím, không đổi disabled presentation khi thoát. Gate catalog theo active, đóng không apply draft và không nhận Apply muộn. Host regression + web tương tác/đo geometry đạt; cần người dùng kiểm motion trên thiết bị.

### Acceptance Phase04 còn mở

Mỗi task tham chiếu [tasks gốc](../../../specs/005-learning-request/tasks.md), bảng Gates bên ngoài workspace mobile. Evidence mới chỉ cập nhật [status](status.md); không tạo validation/progress khác để lặp.

- [ ] spec005/T025 — sau B06 và read-denial source T010/T013: kiểm AC-01/14 bằng hai accounts, own/private/public, invalid UUID/deep link, GET403/404 sau cache phải ẩn content/reason và khóa actions, Auth401/inactive/missing-grant, logout/switch trong read/mutation. Đạt khi không có dữ liệu/callback phiên cũ, ghi môi trường/actor role không credentials và kết quả từng nhóm.
- [ ] spec005/T026 — sau B01/B06 và nguồn guards T004/T008/T010/T013: API thật create201DRAFT/reopen, Unicode/markup/raw PATCH boundaries, dated/weekly timezone/save-reopen-clear/legacy và FR-35 overview/offering/hourly budget, publish clean/flagged, Staff external approve/reject, edit/re-publish/conflict/current reason, inactive/grant/429 giữ draft. AC-01/02/04..08/13 đạt theo case, Tag riêng T029; không tự thực hiện Staff backend work.
- [ ] spec005/T027 — B06/T016; B01 cho edit, riêng NEGOTIATING cần B04: cancel confirmation/race/unlocked/locked/503, expiry worker chậm, effectiveStatus, editor deep link/form qua deadline trước PATCH, GET lỗi/denial/version/terminal giữ draft và không auto-mutate. Đạt AC-09/10 theo prerequisites từng state; không gọi mọi cancel bị lock reader chặn.
- [ ] spec005/T028 — B01/B02/T018/T019, B03 cho recommended: public feed account khác/detail, >=2pages/search/Skill/order/races/cursor recovery, ranking snapshot hoặc503 không fallback; profile entry/back/privacy theo amendment003. Đạt AC-11/12/15 trong dữ liệu thật, empty feed/fixture không thay bằng chứng.
- [ ] spec005/T029 — B01/B05/B06, T021..T024 đã có source: Tag ACTIVE/inactive/error/empty,0/10/11/duplicate/non-UUID, omission/[]clear, ANY AND Skill/keyword/paging thật. Đạt AC-03/07/11 theo canonical IDs/actual contract, không seed backend để mở gate từ mobile.
- [ ] spec005/T030 — Android emulator/device + client/build SDK57; kiểm multiline/keyboard/scroll/safearea/orientation/font130%, screen nhỏ, pending hardware Back/double tap, Back sau create/edit, weekly/tag/offering mới. Đạt AC-16 theo device/OS/build/API-fixture-or-real/screenshots/results rõ; web/export không thay native.
- [ ] spec005/T031 — iOS device/simulator macOS+Xcode/client phù hợp; matrix T030, gesture Back/pending, keyboard/large text. Ghi evidence riêng iOS; không tự dùng cloud/upgrade SDK chỉ để tick.
- [ ] spec005/T032 — sau T030/T031, chỉ sửa native failures đã tái hiện trong hooks/use-request-back, request-page/request-fields/list styles hoặc source liên quan được xác minh lại; kiểm đúng ca lỗi và consumers. Nếu không có lỗi ghi không cần source change, không refactor theo sở thích.

Không tạo checkbox thứ hai cho FR-35/T037; weekly/FR-35 acceptance được gắn T026/T030/T031, nguồn resume/spec giữ nguyên. Tổng hợp cũ “Tag pending” không tạo implementation task mới vì source và amendment đã thay thế. Proposal thật cần work riêng/contract; DEP-01 notification vẫn là acceptance limitation của requirement, không kéo API notification vào005.

## Ma trận màn và lifecycle

| Màn/route                         | Dữ liệu/quyền              | States/actions                                              | Back/fallback                                                      | Bằng chứng                                    |
| --------------------------------- | -------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------- |
| /my-learning?tab=requests         | Own API theo session       | loading/empty/refresh/page-error/filter                     | Profile; legacy /requests redirect                                 | T025/28/30/31                                 |
| /requests/new, /requests/:id/edit | Owner + catalogs thật      | draft/conflict/expiry/read-denial/unknown-write, fields mới | History, new→Discover/edit→detail fallback; không duplicate detail | T026/27/29/30/31                              |
| /requests/:id                     | Owner detail/reason        | Publish/cancel/pending/version/denial                       | History/Discover                                                   | T025/26/27                                    |
| /discover, /request/:id           | Public OPEN + owner        | Paging/ranking/unavailable/target                           | Profile context và Back giữ request                                | T028                                          |
| /profiles/:userId                 | Public allowlist API       | 403/404 eviction;503 retry                                  | History/request fallback                                           | Profile amendment acceptance, T028            |
| /send-proposal?mode=mock-request  | Preview-prefixed local IDs | Local-only submit, nhãn rõ; không POST Proposal             | Original real request qua Back                                     | AC-15 boundary, không Proposal API acceptance |

## UAT kiểm tra và kết thúc

Trước UAT ghi binary/build/API origin, migration20261012000000_learning_request_fe_preferences đã apply bởi API owner, grants/config/Skill/Tag/offering data và quyền tác động test accounts/bài test. Không credentials hoặc private request bodies trong evidence. Không tự apply migration/seed/config để test pass.

Journey: Profile→Mine→New→Back; Discovery→New→save→detail→edit/save→publish→profile→Back; errors/conflict/denied/expired; switch account/background; Tag/weekly/FR-35 save-reopen-clear. Chỉ thao tác API data trong quyền được cấp; fixture/network cases tách khỏi real service và device. Focused regression + mobile lint/type/structure/full relevant suite khi có code; migration docs không chạy app suite.

Tiêu chí: từng AC có môi trường/bằng chứng đủ; không claim Notification FR-LR-04 end-to-end hoặc Proposal thật khi ngoài scope. Technical review, UI design review, Product/native acceptance riêng, không đóng phase với native/API nằm trong tiêu chí còn NOT_RUN. Nợ: B04 lock reader source unavailable (cao cho cancel NEGOTIATING), Sonar Quality Gate cần CI analysis mới theo validation (không suy local tests đóng Sonar). Rollback tương lai theo diff thực và compatibility; hiện migration không đổi code/data để rollback.
