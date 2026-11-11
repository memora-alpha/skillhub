# Trạng thái Phase 07 — Session API

## Dọn code trước commit — 2026-11-12T00:27:44+07:00

- P07-UI-07 **Ready for review**, người dùng **Chưa nghiệm thu**. Bỏ Session preview context/provider không có người đọc khỏi UiPreviewProvider/index và xóa cờ demo/style không có caller của SessionPage. Giữ RoomPreview dùng cho camera thật; dữ liệu mẫu của các màn khác có consumer/nhãn vẫn giữ.
- Kiểm chứng chung tại [Report UI](../reports-ui/status.md), REPORT-UI-23: full suite **1.134/1.134 PASS**, types/lint/structure **962 source files**, export/format/diff và **48 nhóm browser fixture PASS**. Giữ giới hạn API thật/Android/iOS/UAT **NOT_RUN**; chưa stage/commit, chỉ sửa mobile.

## Rà lại màn đăng ký học bù — 2026-11-12T00:10:14+07:00

- P07-UI-06 **Ready for review**; người dùng **Chưa nghiệm thu**. Đối chiếu source `attendance-view.ts`, `scheduling.service.ts` và mobile: học bù dùng quyền `PROPOSE_MAKEUP`/`makeupBy`, cùng API đề xuất/xác nhận lịch theo version; không áp cutoff giờ buổi gốc cho học bù. Không sửa backend, cấu hình thời lượng hoặc quy tắc cấp lượt.
- UI đã dùng Nunito/theme/SessionSection/SessionButton/DateTimeField/Input chung. Sửa các điểm còn lệch: trường ngày giờ/thời lượng giờ khóa cùng nút gửi khi hết hạn/thiếu quyền/context chưa sẵn sàng; hạn chốt gọn `Chốt trước HH:mm · dd/MM/yyyy`; lỗi học bù không còn nói lịch cũ vẫn hiệu lực; proposal hết hạn không đồng thời nhắc xác nhận trước hạn. Giữ draft khi lỗi trùng lịch.
- Bổ sung AppState vào lifecycle action: chuyển nền trong lúc đọc kiểm tra trước gửi sẽ hủy lượt thao tác đó, quay lại không tự POST. Focus/owner/version guards, đọc mới trước mutation và recovery uncertain hiện có được giữ.
- Kiểm chứng: **23 tests PASS** trong 6 file (context/eligibility/read/time/import/lifecycle, gồm quyền/hạn/version/path thay đổi giữa lúc mở form và gửi); TypeScript, full ESLint, structure **963 files**, web export và `git diff --check` **PASS**. Browser **11 nhóm PASS**, 320/375/430px không tràn ngang; một đề xuất thành công, một đề xuất bị từ chối trùng lịch và một xác nhận qua API fixture; không page error. Đã mở xem ảnh form và xác nhận 375px. Full suite, API thật, native keyboard/AppState Android/iOS và font scaling **NOT_RUN**.
- Evidence local ignored: `.expo/makeup-review-browser.cjs`, `.expo/makeup-review-validation/`, `.expo/makeup-review-browser.log`, `.expo/makeup-review-tests.log`, `.expo/makeup-review-types.log`, `.expo/makeup-review-export.log`. Web fixture và unit test không thay bằng chứng deployment hoặc native; các dependency/acceptance cũ của phase giữ nguyên.

## Thu nhỏ số tiến độ — 2026-11-11T17:21:22+07:00

- **Ready for review**, người dùng **Chưa nghiệm thu**. P07-UI-05 đổi progressValue từ amount 32px/40px sang title 20px/28px, giữ font đậm và đơn vị buổi. Không đổi dữ liệu/API/logic progress.
- TypeScript, focused ESLint và web export **PASS**; browser xác nhận 1/1 ở 20px, progressbar vẫn có giá trị đúng và không tràn ngang ở 320/375px. Không thêm unit test cho thay đổi trình bày. Native **NOT_RUN**. Evidence ignored: `.expo/session-small-ui-browser.cjs`, `.expo/session-small-ui-validation/`, `.expo/session-small-ui-export.log`.

## Trình bày quy định buổi học — 2026-11-11T13:14:21+07:00

