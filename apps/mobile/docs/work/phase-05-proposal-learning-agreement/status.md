# Trạng thái Phase 05–06

Cập nhật tài liệu: 2026-10-29T21:08:08+07:00.

**Ready for review — source complete; acceptance pending.** Source và regression đã hoàn tất trên nhánh `fix/mobile-proposal-chat-learning-path`; nghiệm thu API thật và Android/iOS còn mở.

## Kiểm tra xung đột lịch

- Editor đối chiếu draft nội bộ, lịch chiều đối ứng trong Path và Session đã chốt của tài khoản hiện tại ở Path khác. `useExistingScheduleCheck` đọc GET `/sessions/mine` trên toàn dải ngày của draft, kể cả các thẻ thu gọn và lịch điền theo tuần.
- Nút Gửi đề xuất/Lưu thay đổi bị khóa khi có xung đột. Input, Sửa từng buổi và Áp dụng lịch tuần vẫn hoạt động. Sửa hết trùng mở lại nút khi các điều kiện version/read/pending hợp lệ.
- Áp dụng lại cùng template và preflight trước POST/PATCH buộc đọc Session mới. Loading, read lỗi, denied hoặc response đạt giới hạn 100 buổi chặn gửi và giữ draft. Sau await kiểm lại user/generation/range/timestamp draft; chặn preflight trùng và callback cũ.
- Draft và plan đang sửa giữ snapshot; lịch chiều đối ứng lấy từ projection Path mới nhất. Focus epoch vô hiệu hóa callback sau khi rời editor, chặn gửi tiếp sau validation muộn và chặn điều hướng từ response cũ khi quay lại.
- Timestamp giữ phần giây; hai buổi chỉ tiếp giáp không bị coi là trùng. Regression múi giờ đối chiếu 21:00–22:00 UTC+07 với 14:00–15:00 UTC.
- Mỗi buổi cần sửa có một khối cảnh báo, gộp lý do trùng lặp. Trùng nội bộ hiển thị ở buổi sau; panel lịch bận loại Session đã cảnh báo trên thẻ. `ScheduleTimelineItem` đo chiều cao thực tế bằng `onLayout`, nối tới tâm chấm tiếp theo theo gap của consumer.

Giới hạn: endpoint hiện tại chỉ cung cấp Session riêng của tài khoản đang đăng nhập; response 100 buổi có thể chưa đầy đủ. Chưa có draft-validation và details lỗi cho lịch ở Path khác của bên đối ứng. Backend final-validation/finalize vẫn kiểm tra xung đột, số dư và quyết định chốt lịch.

## Credit và thông báo lịch trong Chat

`ApiHoldScreen` hiển thị nút **Nạp Credit** mở `/wallet/topup` khi final-validation/finalize trả `INSUFFICIENT_AVAILABLE_CREDIT`.

Xác nhận từng schedule không gửi card vào Chat. Finalize thành công gửi một tin tổng hợp từ receipt, gồm tổng Session của hai chiều, khoảng ngày và nút Xem lịch học. Gửi Chat lỗi giữ đúng intent để retry, không lặp nghiệp vụ finalize.

History gộp thông báo lịch theo conversation/path, dùng sequence mới nhất cho read watermark và ưu tiên receipt chốt lịch mới nhất. Card legacy chỉ thể hiện đã xác nhận. `ChatScheduleNotice` dùng chung `ChatWorkflowCard`, sender/avatar/group props và badge với các card nghiệp vụ khác. Tin nhắn lưu tại backend giữ nguyên; bảo đảm gửi duy nhất và không mất thông báo giữa finalize và POST message vẫn cần cơ chế backend.

## Kết quả kiểm tra gần nhất

Kết quả của các thay đổi code trước lần biên tập tài liệu này:

