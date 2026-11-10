# Trạng thái Phase 05–06

## Rà và dọn trước commit — 2026-11-10T18:10:54+07:00

- Rà toàn bộ30 file đang sửa/thêm trên nhánh fix/mobile-schedule-validation; không thay backend/root tooling, không stage/commit. Bỏ sessionCount/sessions khỏi metadata thẻ xác nhận vì không có consumer trình bày; tin chốt lịch vẫn giữ tổng Session thật. Thẻ xác nhận mới đi thẳng vào timeline thay vì tạo nhóm một phần tử qua đường gom legacy; bỏ nhánh xử lý confirmation không còn cần trong reduce legacy, reset checked lặp sau finalize thành công và export helper lọc chỉ dùng bởi test. Contract được đồng bộ với payload cuối.
- Bổ sung assertion đã tái hiện lỗi cột phút làm giờ23 quay về19 khi hai sự kiện đến trước render. Sửa TimeWheelPicker dùng giá trị vừa phát gần nhất và cập nhật riêng giờ/phút; từng cột giữ lựa chọn tức thời để sự kiện quay về giá trị đầu không bị bỏ qua. Regression kiểm cả cuộn liên tiếp, quay lại giờ cũ, tap phút, accessibility và ngày/giờ gốc không bị mutate. Focused32/32 PASS sau sửa; không coi fake hook/web thay native acceptance.
- Audit AST936 source files: bốn module production mới đều có consumer production, không có style chưa tham chiếu trong source đang sửa. Kết quả local `.expo/precommit-source-audit.cjs`; đây là kiểm source tĩnh, không chứng minh hết mọi đường chạy trên thiết bị.
- Full mobile cuối **1087/1089 PASS, 2 FAIL**, skip/cancel0. Hai lỗi giữ nguyên từ baseline dev: profile-moderation-ui/processColor mock và sessions-list/protocol; đã tái hiện cùng lỗi trên source HEAD nguyên trạng ở mốc trước. TypeScript, ESLint toàn mobile, structure936, Prettier toàn source/test trong diff và whitespace PASS. Expo web export cuối PASS tại `.expo/mobile-precommit-export`. Logs ignored `.expo/mobile-precommit-tests.log`, `.expo/mobile-precommit-types.log`, `.expo/mobile-precommit-export.log`, `.expo/mobile-precommit-focused.log`.
- Chạy lại ba fixture sau cleanup: chọn giờ/lỗi thời gian, thẻ xác nhận lịch/cách học/lộ trình/chốt và danh sách/bộ lọc. Tất cả PASS tại320/390/430 và chữ lớn320: vị trí giờ/phút, đúng vai trò/reason/route/version, tải thêm/giữ filter, thứ tự BE, không tràn ngang/page error/request API ngoài fixture. Scripts precommit-check.cjs và ảnh trong các thư mục preview đã ghi ở mốc trước.
- Source trong phạm vi đủ chuẩn bị commit kèm ghi nhận hai lỗi test baseline; chưa có kết quả suite xanh hoàn toàn. Android/iOS thật, API hai tài khoản và các gap BE đã ghi vẫn chưa nghiệm thu. Người dùng mới yêu cầu kiểm tra/dọn; chưa cấp lệnh stage/commit/push.

## Bộ lọc danh sách theo giai đoạn học — 2026-11-10T17:41:49+07:00

- Thay bộ lọc Đã xác nhận chỉ khớp CONFIRMED bằng Tất cả/Đang trao đổi/Chờ bắt đầu/Đang học/Chờ quyết toán/Hoàn thành/Đã dừng/Tranh chấp. Dùng stage projection giống nội dung thẻ để phân biệt học xong chưa quyết toán với hoàn tất; null/thiếu stage dùng status. CONFIRMED chưa khóa lịch ở Đang trao đổi; DISPUTED có nhóm riêng kể cả khi stage vẫn học hoặc đã dừng. Không đổi trạng thái/quyền/API/backend.
- Khi đang chọn nhóm mà còn trang, hiện chú thích đang lọc trong số lộ trình đã tải; trạng thái rỗng nói rõ chỉ chưa tìm thấy trong phần đã tải. Giữ nút tải thêm và nhóm đang chọn khi trang tiếp theo về; lỗi trang tiếp giữ kết quả/nhóm và có retry. Hết trang thì bỏ chú thích và mới báo không có kết quả nhóm. Chỉ Tất cả tiếp tục auto-load khi chạm cuối; nhóm cụ thể không tự quét hết danh sách. Giữ nguyên createdAt/ID/cursor BE; lastActivityAt ordering vẫn cần BE.
- **4/4 focused tests PASS**: đủ chín status, sáu stage, fallback null/thiếu, tranh chấp, không lẫn chờ quyết toán/hoàn thành, giữ thứ tự/không mutate; UI chọn nhóm, partial empty, tải thêm, giữ filter, retry lỗi trang, exhausted state và visibility/profile enrichment. TypeScript, ESLint file sửa, structure936 và diff whitespace PASS. Logs ignored `.expo/path-list-filters-focused.log`, `.expo/path-list-filters-types.log`. Không chạy lại full suite/export vì chỉ thay filter/copy của một màn, không thêm import package/route; hai lỗi full-suite baseline ở mốc trước giữ riêng.
- Fixture dùng ApiPathsContent/thẻ thật qua React Native Web, thay API/router/FlatList boundary:320/390/430 và chữ lớn320 PASS; tám filter, đổi từng nhóm, tải thêm từ partial-empty sang kết quả giữ nhóm, hết trang bỏ hint, trở về Tất cả giữ đúng thứ tự BE, không tràn ngang/page error/API request. Đã xem ảnh partial390 và chữ lớn320; script/ảnh local `.expo/path-list-filters-preview`. Nguồn UI là yêu cầu hiện tại và chips/theme đang có; chưa nghiệm thu native hoặc API thật. Chưa stage/commit/push.