- **Ready for review**, người dùng **Chưa nghiệm thu**. Chỉ sửa trình bày trong phần mở rộng Quy định buổi học: bốn nhóm Đổi lịch → Học bù → Điểm danh và vắng học → Giải trình và hỗ trợ. Tiêu đề đậm, đường phân cách, gạch ý; nhấn đậm các mốc/điều kiện chính.
- Bốn trường hợp điểm danh nằm trong một khối nền nhẹ, mỗi trường hợp có nhãn đậm và mô tả riêng. Lịch gốc đặt trong Đổi lịch, lượt đã dùng đặt trong Học bù. Giữ theme/Nunito và hành vi mở/đóng; không sửa API, quyền, mutation hoặc quy tắc nghiệp vụ.
- Kiểm tra: focused ESLint và TypeScript **PASS**; web export **PASS**; browser **3 nhóm PASS** gồm thứ tự/độ đậm tiêu đề, layout 320/375/430px, mở/đóng không gửi mutation và không page error. Đã xem ảnh phần đầu/điểm danh 375px. Không thêm unit test cho định dạng thuần túy, không chạy lại full suite; native **NOT_RUN**.
- Evidence ignored: `.expo/mobile-session-rules-browser.cjs`, `.expo/mobile-session-rules-validation/`, `.expo/mobile-session-rules-export.log`.

## Thiết kế lại vùng tiến độ và quản lý buổi học — 2026-11-11T12:58:10+07:00

- Nhánh `fix/mobile-session-ui`, **Ready for review** trong phạm vi giao diện. Nghiệm thu người dùng **Chưa thực hiện**. Nguồn thiết kế: yêu cầu tiếp tục giảm chữ/tăng độ dễ nhìn trong phiên; giữ Nunito, palette, Button/Icon và token của app, không có frame mới để pixel-match.
- Tiến độ dùng nền forestSoft, số đếm lớn và thanh tiến độ; tổng thỏa thuận chỉ hiện khi khác tiến độ plan. Mở lộ trình bằng nút chevron có nhãn truy cập ở header. Nội dung có nhãn số buổi, mặc định ba dòng và xem thêm/thu gọn.
- Điểm danh đổi từ hai ô nhiều chữ sang hai hàng: vai trò, số phút tham gia, vào muộn nếu có và badge trạng thái. Dữ liệu chưa xác minh không biến thành vắng/0 phút; accessibility label giữ thời lượng đầy đủ từ server.
- Gom card yêu cầu học bù vào Quản lý buổi học bằng prop `embedded` chỉ bật cho Session. Hạn mức đặt cạnh nhau; thỏa thuận/báo sự cố thành hàng điều hướng; quy định gom một mục mở rộng, bỏ nội dung trùng và hướng dẫn quyết toán khỏi detail này. Các consumer khác của LearningChangePanel giữ mặc định.
- Giữ draft mở/đóng, yêu cầu đang chờ và các nút phản hồi, deadline/permission/mutation/recovery hiện hành. Không sửa backend/API/dependency hoặc các màn trên vùng tiến độ.
- Kiểm chứng: TypeScript, ESLint, structure và focused Session/import/Path changes **63/63 PASS**; web export **PASS**. Browser detail **11 nhóm PASS** ở 320/375/430px, không tràn ngang, một completion POST fixture và không page error. Hồi quy học bù **10 nhóm PASS**, một POST đề xuất/một POST xác nhận fixture, không page error; deadline/permission/đã chốt giữ đúng. Không chạy full suite; API thật, Android/iOS và native font scaling **NOT_RUN**.
- Evidence ignored: `.expo/mobile-session-redesign-browser.cjs`, `.expo/mobile-session-redesign-validation/`, `.expo/mobile-session-redesign-tests.log`, `.expo/mobile-session-redesign-export.log`; harness hồi quy học bù `.expo/mobile-session-redesign-makeup.cjs`.

## Đồng nhất chọn/xác nhận lịch học bù — 2026-11-11T11:53:18+07:00