- 64/64 focused tests đạt trong 16 suite: `schedule-conflicts`, `schedule-existing-conflicts`, `schedule-existing-fresh`, `schedule-busy-day`, `schedule-timeline`, `schedule-editor-ui`, `schedule-read-card`, `editor-draft-revision`, `learning-amendments`, `learning-agreement-hold-ui`, `chat-schedule-notice`, `chat-file-card`, `chat-timeline`, `message-grouping`, `sessions-context`, `sessions-reschedule-availability`.
- Sau dọn code thừa, 14/14 tests liên quan đạt: `chat-schedule-notice`, `chat-file-card`, `weekly-schedule`, `schedule-time-fields`, `schedule-editor-ui`. Nhóm này có giao với 64 tests trên.
- Mobile lint, check-types, structure check (822 source files), format và diff check đạt. Hai test Session đã đồng bộ import `rescheduleAvailabilityMessage` và quy tắc xác nhận hai bên trước cutoff 60 phút.
- Các commit code/test đã qua lint-staged và commitlint. Chưa nghiệm thu trực tiếp API thật, Android hoặc iOS.

## Các commit lịch học và Chat

- `2a685d4e` — đồng bộ test điều kiện đổi lịch.
- `a45177a3` — kiểm tra xung đột, làm mới Session và vô hiệu hóa callback editor cũ.
- `4f8a9423` — điều hướng nạp Credit từ lỗi thiếu số dư.
- `6e9f4539` — gộp và thống nhất card thông báo lịch trong Chat.

## Bàn giao Git

Các commit source/tests ngày 2026-10-27:

- `0c533023` — `fix(mobile): use learning request owner avatars`.
- `c788942a` — `fix(mobile): explain failed chat attachments`.

Cả hai qua lint-staged/commitlint; tài liệu contract/plan/status trong commit riêng. Source không đổi so với bản đã đạt869/869 và bundle ba nền tảng ở checkpoint dưới. Chưa push.

Checkpoint chia commit trước đó:

Source đã chia thành 4 commit theo nhóm; tài liệu ghi nhận trong commit riêng, chưa push.

- `36a91c19` — `fix(mobile): unify screen loading states`.
- `5e06db18` — `fix(mobile): guard proposal submission and actions`.
- `3907c6d1` — `fix(mobile): streamline chat attachments and delivery recovery`.
- `0790f219` — `fix(mobile): preserve learning drafts and validate schedules`.

Mỗi mốc source được kiểm TypeScript trên bản chụp Git index để không dựa vào file chưa stage của commit sau. Focused tests theo thứ tự: 10/10 loading, 2/2 Proposal, 10/10 Chat, 41/41 Learning Path. Cả bốn commit đã qua lint-staged và commitlint; logs ignored `.expo/commit-{1..4}-{types,tests}.log`. Các ghi chú chưa commit ở checkpoint lịch sử bên dưới là trạng thái tại lúc kiểm chứng tương ứng.

Follow-up loading toàn mobile dùng cùng nhánh: Proposal/LearningPath gom loader ở vùng content, Chat gom lần tải thread đầu; dữ liệu phụ/trang cũ dùng placeholder và refresh có cache giữ content. Checkpoint loading trước chỉnh thẻ tệp là 855/855 cùng types/lint/structure788/export ba platform đạt; evidence và giới hạn chính ở [status loading](../mobile-chat-rate-limit/status.md). Bảng bên dưới giữ checkpoint 843/843 của lần sửa Proposal/Chat trước khi gom loading; checkpoint UI mới nhất ở ngay dưới.

## Kết quả kiểm tra trước thay đổi lịch và Chat

### Rà sau đồng bộ BE — 2026-10-27T08:43:56+07:00