## Mobile tự gửi thẻ xác nhận lịch — 2026-11-10T15:05:51+07:00

- Theo yêu cầu tiếp, SchedulePanel gọi confirmAndShare sau API confirm thành công, gửi TEXT của người xác nhận qua API chat hiện có. Metadata giữ path/plan/schedule/version, teacher/learner/confirmedBy và bothConfirmed từ receipt. Card phân biệt Lịch bạn dạy/Lịch bạn học, người đã đồng ý/chờ ai và Đủ xác nhận nhưng Chưa chốt lịch; không suy cả Path đủ xác nhận từ một chiều. Receipt LOCKED trả cho màn cũ không gửi thêm thẻ chờ chốt. Không sửa BE, không giả SYSTEM/notification/push.
- Mỗi thẻ mới giữ riêng trong history; chỉ tin chốt và xác nhận legacy tiếp tục gộp như trước. Link mở lịch kèm plan/schedule/version, màn đã có cảnh báo khi bản lịch thay đổi. Thiếu quyền/refresh/read lỗi/session cũ không được gửi xác nhận. Tin lỗi giữ trong queue session và dùng ConfirmedFormFeedback tại màn lịch/thỏa thuận/chat để kiểm tra hoặc gửi lại đúng body/clientMessageId, không lặp xác nhận. Queue hiện có không bền qua restart; khoảng trống confirm thành công→app tắt trước gửi tin vẫn cần BE event/outbox.
- Thẻ DELIVERED invalidate thread và mọi query conversations của đúng owner/session để list/nhóm/preview đọc activity mới. Inbox dùng preview riêng cho chờ/đủ xác nhận, nhận incoming readAt thật; không tự tạo trạng thái chưa đọc cho đối tác. Refresh trạng thái Path khi focus/foreground và polling chỉ-đọc đã có, được giữ nguyên.
- ApiHoldScreen xóa checked ngay khi bắt đầu chốt và guard trực tiếp handler theo readiness/refresh/pending/session. Chốt thất bại không còn thông báo xanh hoặc nút chốt dựa vào kết quả cũ; phải kiểm tra lại. Unknown outcome giữ exact recovery, không tạo lần chốt mới. Đóng task mobile đã mở ở lượt review; phần gap BE INVALID_SCHEDULE_ITEMS vẫn mở.
- Kiểm cuối **52/52 focused PASS**, TypeScript, ESLint toàn mobile và lint cuối file sửa, structure936, Prettier/diff whitespace PASS. Full mobile **1086/1088 PASS, 2 FAIL**, skip/cancel0; cùng hai lỗi baseline dev ở profile-moderation-ui/processColor và sessions-list/protocol đã được đối chiếu ở mốc trước. Sau nhánh LOCKED và tinh chỉnh chữ lớn, focused52, types/lint/export/fixture được chạy lại. Expo web export cuối PASS tại `.expo/schedule-chat-export`. Logs ignored `.expo/schedule-chat-focused.log`, `.expo/schedule-chat-full-tests.log`, `.expo/schedule-chat-types.log`, `.expo/schedule-chat-export.log`.
- Fixture dùng ApiMessageBubble/ChatWorkflowCard thật, chỉ thay router/API/native boundary:320/390/430 và chữ lớn320 PASS; bốn trường hợp actor/chiều/chờ/đủ, đúng route plan/schedule/version, không tràn ngang/page error/API request. Chữ lớn giữ trọn nội dung chờ ai; header card chung cho badge xuống dòng khi chật. Các consumer cách học/lộ trình/thẻ đã chốt được xem lại cùng fixture, vẫn đúng nội dung. Ảnh/script local `.expo/schedule-confirmation-preview`; đã xem ảnh390 và chữ lớn320. Nghiệm thu Android/iOS thật và API hai tài khoản còn mở; source/fixture không thay nghiệm thu đó. Chưa stage/commit/push.

## Bàn giao gap BE và kết quả rà tiếp — 2026-11-10T13:43:50+07:00

- Đã ghi [BE cần bổ sung chi tiết lỗi thời gian](../../contracts/backend-schedule-validation-gap.md): hai endpoint409 dùng chung validateForFinalizeTx; field/reason đề xuất để định danh đúng chiều/buổi theo giờ DB/config; HttpExceptionFilter cần allowlist mới; OpenAPI, transaction/replay và tiêu chí HTTP integration tests. Chưa thay code BE hoặc coi response đề xuất là API đã có.
- Mobile hiện cũng phải thêm parser cho mã INVALID_SCHEDULE_ITEMS sau khi BE chốt contract; adapter đang bỏ details của mã này. Ghi rõ fallback/version và nghiệm thu API hai tài khoản còn thiếu.
- Review tiếp đã tái hiện lỗi frontend độc lập: kiểm tra thành công → finalize bị từ chối vì thời gian sai → vẫn cùng lúc hiện ScheduleValidationFeedback, thông báo xanh và nút chốt bật. Test tái hiện ignored `.expo/schedule-review.test.ts`; chưa sửa, đã mở task trong plan. Vì vậy phạm vi source picker/feedback bên dưới đã có kiểm chứng nhưng toàn luồng chốt lịch vẫn còn việc này; không coi đã hoàn tất toàn bộ luồng.
- Lượt bàn giao này chỉ sửa tài liệu mobile; đối chiếu source và kiểm link/diff whitespace, không chạy lại app tests cho thay đổi tài liệu. Giữ kết quả và giới hạn kiểm chứng của bản source bên dưới.

