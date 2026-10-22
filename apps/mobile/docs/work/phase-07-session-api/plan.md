# Phase 07 — Hoàn thiện Session và đổi lịch qua API

## Mục tiêu và phạm vi

Tiếp tục Session đang có: từ Lịch học hoặc LearningPlan mở đúng Session thật; đọc đủ nội dung/tiến độ; xác nhận hoàn thành và cập nhật các màn liên quan; đề nghị và xác nhận đổi lịch cùng version khi backend đủ điều kiện.

Chỉ thay `apps/mobile`, ưu tiên features sessions/calendar và public boundary của learning-paths. Không viết lại API completion đã nối. **LiveKit đang tích hợp ở nhánh khác theo người dùng: không triển khai token/media/RoomScreen, không thêm SDK hoặc sửa camera/mic/app config trong phase này.** Backend chỉ đọc để đối chiếu. Report/Dispute đầy đủ, settlement/reviews, hủy/no-show, thông báo và dữ liệu Home mẫu thuộc work khác.

## Nhận diện và nguồn

- Kế thừa spec Session 006: T016/T017/T020 về đổi lịch và T019 về nghiệm thu; không sửa/tick lại hồ sơ lịch sử trong phiên lập phase.
- Task cũ được tiếp nhận vào task dưới đây theo tham chiếu; đây là checklist thực hiện hiện hành duy nhất của work. Không cộng task lịch sử như một lần hoàn thành mới.
- [Contract Session hiện hành](../../contracts/sessions.md), [contract thỏa thuận](../../contracts/proposal-learning-agreement.md), [workflow](../../workflow.md), [API guide](../../guides/api-client.md), [state/session](../../guides/state-and-session.md).
- [SRS 1.6](../../../../../docs/SRS_SkillHub_V1.6_VietLai_DongBoNghiepVu.docx) §18.18–18.20, §18.23, §18.33, §18.38. Thời lượng 60–180 phút, cutoff 60 phút đã chốt; policy hủy/no-show/timeout chưa chốt.
- Baseline working tree `be4738b9`, nhánh `feat/mobile-session`; thời điểm và kết quả audit tại [status](status.md). Không tự checkout/merge nhánh LiveKit chưa được xác định.

## Kết quả rà luồng trước triển khai

| Đoạn luồng                  | Đã có trong source                                                                    | Phần còn thiếu                                                                                                                         |
| --------------------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Calendar → Session detail   | GET mine/detail, UUID/participant guard, cache user/generation, loading/error/refresh | Kiểm lại runtime/API/native; xử lý cap 100 rõ ràng                                                                                     |
| LearningPlan → Session      | Path detail có sessions thật và outline; timeline đang render trạng thái buổi         | Nối card vào đúng Session.id; đưa context plan/version/nội dung buổi vào detail qua boundary công khai                                 |
| Danh sách Session theo Path | Đọc mine trong tháng rồi lọc Path                                                     | Không đủ để gọi là toàn bộ buổi của Path; dùng Path detail hiện có cho danh sách toàn Path hoặc giữ màn theo tháng với nhãn phạm vi rõ |
| Detail → hoàn thành         | Modal/POST/preflight/receipt/read reconcile đã có                                     | Schema chưa đọc progress; invalidation hiện tập trung sessions, chưa đồng bộ Path consumer                                             |
| Detail → đổi lịch           | Form draft, gửi bị khóa                                                               | Đọc proposal qua Path; READY/cutoff/state CTA; POST propose/confirm, stale/unknown/reload và lịch hiệu lực                             |
| Phòng học                   | Backend có contract; RoomScreen trong checkout là preview                             | Do nhánh LiveKit khác sở hữu, không phải task triển khai của phase này                                                                 |
| Session → report            | Backend có create/mine; mobile local preview                                          | Bàn giao Phase 08, không mở link Session thật vào editor preview                                                                       |

GAP-01 lịch sử không còn là “không có bất kỳ GET đọc proposal”: `GET /learning-paths/:id` hiện có version/appliedVersion/items/xác nhận. Serializer BigInt của detail cũng đã được xử lý trong source. Conflict tại confirm đổi lịch cuối vẫn cần bằng chứng backend; không đánh dấu mọi gap đã đóng.

## Trình tự và dependency