Rà phần owner avatar theo BE232cb6ba cùng Proposal/Chat/Plan/Schedule trên working tree hiện tại. Phát hiện và tái hiện một lỗi trình bày: GET status tệp trả REJECTED/SCAN_FAILED/UPLOAD_FAILED/CLEANUP_PENDING/DELETED nhưng preview vẫn ghi “Chờ kiểm tra tệp…” và cho kiểm tra lại như đang quét. Regression trước sửa fail đúng nhánh REJECTED (`.expo/post-be-audit-repro.log`). Đã phân biệt nhãn/lý do và hướng dẫn bỏ/chọn lại; QUARANTINED/SCANNING vẫn cho đọc status, chỉ READY mới gửi. Không tự upload/retry mutation, không thay endpoint/BE; processing/uncertain tiếp tục recovery cùng intent. Có regression UI cho cả năm trạng thái và kiểm không gửi ở mọi trạng thái ngoài READY, gồm trạng thái chưa biết.

Baseline audit **868/868 PASS**; sau sửa **869/869 full tests, 12/12 focused PASS**, TypeScript, toàn mobile ESLint và structure **792 source files PASS**. Logs ignored `.expo/post-be-audit-tests.log`, `.expo/post-be-audit-full-final.log`, `.expo/post-be-audit-focused.log`, `.expo/post-be-audit-types-final.log`, `.expo/post-be-audit-lint-final.log`, `.expo/post-be-audit-structure-final.log`. Export Android/iOS/web PASS tại `.expo/post-be-audit-export`, log `.expo/post-be-audit-export.log`; dùng override ignored loại artifact `.expo` như checkpoint trước, không sửa cấu hình sản phẩm. Prettier/diff PASS. Chưa phát hiện thêm lỗi trong phạm vi source đã rà; chưa nghiệm thu BE thật/hai tài khoản/Android/iOS. Source/tests đồng bộ avatar và sửa lỗi scan đã commit tại `0c533023`/`c788942a` như phần bàn giao; chưa push.

### Checkpoint trước đồng bộ BE

Review toàn luồng 2026-10-26 đã tái hiện và sửa ba nhóm lỗi (4 ca fail ở `.expo/flow-audit-before.log`):

- Plan/Schedule save dùng trạng thái trước khi validation nên vẫn gọi API nếu refresh vừa lỗi. Hai form nay kiểm ref cho phép save hiện tại ở cả trước và sau validation, giữ draft/version khi bị chặn.
- Schedule khôi phục phần giây sau validation theo phút có thể tạo trùng 27 giây giữa hai buổi. Nay kiểm lại timestamp cuối, trả lỗi field và mở đúng buổi cần sửa; không gửi hoặc mất draft. Có regression riêng cho utility và handler form.
- Link tải tệp hết hạn trước khi mở từng bị bỏ qua im lặng. Nay hiện lý do và cho nhấn lại thẻ để lấy link mới, không tự retry hoặc mở link hết hạn; kiểm phiên/duplicate taps giữ nguyên.

Kết quả source mới nhất: **863/863 full tests, 42/42 focused PASS**, TypeScript, toàn mobile ESLint, structure **790 source files**, format/diff và export Android/iOS/web PASS. Logs ignored `.expo/flow-audit-full.log`, `.expo/flow-audit-focused.log`, `.expo/flow-audit-types.log`, `.expo/flow-audit-lint.log`, `.expo/flow-audit-export.log`; bundle `.expo/flow-audit-export`. Thêm 4 regression mới, mở rộng test thẻ tệp; full suite bao gồm thay đổi nhập thời lượng trực tiếp. Export dùng cùng override tạm loại artifact `.expo` đã mô tả bên dưới, không sửa cấu hình sản phẩm. Chưa nghiệm thu API/native với hai tài khoản; source đã commit theo nhóm ở phần bàn giao, chưa push.

Follow-up thời lượng 2026-10-26: “Học trong bao lâu?” dùng Input chung với bàn phím số và đơn vị phút thay wheel; lịch tuần và chỉnh từng buổi cùng nhận thay đổi. Giữ DateTimeField cho ngày/giờ bắt đầu, schema số nguyên 60–180, disabled và payload. Checkpoint riêng **7/7 focused PASS**, lint hai file/structure790 PASS; TypeScript PASS (`.expo/typed-duration-types.log`), regression tại `.expo/typed-duration-focused.log`. Đã được kiểm lại trong full suite/export của review trên.