## Chọn giờ cuộn và lỗi lịch có chủ thể — 2026-11-10T12:56:09+07:00

- Theo yêu cầu, tạo nhánh `fix/mobile-schedule-validation` từ `dev` local (`a67dfcef`), giữ source trong mobile. Chưa stage/commit/push. Android DateTimeSelector đổi mặt đồng hồ sang hai cột cuộn giờ/phút ngay khi tạo/sửa lịch; giữ lịch ngày, thời lượng, payload, iOS wheel và web select. Control chung cũng được dùng trong gợi ý Learning Request và đổi lịch Session. Dùng ScrollView snap vì Expo UI Android hiện không cung cấp wheel thật; không thêm package.
- Kiểm tra điều kiện và chốt lịch cùng hiển thị lỗi INVALID_SCHEDULE_ITEMS theo từng chiều dạy: tên teacher/learner (fallback bạn/đối tác), kỹ năng nếu đọc được, số buổi, khoảng giờ và lý do. Có link sửa đúng lịch của mình; lịch đối tác mở màn đọc để nhờ họ sửa. Giữ thông báo/mutation/recovery khác. API chỉ có mã lỗi nên đối chiếu snapshot và giờ thiết bị; khi không có mục local giải thích được lỗi server, báo rõ chưa có chi tiết và cần tải lại, không đoán người sai. Server vẫn authoritative theo DB/config; chi tiết tuyệt đối cần BE contract riêng.
- 23/23 focused tests PASS (hướng dạy một/hai chiều, nhiều buổi, giờ quá khứ, biên thời lượng, fallback thiếu chi tiết/tên, hai thao tác kiểm tra/chốt, thay feedback cũ, cuộn/tap/accessibility). TypeScript, ESLint toàn mobile, structure935 và diff whitespace PASS. Full mobile **1080/1082 PASS, 2 FAIL**, skip/cancel0: profile-moderation-ui báo processColor không được mock; sessions-list báo protocol. Đã chạy cùng hai test files trên bản source HEAD/dev được giải nén nguyên trạng tại `.expo/schedule-validation-baseline`: 4/6 PASS, cùng hai lỗi và stack tương ứng. Không sửa các lỗi ngoài phạm vi.
- Fixture dùng components thật qua React Native Web, chỉ thay router/API/native boundary:320/390/430 và chữ lớn320 không tràn ngang/page error; hai chiều/tên/lý do/link đúng. Kiểm cột giờ/phút căn đúng giá trị lúc mở, cuộn19:35→21:35 giữ phút35. Đã xem ảnh390 tại `.expo/schedule-validation-preview/schedule-validation-390.png`; script và ảnh chữ lớn cùng thư mục. Logs ignored `.expo/schedule-validation-focused.log`, `.expo/schedule-validation-tests.log`; baseline log ở `.expo/schedule-validation-baseline/apps/mobile/baseline-tests.log`. pnpm wrapper tự yêu cầu cài lại modules và dừng vì non-TTY; checks chạy trực tiếp CLI đã cài tương ứng scripts, không cài lại dependencies.
- Source complete trong phạm vi; chưa nghiệm thu Android/iOS thật, thao tác TalkBack/VoiceOver hoặc API hai tài khoản. Không dùng fixture để xác nhận native acceptance.

## Banner đúng trạng thái — 2026-11-09T22:28:14+07:00

- Bổ sung theo đính chính của người dùng lúc2026-11-09T22:36:26+07:00: warning Credit luôn mở đầu bằng trạng thái yêu cầu hủy. PENDING: người gửi chờ đối tác đồng ý, người nhận chờ chính mình phản hồi; STAFF_REVIEW chờ nhân viên; ACCEPTED chưa có approvedAt chờ cập nhật; có approvedAt ghi đã duyệt hủy. Sau đó mới nêu Credit chờ tranh chấp/chính sách. Regression22/22 path-changes-ui PASS, ESLint file và diff whitespace PASS; không thay quyền gửi/đồng ý hoặc tự quyết toán.

- Sau lượt rà read-only, người dùng yêu cầu sửa4 chỗ. Warning của yêu cầu hủy và lỗi TERMINATION_BLOCKED_BY_DISPUTE chỉ rõ Credit chờ tranh chấp/chính sách, không nói tranh chấp ngăn duyệt hủy. Header/thao tác phản hồi giữ theo trạng thái yêu cầu; regression vẫn cho đối tác mở Đồng ý hủy khi có blocker Credit.
- Hold dùng progression hiện hành cho CANCELLED/DISPUTED/COMPLETED; không báo xanh các buổi sẵn sàng. Khi đã có terminationApprovedAt nhưng chưa quyết toán, thông báo các buổi tương lai đã dừng. Path đang học/chờ bắt đầu chỉ hướng mở danh sách xem trạng thái từng buổi. Không sửa finalize/quyền/API.
- Consent sớm đã lưu chỉ nói chờ đối tác/thời hạn ở WAITING_DISPUTE_WINDOW hoặc READY. Các trạng thái dispute/termination/review/retry giữ warning thật và chỉ ghi nhận consent, không hứa tự giải ngân sau hạn. Không lặp consent ở SETTLED/TERMINATED.
- Editor Learning Request dùng baseline.status hiện hành: REJECTED phải lưu về nháp rồi đăng lại; OPEN có thể chuyển chờ duyệt, PENDING_MODERATION chờ duyệt, DRAFT hướng dẫn đăng sau lưu. Chi tiết tại work Phase04.
- 40 focused tests PASS; full mobile **1065/1065 PASS**, fail/skip/cancel0. TypeScript, ESLint toàn mobile, structure910 và diff whitespace PASS. Logs local ignored .expo/banner-copy-fixes-tests.log và .expo/banner-copy-final-tests.log. Không chạy lại export vì thay đổi copy/nhánh hiển thị, không thêm import package hoặc route.
- Fixture component thật tại320/390/430 và chữ lớn320: WAITING_DISPUTE/WAITING_TERMINATION cùng consent đã lưu hiển thị đúng warning, không có wait hint cũ, không tràn ngang/page error; đã xem ảnh390. Artifact local .expo/settlement-preview/banner-*.png. Boundary router/provider giả lập; chưa nghiệm thu API thật hoặc native. Chưa stage/commit các sửa banner.

