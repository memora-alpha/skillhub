# Proposal Chat và thỏa thuận học

## Mục tiêu và phạm vi

Gộp phạm vi Phase 05–06 vào một work, gồm hai mốc: (1) Proposal & Chat; (2) Plan & Schedule. Người dùng đi từ Learning Request hoặc Sharing Skill → proposal → accept → conversation → chọn ONE_WAY/TWO_WAY → kế hoạch và điều khoản → lịch → final validation/finalize. Mỗi bước chỉ rõ ai cần thao tác, việc tiếp theo và đường về Chat. Không đánh lại số Phase 07 trở đi.

Chỉ sửa `apps/mobile`. Backend chỉ đọc; không sửa shared packages, cấu hình tài khoản hoặc dữ liệu thật. Giữ route tree, theme, components, HTTP/session/query runtime hiện có. Không dùng Spec Kit. Dependency icon được thêm theo yêu cầu thay icon trước đó. Ban đầu không commit/push; yêu cầu mới của người dùng ngày 2026-10-22 cho phép chia commit cục bộ sau khi rà lỗi và kiểm tra đạt. Không push.

Dạy thử là tính năng **tùy chọn dự kiến**, chưa có API trước LearningPlan. Chỉ ghi backlog/dependency; không có UI/mock/integration trong work này và không chặn tạo plan trực tiếp từ Chat. Session media, settlement/review/dispute, Wallet top-up và sửa API ngoài phạm vi.

## Nguồn và thiết kế

- [SRS 1.6](../../../../../docs/SRS_SkillHub_V1.6_VietLai_DongBoNghiepVu.docx): BR-12..22, 18.13, 18.32–33, 18.39; [domain rules](../../domain-rules.md).
- [Workflow](../../workflow.md), [state/session](../../guides/state-and-session.md), [testing](../../guides/testing.md).
- [Contract mobile](../../contracts/proposal-learning-agreement.md), đối chiếu controllers/DTO/services backend được dẫn ở đó.
- UI kế thừa Complete SkillHub Product Design/Figma Make theo [README](../../../README.md); chưa có frame mới trong yêu cầu. Reuse Panel, Copy, FormNotice, Button, ChoiceGroup, ControlledInput, ChatHeader và FeaturePage. Không tuyên bố pixel-match hoặc thiết kế mới đã được duyệt.
- Lịch sử: Phase 05 Proposal & Negotiation và Phase 06 Learning Plan & Scheduling từng là hai dòng dự kiến trong roadmap; work này tiếp nhận cả hai, không sửa các specs lưu trữ.

## Baseline source trước khi làm

- Git working tree sạch lúc bắt đầu. Proposal API, source-route guards, accept/recovery và chat HTTP/SSE/attachments đã có trong source, khác mô tả preview-only trong docs cũ.
- `learning-paths/api`, các màn `Api*` và wrappers UUID đã nối endpoints create/read/revise/confirm/schedule/final-validation/finalize. Preview vẫn riêng, có nhãn; không fallback từ API lỗi.
- Thiếu hướng dẫn bước hiện tại/ai phải làm tiếp. Các liên kết schedule/hold xuất hiện cả khi chưa đủ prerequisites. Entry tạo thỏa thuận đặt cạnh một form gợi ý Chat dài, chưa làm rõ đây là tùy chọn.
- Entry vẫn cho thao tác từ conversation cache khi refresh lỗi. Cần giữ read error nhưng khóa mutation phụ thuộc snapshot đó.
- Direct ONE_WAY đang hiển thị người gửi muốn dạy dù nguồn Sharing Skill là người gửi muốn học.
- Finalize có Idempotency-Key nhưng chưa có nút phục hồi chính xác lần gửi khi mất phản hồi. Các lệnh tạo path/plan/lịch không có server idempotency; phải đọc đối chiếu thay vì tự replay.
- Backend list path tối đa 100, không có lookup theo conversation hoặc pagination; khi không tìm thấy trong danh sách đầy phải chặn create để tránh trùng. Schedule hiện không có endpoint sửa/hủy lịch chưa khóa; ghi dependency, không invent endpoint.

## Sub-phase và task

S02 reuse UI gộp vào S03; S04/S05 thực hiện cùng từng lát cắt, không dựng fixture mới trước integration.

| Mốc                     | Kết quả                                                      | Phụ thuộc                   |
| ----------------------- | ------------------------------------------------------------ | --------------------------- |
| S01 Baseline & Contract | Audit SRS/source/routes/contracts, gaps và tiêu chí          | Không                       |
| S03-A Proposal & Chat   | Quyền/source đúng, Chat mở thỏa thuận rõ ràng                | S01                         |
| S03-B Plan & Schedule   | Bước tiếp theo theo vai trò, đủ plan/xác nhận/lịch, recovery | S01, S03-A                  |
| S06 Verification        | Regression và focused/workspace checks                       | Hai mốc source              |
| S99 Review & Acceptance | Technical review và kịch bản UAT có giới hạn thật            | S06; API/native environment |

- [x] P05-S01-T01 Audit implementation và backend contract; phân biệt source/fixture/deployment, ghi gaps và dạy thử dự kiến.
- [x] P05-S03-T01 Sửa diễn giải direct invitation; khóa mutation tạo thỏa thuận khi conversation chưa đọc được; giữ Chat/attachments/recovery đang có.
- [x] P05-S03-T02 Tạo projection bước tiếp theo từ snapshot API, theo ONE_WAY/TWO_WAY và vai trò; không tự quyết định outcome tài chính.
- [x] P05-S03-T03 Entry hướng dẫn tạo/mở path; projection ở path, lịch và Hold; chỉ mở action phù hợp prerequisites, có đường về Chat.
- [x] P05-S04-T01 Làm rõ form gợi ý Chat là tùy chọn; bỏ phụ thuộc preview store khỏi form thật, giữ draft trong phần gợi ý đang mở và trong phiên hiện hành; đóng phần gợi ý/rời route bỏ draft có thông báo.
- [x] P05-S05-T01 Recovery finalize dùng đúng intent/key cũ; unknown create/edit giữ draft, khóa gửi mới và dẫn đọc trạng thái để đối chiếu; không replay khi focus/reconnect.
- [x] P05-S06-T01 Regression hành vi/API/version/quyền/recovery; lint, typecheck, structure, full tests và web export.
- [x] P05-S99-T01 Technical review diff theo tiêu chí, ghi bằng chứng/giới hạn và kịch bản real API/native; không tự nhận người dùng đã nghiệm thu.
- [ ] P05-S99-T02 Nghiệm thu với hai tài khoản trên real API và Android/iOS: các nguồn Request/direct, ONE_WAY/TWO_WAY, keyboard/Back, concurrent edits, thiếu Credit/conflict và recovery. Hiện NOT_RUN; không đóng phase sản phẩm trước nghiệm thu.

## Tiêu chí nghiệm thu source