Follow-up UI thẻ tệp/Inbox/lộ trình đã triển khai trên cùng nhánh:

- Chat dùng `ChatAttachmentTile` gọn có × trong composer theo hướng Messenger, phía trên hàng nhập tin; dùng chung nút Gửi, bỏ hướng dẫn khi ready. Tệp đã gửi dùng `ChatFileCard` với icon tài liệu/ảnh và tải tệp, giữ phía gửi/nhận, avatar/giờ. Tên dài tối đa hai dòng, hiện loại/dung lượng và accessibility label đầy đủ. × khóa theo upload/delivery; giữ refetch READY trước send và recovery của controller. Tải qua API có quyền, giữ kiểm tra phiên/hạn URL và chặn nhấn liên tiếp.
- Inbox: giờ hôm nay; `Th 2`…`Th 7` cho ngày trước trong tuần lịch bắt đầu thứ Hai; `25 thg 10` cho tuần trước, thêm năm khi khác năm. Dùng ngày địa phương, có regression qua ranh giới tuần/tháng/năm.
- Hướng dẫn thỏa thuận, plan và lịch dùng 13px, nhỏ hơn chữ nội dung chính 15px; metadata 11px. Rút câu và giữ điều kiện xác nhận lại/chốt lịch/tạm giữ Credit. `Copy size="hint"` và `FormNotice compact` là props tùy chọn, không đổi mặc định của consumer khác.
- Checkpoint Messenger: full mobile **858/858 PASS**, TypeScript, ESLint và structure **790 source files** đạt. Logs ignored `.expo/messenger-full.log`, `.expo/messenger-types.log`, `.expo/messenger-lint.log`; **7/7 focused** gồm handler remove khóa/mở, ready chỉ còn remove, recovery giữ caption và attachment trong composer (`.expo/messenger-focused.log`). Sửa type của JSX stub test rồi chạy lại typecheck và composer regression/lint, không đổi runtime.
- Đã xem component React Native Web thật ở khung 320/390px, có tên tệp dài, tin nhận/gửi, ô tệp ready và đang upload; ảnh `.expo/messenger-preview.png`. Thử × ở bản preview: gỡ tile và khóa Gửi khi trống, upload giữ ×/Gửi disabled. Preview cô lập dữ liệu và native boundaries, không phải nghiệm thu API hay thiết bị. Ảnh `.expo/ui-polish-preview.png` giữ checkpoint giao diện thỏa thuận/lộ trình trước đó.

Checkpoint Messenger Android/iOS/web export **PASS**, output `.expo/messenger-export`, log `.expo/messenger-export.log`. Checkpoint trước tại `.expo/ui-polish-export-final` cũng PASS; các lượt đầu dừng ở Metro không được tính PASS. Lượt đạt dùng Expo default config với override tạm chỉ loại `.expo` chứa artifact kiểm tra cũ khỏi file scan (`.expo/web/cache/ui-polish-metro.cjs`); không thay config app/dependency. Preview và helper nằm trong vùng cache. Không stage/commit/push, không sửa API/shared packages/dependencies; nghiệm thu thiết bị/API vẫn còn mở.

Review 2026-10-25T20:19:39+07:00 đã tái hiện editor bị remount theo plan version (log `.expo/review-editor-before.log`). Plan/Schedule editor hiện giữ resource key và snapshot đã mở; polling không reset draft, callback cũ/validation chậm không được gửi khi revision đổi. Chỉ nút mở bản mới reset form; pending/unknown chặn việc bỏ intent. Khi thỏa thuận tạm chưa cho sửa, draft đã mở giữ ở chế độ chỉ đọc; khi mất authorized data hoặc đổi resource không được phép thì editor bị gỡ. Không mở quyền hoặc tự xác nhận nghiệp vụ.