## Chia commit theo phạm vi — 2026-11-09T22:01:13+07:00

- Theo yêu cầu tiếp của người dùng, giữ nhánh fix/learning-path-flow và chia source thành bốn commit: 0fe92188 tổng quan/vụ việc và bảo vệ hủy; 3649835b giao diện thỏa thuận/lịch; 44f47d29 lifecycle Proposal; 5ea52e90 nút hồ sơ và khóa picker. Nhóm tài liệu contract/plan/status được commit riêng sau source.
- Đã review staged diff từng nhóm; lint-staged/Prettier và commitlint chạy qua hooks, không bypass. Kiểm chứng source giữ kết quả1062 test và các checks bên dưới; không có thay đổi logic sau kiểm chứng. Chỉ commit local, không push/deploy; API/native acceptance vẫn pending.

## Dọn code và kiểm tra trước commit — 2026-11-09T21:55:42+07:00

- Xóa component PathAttentionItems không còn consumer sau lựa chọn tóm tắt gọn; bỏ test của component bị xóa. PathOverviewSummary chỉ còn nội dung tóm tắt đang dùng, bỏ props compact/showStage và nhánh CTA một buổi không còn sử dụng. PathOverviewPanel không tạo lại attentionItems khi fallback vì không còn render danh sách này. Giữ contract/API và các route vụ việc đang được settlement sử dụng.
- Bỏ style doneNumber không thể chạy khi bước đã hoàn thành luôn hiển thị icon, bannerReady trùng style banner nền và màu settings shortcut đã bị bỏ. Kiểm import graph910 source files: mọi module thay đổi ngoài app routes đều có production consumer; audit style local không còn candidate thừa trong diff.
- Phát hiện test focus mới đã ghi đè nhầm tests/proposal-lifecycle.test.ts ở lượt trước. Khôi phục nguyên8 test API/form/identity/version/idempotency cũ (file không còn diff), chuyển test hook mới sang proposal-visit-lifecycle.test.ts. Kết quả1055 trước đó thiếu8 test cũ; kết quả hiện tại chạy đủ các test khôi phục và đã bỏ1 test component dead.
- Full mobile **1062/1062 PASS**, fail/skip/cancel0; TypeScript, ESLint toàn mobile, structure910, Prettier toàn source/test đang thay đổi và git diff whitespace PASS. Expo web export PASS. Logs local ignored: .expo/mobile-cleanup-final-tests.log và .expo/mobile-cleanup-export.log; bundle tại .expo/mobile-cleanup-export.
- Fixture source thật: tổng quan/lối vào tất cả buổi học và own/public profile tại320/390/430, chữ lớn320 PASS; không tràn ngang, không thêm CTA một buổi, chỉ một CTA danh sách toàn Path, callback/nút tài khoản đúng. Hồ sơ cuối cùng dùng hai nút icon vuông44×44px, bo góc13px, cách4px, có nền/viền mảnh, không chữ Chỉnh sửa. Scripts/ảnh local tại .expo/schedule-layout-preview và .expo/profile-settings-preview.
- Source đủ kiểm chứng để review/commit. API thật/hai tài khoản và Android/iOS acceptance vẫn chưa thực hiện, fixture/export không thay các bước đó. Người dùng sau đó đã yêu cầu chia commit, ghi tại mục trên.

## Sửa mobile sau rà liên feature — 2026-11-09T21:38:04+07:00

- Theo yêu cầu sửa mobile, luồng Learning Request → Proposal và lời mời trực tiếp dùng guard theo resource, session và lượt focus. Preflight hoàn tất sau khi rời màn không POST; POST đã gửi vẫn hoàn tất qua runtime/cache/recovery hiện có nhưng không tự điều hướng từ màn khác. Gửi, sửa, chấp nhận và explicit recovery đều chụp lượt focus trước khi await; quay lại màn không hồi sinh callback cũ. Không tự replay mutation.
- Bỏ nhánh chặn tạo thỏa thuận khi có từ100 Path: api.mine đã đọc hết cursor,100 chỉ là page size. Giữ kiểm lỗi/refresh/denied, Path có sẵn cùng conversation và chống tạo trùng hiện tại. Không đổi API/backend; không thêm thay đổi nghiệp vụ cho Learning Request khi chưa có lỗi xác nhận.
- Hồ sơ riêng chuyển Cài đặt khỏi grid thành icon bánh răng cạnh Chỉnh sửa, vùng chạm44px và nhãn accessibility Cài đặt tài khoản. Icon settings dùng glyph bánh răng trong map mobile hiện có. Hồ sơ công khai không nhận handler quản lý tài khoản. Profile picker luôn nhả khóa local khi kết thúc lúc blur; dữ liệu ảnh/error vẫn kiểm focus/session.
- Regression gồm rời màn khi preflight hoặc POST đang chờ, blur/refocus, đổi resource/session, hồi phục explicit, picker cancel/kết quả cũ lúc blur và danh sách hơn100 Path. Full mobile **1055/1055 PASS**, fail/skip/cancel0; TypeScript, ESLint và structure911 PASS. Log local ignored .expo/mobile-proposal-profile-tests.log.
- Fixture dùng components thật và icon Lucide thật, chỉ thay native SVG/router boundary; own/public profiles320/390/430 và chữ lớn320: không tràn ngang, một icon Cài đặt cạnh Chỉnh sửa, callback đúng, không còn shortcut trùng hoặc control tài khoản trên public profile. Đã xem ảnh390 và chữ lớn320 tại .expo/profile-settings-preview. Chưa nghiệm thu API thật hoặc Android/iOS.