- **Ready for review** trên `fix/mobile-session-ui`; nghiệm thu người dùng **Chưa thực hiện**. Theo yêu cầu tiếp tục chỉnh nội dung ngắn, dễ nhìn và đúng luồng học bù; dùng theme, SessionSection/SessionInfoRow/SessionButton đang có, không thêm frame/stack/dependency mới.
- Màn học bù mang tên “Lịch học bù”, có ngày giờ buổi gốc, hạn chốt, form và nút gửi/xác nhận riêng. Bỏ hướng dẫn giữ lịch cũ/cutoff 60 phút ở học bù; đổi lịch thường vẫn giữ điều kiện này. Không hiện version lịch hoặc thẻ đề nghị rỗng.
- Có đề nghị đang chờ thì ưu tiên lịch đề xuất và trạng thái hai bên, ẩn form tạo thêm. Sau khi backend áp dụng, giữ tên “Lịch học bù” và hiển thị “Lịch học bù đã chốt”, không mở lại form đổi lịch trong cùng lượt thao tác. Giữ dự thảo cùng Session, feedback/recovery và chống tự gửi lại mutation. Nội dung success không còn mặc định nói lịch cũ vẫn hiệu lực cho học bù.
- Detail/form/confirmation cùng kiểm tra `isRescheduleEligible`; SessionClock cập nhật ngay khi qua hạn hoặc quay lại màn hình. Nút hết hạn có giải thích, direct link không vượt quyền server; đồng hồ client không thay kiểm tra backend.
- Cả hai vắng: hiển thị “Hệ thống xét học bù sau hạn phản hồi” và thời hạn server, không hứa cấp lượt hoặc mở form giải trình lẫn nhau. Đến hạn chuyển thông báo đang chốt; case xem xét có nội dung riêng. Không hard-code 48 giờ/7 ngày trong hướng dẫn luồng này.
- Kiểm tra cuối: TypeScript, ESLint, structure **PASS**; focused Session/import tests **41/41 PASS** (gồm deadline/quyền học bù và hướng dẫn cả hai vắng); web export **PASS**. Browser fixture học bù **10 nhóm PASS**, đúng một POST đề xuất và một POST xác nhận, không page error. Kiểm 320/375/430px, gửi/xác nhận/đã chốt, pending của bạn/đối tác, hết hạn cả detail/form/confirmation và hết hạn khi đang mở, thiếu quyền và lỗi đọc/recovery. Regression giao diện detail **11 nhóm PASS**, một completion POST fixture, không page error. Real API và Android/iOS **NOT_RUN**; không chạy full suite cho phạm vi này.
- Evidence local ignored: `.expo/mobile-makeup-browser.cjs`, `.expo/mobile-makeup-validation/`, `.expo/mobile-makeup-tests.log`, `.expo/mobile-makeup-export.log`. Không sửa backend, API contract hay dependency.

## Bổ sung UI chi tiết buổi học — 2026-11-11T10:50:51+07:00

- Nhánh `fix/mobile-session-ui`, baseline `90279b28`; **Ready for review** trong phạm vi rút gọn UI. Nghiệm thu người dùng: **Chưa thực hiện**.
- Gom tiến độ backend và nội dung vào một thẻ, bỏ số phiên bản nội bộ khỏi UI. Bài dài mặc định tối đa bốn dòng, có xem thêm/thu gọn. Giữ progress khi context lỗi/denied và nút tải lại riêng.
- Điểm danh chỉ hiện khi có dữ liệu sau buổi học hoặc có việc cần xử lý; bỏ giờ vào phòng lần đầu và chỉ hiện hạn liên quan. Giữ giải trình, phản hồi, học bù, confirmation và recovery theo dữ liệu/quyền server.
- Form hủy buổi và lịch sử đã đóng được thu gọn; mở/đóng giữ draft. Yêu cầu đang hoạt động cùng nút phản hồi luôn hiện. Bên nhận thấy “Cần bạn phản hồi”; nội dung vẫn chỉ rõ người yêu cầu dùng lượt học bù.
- Đồng nhất heading/icon/thẻ với theme hiện hành. Giới hạn đổi lịch/lượt học bù hiển thị bằng hàng ngắn; quy định và chi tiết nằm sau nút mở rộng, gom liên kết thỏa thuận/báo sự cố ở cuối.
- Checks: TypeScript, ESLint, structure **PASS**; focused Session/import boundary/Path changes **61/61 PASS**; web export **PASS**. Browser fixture **11 nhóm PASS**, đúng một completion POST fixture và không có page error. Đã mở xem ảnh progress, incoming request, attendance ở 375px; kiểm không tràn ngang 320/375/430px.
- Evidence local ignored: `.expo/mobile-session-ui-browser.cjs`, `.expo/mobile-session-ui-validation/browser-result.json`, ảnh `detail-320/375/430.png`, `pending-375.png`, `attendance-375.png`; logs `.expo/mobile-session-ui-tests.log`, `.expo/mobile-session-ui-export.log`.
- Chỉ sửa mobile presentation và test hiện có; không sửa backend/API/dependencies. `compact` là prop tùy chọn, chỉ consumer Session bật. Không chạy lại full suite cho chỉnh UI này. Real API, Android/iOS và native font scaling **NOT_RUN**; web fixture không thay nghiệm thu native.

