# Trạng thái Phase 07 — Session API

## Hiện trạng

- Cập nhật lúc: 2026-10-22T20:53:47+07:00; baseline HEAD `be4738b9`, nhánh `feat/mobile-session`, cộng working tree của phase.
- Trạng thái: **In progress — các lát cắt đọc/context/điều hướng/completion đã triển khai; mutation đổi lịch và nghiệm thu thực tế còn mở.** Task tại [plan](plan.md).
- Source đã nối: detail giữ planVersion/outlineSessionNo/progress, đọc outline đúng Path/plan/version/Session; link Session → Plan → Session thật; entry từ thỏa thuận mở toàn bộ Session của Path; danh sách Path không còn phụ thuộc tháng/cap 100 của mine.
- Completion giữ modal/preflight/receipt/reconcile hiện có và refresh Path/mine qua public boundary đúng owner/generation. Path refetch lỗi không mất receipt hoặc gửi POST lại. Không optimistic progress/settlement/Credit.
- Đổi lịch đã đọc proposal/version/appliedVersion/lịch đề xuất/xác nhận A-B từ Path; READY/cutoff/ONGOING được xử lý ở CTA. Gửi và confirm vẫn **unavailable**, không thêm adapter mutation khi SESSION-DEP-01/04 chưa đạt.
- LiveKit/media giữ ngoài phạm vi; room chỉ đổi import sang preview/context sau khi dọn provider. Không sửa token/SDK/app config/package/lockfile. File cần đối chiếu khi ghép nhánh: sessions/types.ts, detail screen, completion hook và import của preview-room-screen.
- Nghiệm thu người dùng: **Chưa thực hiện**. API đích hai tài khoản và Android/iOS: **NOT_RUN**; không có phiên test được xác định để nghiệm thu các ca này.

- Cleanup: bỏ mutation giả lập/overrides/progress optimistic trong provider preview, helper dựng payload không có consumer, style tháng và sessions/state không có consumer; provider chỉ đọc còn cần cho room/report nằm trong preview/context.tsx. Bỏ tham số allowed trùng với UUID guard của useLearningPath và lookup Session lặp ở timeline. Card đổi lịch chỉ hiện pending cho buổi thực sự đổi giờ, loại trạng thái CANCELLED/EXPIRED và snapshot cùng appliedVersion lệch giờ.

- Dọn file dư: xóa sessions/screens.tsx và export trực tiếp qua index; xóa Calendar SessionDetailScreen/SessionCards cùng hai file mocks không còn route dùng. WeekDays chuyển về MonthCalendar; bỏ filter/group/status labels, public export và màu không có application consumer. Kiểm import tĩnh của 40 file Session/Calendar còn lại không thấy file thiếu nơi tham chiếu. Route/API/LiveKit giữ nguyên.

## Bằng chứng hiện hành

| Phạm vi                             | Kết quả                                                                         | Nguồn và giới hạn                                                                                                                                                                                                                                                                                                                     |
| ----------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Focused Session/Plan/Schedule       | **91/91 PASS**, 0 failed/skipped                                                | `pnpm --filter mobile exec tsx --experimental-test-module-mocks --test tests/sessions-*.test.ts tests/app-refresh.test.ts tests/plan-navigation-ui.test.ts tests/learning-agreement*.test.ts tests/schedule-*.test.ts`; gồm hai regression snapshot mới                                                                               |
| TypeScript                          | **PASS**                                                                        | `pnpm --filter mobile check-types`                                                                                                                                                                                                                                                                                                    |
| ESLint                              | **PASS**                                                                        | `pnpm --filter mobile lint`                                                                                                                                                                                                                                                                                                           |
| Full mobile suite                   | **735 PASS / 3 FAIL / 0 skipped**, 738 tests                                    | `pnpm --filter mobile test`; kết quả trước lần dọn file, không chạy lại toàn suite cho thay đổi này; cả trước và sau cleanup đều chỉ lỗi 3 ca baseline ngoài Session ghi bên dưới                                                                                                                                                     |
| Structure                           | **FAIL tại 3 file baseline**, không có file phase vượt hard limit               | `check-structure`; đã đối chiếu HEAD và working tree, các file lỗi không thay đổi                                                                                                                                                                                                                                                     |
| Web export                          | **PASS**                                                                        | `pnpm --filter mobile exec expo export --platform web --output-dir .expo/phase-07-session-web`; bundle không chứng minh API/native                                                                                                                                                                                                    |
| Browser fixture                     | **9 nhóm PASS**, 32 requests, 1 completion POST fixture, 0 page errors          | Session content/progress; vòng Session → Plan → Session; proposal/version/A-B và submit disabled; toàn Path; completion một lần; version mismatch; Path denial; stale context refresh lỗi vẫn giữ nội dung và có retry riêng. Thêm kiểm reorder/no-reload-button/pull refresh giữ draft. Không có reschedule/token/settlement request |
| UI review                           | Đã xem ảnh detail/context/reschedule 375px; layout 320/375/430 không tràn ngang | Reuse SessionPanel/Button/Nunito/theme; không tuyên bố pixel-match hoặc native acceptance                                                                                                                                                                                                                                             |
| Diff và scope                       | Chỉ mobile, không stage/commit/push                                             | Backend/app.json/package.json/lockfile không đổi; room chỉ chuyển import preview provider                                                                                                                                                                                                                                             |
| Real API / Android / iOS / user UAT | **NOT_RUN**                                                                     | Không dùng fixtures/web export làm nghiệm thu thực tế                                                                                                                                                                                                                                                                                 |