| Mốc                          | Kết quả                                                                            | Điều kiện                                                       |
| ---------------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| S01 Baseline & Contract      | Audit, contract và danh sách thiếu có nguồn                                        | Đã rà source; deployment chưa xác minh                          |
| S02 UI Foundation            | Reuse pattern và xác định dữ liệu/nút cần bổ sung                                  | S01; không làm lại theme hoặc phòng học                         |
| S03 Screen Slices            | Context/tiến độ → điều hướng/list → completion → read đổi lịch → mutation đổi lịch | Các lát cắt đầu làm độc lập; mutation đợi DEP-01/02/03/04       |
| S04 Navigation & Lifecycle   | Back/deep link/refetch/account switch đúng                                         | Các lát cắt liên quan đã nối                                    |
| S05 Integration & Edge Cases | Concurrent/stale/unknown/denial có kiểm chứng                                      | Backend test cho đổi lịch cuối; không dùng fixture để đóng gate |
| S06 Verification & Cleanup   | Checks, regression và docs đúng scope                                              | Source đã triển khai; ghi riêng phần unavailable                |
| S99 Review & Acceptance      | API hai tài khoản và Android/iOS                                                   | Môi trường test hợp lệ; LiveKit kiểm theo work nhánh khác       |

### S01 — Baseline và contract

- [x] P07-S01-T01 Rà source Session/Calendar/Path/Scheduling/Report và SRS; ghi contract hiện hành, so với gaps spec006 và xác định phần đã nối. Hoàn thành audit tài liệu, chưa chứng minh API/native.
- [ ] P07-S01-T02 Xác minh API đích: GET list/detail/Path ở hai participant, participant ngoài cuộc, mapping planVersion/sessionNo, proposal đang áp dụng/chờ confirm; ghi revision/môi trường đã làm sạch PII. Nguồn kế thừa: phần read của spec006/T016 và smoke của T019. Có thể tiếp tục S03 read/fixture khi chưa có môi trường.

### S02 — Tái sử dụng UI

- [x] P07-S02-T01 Dùng SessionPage/SessionFeedback, detail/modal/picker hiện có, Nunito/theme và timeline Plan làm nguồn thiết kế; xác định vị trí context/tiến độ, lịch hiện tại/lịch đề xuất, xác nhận A/B và CTA. Chưa có frame mới; không tuyên bố pixel-match. Không sửa room/card LiveKit do nhánh khác sở hữu. Shared component chỉ đổi nếu cần và kiểm consumer đang dùng.

### S03 — Hoàn thiện từng lát cắt

- [x] P07-S03-T01 **Context và tiến độ Session.** Mở rộng allowlist schema detail cho planVersion/outlineSessionNo và progress đúng contract; không buộc list mine có field chỉ detail mới trả. Cung cấp Path read/context qua public exports của learning-paths, dùng cùng HTTP/Auth/Query owner/generation. Match đúng Path/plan/version/sessionNo trước hiện nội dung buổi; mismatch/thiếu context không lấy outline khác hoặc bịa title. Detail vẫn đọc được nếu API context phụ lỗi; không fallback preview. Kiểm parser, participant, version mismatch, nullable/missing field và progress server sau một/hai confirmation.
- [x] P07-S03-T02 **LearningPlan và danh sách → Session thật.** Nối timeline đã có `plan.sessions` sang `/learning-sessions/[id]` bằng UUID server; buổi chưa tạo Session không có link giả. Cho `/paths/[id]/sessions` dùng projection sessions của Path để xem toàn Path, qua public boundary, giữ component/card hiện có và đọc detail riêng khi mở. Nếu giữ bộ lọc tháng phải công bố đúng phạm vi, không lấy mine cap 100 làm danh sách toàn Path. Calendar vẫn query theo tháng, cảnh báo cap 100; không thêm pagination/total giả. Kiểm ONE_WAY/TWO_WAY, nhiều tháng, Path có buổi ngoài 100 rows mine và direct link.
- [x] P07-S03-T03 **Completion và cập nhật consumer.** Giữ action/modal hiện có, không tạo route mới. Sau POST receipt/read reconciliation, cập nhật lại detail/list, progress và Path liên quan qua public boundary; lỗi tải Path không biến receipt thành thất bại hoặc kích hoạt POST lại. Một bên chỉ hiện chờ bên kia; không cộng progress, settle Credit hay đặt Path COMPLETED tại client. Regression double-submit, 401 không replay, timeout/lost response, receipt + refresh lỗi và đổi account. Nguồn kế thừa: nghiệm thu spec006/T019; implementation T011–T013 đã có.
- [x] P07-S03-T04 **Đọc đổi lịch sau khóa.** Tiếp nhận phần read spec006/T016: từ Session.pathId/planId/planVersion/outlineSessionNo lấy schedule.version/appliedVersion/items/A-B confirmations và Session hiệu lực qua GET Path. Hiện lịch cũ khác lịch đề xuất, đúng người đã xác nhận sau reload; Path A/B không suy từ teacher/learner. Sửa availability cho CONFIRMED/READY và cutoff; ONGOING/terminal/stale/denied khóa action. Có thể triển khai read/UI với mutation unavailable khi còn DEP-01. Kiểm malformed/mismatch, không proposal, applied=current, pending mới hơn và hai account có vai trò đảo trong TWO_WAY.
- [ ] P07-S03-T05 **Gửi và xác nhận đổi lịch.** Bắt đầu nối mutation thật khi SESSION-DEP-01/02/03/04 trong contract đạt. Tiếp nhận spec006/T017 và phần còn lại T016. POST propose với version schedule vừa đọc và UTC timestamps; không reason giả/auto-confirm tác giả. Confirm riêng đúng version cho mỗi người. Sau đủ confirm, GET Session/Path để lấy giờ hiệu lực rồi refresh Calendar/list/context. Không dùng PATCH sửa lịch trước khóa thay endpoint reschedule. Khóa gửi lặp; replayAfterRenewal false; uncertain giữ draft và reconcile trước gửi lại, read chưa đủ bằng chứng thì vẫn chặn. Không tự tăng version hoặc tự áp giờ theo receipt.

