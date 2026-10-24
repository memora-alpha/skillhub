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