Kiểm chứng review: **855/855 full tests, 32/32 focused**, TypeScript, ESLint, structure788, format/diff và export Android/iOS/web đạt. Logs ignored `.expo/review-full-final.log`, `.expo/review-focused-final.log`, `.expo/review-types-final.log`, `.expo/review-lint-final.log`, `.expo/review-export-final.log`. Baseline trước review847; thêm8 regression về focus, resource key, draft/reload/version callback và giữ/gỡ editor theo quyền. Chưa nghiệm thu polling/concurrent edits trên API/native, chưa stage/commit/push.

| Phần             | Hiện trạng                                                                                                                                                                                                                                                                                                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Proposal & Chat  | Khóa gửi proposal xuyên suốt preflight/POST, pending read thiếu kết quả không được coi đủ điều kiện; lỗi refresh chặn edit/accept dù còn cache. Chat mở bộ chọn tệp thiết bị trực tiếp và hiển thị upload/scan/gửi tại Chat; giữ file/caption/clientMessageId khi recovery, hỗ trợ gửi không caption.                                                                          |
| Plan & Schedule  | Đã tích hợp API: ba bước Cách học → Lộ trình → Lịch; quyền teacher/learner, ONE_WAY/TWO_WAY, exact-version confirmation và backend validation/finalize. PATCH sửa lịch trước chốt, prefill giờ cũ và hiển thị lịch thiếu buổi NEEDS_REVISION.                                                                                                                                  |
| UI và navigation | Lịch tuần và từng buổi dùng cùng DateTimeField với Learning Request; giữ ngày/giờ bắt đầu và nhập trực tiếp số phút 60–180, không đổi sang giờ kết thúc. Ngày/giờ dùng wheel trên iOS, control platform trên Android/web. Chat không điều hướng sang màn khác khi nhấn đính kèm; route cũ còn tương thích qua cùng hook. Theme/font, timeline, Back và polling 30s giữ nguyên. |
| Fixture/runtime  | Route Proposal/Chat/Agreement/Plan/Schedule dùng API, không fallback fixture. `learning-paths/preview` còn cho Community/Sessions chưa tích hợp; không được đọc bởi route thỏa thuận API.                                                                                                                                                                                      |

`learning-paths` đã gom vào `api`, `components`, `hooks`, `screens`, `schemas`, `utils`, `preview`; root chỉ giữ public entries `index.ts`, `state.ts`, `policy.ts`.

## Checkpoint Proposal/Chat trước gom loading

| Kiểm tra                             | Kết quả / giới hạn                                                                                                                                                                                                                                                                              |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Full mobile tests                    | **843/843 PASS**, fail 0, skipped 0; baseline trước sửa 834/834, bổ sung 9 regression và mở rộng test proposal/template hiện có. Log ignored: `.expo/proposal-chat-learning-full-final.log`.                                                                                                    |
| ESLint, TypeScript, structure        | PASS; structure kiểm 781 source files. Logs ignored `.expo/proposal-chat-learning-types-final.log`, `.expo/proposal-chat-learning-lint-final.log`. Dùng binary local tương đương package scripts vì pnpm wrapper định cài lại dependencies và dừng ở lỗi no-TTY; không cài/purge modules.       |
| Android/iOS/web export               | PASS tại `.expo/proposal-chat-learning-export-final`; log `.expo/proposal-chat-learning-export-final.log`. Chứng minh bundle cả ba platform, không thay nghiệm thu native/API.                                                                                                                  |
| Diff                                 | Prettier toàn bộ file thay đổi và whitespace PASS; chỉ sửa apps/mobile. Không push.                                                                                                                                                                                                             |
| UI host checks                       | Test dùng màn/hook/handler thật với mock native boundaries: picker thời lượng, template chỉ áp dụng khi nhấn nút, gửi file không caption, upload/scan/read lỗi, duplicate taps, logout, 201/202 và recovery giữ payload gốc. Chưa kiểm giao diện/gesture/document picker/scanner trên thiết bị. |
| API đang triển khai                  | **Chưa nghiệm thu** end-to-end với hai tài khoản.                                                                                                                                                                                                                                               |
| Android/iOS và nghiệm thu người dùng | **Chưa thực hiện** cho phiên bản bàn giao hiện tại.                                                                                                                                                                                                                                             |