### S04 — Điều hướng và lifecycle

- [x] P07-S04-T01 Kiểm Calendar/Plan/Path list → detail → đổi lịch → Back; legacy `/session/[id]` vẫn mở detail thật. Deep link có fallback an toàn; ID mẫu không request/fallback. Focus/resume chỉ refetch reads; người dùng ở màn khác/account khác không nhận late response hoặc tự replay POST. Giữ boundary nhánh LiveKit: không sửa `/learning-sessions/[id]/room`; thống kê file chung schema/detail/runtime để đối chiếu khi ghép, không tự merge.

### S05 — Tích hợp và ca lỗi

- [ ] P07-S05-T01 Kiểm hai account reload cùng proposal/version: một confirm giữ giờ cũ, đủ hai đổi giờ theo server; stale version, exactly 60 phút/dưới cutoff theo giờ server, state đổi giữa preflight và POST, conflict phát sinh sau proposal/trước confirm cuối. Nguồn kế thừa: spec006/T020. Conflict cuối phải có evidence backend nguyên tử; client test không thay gate này. Denial sau cache success phải ẩn dữ liệu và khóa mutation.
- [ ] P07-S05-T02 Kiểm completion qua API và đồng bộ Path/progress: không settle theo buổi, dispute/backend từ chối hiển thị đúng; thiếu context phụ không che Session hợp lệ. Rà entry report để không cho Session UUID thật rơi vào ReportsPreview. Chỉ ghi dependency/handoff Phase 08; không mở editor local rồi báo đã gửi. Nhánh LiveKit tự sở hữu token/join/leave/reconnect; phase này chỉ giữ nguyên nguyên tắc rời phòng không gọi completion.

### S06 — Kiểm chứng và dọn phạm vi

- [ ] P07-S06-T01 Chạy focused Session/Path tests cho phần thay đổi rồi `pnpm --filter mobile lint`, `check-types`, `check-structure`, `test`. Kiểm consumer learning-paths nếu mở public exports/cache invalidation. Khi sửa UI/navigation, thêm web fixture/export và kiểm màn nhỏ, accessibility/font/Back theo phạm vi; không cần chạy checks backend hoặc Next.js. Ghi command, thời điểm, revision, pass/fail/skipped và giới hạn ở status.
- [x] P07-S06-T02 Cập nhật contract/status/matrix theo source sau triển khai; giữ spec006 lịch sử, không đếm lại evidence cũ thành nghiệm thu mới. Review diff chỉ mobile, không fixture fallback, không config/SDK/room ngoài scope. Rollback nếu cần: hoàn nguyên lát cắt mobile, khóa CTA mutation; không hoàn nguyên hoặc xóa dữ liệu lịch/completion/financial đã ghi ở server.

### S99 — Review và nghiệm thu

- [x] P07-S99-T01 Technical/UI review source/contract/diff và evidence các lát cắt; xác định rõ phần nào đã nối, phần nào unavailable, file nào cần phối hợp với nhánh LiveKit. Không tự ghi owner đã duyệt.
- [ ] P07-S99-T02 Nghiệm thu API hai tài khoản và Android/iOS theo bảng dưới; tiếp nhận spec006/T019/T020. Không đóng phase nếu reschedule vẫn gated hoặc API/native chưa đạt tiêu chí; có thể ghi source complete; acceptance pending. Việc điều chỉnh phạm vi để bỏ acceptance cần quyết định có nguồn.

## Ma trận hành vi