## Rà lại sau thiết kế — 2026-11-09T19:01:54+07:00

- Rà source danh sách, thỏa thuận/bốn bước, tổng quan gọn, lịch xem/editor, tóm tắt vụ việc, nhiều Session/hai chiều/khác tháng, denied/read errors, trạng thái hủy/hoàn tất và các đích điều hướng trong phạm vi vừa thay đổi.
- Sửa hai lỗi xác nhận được: list thiếu learningStage đã dùng label Path nhưng icon/màu lại theo PREPARING; giờ cả label và presentation cùng fallback Path. Màn lịch từng buổi trước đó chỉ blocked theo error, vẫn cho xác nhận trong isFetching; giờ truyền blocked cả refresh xuống overview/các chiều/finalize và guard trực tiếp callback xác nhận khi blocked/pending.
- Regression kiểm ACTIVE/CANCELLED/DISPUTED thiếu stage có icon phù hợp; trong refresh/read failure nút xác nhận disabled, gọi trực tiếp handler không POST; tải xong xác nhận hoạt động lại. Không đổi API, phiên bản hay chính sách xác nhận.
- Full suite lần đầu có một test còn đòi link danh sách vụ việc chung đã được người dùng yêu cầu bỏ. Cập nhật assertion để vẫn kiểm thông báo tranh chấp, giữ trạng thái quyết toán khi read lỗi và không có nút generic đó.
- Full mobile cuối **1060/1060 PASS**, fail/skip/cancel0; TypeScript, ESLint toàn mobile, structure910, git diff whitespace PASS. Expo web export PASS tại .expo/learning-ui-review-export. Logs local ignored: learning-ui-review-final-tests.log, learning-ui-review-fixes-tests.log và learning-ui-review-export.log.
- Chưa xác nhận thêm lỗi trong scope source đã rà. Bằng chứng full tests/export không thay nghiệm thu API thật/hai tài khoản hoặc Android/iOS, Back gesture, accessibility hệ điều hành và đồng bộ foreground/background trên thiết bị.


## Tổng quan gọn, mở toàn bộ buổi học — 2026-11-09T18:55:28+07:00

- Người dùng xác nhận lựa chọn: tóm tắt gọn → tất cả buổi học, bỏ danh sách vấn đề và các màn trung gian trong khối Tình hình học tập.
- PathOverviewPanel chỉ render tiến độ, thông tin buổi tiếp theo ở chế độ compact và tổng số việc cần theo dõi. Không render PathAttentionItems hoặc CTA tới case/Session riêng; không còn chuỗi list vấn đề → tóm tắt vụ việc → một buổi. Thông tin chi tiết/vụ việc và routes riêng giữ nguyên cho các consumer khác.
- Nút tổng hiện có ở phần lịch tiếp tục là CTA duy nhất mở /paths/[id]/sessions. Danh sách này đã kiểm nhiều buổi, hai chiều và khác tháng ở lượt trước; không giới hạn vào nextSession hoặc một attention item.
- 35 focused tests PASS, TypeScript, ESLint file ảnh hưởng, structure910 và diff whitespace PASS. Regression ba attention items chỉ cho một dòng đếm và không có link chi tiết; denied/empty và đích danh sách giữ nguyên. Log .expo/overview-simple-sessions-tests.log.
- Fixture source thật tại320/390/430 và chữ lớn320: không còn list/case/single-session link, chính xác một nút Xem tất cả buổi học, đích path sessions đúng, không tràn ngang/API request/page error. Đã xem ảnh390; evidence .expo/schedule-layout-preview/overview-simple-*.png. Chưa nghiệm thu Android/iOS hoặc API thật.


## Phân biệt một buổi và toàn lộ trình — 2026-11-09T18:47:36+07:00