## Hiện trạng

- Cập nhật lúc: 2026-10-22T20:53:47+07:00; baseline HEAD `be4738b9`, cùng source của phase.
- Trạng thái: **In progress — các lát cắt đọc/context/điều hướng/completion đã triển khai; mutation đổi lịch và nghiệm thu thực tế còn mở.** Task tại [plan](plan.md).
- Source đã nối: detail giữ planVersion/outlineSessionNo/progress, đọc outline đúng Path/plan/version/Session; link Session → Plan → Session thật; entry từ thỏa thuận mở toàn bộ Session của Path; danh sách Path không còn phụ thuộc tháng/cap 100 của mine.
- Completion giữ modal/preflight/receipt/reconcile hiện có và refresh Path/mine qua public boundary đúng owner/generation. Path refetch lỗi không mất receipt hoặc gửi POST lại. Không optimistic progress/settlement/Credit.
- Đổi lịch đã đọc proposal/version/appliedVersion/lịch đề xuất/xác nhận A-B từ Path; READY/cutoff/ONGOING được xử lý ở CTA. Gửi và confirm vẫn **unavailable**, không thêm adapter mutation khi SESSION-DEP-01/04 chưa đạt.
- LiveKit/media giữ ngoài phạm vi; room chỉ đổi import sang preview/context sau khi dọn provider. Không sửa token/SDK/app config/package/lockfile. File cần đối chiếu khi tích hợp LiveKit: sessions/types.ts, detail screen, completion hook và import của preview-room-screen.
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
| Diff và scope                       | Chỉ mobile                                             | Backend/app.json/package.json/lockfile không đổi; room chỉ chuyển import preview provider                                                                                                                                                                                                                                             |
| Real API / Android / iOS / user UAT | **NOT_RUN**                                                                     | Không dùng fixtures/web export làm nghiệm thu thực tế                                                                                                                                                                                                                                                                                 |

Logs dọn file: `.expo/phase-07-session-validation/prune-focused.log`, `prune-export.log`, `prune-browser.log`; focused 91/91, types/lint/export PASS, browser 9 nhóm/32 requests/1 completion POST fixture/0 page errors. Structure vẫn chỉ lỗi ba file baseline.

Logs cleanup hiện hành: `.expo/phase-07-session-validation/cleanup-focused.log`, `cleanup-final-tests.log`, `cleanup-export.log`, `cleanup-browser.log`. Browser sau cleanup: 9 nhóm PASS, 32 requests, 1 completion POST fixture, 0 page errors.

Logs/ảnh/harness cục bộ ignored: `apps/mobile/.expo/phase-07-session-validation/` (focused.log, types.log, lint.log, tests.log, export.log, browser-result.json, detail/context/reschedule/denied PNG); harness `.expo/phase-07-session-browser.cjs`. Artifact local ignored, không phải evidence deployment. Commands dùng process-only `pnpm_config_verify_deps_before_run=false` để chạy dependencies sẵn có; không đổi pnpm config/install/lockfile.

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
4. Report thật tiếp nhận ở Phase 08; Session thật không mở ReportsPreview. Khi tích hợp LiveKit, cần đối chiếu các file dùng chung.

## Technical và UI review