| Màn/route                                         | Dữ liệu và quyền                                  | Action                                               | Back và bằng chứng                                                  |
| ------------------------------------------------- | ------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------- |
| `/calendar`                                       | GET mine của owner, tháng/timezone/cap 100        | Mở đúng Session; refresh GET                         | List/empty/error/stale/denied; web + API + native                   |
| `/paths/[id]/plans/[planId]`                      | Path/plan thật, participant                       | Mở đúng actual Session của outline                   | Back về plan; chưa có Session không link mẫu                        |
| `/paths/[id]/sessions`                            | Path projection, đúng participant/plan/Session    | Chọn buổi, mở detail thật                            | History → Path; direct link fallback hợp lệ                         |
| `/learning-sessions/[id]`, legacy `/session/[id]` | Session + context Path đã match + progress server | Modal completion, vào đổi lịch nếu đủ điều kiện      | Lỗi context riêng; denial ẩn private cache; không mở report preview |
| `/learning-sessions/[id]/reschedule`              | Lịch hiệu lực + proposal/current version + A/B    | Propose/confirm khi đủ gate; stale/unknown giữ draft | Back về detail; focus/reload GET, không replay POST                 |
| Room/Report                                       | Nhánh LiveKit / work Phase 08                     | Không thêm tích hợp trong Phase 07                   | Không dùng preview như kết quả API thật                             |

Mỗi màn xét loading/empty/error/retry/stale/denied phù hợp; không tạo loading giả rồi giữ dữ liệu account cũ. UI mới tái sử dụng pattern đã nêu; chưa có native evidence cho phiên bản phase này.

## Kịch bản nghiệm thu

Môi trường: API test đã migrate/cấp quyền/config đúng, hai participant A/B, account C ngoài cuộc; ONE_WAY và TWO_WAY có Path đã khóa, Session ở nhiều tháng/trạng thái, proposal pending, buổi đã endAt để complete. Không ghi credentials vào docs. Các mutation chỉ chạy trên dữ liệu test được phép; report/settlement/thanh toán thật không thuộc kịch bản.

| #   | Thao tác                                                                         | Kết quả cần có                                                                                    |
| --- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 1   | Calendar và Plan mở cùng Session; direct link/Back                               | Cùng UUID/giờ/nội dung đúng version; không route mẫu                                              |
| 2   | Path trải nhiều tháng và Calendar chạm 100 rows                                  | Path list không bị cap mine làm thiếu; Calendar cảnh báo phạm vi đúng                             |
| 3   | A complete sau endAt, B reload rồi complete                                      | A chờ B; đủ hai mới COMPLETED; progress/Path đọc từ server, không gọi settle theo buổi            |
| 4   | A gửi reschedule, cả A/B reload, chỉ một bên confirm                             | Cùng proposal/version/confirmations; lịch cũ giữ nguyên                                           |
| 5   | B confirm đủ hai khi còn cutoff; thử stale/dưới cutoff/conflict mới              | Chỉ backend apply hợp lệ đổi giờ; Calendar/Path/detail đồng bộ; lỗi không bị che thành thành công |
| 6   | Double tap/lost response/401/refresh fail                                        | Không replay; receipt giữ; reconcile GET; uncertain không tự tạo version mới                      |
| 7   | C truy cập; A logout/đổi account giữa request                                    | Denied/không lộ cache; không late mutation/navigation sang phiên khác                             |
| 8   | Android/iOS: keyboard/picker, font lớn, hardware Back/gesture, background/resume | Không mất draft ngoài dự kiến, không gửi POST tự động; UI đọc được và tương tác đúng              |

Không có API/device thì ghi NOT_RUN, giữ acceptance mở. Media/camera/mic/token/reconnect do nhánh LiveKit kiểm riêng, không là điều kiện hoàn thành implementation Session của phase này.

## Câu hỏi và dependency

- **SESSION-DEP-01:** conflict nguyên tử ở confirm cuối; backend owner cần xử lý/xác minh qua công việc riêng, phase này không cấp quyền sửa backend.
- **SESSION-DEP-02/03:** API đích/read mapping và config test đúng SRS. Có thể triển khai phần read/schema/fixture trước.
- **SESSION-DEP-04:** proposeReschedule so cả buổi giữ nguyên trong candidate với chính Session đó trong otherSessions; lịch nhiều buổi có thể bị SCHEDULE_CONFLICT giả. Cần sửa/xác minh backend riêng trước khi mở mutation; xem diagnostic trong contract. Không sửa backend trong task UI.
- **LIVEKIT-HANDOFF:** chưa có tên/ref nhánh LiveKit; chỉ cần khi đối chiếu tích hợp giữa hai nhánh. Không chặn Session context/completion/đổi lịch, không tự chọn nhánh hoặc làm lại phần tích hợp.
- **REPORT-HANDOFF:** Phase 08 sở hữu report thật, evidence và owner detail/read gap. Giữ Session thật không đi editor preview.
- Không quyết định thay PO về completion timeout, auto-confirm, dispute window, cancel/no-show hoặc tiền phạt. Chúng không được thêm để đóng phase Session.