- Accept chỉ mở conversation; các hint proposal và Chat không thay confirm nghiệp vụ.
- ONE_WAY chỉ teacher tạo một plan; TWO_WAY mỗi teacher tạo chiều của mình, đủ hai plan đối ứng. Learner confirm version hiện tại; sửa plan/terms cần xem và xác nhận lại theo server.
- Bước tiếp theo ưu tiên phần người dùng có thể làm, hiển thị phần đang chờ đối tác. Không báo đã đủ plan/lịch khi thiếu chiều hoặc confirmation.
- Tạo lịch chỉ sau path và các plan đủ xác nhận; mỗi lịch đủ items và hai confirmations cùng version trước validation/finalize.
- Validation là đọc kết quả server; finalize mới Hold/lock/tạo Session nguyên tử trên server. Mất phản hồi không tạo intent mới khi recovery.
- Loading/error/empty/content và stale-with-error rõ; 403/404 không hồi sinh private data. Session cũ không được cập nhật/navigation/mutation.
- Preview vẫn tách khỏi API; không thêm dạy thử vào UI. Không hiển thị thành công từ client khi chưa có kết quả server.

## Ma trận hành vi và kiểm chứng

| Điểm vào/màn                     | Quyền và trạng thái                      | Action/side effect                                                 | Back/khôi phục                                      |
| -------------------------------- | ---------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------- |
| Request/Sharing Skill → proposal | Nguồn public hợp lệ, không tự gửi        | Create/edit/withdraw/reject theo contract; idempotent retry intent | Nguồn gốc hoặc danh sách proposals                  |
| Proposal nhận                    | Pending/version/source hiện hành         | Recipient accept → conversation, không Hold                        | Chat hoặc đọc lại khi conflict/expiry               |
| Chat → agreement-type            | Participant, đọc được conversation       | Tạo/mở path; gợi ý Chat tùy chọn                                   | Conversation cùng ID                                |
| Path/plan                        | Teacher/learner theo từng chiều          | Tạo/sửa plan; learner confirm; terms confirm                       | Path và Chat                                        |
| Schedule                         | Path CONFIRMED, plan CONFIRMED           | Teacher đề xuất; hai bên confirm cùng version                      | Path/Chat; refresh khi version conflict             |
| Hold                             | Đủ số plan/đúng chiều/confirmations/lịch | Server validation, finalize với Idempotency-Key                    | Đọc trạng thái; exact-intent retry khi mất phản hồi |

Automated: API adapters với transport fixture theo DTO thật, projection progression ở hai vai trò, thiếu/sai chiều, đổi version và state terminal, recovery/idempotency. Các test này không chứng minh deployment/native.

UAT cần hai tài khoản ACTIVE, API có migrations/grants/policies và ví test đủ Credit; không ghi credentials. Thử cả nguồn Request/direct, ONE_WAY và TWO_WAY; sửa trước confirm, chờ đối tác, thiếu/trùng lịch, thiếu số dư, mất phản hồi finalize, reload/focus/logout, keyboard và Back trên Android/iOS. Chỉ tác động tài khoản/ví test được cho phép. Nếu chưa có môi trường, ghi NOT_RUN.

## Dependency và rollback

- API readiness/policies/deployment, scanner/realtime và native UAT chưa được chứng minh bằng source. Không tự đặt giá trị production.
- Thiếu lookup path theo conversation, server idempotency cho create, sửa/hủy schedule chưa khóa: backend follow-up; dùng read/reconciliation và thông báo rõ trong phạm vi hiện hành.
- Dạy thử tùy chọn: cần backend booking/session độc lập trước plan; giá/thời lượng/quy tắc chưa chốt, làm sau. Không là blocker hiện tại.
- Rollback source chỉ gỡ UI/projection của work và giữ adapters/runtime/contracts tương thích; không xóa path, lịch, Session hoặc financial records.

## Điều chỉnh UX theo yêu cầu sau review

Phạm vi mới: đồng bộ toàn bộ UI của luồng, giảm màn trung gian và lấy chat làm nơi trao đổi/gửi lộ trình. Đây là kế hoạch trước đợt triển khai tiếp theo; giữ kết quả/lịch sử của đợt trước.

Luồng đích: gửi đề xuất → danh sách **Đã gửi** → recipient đọc/chấp nhận → Chat → tạo lộ trình mình dạy → gửi liên kết lộ trình qua tin nhắn → learner đọc chi tiết/xác nhận → hai bên xác nhận điều khoản ngay trong lộ trình → xếp lịch và chốt trên cùng màn lịch. TWO_WAY vẫn đủ hai plan đối ứng, không cho người gửi tạo thay teacher.

| Bề mặt          | Thiết kế và hành vi đích                                                                                                                                            |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Đề xuất         | Nhận được/Đã gửi rõ ràng, thẻ người dùng/kỹ năng/trạng thái; gửi thành công về Đã gửi; accept một action, đóng/rút xác nhận inline                                  |
| Tin nhắn        | Conversation rows có avatar/preview thật; không suy badge unread hoặc online từ SSE. Bong bóng trái/phải, thời gian gọn và ngày phân cách; bỏ hướng dẫn dài/CTA lặp |
| Tạo/mở lộ trình | Bỏ form gợi ý thương lượng dư; một entry tạo/mở; cuộc trò chuyện có đúng một path thì mở thẳng overview; sau tạo thỏa thuận đưa teacher thẳng vào editor            |
| Lộ trình        | Overview là thẻ tóm tắt thay vì toàn bộ outline lặp lại; detail để đọc toàn bộ và xác nhận; gửi link qua Chat bằng API messageText hiện có, không giả SYSTEM event  |
| Điều khoản      | Tóm tắt và sửa inline trên lộ trình; legacy terms route trỏ về đây                                                                                                  |
| Lịch            | Dùng chọn ngày/giờ theo pattern app; xác nhận, validation và Hold trên màn lịch; legacy hold route trỏ về đây                                                       |