Regression kiểm no-op/same-version đúng flag và resource, sửa plan giữ cách học/chiều đối ứng, lịch thiếu không confirm/finalize, quyền teacher/lock, PATCH và prefill giữ giây của lịch cũ, uncertain giữ draft. Lưu terms y nguyên đã tự xác nhận không confirm/gửi Chat thêm; phần chưa xác nhận vẫn confirm. Không coi host mocks hoặc web export là nghiệm thu quyền/ledger/API thật.

Follow-up 2026-10-25 đã đối chiếu SRS 1.6 mục 18.12/CHAT-002: Chat cho phép attachment tối đa 15 MB và phải validation/malware scan. Chọn tệp tự mở picker và upload theo thao tác người dùng, gửi chỉ sau GET trạng thái READY mới. Recovery 202 chỉ đọc delivery; nếu server báo publication failure thì người dùng có thể gửi lại cùng intent. Màn đính kèm cũ và chia sẻ lộ trình được cập nhật theo cùng cơ chế recovery. Không sửa BE/shared/dependency; chưa stage/commit/push.

## Giới hạn và dependency còn mở

- **P05-API-DEP-T78:** Mobile chặn các xung đột đã đọc trong Path và Session riêng; chưa có API kiểm lịch nháp của cả hai người trên mọi Path. Final-validation/finalize vẫn kiểm trùng; teacher có thể dùng PATCH sửa lịch chưa khóa sau lỗi kiểm tra. Hủy schedule riêng chưa có API mobile xác minh.
- Theo BE mới: sửa plan không reset cách học; cùng số buổi giữ xác nhận lịch, đổi số buổi cần sửa/xác nhận lịch lại. Sửa terms cần xác nhận lại terms, phần tương thích được BE giữ. Mobile luôn đọc projection server; chưa xác minh deployment BE.
- Create path/plan/schedule thiếu server idempotency; lookup path theo conversation bị giới hạn danh sách tối đa 100. Khi unknown hoặc chưa đủ bằng chứng, mobile chặn gửi mới và yêu cầu đối chiếu.
- Inbox sắp xếp theo activity của các conversation đã tải; chưa có last-message/unread summary hoặc batch context từ backend. Không khẳng định thứ tự/tổng unread của các trang chưa tải.
- Dạy thử tùy chọn vẫn là backlog tương lai; hủy/quyết toán và các phần chưa có API không được triển khai bằng fixture trong luồng thật.

## Bước tiếp theo

1. Thực hiện **P05-S99-T02** theo [plan](plan.md) trên môi trường API và hai tài khoản/ví test được cho phép.
2. Kiểm Android/iOS: picker ngày/giờ và thời lượng, đính kèm trực tiếp từ Chat (hủy/đổi file, 15 MB, scanner READY/blocked, caption, 202/mất phản hồi), keyboard, Back/gesture và foreground/background; đối chiếu trạng thái server khi confirm/finalize.
3. Đối chiếu kết quả với tiêu chí nghiệm thu, ghi lỗi còn lại và cập nhật trạng thái phase theo bằng chứng API/native.

[Contract](../../contracts/proposal-learning-agreement.md) sở hữu chi tiết nghiệp vụ/API. [History](history.md) giữ các checkpoint và task ID cũ để tra cứu; status này chỉ cập nhật hiện trạng và bằng chứng còn hiệu lực.