- Nút cũ Xem buổi học liên quan dùng relatedSessionId đơn từ participant case, nên mở chi tiết một Session. Đổi nhãn thành Xem buổi học của vụ việc; bổ sung Xem tất cả buổi học mở /paths/[id]/sessions ở chi tiết vụ việc. Không suy rằng tất cả Session của Path đều thuộc cùng vụ việc.
- CTA tổng ở lịch/chốt thống nhất nhãn Xem tất cả buổi học. Buổi tiếp theo ghi rõ Xem buổi học tiếp theo, giữ đích một Session. Màn danh sách đổi title Tất cả buổi học và hiển thị tổng số buổi thật từ Path.
- Source danh sách vốn flatMap tất cả plan rồi sắp xếp startAt, không giới hạn tháng hay chỉ lấy phần tử đầu. Regression mở rộng tới ba Session, hai chiều học/dạy và khác tháng, kiểm đủ ID/plan và thứ tự. Không sửa API hoặc giả lập quan hệ nhiều Session cho vụ việc vì contract chỉ có relatedSessionId đơn.
- Card Trạng thái thỏa thuận rỗng do terminal progress có description nhưng component chỉ render waiting (rỗng). Trạng thái đóng giờ dùng FormNotice gọn với mô tả thật; title progression cũng cụ thể đã hủy/đang tranh chấp/hoàn thành. Các bước khác không có waiting vẫn hiển thị description, không còn panel tiêu đề rỗng.
- 61 focused tests PASS, TypeScript, ESLint file ảnh hưởng, structure910 và diff whitespace PASS; log local ignored .expo/session-navigation-clarity-tests.log. Bao phủ hai loại đích Session/list, cả hai chiều/khác tháng và terminal notices; không đổi mutation/quyền. Chưa nghiệm thu dữ liệu API thật hoặc Android/iOS.


## Thiết kế màn Lịch học — 2026-11-09T18:40:25+07:00

- Theo đính chính của người dùng, card Tình hình học tập chỉ xuất hiện khi chọn bước Lịch học, trước phần lịch. Đối tác giữ vị trí trên thanh bốn bước. Không lặp card ở Cách học/Lộ trình/Hoàn tất; phần không có dữ liệu hữu ích tiếp tục ẩn.
- Phần lịch dùng các dòng phẳng, phân cách nhẹ: vai trò + trạng thái → kỹ năng → số buổi và ngày bắt đầu thực tế nếu có. Bỏ khung xám lồng; nút đề xuất/xác nhận/chốt/xem buổi nằm trong section lịch. Chat thành nút phụ nhẹ. Lịch đã chốt dùng cùng bố cục; không tự suy có lịch nếu payload thiếu schedule/Session.
- Giữ duy nhất một shortcut Session list khi mở bước lịch, kể cả read error. Chỉ thao tác xem Session được giữ cho phép khi read lỗi; điều hướng đề xuất/xác nhận/chốt vẫn blocked theo guard có sẵn. Không đổi mutation hoặc policy backend.
- Màn lịch từng buổi đổi title thành Lịch học, ưu tiên trạng thái hiện tại → hình thức gọn → từng lịch → múi giờ → kiểm tra/chốt. Bỏ chú thích điều kiện trùng và rút dòng múi giờ; thông tin Credit vẫn ở bước chốt.
- 65 focused tests PASS, TypeScript, ESLint các file ảnh hưởng và structure (910 files) PASS. Regression kiểm vị trí card theo bước, thứ tự màn xem lịch, ngày bắt đầu, ONE_WAY/TWO_WAY, read errors và một shortcut Session. Log .expo/schedule-layout-refinement-tests.log.
- Fixture component thật với router/provider/icon/SVG boundary giả lập: 320/390/430px và chữ lớn320; chưa xếp, đủ xác nhận, đã chốt, blocked, một chiều và lịch từng buổi PASS. Kiểm CTA/đổi bước, không tràn ngang, không API request/page error; đã xem ảnh màn chờ và đã chốt. Evidence .expo/schedule-layout-preview. Chưa nghiệm thu API thật/Android/iOS.


## Vị trí đối tác và tổng quan — 2026-11-09T18:04:36+07:00

- Đối chiếu ApiPathDetailScreen tại HEAD: AgreementContext trước AgreementSteps. Đã khôi phục thứ tự đối tác → thanh bốn bước → nội dung bước; giữ thông tin đối tác gọn, không đưa lại mã kỹ thuật.
- Card Tình hình học tập chỉ mount khi chọn bước Lộ trình và thuộc giai đoạn có tổng quan cần hiển thị. Đặt trước nội dung lộ trình; không lặp ở Cách học/Lịch học/Hoàn tất. Nếu không có dữ liệu hữu ích, component tiếp tục ẩn toàn bộ card. Danh sách vẫn chỉ có tóm tắt ngắn.
- Regression kiểm thứ tự đối tác/thanh bước và chọn các bước, kể cả xem lại sau hoàn tất: tổng quan chỉ có ở Lộ trình, Hoàn tất vẫn dùng quyết toán riêng. Không đổi API, quyền hay hành động xác nhận. Kết quả kiểm tra và giới hạn xem các mục ngay dưới; chưa nghiệm thu Android/iOS hoặc API thật.


## Tinh gọn thỏa thuận theo phản hồi — 2026-11-09T18:02:33+07:00