Tham khảo chính thức: [Superprof request accepted](https://www.superprof.com/help/students/manage-my-requests/request-accepted/8/), [Preply Messages](https://help.preply.com/en/articles/4179497-how-to-send-a-message-to-your-tutor), [Calendly booking details](https://calendly.com/help/calendly-scheduling-notifications). Tham khảo kiến trúc thông tin/thao tác, không sao chép visual hoặc rule trial/payment. Màu/font/layout theo theme và shell SkillHub hiện hành, áp dụng Expo Design System vào hệ thống đang có.

- [x] P05-UX-T01 Proposal direction tabs, landing Đã gửi và accept/close inline.
- [x] P05-UX-T02 Inbox rows và chat bubbles/date separators, bỏ hướng dẫn/CTA dư; giữ history/read/delivery/attachments.
- [x] P05-UX-T03 Entry tối giản, plan summary/detail, gửi link nội bộ qua Chat; mở link vẫn kiểm quyền qua API và cảnh báo version cũ.
- [x] P05-UX-T04 Terms inline, lịch với picker và finalize embedded; legacy routes có compatibility redirect.
- [x] P05-UX-T05 Regression/navigation/sharing và workspace checks; visual review nếu môi trường chạy được; phân biệt real API/native acceptance.

Link chia sẻ chỉ là lời nhắn của participant, không phải bằng chứng xác nhận. Không thêm endpoint/SYSTEM metadata giả; API thiếu lịch sử plan version thì hiển thị current version rõ ràng. Các thay đổi shared UI trong mobile phải giữ default cho consumer khác. Dạy thử vẫn ngoài phạm vi.

## Tinh chỉnh sau phản hồi màn lộ trình và Back

Header Chat dùng **Thỏa thuận**: không gian chung của conversation, gồm plan bạn học và plan bạn dạy (ONE_WAY một chiều, TWO_WAY hai chiều). Thẻ plan trong tin nhắn chỉ mở chi tiết plan đó; gửi thẻ là cách thông báo, không tạo một bản plan riêng. Overview phân biệt vai trò rõ, giảm CTA/nội dung trùng; phần điều chỉnh Credit thu gọn. Giữ theme/components và contract hiện hành.

- [x] P05-UX-T06 Đổi tên header/màn chung; nhóm rõ Bạn học/Bạn dạy, gọn bước tiếp theo và điều khoản.
- [x] P05-UX-T07 Thẻ Chat mang nguồn conversation; detail Back theo history với fallback đúng Chat cả loading/error, không đẩy sang danh sách cá nhân. Xác nhận plan giữ màn detail, tiếp tục thỏa thuận bằng action rõ ràng.
- [x] P05-UX-T08 Regression cho shared detail/loading/error/confirm và overview Back; checks source và visual fixture, ghi riêng giới hạn native/real API.

Nghiệm thu: Chat → thẻ plan → chi tiết → Back về chính Chat; header → thỏa thuận chung → chi tiết → Back về thỏa thuận; overview Back về nơi mở. Confirm không tự đổi màn. Plan của đối tác và plan của mình cùng conversation được phân biệt theo Bạn học/Bạn dạy. Không render plan thuộc conversation khác khi link gửi có nguồn không khớp snapshot được cấp quyền.

## Triển khai thỏa thuận theo từng bước

Theo yêu cầu tiếp theo: **Cách học → Lộ trình → Lịch học**. Màn chung chỉ hiển thị nội dung bước đang chọn; bước hoàn tất có thể xem lại. Cách học gồm ONE_WAY/TWO_WAY, vai trò và Credit; cả hai xác nhận bản hiện hành mới mở tạo/sửa/confirm plan. TWO_WAY cho hai teacher làm song song. Đủ plan/terms và path CONFIRMED mới mở lịch. Mỗi bề mặt một CTA chính; chờ đối tác có trạng thái thay nút lặp. Chat luôn truy cập được, thẻ vẫn mở detail và Back đúng nguồn.

Đối chiếu backend: POST path/confirm cho phép xác nhận terms trước khi có plan; trạng thái path chỉ CONFIRMED khi đủ plans. Add plan không tăng path version, revise plan/terms tạo version mới xóa confirmations chung. Không thêm endpoint riêng hoặc coi lựa chọn/form submit là xác nhận backend. Gửi đề xuất tạo path; mỗi bên xác nhận bằng action riêng ở bước Cách học (kể cả người tạo); khi version đổi quay lại bước này và giải thích cần xác nhận lại. Không auto-confirm/replay mutation.

- [x] P05-UX-T09 Projection ba bước và policy mở plan sau hai confirmations; regression đổi version, ONE_WAY/TWO_WAY, khóa và deep link.
- [x] P05-UX-T10 Tách bề mặt Cách học/Lộ trình/Lịch học, step indicator và action theo vai trò; tạo path về bước đầu, giữ navigation/recovery hiện hành.
- [x] P05-UX-T11 Kiểm chứng command confirm sớm, unknown/read error không mở bước, native/API limits và cập nhật docs/status.

Nghiệm thu source: chưa đủ hai confirmations thì không có form tạo/sửa/confirm plan, kể cả deep link; thẻ nhận vẫn đọc được. Hai confirmations chuyển bước Lộ trình dù status path còn PROPOSED/PARTIALLY_CONFIRMED. Sửa plan/terms về bước Cách học của version mới; đủ plan xác nhận nhưng path status chưa CONFIRMED không mở lịch hoặc Hold. Không thay backend, không fixture fallback ở runtime.

## Giảm thao tác xác nhận và nút phụ

Phản hồi mới thay UX của đợt trước: mở Chỉnh sửa chỉ mở form; nút **Gửi và đồng ý thay đổi** thực hiện revise rồi confirm chính người gửi ở version vừa lưu. Tạo mới dùng **Gửi và đồng ý cách học** tương tự. Đối tác vẫn xác nhận riêng; không tự coi PATCH/create thành confirmation nếu chưa nhận command confirm thành công/snapshot mới. Giữ identity đã lưu trong cùng intent để retry confirm không lặp save; save chưa rõ kết quả phải đọc đối chiếu, không tạo lại tùy ý.

- [x] P05-UX-T12 Gộp submit và self-confirm bằng API hiện hành; regression partial success/session/version và không ghi nhận thay đối tác.
- [x] P05-UX-T13 Bỏ nút Về cuộc trò chuyện/Kiểm tra cập nhật ở trạng thái thường; giữ Back đúng nguồn và recovery chỉ khi lỗi. Authorized detail đọc cập nhật mỗi 8 giây khi màn focus/app active, dừng blur/background/error/terminal/logout; chỉ GET, không replay mutation.
- [x] P05-UX-T14 Checks/visual và cập nhật contract/status; không thay auth/login/backend.

## Rà màn trung gian và lịch sử điều hướng

Audit sau phản hồi: Entry map ApiPathCard trước khi useEffect replace nên có thể ló danh sách khi mở một thỏa thuận; Back fallback của overview đang tải còn trỏ My Learning. Plan save/tiếp tục dùng replace/push có thể giữ hai bản detail/overview; schedule save có nguy cơ tương tự. Giữ route cũ cho deep link/preview nhưng không đưa chúng thành bước thao tác thường.

- [x] P05-UX-T15 Chat đọc lookup hiện hành trước khi push, mở thẳng đúng path khi chỉ một kết quả; Entry direct/legacy không vẽ card khi sắp chuyển. Source conversation được validate để Back loading/error về Chat.
- [x] P05-UX-T16 Rà plan edit/save/continue, schedule edit/save, proposal edit/send và attachment; dùng history khi Back và dismissTo khi quay về màn đã có để không lặp detail/list. Không đổi AuthNavigator/route tree toàn app nếu không có bằng chứng cần thiết. Attachment bỏ nút Trở lại chat trùng header Back; các nút recovery upload/delivery vẫn giữ đúng trạng thái.
- [x] P05-UX-T17 Regression navigation async/stale session/loading/error và visual fixture, ghi giới hạn stack native/API thật trong status.

## Thu gọn danh sách chat theo ảnh tham chiếu

Nguồn: ảnh người dùng cung cấp ngày 2026-10-20 (card trắng trên nền sáng, banner đề xuất, avatar bên trái). Áp dụng cấu trúc và mật độ, giữ avatar tròn/theme app; không cần đưa toàn bộ badge/nội dung trong ảnh lên card. Mỗi card chỉ gồm tên, thời gian và một dòng tin nhắn gần nhất, bỏ subtitle bài đăng và badge kỹ năng để tên có đủ chỗ. Một banner mở danh sách đề xuất thay hai nút lớn; bản API và preview dùng cùng presentation. API không có unread/skill/search metadata thì không suy hoặc thêm fixture; giữ list pagination, retry và navigation.

- [x] P05-UX-T18 Đồng bộ card chat gọn và banner đề xuất; xem ở 390px/320px, kiểm mở chat/đề xuất và các checks mobile phù hợp. Native/API thật ghi riêng.

## Phân biệt các chat cùng một người

Theo phản hồi tiếp theo, bổ sung lại một dòng ngữ cảnh thay cho badge/subtitle dài: Learning Request dùng tiêu đề bài đăng, lời mời trực tiếp dùng tên kỹ năng; mã đề xuất ngắn giúp phân biệt cả khi trùng chủ đề. Card và header Chat cùng ngữ cảnh. Không coi conversation là một plan duy nhất: conversation gắn proposal, TWO_WAY có hai plan và có thể chưa tạo plan. Đọc metadata qua GET proposal/request/skill hiện có, kiểm identity/membership, dùng runtime/cache theo session; metadata không khả dụng dùng nhãn nguồn và mã thay vì đoán. Không ghép chat theo user hoặc thay API backend.

- [x] P05-UX-T19 Bổ sung ngữ cảnh ba dòng ở card và dưới tên header; API/preview cùng presentation, avatar tròn, ellipsis giữ card gọn. Kiểm nguồn/identity/read failure và hai chat cùng đối tác, các checks và visual fixture; ghi giới hạn API/native.

## Ưu tiên tin nhắn và làm rõ trạng thái chưa đọc

Phản hồi tiếp theo: chủ đề/mã đang tranh sự chú ý với nội dung chat. Tham khảo cách [Messenger hiển thị tin chưa đọc](https://www.digitbin.com/find-unread-messages-in-messenger/) (ảnh/chỉ dẫn giao diện bên thứ ba), dùng tên và preview đậm + chấm màu bên phải, giữ màu app và avatar tròn. Dòng thứ hai là tin nhắn; chủ đề xuống dòng cuối nhỏ/xám. Bỏ icon sách theo phản hồi tiếp theo. Ẩn mã kỹ thuật trên card, giữ mã trong header/accessibility để phân biệt khi cần. Không sao chép màu xanh/presence hay badge tổng chưa có API.

Backend history tính readAt của incoming theo watermark của viewer; outgoing readAt là trạng thái đối tác đã đọc, không được dùng để suy người dùng có tin mới. Dựa incoming chưa đọc trong trang history hiện có để hiện chấm, không đếm hoặc coi dữ liệu thiếu là tổng số chưa đọc. Khi SSE message/read updated, hydrate qua GET và cập nhật preview; không clear optimistic lúc chỉ bấm card. Giới hạn backend chưa có unread summary cho mọi trang được ghi trong status.

- [x] P05-UX-T20 Tách thứ bậc tin nhắn/chủ đề, trạng thái chưa đọc đúng readAt, SSE read refresh preview; regression own/incoming/read/error và visual trước/sau đọc ở màn nhỏ. Giữ scope mobile/runtime, phân biệt real API/native. Bỏ icon sách theo phản hồi trong lượt kiểm tra.

## Chat mới nhất, avatar hồ sơ và gửi lại form đã xác nhận

Phản hồi tiếp theo mở rộng màn Chat: vào màn lấy trang mới nhất, bắt đầu ở cuối hội thoại, lướt lên tải trang cũ và giữ vị trí; tin mới không kéo người đang đọc lịch sử xuống. Header gọn, avatar inbox/header/bubble dùng avatarUrl của public profile, fallback initials khi thiếu/lỗi. Tái sử dụng theme/runtime và HTTP history cursor hiện có, không dùng API giả hoặc đổi thứ tự server.

Sau confirm cách học/plan/lịch thành công, gửi lại form dưới dạng thẻ messageText có liên kết trong cùng conversation. Đây là tin nhắn của người thực hiện, không giả SYSTEM event hoặc dùng thẻ làm bằng chứng nghiệp vụ; mở thẻ vẫn đọc authorized snapshot/đúng version. Gửi form dùng clientMessageId của exact confirmation intent, tách lỗi gửi khỏi kết quả confirm; retry chỉ form cùng ID, không gọi lại confirm. Pending/unknown có GET delivery và retry thủ công, không replay khi focus/reconnect. Backend chưa có outbox nguyên tử cho confirm→chat: app tắt giữa hai bước hoặc process restart có thể thiếu thẻ Chat; ghi dependency, không sửa backend. Cho phép gửi tin theo thao tác xác nhận được người dùng yêu cầu, không gửi tới người ngoài conversation.

- [x] P05-UX-T21 Trang mới nhất khi vào Chat, inverted list/tải cũ khi lướt lên, giữ anchor, nút về tin mới khi đang đọc cũ; regression pagination/concurrent read.
- [x] P05-UX-T22 Header/avatar hồ sơ và card Chat thống nhất, ảnh lỗi có fallback; bảo toàn preview/navigation/read receipts.
- [x] P05-UX-T23 Tự gửi lại form vào Chat sau confirm cách học (gồm create/revise+self-confirm), plan và schedule; parser/card/recovery gửi thẻ riêng và chống gửi trùng theo exact intent. Không tích hợp notification. Ghi dependency backend nguyên tử.
- [x] P05-UX-T24 Checks/source/UI fixture với lịch sử nhiều trang, avatar, xác nhận/gửi lại form; cập nhật contract/status, phân biệt real API/native acceptance.


## Tinh chỉnh Chat theo ảnh thiết bị

- [x] P05-UX-T25 Căn ngữ cảnh yêu cầu học dưới avatar/header; card form gọn, CTA thống nhất, bảo toàn detail/version. Chỉ một receipt avatar ở outgoing có sequence lớn nhất đã được đối tác đọc, không lặp ở mọi bubble.
- [x] P05-UX-T26 Sửa cache-only confirmed-form-deliveries bằng skipToken, kiểm mount không cảnh báo/query tự chạy, giữ retry thủ công; regression receipt/order/incoming/unread, checks và visual màn nhỏ. Không sửa backend.


## Bố cục Thỏa thuận theo ảnh tham chiếu

- [x] P05-UX-T27 Thanh tiến trình nối ba bước, nhãn trạng thái và phần Cùng đối tác/mã thỏa thuận; giữ typography/theme app.
- [x] P05-UX-T28 Khối cách học với badge, nguyên tắc tạo plan, Credit và hai hàng xác nhận kèm tiến độ 0–2/2, CTA chính/phụ cuối card. Bảo toàn edit/confirm/share/retry và ONE_WAY/TWO_WAY; không chép nhãn người khởi tạo, online hoặc cam kết hoàn Credit chưa có dữ liệu.
- [x] P05-UX-T29 Checks source/host + visual màn nhỏ, trạng thái chờ/xác nhận/edit, cập nhật bằng chứng riêng với API/native acceptance.


## Đồng bộ style button và card toàn mobile

- [x] P05-UX-T30 Theo yêu cầu mở rộng của người dùng: chỉnh tokens theme/nút dùng chung, bo tròn vừa phải, palette trung tính xám sáng cho nền/card/nút phụ, giữ font và semantic status/error. Rà card/control còn hardcode radius ở các consumer chính (auth/discovery/calendar/profile/skills); chỉ apps/mobile.
- [x] P05-UX-T31 Kiểm chữ trắng trên primary, enabled/disabled/pressed, type/lint/full tests/export và visual đại diện login/Thỏa thuận/card ở màn nhỏ; ghi shared consumer impact và giới hạn native/API.

- Điều chỉnh T30 theo phản hồi tiếp theo: nút phụ/card trung tính xám sáng, không dùng cam đào trùng card Credit. Button bo 10px thay 14px, card giữ 20px.
- [x] P05-UX-T32 Thu gọn màn Thỏa thuận ở trạng thái xem thường để vừa viewport điện thoại: giảm khoảng trống/lặp nội dung, giữ đủ phân công/Credit/hai xác nhận/CTA và font theme. Không cắt nội dung quan trọng; form chỉnh sửa/lỗi và font accessibility vẫn phải truy cập được.


## Editor lộ trình theo ảnh tham chiếu

- [x] P05-UX-T33 Tách editor trình bày khỏi screen, chip kỹ năng chọn theo ID, mục tiêu có counter theo giới hạn API, danh sách buổi thêm/sửa/xóa thay textarea mỗi dòng; giữ font/theme/button mới.
- [x] P05-UX-T34 Giữ đúng quyền teacher, current version, uncertainty/recovery, lưu→detail→share. Kiểm 1–100 buổi/2.000 ký tự nội dung và mục tiêu 1.500 ký tự; giữ newline trong một buổi. Không bịa thời lượng/reward hoặc lưu nháp bền khi API chưa hỗ trợ; không dùng template/fixture thay API.
- [x] P05-UX-T35 Regression mapping/validation/save/navigation, checks và visual tạo/sửa/số buổi ở màn nhỏ; phân biệt API/native acceptance.

- Bổ sung T33 theo phản hồi: bỏ card bao ngoài/intro/tổng kết và chú thích lặp; label/body dùng typography app 15px, phụ 13px. Chỉ hiện kỹ năng đang chọn, Xem thêm mở danh mục, chọn xong tự thu gọn; pagination chỉ hiện trong danh mục đang mở. Save ghim dưới cùng, giữ cảnh báo sửa phiên bản cần xác nhận lại.

- Điều chỉnh T33 theo mẫu HTML người dùng cung cấp ngày 21/10: dựng bằng React Native, từng khối kỹ năng/mục tiêu và từng buổi có nền sáng, tìm kiếm trong danh mục đã tải kèm tải thêm; giữ chọn theo UUID, Xem thêm và nút lưu cố định. Không chép status bar giả, nháp, thời lượng hay tự động gửi khi chỉ lưu. Mẫu chỉ là nguồn bố cục.
- [x] P05-UX-T36 Khôi phục màn Thỏa thuận học về spacing/cỡ chữ app trước bản thu nhỏ T32; không ép vừa một viewport bằng chữ nhỏ. Giữ tiến trình và hành vi xác nhận hiện có; kiểm source/consumer và ghi rõ giới hạn visual/native.

## Editor đề xuất lịch theo mẫu HTML ngày 21/10

- [x] P05-UX-T37 Dựng màn Đề xuất lịch tôi dạy bằng React Native theo mẫu: tổng quan số buổi, chọn thứ/ngày giờ/thời lượng để điền lịch tuần, danh sách buổi gắn outline và chỉnh riêng, footer gửi cố định. Giữ font/cỡ chữ theme. Không nhúng HTML, giả status bar/Google Meet, lưu nháp hoặc hứa settlement theo buổi.
- [x] P05-UX-T38 Sinh đúng số buổi theo thứ đã chọn từ ngày bắt đầu (giờ địa phương), áp dụng có chủ đích và xem lại/chỉnh riêng trước gửi. Giữ validation tương lai/thứ tự/60–180 phút, đúng plan version, teacher gating và unknown recovery; không tạo recurrence API hay sửa lịch đã gửi.
- [x] P05-UX-T39 Checks generator biên/ngày/thời lượng/số buổi, mapping/save và UI fixture màn nhỏ; cập nhật status, phân biệt source/fixture/API/native.

## Bước Lộ trình trong Thỏa thuận theo mẫu ngày 21/10

- [x] P05-UX-T40 Dựng React Native theo mẫu: đối tác/avatar/mã, tiến trình hiện có, banner phân công, hai card đối ứng có trạng thái chờ/tạo/đã có/xác nhận và CTA đúng vai trò. ONE_WAY chỉ hiện chiều thực tế; giữ font/cỡ chữ app, không giả online/verified/kỹ năng chưa có/notification.
- [x] P05-UX-T41 Đọc chi tiết/tạo lộ trình và quay lại Chat/xem cách học không thêm màn trung gian; giữ teacher/version/confirmation gates, không coi duyệt plan là đã Hold/kích hoạt. Kiểm states/route/blocked và preview màn nhỏ; cập nhật status với giới hạn API/native.

- [x] P05-UX-T42 Tinh chỉnh card plan đã tạo: vai trò/đối tác và trạng thái cùng header, mục tiêu là nội dung chính, kỹ năng/số buổi/version là thông tin phụ; bỏ khối lồng và nội dung phân tán. Đồng nhất Cùng đối tác/avatar ở mọi bước và nối ảnh hai hàng xác nhận Cách học; giữ API/version/navigation, kiểm consumer và visual.

- [x] P05-UX-T43 Chi tiết LearningPlan theo mẫu HTML: tổng quan kỹ năng/version/số buổi, vai trò, mục tiêu, danh sách buổi đánh số, trạng thái xác nhận và khối chia sẻ riêng bằng React Native/theme app. Giữ quyền teacher/learner, exact version, share/recovery/Back; không giả thời lượng hoặc trạng thái từng buổi. Checks liên quan và visual hai vai trò/màn nhỏ, ghi giới hạn API/native.

- [x] P05-UX-T44 Thiết kế lại bước Lịch học trong Thỏa thuận theo mẫu HTML bằng React Native: giữ context/avatar/stepper chung, khối trạng thái chờ, lịch từng chiều với kỹ năng/phiên bản/trạng thái thật, CTA progression và mở Chat. Bảo toàn ONE_WAY/TWO_WAY, cả hai xác nhận cùng version, final validation/Hold/backend quyết định Session. Không giả online/verified/đang chọn giờ/bảo lãnh hoặc tự gửi nhắc lịch. Kiểm states/route/blocked và visual 390/320px, ghi giới hạn API/native.

- [x] P05-UX-T45 Lịch của từng kế hoạch theo mẫu bằng React Native: banner tóm tắt, card kỹ năng/vai trò/trạng thái, hàng ngày giờ và thời lượng suy từ timestamps, hai xác nhận riêng, empty state/Chat. Giữ confirm/version/share/recovery/final validation và Session thật; không giả notification hoặc gửi nhắc. Theme/font app, checks và visual màn nhỏ.

- [x] P05-UX-T46 Hành trình của tôi/tab Lộ trình theo mẫu: segmented tabs hiện hữu, lọc Tất cả/Đã xác nhận/Đang trao đổi với số lượng trong dữ liệu đã tải; card avatar/profile, updatedAt, version, status, hình thức học và CTA. Giữ tab requests/shell/routes, không fake verified/notification/lịch sử hoặc số buổi/thời lượng/ready chưa có trong summary API. Checks filter/navigation/consumer và visual 390/320px, cập nhật status.

## Đồng bộ icon toàn mobile

- [x] P05-UX-T47 Rà icon toàn app, dùng Lucide React Native qua Icon chung với mapping semantic và kích thước/màu theme; giữ props/filled/accessibility và logo thương hiệu. Nguồn [Lucide RN](https://lucide.dev/guide/react-native/getting-started), SVG dependency có sẵn. Chỉ thêm dependency mobile và root lockfile cần thiết, không đổi SDK/backend/shared packages.
- [x] P05-UX-T48 Thay glyph icon rời trong các màn bằng component chung (không thay ký tự trong nội dung nghiệp vụ), kiểm source/test đầy đủ và export/visual đại diện auth/shell/chat/learning/profile; ghi giới hạn native/API và các consumer được ảnh hưởng.

## Đề xuất theo mẫu HTML ngày 21/10

- [x] P05-UX-T49 Dựng lại danh sách Đề xuất bằng React Native: bộ lọc chiều gửi/nhận gọn, lọc status thu mở, card kỹ năng/gợi ý/đối tác/avatar/ngày/trạng thái/lời nhắn và CTA riêng. Giữ typography/theme/Lucide/shell app; không giả verified, tổng hoạt động, category hoặc đơn vị Credit/buổi chưa có.
- [x] P05-UX-T50 Bảo toàn search trên dữ liệu đã tải, API status/direction/pagination/refresh/error, detail/withdraw confirmation và conversationId thật khi mở chat; không accept/Hold trên list. Checks liên quan và visual 390/320px; ghi giới hạn API/native.

## Tinh giản lộ trình theo phản hồi ngày 21/10

- Hủy theo phản hồi người dùng, đã hoàn tác — P05-UX-T51 Bỏ nền/card lặp ở chi tiết lộ trình: mục tiêu chữ thuần, nội dung buổi theo danh sách có đường phân cách, vai trò/metadata gọn, chỉ nhấn màu trạng thái cần thiết; khối chia sẻ nhẹ. Giữ font/theme và toàn bộ nội dung/quyền/version/actions.
- Hủy theo phản hồi người dùng, đã hoàn tác — P05-UX-T52 Thu gọn card Bạn học/Bạn dạy ở bước Lộ trình: kỹ năng làm tiêu đề, vai trò/đối tác/status rõ, mục tiêu và metadata liền mạch, CTA phù hợp; empty state không lồng icon/card lớn. Giữ ONE_WAY/TWO_WAY, create/confirm gates, kiểm route/regression và visual 390/320px.

## Card lộ trình theo ảnh 22567fe4 ngày 21/10

- [x] P05-UX-T53 Chỉnh riêng card Bạn học/Bạn dạy theo ảnh: header vai trò/đối tác/status, mục tiêu làm tiêu đề, kỹ năng/số buổi/version, thông báo đã xác nhận, hàng CTA gọn có sửa đúng quyền. Giữ font/theme, shell/guide/stepper và màn chi tiết đã khôi phục; không giả title riêng hoặc quyền sửa.
- [x] P05-UX-T54 Kiểm teacher-only edit/blocked/locked, ONE_WAY/TWO_WAY, đọc/confirm/create route, lint/typecheck và visual 390/320px; ghi rõ fixture/API/native.

## Chi tiết lộ trình theo HTML 566d6ed7

- [x] P05-UX-T55 Dựng tổng quan/roles, mục tiêu, danh sách buổi riêng và trạng thái/action theo mẫu bằng React Native; giữ font/theme/Lucide, exact-version/teacher/learner/share/Back. Không giả duration/checklist hoặc đủ điều kiện Hold khi chỉ confirm plan.
- [x] P05-UX-T56 Đối chiếu contract về chi tiết buổi học tùy chọn; người dùng xác nhận tiêu đề bắt buộc/mô tả tùy chọn khi tạo lộ trình; lưu plain text theo contract content hiện có. Không thêm field ngoài API hoặc mất dữ liệu im lặng. Checks route/progression/share và visual detail 390/320px; ghi dependency/giới hạn.

## Đề xuất lịch theo HTML 94e5c2d7

- [x] P05-UX-T57 Dựng lại editor lịch theo mẫu: bỏ banner lớn, header lịch tuần/mô tả gọn, chọn thứ và presets 60/90/120/180, status thật sau apply, card từng buổi có ngày giờ/timezone/nội dung title + optional description và edit. Giữ font/theme/Lucide/date picker và save footer.
- [x] P05-UX-T58 Giữ finite generation/expectedPlanVersion, submit/uncertainty/refetch gates; không 45 phút/recurrence API/draft giả. Checks generator/form và visual 390/320px, ghi giới hạn native/API.

- [x] P05-UX-T59 Theo xác nhận tiếp theo: bỏ nút Áp dụng, tự điền schedule items khi người dùng đổi thứ/ngày giờ/thời lượng đủ hợp lệ. Chỉ tính local, không mutation; rerender/refetch không tự điền lại hoặc ghi đè chỉnh riêng, disabled chặn apply. Kiểm handler/generator/form.

- [x] P05-UX-T60 Thay thế T59 theo yêu cầu mới: khôi phục nút Áp dụng, chỉ nhấn nút mới generate/replace array; đổi lựa chọn và rerender không làm mất các chỉnh sửa riêng. Ghi chú rõ ghi đè khi apply; kiểm invalid/disabled và hồi quy giữ lịch đã sửa, không tự gửi API.

- [x] P05-UX-T61 Hài hòa màu riêng editor lịch theo phản hồi: cam cho CTA chính/lựa chọn thứ nhẹ, neutral cho presets/Apply/badge buổi, success xanh lá, note chốt lịch xanh xám dịu. Thêm semantic info tokens không đổi consumer khác; giữ apply có chủ đích/API và kiểm checks/visual.

- [x] P05-UX-T62 Đồng nhất footer ba bước: primary theo progression/existing confirmation gate, dưới là Chat và review/chỉnh sửa dạng link; bước2 xem lại cách học, bước3 xem lại lộ trình trong cùng screen. Dùng component chung, không thêm stack hoặc bypass exact-version/Hold. Checks method/plans/schedule/route và visual.

- [x] P05-UX-T63 Compact ChatHeader theo ảnh: avatar/name và context cùng hàng với Thỏa thuận, bỏ context strip lớn, giữ font/theme/identity/a11y, không giả verified. Sửa empty hint trong inverted list không bị lật.
- [x] P05-UX-T64 Audit xác nhận lịch→confirmed form; regression exact schedule/plan/version, lỗi confirm không share. Render gợi ý thương lượng cũ gọn và chưa xác nhận, không giả nó là schedule confirmed. Checks và visual fixture/header/empty/forms, ghi API/native giới hạn.

- [x] P05-UX-T65 Sửa nhận diện confirmation có query separator `&amp;` như ảnh thực tế: plan/schedule trở lại ChatWorkflowCard Đã xác nhận, không lộ URL kỹ thuật. Chỉ giải mã separator trong query; giữ title/summary, ID/version và navigation hiện hành. Regression escaped/raw links, version mismatch và ID sai; typecheck/lint. Không viết lại lịch sử hoặc gửi lại message; chưa kiểm native/API trực tiếp.

- [x] P05-UX-T66 Màn Lịch của từng kế hoạch theo HTML eb4b812f: giữ React Native/font/theme; làm rõ ONE_WAY/TWO_WAY và hai chiều Bạn dạy/Bạn học, trạng thái/xác nhận riêng. Hiện tiêu đề outline theo sessionNo trong lịch dự kiến lẫn Session đã tạo, thiếu tiêu đề thì fallback Buổi N. Giữ ngày giờ/version/permissions/final validation; không thêm notification/nhắc lịch giả. Kiểm mapping, hai hình thức và consumer, lint/typecheck; ghi giới hạn visual/API/native.

- [x] P05-UX-T67 Hiển thị đủ hai chiều học theo agreement ở lịch chi tiết và Thống nhất lịch, phân biệt thiếu plan/chưa có schedule/chờ xác nhận. Card chờ có calendar và nút Nhắc đối tác qua chat, mở đúng conversation không tự gửi/push; không giả online/đang chọn giờ. Giữ ONE_WAY một chiều và gates tạo lịch/Hold; test chiều trống, hai bên, blocked/navigation và visual fixture.

- [x] P05-UX-T68 Inbox đẩy cuộc trò chuyện có tin mới lên đầu theo preview/thread cache cùng owner/session; gửi/nhận đều cập nhật, timestamp hòa giữ thứ tự, không thêm API N+1. SSE chỉ refresh preview liên quan khi có tin mới. ConnectionFeedback dùng dòng nhẹ và retry nhỏ; 429 không có nút retry, PathReadFeedback không tạo nút riêng. Giữ error/permission/unknown-command gates, test sort/cache events/feedback và checks liên quan.

- [x] P05-UX-T69 Chat gom giờ theo đoạn: mốc đầu history đã tải/sang ngày/cách từ15 phút; bỏ giờ từng text/form card. Tin cùng người liên tiếp sát nhau và avatar cuối nhóm, giữ spacer canh hàng; không thay thứ tự/inverted/pagination/read receipts. Kiểm boundary/đổi người/SYSTEM/qua ngày, checks và visual fixture; giữ font/theme.

- [x] P05-UX-T70 Audit câu hỏi sửa sau xác nhận có phải làm lại bước1: đối chiếu reviseAgreement/revisePlan/current schedule projection, mobile progression/gates và SRS1.6 BR-19/FR-PATH-04/SCH-007. Ghi rõ xác nhận lại khác tạo lại, plan đối ứng giữ gì, lịch bị loại khỏi bản hiện hành ra sao; ghi dependency selective invalidation/no-op, không tự đổi backend hoặc bỏ gate mobile.

- [x] P05-UX-T71 Gửi đề xuất theo HTML dc76a8cf bằng React Native/theme: context avatar/skill, hai lựa chọn, lời nhắn/counter, lịch rảnh và chi tiết thu mở, footer cố định. Preflight sớm request OPEN/chưa hết hạn/không tự gửi, kỹ năng teacher ACTIVE/chưa archive/VERIFIED khi yêu cầu, pending trùng qua các trang; direct kiểm target public và pending, không áp điều kiện teacher của Request. Giữ draft khi refresh/error, recheck trước submit, runtime/idempotency/unknown recovery; không giả rating/online/nháp/notification hoặc API cooldown. Tests eligibility/pagination/gates/payload, checks và visual states.

- [x] P05-UX-T72 Hiện trạng thái Proposal của chính user trên Request feed/detail qua shared owner/session query, không N+1 theo card. Pending/accepted mở đề xuất cũ thay gửi thêm; withdrawn/rejected/expired ghi lịch sử và chỉ gửi lại khi bài OPEN/chưa hết hạn. Không đổi trạng thái bài/đánh dấu local giả; pagination đầy đủ/error/denial/focus/SSE/mutation refresh, tests reducer/CTA/checks và visual.


- [x] P05-UX-T73 Avatar người đăng Request dùng ảnh hồ sơ công khai qua runtime hiện hành trên feed/detail, hình tròn/fallback initials; nhấn card người đăng ở detail mở đúng public profile với requestId cho Back. Giữ schema Request, query/session/privacy, status/CTA; kiểm route/props và checks mobile.

- [x] P05-UX-T74 Thiết kế lại Chi tiết đề xuất theo mẫu HTML b6fd43ff bằng React Native/theme: phân cấp skill/status/đối tác/lời nhắn/các hint/expiry/liên kết; avatar từ public profile. Giữ hành động và gate theo role/status API; bỏ dữ liệu HTML giả (online, verified, rating, ID minh họa), không diễn giải Credit thành tổng lộ trình khi contract không nói vậy.

- [x] P05-UX-T75 Thiết kế lại màn Lịch của từng kế hoạch theo HTML a35ce401 bằng React Native/theme: mode context card, trạng thái chờ/đủ xác nhận đúng snapshot, kế hoạch/lịch từng buổi, xác nhận hai bên và tổng kết Credit/số buổi trước finalize. Giữ ONE_WAY/TWO_WAY nhiều plan, exact version, backend validation/Hold/Session và nhắc chat hiện có; không chép GMT/fake escrow/online-room/auto-check từ HTML. Checks source phù hợp.

- [x] P05-UX-T76 Điều chỉnh card lịch và phần review theo ảnh 0fee4f0b: role/session chip, bộ đếm lịch sẵn sàng, bullet tổng buổi/Credit/thao tác chốt, warning validation. Dùng số liệu source/API; giữ gates validate→finalize, không khẳng định chuẩn phút nếu lịch không có duration đồng nhất.

- [x] P05-UX-T77 Ô ngày trong card lịch hiển thị thứ ở trên, ngày ở dưới theo ảnh b6bc319d; bỏ B1, hiển thị tháng/năm cạnh khung giờ.
- [ ] P05-API-DEP-T78 Khi đủ hai schedule proposal của TWO_WAY, phát hiện conflict trước khi confirm và yêu cầu teacher cập nhật lịch. Chờ backend contract: trả conflict/state ở GET hoặc preview endpoint, chặn confirm schedule khi conflict, cho teacher sửa thành version mới và reset confirmations. Mobile hiện final-validation-only; không tự enforcement client-side trước khi có contract cho sửa/re-submit.
- [x] P05-UX-T79 Giãn refresh thỏa thuận từ 8s lên 30s; background GET không khóa CTA xác nhận/chốt/gửi chỉ do `isFetching`, vẫn khóa khi đọc lỗi, mutation pending/uncertain và dùng exact-version API gate. Bỏ refresh gating trên nút gửi schedule draft. Giữ refresh tức thời khi focus/app foreground và không thay đổi polling SSE/chat.
- [x] P05-UX-T80 Thêm pull-to-refresh theo theme cho màn thỏa thuận, chi tiết lộ trình, lịch, kiểm tra/chốt và entry từ Chat. Spinner chỉ theo thao tác kéo tay, không nháy theo polling nền; chặn gesture trùng, giữ refresh khi focus/foreground và periodic polling 30s.

- [x] P05-UX-T81 Thiết kế lại chi tiết LearningPlan theo ảnh người dùng cung cấp: gom thông tin kỹ năng/phiên bản/vai trò/mục tiêu/nội dung từng buổi/trạng thái vào một card gọn, ưu tiên title và mô tả API hiện có; hiện đúng trạng thái draft, chờ xác nhận, cần sửa hoặc đã xác nhận. CTA giữ quyền teacher/learner và exact version; khi mở từ Chat không lặp hành động gửi lại, entry nội bộ vẫn giữ share. Không bịa ghi chú riêng, thời lượng hoặc trạng thái buổi không có trong API. Kiểm lint/typecheck, regression route và session content; native/API acceptance ghi riêng.

- [x] P05-UX-T82 Thiết kế lại màn chi tiết LearningPlan theo mẫu timeline sáng, thống nhất theme: tóm tắt kỹ năng/phiên bản/vai trò, mục tiêu, danh sách buổi dạng timeline và trạng thái xác nhận thật. Đưa CTA xuống footer cố định: xác nhận đúng version, tiếp tục thỏa thuận lịch học, sửa theo quyền hoặc mở Chat; giữ Back/nguồn điều hướng. Chỉ hiện duration khi suy ra từ session/schedule thật; không bịa tag, trạng thái, lịch sử chỉnh sửa vì contract chưa có. Kiểm lint/typecheck/structure, navigation/session-content; ghi rõ native/API acceptance.

- [x] P05-UX-T83 Thiết kế lại tab Lộ trình trong Hành trình của tôi theo HTML 99068dff: card gọn có avatar tròn/tên đối tác, version, cập nhật, trạng thái thật, hình thức học và action mở chi tiết; bỏ line màu trên card và nhãn “Đối tác” theo tinh chỉnh sau đó. Đồng bộ màu chip lọc với Yêu cầu học (selected tint, border/text accent, unselected surface/border), số lượng filter lấy từ danh sách API đã tải. Không giả mục tiêu/tên kỹ năng vì PathSummary không có; không thêm N+1/detail endpoint hoặc nút tìm/lọc không có hành vi. Giữ loading/error/empty/API navigation; kiểm test list/filter, lint/typecheck/structure. Chưa xem native/API thực hoặc preview app.

- [x] P05-UX-T84 Hiển thị các buổi trong lịch từng kế hoạch và editor đề xuất lịch theo cùng timeline dọc: nối các mốc buổi, giữ số buổi/title, ngày giờ/thời lượng, status session và quyền Sửa hiện có. Giữ nguyên payload, xác nhận, validation, edit/apply và empty states. Schedule read/editor tests 2/2, lint, typecheck, structure 563 source files, diff check PASS; chưa tự nhận native/API acceptance.

- [x] P05-AUDIT-T85 Rà source/route/UI/API-state của toàn bộ Proposal → Chat → Agreement → LearningPlan → Schedule và consumer liên quan. Chặn implicit fixture fallback; preview chỉ mở khi `mode=preview`. Thay mock hủy/quyết toán không có API bằng trạng thái chưa hỗ trợ và gỡ MyPathsContent không có consumer. Đối chiếu role/version/membership, lỗi/unknown mutation, cache/session/realtime/polling qua source và regression tests. PASS lint/typecheck/structure, 44 test flow trọng yếu; toàn suite 440/449, 9 test Hold UI không chạy được do test loader CJS kéo React Native Flow thật và mock module không được restore. Chưa native/deployed API acceptance.

- [x] P05-AUDIT-T86 Gỡ fixture khỏi các entry point đã tích hợp API: Inbox/Chat/Attachment và Agreement/Path/Plan/Schedule/Terms phải luôn dùng API, không nhận `mode=preview`; route ID thiếu/sai hiện not-found. Gỡ MockMessages provider/data và fixture-linked buttons khỏi runtime; route Home demo về danh sách API thay vì chat/request fixture. Giữ state preview cho các consumer chưa có API (Community/Sessions), không xóa fixtures toàn feature. PASS lint, typecheck, structure, diff check và regression tests; native/deployed API acceptance pending.

- [x] P05-REFACTOR-T87 Gom 17 file learning-paths theo trách nhiệm: root chỉ giữ index/state/policy public entry; utils chứa xử lý thuần, schemas chứa validation input, preview chứa fixture/context/types/rules cho consumer chưa tích hợp. Cập nhật 40 file source/test imports, giữ public entry/route/API/hành vi. TypeScript, full ESLint, structure (558 files), 62 regression tests và diff check PASS.

- [x] P05-REVIEW-T88 Rà toàn bộ diff trước commit: kiểm role/version, preflight, form-chat delivery, pagination/read receipt, route/API-only và preview boundaries. Sửa harness Hold UI trỏ module cũ/thiếu host mocks, cleanup khi setup lỗi; sửa callback tin nhắn mẫu Home mở Inbox thật. Full448/448, web export, lint/typecheck/structure/diff PASS; chia commit theo UI foundation, Proposal/Request, Chat, Agreement/Plan/Schedule và docs; giữ native/deployed API acceptance riêng, không push.