Logs dọn file: `.expo/phase-07-session-validation/prune-focused.log`, `prune-export.log`, `prune-browser.log`; focused 91/91, types/lint/export PASS, browser 9 nhóm/32 requests/1 completion POST fixture/0 page errors. Structure vẫn chỉ lỗi ba file baseline.

Logs cleanup hiện hành: `.expo/phase-07-session-validation/cleanup-focused.log`, `cleanup-final-tests.log`, `cleanup-export.log`, `cleanup-browser.log`. Browser sau cleanup: 9 nhóm PASS, 32 requests, 1 completion POST fixture, 0 page errors.

Logs/ảnh/harness cục bộ ignored: `apps/mobile/.expo/phase-07-session-validation/` (focused.log, types.log, lint.log, tests.log, export.log, browser-result.json, detail/context/reschedule/denied PNG); harness `.expo/phase-07-session-browser.cjs`. Không phải artifact đã commit hoặc evidence deployment. Commands dùng process-only `pnpm_config_verify_deps_before_run=false` để chạy dependencies sẵn có; không đổi pnpm config/install/lockfile.

Tests mới tại [context](../../../tests/sessions-context.test.ts), [Path refresh](../../../tests/sessions-path-refresh.test.ts), [UI host](../../../tests/sessions-phase-ui.test.ts); navigation regression bổ sung trong [Plan navigation](../../../tests/plan-navigation-ui.test.ts). Host mocks/fixture không thay native navigation stack.

## Lỗi workspace baseline còn tồn tại

- `proposal-landing-ui.test.ts`: ca successful Request/direct proposals không tìm được form (`undefined == true`, line 131).
- `skills-read-ui.test.ts`: history denial và own-list denial thiếu mock `@/components/RefreshableFlatList`.
- Chạy riêng hai file vẫn tái hiện đúng 3 lỗi. Test/source Proposal/Skills liên quan không có diff trong phiên này; không sửa ngoài scope để làm full suite xanh.
- Structure checker: `agreement-plans-step.tsx` 419 dòng, `learning-paths/utils/progression.ts` 279, `ApiSendProposalScreen.tsx` 465. HEAD và working tree của ba file giống nhau; checker tính thêm dòng cuối. Các file mới/sửa của phase không vượt giới hạn.

## Dependency và bước tiếp theo

1. **SESSION-DEP-04:** backend propose có conflict giả ở lịch nhiều buổi; xem contract và diagnostic source. **SESSION-DEP-01:** backend owner cần evidence kiểm conflict nguyên tử ở confirm đổi lịch cuối, kể cả conflict phát sinh sau proposal/giữa Path. Không có bằng chứng mới; giữ P07-S03-T05 khóa và không sửa backend.
2. P07-S01-T02 / DEP-02/03: smoke API đích hai participant, ONE_WAY/TWO_WAY, read mapping/reload và config duration/cutoff. Các ca fixture đã có, deployment chưa được xác minh.
3. Sau gate, nối propose/confirm và hoàn tất S05; real API/native UAT theo S99. S06-T01 đã chạy checks nhưng còn mở vì full suite/structure chưa xanh.
4. Report thật tiếp nhận ở Phase 08; Session thật không mở ReportsPreview. Khi có ref nhánh LiveKit, đối chiếu file chung, không tự merge hay làm lại media integration.