- Bỏ nút Vụ việc liên quan thỏa thuận, nút Xem thỏa thuận và quyết toán và lối mở danh sách vụ việc chung khi không có target cụ thể. Màn tóm tắt giữ Back theo history và fallback; trợ giúp chỉ hiện khi cần bổ sung thông tin. Footer Lộ trình/Lịch học bỏ nút xem lại bước đã có trong stepper.
- Cách học dùng các dòng Hình thức, Credit, Xác nhận; bỏ avatar lặp, khung lồng và hướng dẫn phân công dài. Card lộ trình bỏ số phiên bản, dòng xác nhận và ghi chú Credit lặp. Phần hoàn tất bỏ mô tả lặp và không dựng thêm tổng quan học tập cùng thông tin.
- Giai đoạn null không biến thành một trạng thái giả: không hiện Chưa xác định giai đoạn học hay Dữ liệu chưa đầy đủ. Dữ liệu tiến độ/buổi tiếp theo có thật vẫn hiện; không có gì hữu ích thì bỏ cả khối. List dùng trạng thái Path hiện có khi stage vắng. Không sửa contract hay tự suy giai đoạn học.
- Tổng quan dùng hai thanh tiến độ học/dạy, thời gian buổi tiếp theo và các việc cụ thể cần xử lý. Bỏ timestamp kiểm tra, thông báo không có việc và placeholder không hỗ trợ. Chặn link attention trỏ lại chính thỏa thuận; giữ link tới Session/yêu cầu hủy/vụ việc cụ thể. Read errors/retry và denied-data guards giữ nguyên.
- 78 focused tests PASS, TypeScript, ESLint và structure PASS. Assertions bao phủ stage null nhưng có tiến độ, tổng quan trống/denied, không có nút lặp và target trỏ về chính trang. Log local ignored: .expo/agreement-compact-followup-tests.log.
- Fixture component thật với provider/router/icon giả lập ở 320/390/430px và chữ lớn320: cách học, lịch học, tổng quan đủ/thiếu stage/trống và tóm tắt vụ việc PASS; không tràn ngang, không gọi API/page error. Evidence .expo/agreement-compact-preview. Đã xem ảnh cách học/tổng quan; API thật và Android/iOS chưa nghiệm thu.


## Thiết kế list lộ trình và lịch học — 2026-11-09T17:39:50+07:00

**Source complete; native/API acceptance pending.** Tiếp tục trên working tree hiện tại và giữ các sửa overview/hủy/quyết toán có sẵn.

- Tab dùng nhãn Lộ trình học. Card ưu tiên tên lộ trình, hình thức, đối tác và trạng thái; chỉ hiện một cập nhật theo thứ tự việc cần theo dõi → buổi tiếp theo → tiến độ đã chốt. Bỏ phiên bản, thời điểm cập nhật, giải thích kỹ thuật và các nút dẫn phụ; một nút Xem lộ trình mở đủ chi tiết.
- Tiến trình bốn bước đặt đầu màn thỏa thuận, trên đối tác. Giữ quyền chọn lại bước trước; bước tương lai vẫn khóa. Mỗi bước có trạng thái cho accessibility, màn hình chỉ hiện trạng thái của bước đang xem. Bỏ mã thỏa thuận khỏi context.
- Bước lịch chỉ giữ mô tả ngắn, từng chiều bạn dạy/bạn học, kỹ năng, số buổi, trạng thái và hành động tiếp theo. Bỏ khối chờ trùng từng chiều, số phiên bản và nút nhắc chat trùng footer. Chi tiết kiểm tra Credit vẫn ở bước kiểm tra/chốt hiện có.
- Tổng quan học tập đặt sau nội dung bước; chỉ hiện khi đã khóa, dừng/tranh chấp hoặc có attention trong snapshot. Quyền/API/owner-session guards, mutation và recovery giữ nguyên.
- 66 focused tests PASS, TypeScript, ESLint, structure (910 source files) và diff whitespace PASS. Bổ sung assertions cho ưu tiên thông tin và thứ tự tiến trình/context; regression lịch, xác nhận, điều hướng và hoàn tất giữ nguyên.
- Fixture dùng các component source thật và ranh giới provider/router/icon giả lập: 320/390/430px, chữ lớn320, list, lịch hai chiều, đủ xác nhận/chờ chốt và blocked; kiểm đích CTA và chọn lại bước PASS, không tràn ngang/API request/page error. Evidence local ignored tại .expo/path-redesign-preview; focused log .expo/path-list-redesign-tests.log. Chưa chạy API thật hoặc Android/iOS.


Cập nhật tài liệu: 2026-11-08T16:14:30+07:00.

**Ready for review — source complete; acceptance pending.** Source và regression đã hoàn tất trên nhánh `fix/mobile-proposal-chat-learning-path`; nghiệm thu API thật và Android/iOS còn mở.

## Điều hướng hồ sơ qua avatar

2026-11-08T16:14:30+07:00, trên nhánh hiện tại `fix/learning-path-flow`.

- Entry xem hồ sơ trong Request, chi tiết Proposal/Session, tìm người chia sẻ,
  khám phá mẫu và self-preview chuyển sang avatar. Gỡ nút trùng và chevron của
  hàng không còn nhấn; tên/metadata giữ dạng thông tin. Giữ `requestId` khi mở
  từ Request, ảnh thật/initials và xử lý lỗi ảnh hiện có.
- Phát hiện và sửa hai link tới route không tồn tại `/proposals/[id]` trong
  footer Request và thông báo đề xuất trùng thành `/proposal/[id]`. Regression
  đề xuất trùng kiểm file route đích có thật, đúng ID và không hiện action khi
  đang kiểm tra hoặc read lỗi.
- 32 focused tests đạt, fail 0, skipped 0; TypeScript, ESLint, structure
  (878 source files) và `git diff --check` đạt. Chạy pnpm với
  `pnpm_config_verify_deps_before_run=false` để dùng dependencies hiện có vì
  wrapper mặc định định cài lại modules rồi dừng do no-TTY.
- Phạm vi kiểm chứng là source và host tests; chưa nghiệm thu giao diện,
  Back/gesture trên Android/iOS hoặc luồng hai tài khoản với API triển khai.
  Không xác nhận thêm lỗi nào trong phạm vi rà luồng điều hướng này.

## Tải Hành trình của tôi

Cập nhật 2026-11-04T23:07:58+07:00.

- Learning Path mở trang 20 lộ trình, dựng danh sách bằng FlatList và chỉ đọc
  hồ sơ đối tác cho thẻ đang thấy. Cuộn hoặc chọn tải thêm sẽ lấy trang kế.