Agent tự review source/contract/diff trong phiên này: metadata thiếu không bịa progress; mismatch/denial không lộ outline; list lấy actual sessions thay giờ proposal; A/B không bị đảo theo teacher/learner; invalidation chỉ Path/mine của owner/generation; receipt không mất khi Path read lỗi. Browser chỉ gửi đúng một completion POST đến route fixture. Đã bổ sung retry riêng khi context stale refresh lỗi.

Kết luận kiểm chứng: phần Session đọc/context/completion không có lỗi mới trong các checks đã chạy; toàn workspace chưa xanh vì 3 lỗi suite và 3 lỗi structure baseline. Mutation đổi lịch unavailable và real API/native chưa nghiệm thu. Không có xác nhận chấp thuận thay người dùng.

## Nhật ký

### 2026-10-22T19:11:27+07:00

- Đưa đề nghị đổi lịch hiện tại xuống sau form và hướng dẫn giữ lịch cũ; bỏ nút tải lại đề nghị. Dùng pull refresh chung đã có trong KeyboardFormScrollView/AppRefreshProvider, không thêm luồng refresh riêng.
- Browser kéo xuống thực tế refetch cả Session và Path, giữ duration đang nhập 90 phút, không gửi POST. 9 nhóm/32 requests/1 completion POST fixture/0 page errors; đã mở kiểm ảnh layout mới. Focused Session + app-refresh 39/39 PASS; types/focused ESLint/web export PASS. Không chạy lại full suite cho chỉnh UI nhỏ.
- Chẩn đoán nguyên nhân gửi bị khóa: mobile available=false, disabled/onPress rỗng, SessionsApi chưa có propose/confirm; backend đã có endpoint/read version. Không phải request gửi rồi lỗi.
- Bổ sung SESSION-DEP-04: predicate conflict của proposeReschedule so candidate buổi giữ nguyên với chính Session đó trong otherSessions. Chạy nguyên biểu thức trích source với hai buổi không trùng: chỉ buổi đổi false, thêm buổi giữ nguyên true. Evidence ignored .expo/phase-07-session-validation/reschedule-conflict-diagnostic.json; không gọi API thật, không sửa/build backend. DEP-01 kiểm conflict cuối vẫn mở.

### 2026-10-22T18:22:11+07:00

- Triển khai S02, S03-T01..T04 và S04 theo phạm vi mobile; cập nhật contract/matrix/architecture và review phần đã làm. S03-T05, S05, S06-T01 và S99-T02 giữ mở theo dependency/bằng chứng thực tế.
- Check focused/types/lint/export/browser đạt trong phạm vi khai báo; full suite và structure vẫn có các lỗi baseline nêu trên. Không nhận toàn phase Done.
- LiveKit thuộc work riêng; API backend chỉ đọc để đối chiếu. Không thực hiện mutation API thật.

### 2026-10-22T17:55:13+07:00

- Kiểm 148 liên kết local trong 8 tài liệu mới/cập nhật: PASS, không có target thiếu. Đã xác minh route Plan/Session được dẫn tồn tại trong route tree.
- Prettier chạy trực tiếp với `--ignore-path NUL` trên 3 file mới để không bị rule ignore `docs` bỏ qua; `git diff --check` PASS cho các file tracked. Chỉ mục/roadmap/matrix chỉ sửa dòng liên quan, không format lại toàn bộ tài liệu cũ.
- Chỉ thay tài liệu mobile. Không chạy app tests/export/API/native vì phiên này không sửa implementation; các mục đó vẫn NOT_RUN ở bảng bằng chứng.

### 2026-10-22T17:48:42+07:00

- Rà luồng Session từ Calendar, timeline Plan, Path sessions đến detail/completion/reschedule và các entry preview.
- Tạo contract Session và work Phase 07 theo workflow docs hiện hành; tiếp nhận các phần còn mở của spec006, giữ task/evidence cũ làm lịch sử.
- Tích hợp LiveKit nằm ngoài phase này và do work riêng phụ trách. Chỉ ghi handoff, không tạo bản tích hợp song song.
- Mốc này chỉ cập nhật tài liệu, chưa sửa mã app/backend hoặc thực hiện nghiệm thu.