## Technical và UI review

Agent tự review source/contract/diff trong phiên này: metadata thiếu không bịa progress; mismatch/denial không lộ outline; list lấy actual sessions thay giờ proposal; A/B không bị đảo theo teacher/learner; invalidation chỉ Path/mine của owner/generation; receipt không mất khi Path read lỗi. Browser chỉ gửi đúng một completion POST đến route fixture. Đã bổ sung retry riêng khi context stale refresh lỗi.

Kết luận commit: phần Session đọc/context/completion không có lỗi mới trong các checks đã chạy; toàn workspace chưa xanh vì 3 lỗi suite và 3 lỗi structure baseline. Mutation đổi lịch unavailable và real API/native chưa nghiệm thu. Không có xác nhận chấp thuận thay người dùng.

## Nhật ký

### 2026-10-22T19:11:27+07:00

- Đưa đề nghị đổi lịch hiện tại xuống sau form và hướng dẫn giữ lịch cũ; bỏ nút tải lại đề nghị. Dùng pull refresh chung đã có trong KeyboardFormScrollView/AppRefreshProvider, không thêm luồng refresh riêng.
- Browser kéo xuống thực tế refetch cả Session và Path, giữ duration đang nhập 90 phút, không gửi POST. 9 nhóm/32 requests/1 completion POST fixture/0 page errors; đã mở kiểm ảnh layout mới. Focused Session + app-refresh 39/39 PASS; types/focused ESLint/web export PASS. Không chạy lại full suite cho chỉnh UI nhỏ.
- Chẩn đoán nguyên nhân gửi bị khóa: mobile available=false, disabled/onPress rỗng, SessionsApi chưa có propose/confirm; backend đã có endpoint/read version. Không phải request gửi rồi lỗi.
- Bổ sung SESSION-DEP-04: predicate conflict của proposeReschedule so candidate buổi giữ nguyên với chính Session đó trong otherSessions. Chạy nguyên biểu thức trích source với hai buổi không trùng: chỉ buổi đổi false, thêm buổi giữ nguyên true. Evidence ignored .expo/phase-07-session-validation/reschedule-conflict-diagnostic.json; không gọi API thật, không sửa/build backend. DEP-01 kiểm conflict cuối vẫn mở.

### 2026-10-22T18:22:11+07:00

- Triển khai S02, S03-T01..T04 và S04 theo phạm vi mobile; cập nhật contract/matrix/architecture và review phần đã làm. S03-T05, S05, S06-T01 và S99-T02 giữ mở theo dependency/bằng chứng thực tế.
- Check focused/types/lint/export/browser đạt trong phạm vi khai báo; full suite và structure vẫn có các lỗi baseline nêu trên. Không nhận toàn phase Done.
- Giữ scope LiveKit ở nhánh khác và API backend chỉ đọc. Không stage/commit/push hoặc thực hiện mutation API thật.

### 2026-10-22T17:55:13+07:00

- Kiểm 148 liên kết local trong 8 tài liệu mới/cập nhật: PASS, không có target thiếu. Đã xác minh route Plan/Session được dẫn tồn tại trong route tree.
- Prettier chạy trực tiếp với `--ignore-path NUL` trên 3 file mới để không bị rule ignore `docs` bỏ qua; `git diff --check` PASS cho các file tracked. Chỉ mục/roadmap/matrix chỉ sửa dòng liên quan, không format lại toàn bộ tài liệu cũ.
- Chỉ thay tài liệu mobile. Không chạy app tests/export/API/native vì phiên này không sửa implementation; các mục đó vẫn NOT_RUN ở bảng bằng chứng.

### 2026-10-22T17:48:42+07:00

- Rà luồng Session từ Calendar, timeline Plan, Path sessions đến detail/completion/reschedule và các entry preview.
- Tạo contract Session và work Phase 07 theo workflow docs hiện hành; tiếp nhận các phần còn mở của spec006, giữ task/evidence cũ làm lịch sử.
- Theo điều chỉnh phạm vi trực tiếp của người dùng, loại tích hợp LiveKit khỏi phase này vì đang làm ở nhánh khác. Chỉ ghi handoff, không tạo bản tích hợp song song.
- Chưa sửa mã app/backend, chưa stage/commit/push, chưa thực hiện nghiệm thu thay người dùng.