- Bộ lọc ghi rõ số lượng tính trên dữ liệu đã tải. Kéo làm mới chỉ đọc danh
  sách lộ trình. Các luồng tra cứu cần toàn bộ lộ trình tiếp tục dùng API cũ.
- Tab Yêu cầu học chỉ đọc tên kỹ năng cho thẻ đang thấy. Cache và scope phiên
  tiếp tục được dùng khi đổi tab.
- 949 test mobile, TypeScript và ESLint đạt. Chưa đo thời gian tải trên thiết bị
  với API thật.

## Rà luồng hoàn tất ngày 2026-11-05

2026-11-05T12:53:07+07:00.

- Lộ trình ACTIVE có đủ buổi COMPLETED tiếp tục đọc lại khi màn đang mở, tới
  khi backend trả kết quả quyết toán. Đã quyết toán hoặc có tranh chấp thì dừng
  lượt đọc định kỳ này. Quyền/state cuối vẫn lấy từ server.
- Lịch học mở theo cả tháng và kéo làm mới query tháng hiện tại.
- 951 test mobile, TypeScript và ESLint đạt. Nghiệm thu thiết bị/API thật còn mở.
- Backend còn lỗi kiểm thử HTTP tại
  `services/api/test/learning-sessions/http.test.mjs:201`: JSON webhook sai
  định dạng trả 500, ca kiểm thử yêu cầu 400. Đã tái hiện ở lượt audit này.

## Đối chiếu nghiệp vụ quyết toán

2026-11-05T13:01:25+07:00.

- Đối chiếu SRS 1.6 mục 18.19/18.40 với service, ledger, handler sự kiện và
  worker. Chờ tất cả Session COMPLETED, hết thời hạn khiếu nại muộn nhất và
  hết tranh chấp chặn trước khi chuyển Path COMPLETED cùng kết quả Credit.
- ONE_WAY trả teacher 96%, phí 4%. TWO_WAY hoàn 96% khoản Held của chính mỗi
  participant, phí 4% mỗi khoản. Phí làm tròn xuống theo snapshot tại lúc khóa.
- Đã build backend và chạy 58 test liên quan. Kiểm tra riêng worker với dữ liệu
  giả lập ONE_WAY 100 Credit và TWO_WAY 20 Credit mỗi người đạt, gồm trước/đúng
  hạn 48 giờ và gọi lại để kiểm tra ledger không bị ghi thêm.
- Đổi panel sau khi mọi buổi hoàn tất thành trạng thái chờ hệ thống quyết toán,
  tránh tiếp tục hướng dẫn chuẩn bị buổi học. 43 test mobile liên quan đạt.
- Chưa đối chiếu cấu hình hoặc giao dịch trên API đang triển khai.

## Kiểm tra xung đột lịch

- Editor đối chiếu draft nội bộ, lịch chiều đối ứng trong Path và Session đã chốt của tài khoản hiện tại ở Path khác. `useExistingScheduleCheck` đọc GET `/sessions/mine` trên toàn dải ngày của draft, kể cả các thẻ thu gọn và lịch điền theo tuần.
- Nút Gửi đề xuất/Lưu thay đổi bị khóa khi có xung đột. Input, Sửa từng buổi và Áp dụng lịch tuần vẫn hoạt động. Sửa hết trùng mở lại nút khi các điều kiện version/read/pending hợp lệ.
- Áp dụng lại cùng template và preflight trước POST/PATCH buộc đọc Session mới. Loading, read lỗi, denied hoặc response đạt giới hạn 100 buổi chặn gửi và giữ draft. Sau await kiểm lại user/generation/range/timestamp draft; chặn preflight trùng và callback cũ.
- Draft và plan đang sửa giữ snapshot; lịch chiều đối ứng lấy từ projection Path mới nhất. Focus epoch vô hiệu hóa callback sau khi rời editor, chặn gửi tiếp sau validation muộn và chặn điều hướng từ response cũ khi quay lại.
- Timestamp giữ phần giây; hai buổi chỉ tiếp giáp không bị coi là trùng. Regression múi giờ đối chiếu 21:00–22:00 UTC+07 với 14:00–15:00 UTC.
- Mỗi buổi cần sửa có một khối cảnh báo, gộp lý do trùng lặp. Trùng nội bộ hiển thị ở buổi sau; panel lịch bận loại Session đã cảnh báo trên thẻ. `ScheduleTimelineItem` đo chiều cao thực tế bằng `onLayout`, nối tới tâm chấm tiếp theo theo gap của consumer.

Giới hạn: preflight mobile chỉ đọc Session của tài khoản đang đăng nhập. Backend kiểm tra lịch của cả hai ở các thao tác lưu và chốt lịch.

Trên `fix/learning-path`, mobile đọc chi tiết 409 từ API để hiển thị khoảng trùng theo giờ thiết bị và phân biệt tài khoản thiếu Credit. Đã chạy 16 test HTTP/Hold, gồm ca kiểm tra lại sau lỗi chốt lịch và API thiếu chi tiết người trả Credit. Còn kiểm tra với API thật trên thiết bị.

## Credit và thông báo lịch trong Chat

`ApiHoldScreen` hiển thị lỗi từ thao tác kiểm tra hoặc chốt lịch gần nhất. Nút **Nạp Credit** mở `/wallet/topup` khi lỗi đó báo tài khoản hiện tại thiếu Credit. Nếu API thiếu chi tiết người trả, nút hiện cho người học của lộ trình một chiều và cho cả hai bên của lộ trình hai chiều.

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
