# Trạng thái giảm HTTP 429 mobile

- Cập nhật: 2026-10-26T22:07:17+07:00.
- Trạng thái: Ready for review — toàn mobile đã gom loading theo màn hình, dữ liệu phụ dùng placeholder và refresh có cache giữ content; host checks/export Android/iOS/web đạt. Native UX/motion/gesture chưa nghiệm thu.
- Nghiệm thu người dùng: xác nhận “ổn hơn rồi” sau TRACE, chưa xác nhận hết429; yêu cầu bỏ log dư và đổi UX loading. Chưa nghiệm thu native UX mới.
- Nhánh hiện tại cho follow-up toàn app: `fix/mobile-proposal-chat-learning-path`; các mốc giảm429 trước đó thuộc `fix/mobile-chat-rate-limit`.
- Task RL-01 đến RL-08 ở [plan](plan.md) đã thực hiện. Chỉ thay đổi mobile, không sửa BE, web, dependencies hoặc contract API. Không có thay đổi SDK 58; chưa push.

Phần gom loading đã commit tại `36a91c19` trên nhánh hiện tại. Các nhóm Proposal/Chat/Learning Path và bằng chứng kiểm từng staged snapshot được ghi tại [status thỏa thuận](../phase-05-proposal-learning-agreement/status.md). Chưa push; ghi chú chưa commit ở checkpoint cũ giữ theo lịch sử.

## Source hiện tại

- Review tiếp nối đã sửa vùng chờ còn nhận focus bàn phím: web dùng inert/visibility để chặn Tab/focus mà không bỏ layout; native bỏ focus bàn phím khi bắt đầu chờ và không tự focus lại. Children giữ mounted và header/Back còn ngoài vùng chờ.
- `ScreenLoadingBoundary` có store riêng cho screen/modal, gom các read chính vào một loader giữa vùng content; header/Back còn dùng được. Children giữ mounted, tạm ẩn khỏi chạm/accessibility khi chờ để không mất draft và không chặn request phụ thuộc. Cleanup theo loader, không tắt sớm khi read khác vẫn đang chạy; blur không hiện loader của màn cũ.
- AppScreen/Profile/Skills/Auth, thread Chat và modal danh mục đã gắn boundary. Shared LoadingIndicator mặc định đăng ký vào boundary; fallback ngoài scope căn giữa. Dữ liệu phụ/trang tiếp theo dùng placeholder; header refresh nền không vẽ icon. Wallet refresh có data giữ content; lỗi/denial vẫn theo contract. Startup/session, pull refresh và action trên nút giữ feedback riêng.
- Inbox/Chat/profile chỉ tự refetch khi stale; explicit refresh vẫn đọc mới. Snapshot nghiệp vụ Proposal/Learning Path giữ chính sách freshness hiện có.
- Metadata proposal/request/skill dùng chung cache theo owner/session giữa nhãn Inbox/compact Chat; tên và profile dùng cùng query. Không tăng TTL avatar hoặc giả thêm field Conversation.
- HTTP tối đa4 GET đồng thời và4 lượt bắt đầu GET trong mỗi cửa sổ trượt1 giây cho mỗi coordinator/session; request đang chờ bị abort hoặc thuộc session cũ không gửi đến transport. Mutation không được xếp hàng để tự phát lại.
- HTTP giữ retry deadline từ `Retry-After` nếu đọc được, fallback kỹ thuật 60 giây khi thiếu/không hợp lệ. `RATE_LIMITED` trên endpoint ngoài auth dùng cooldown chung; auth/unknown/SSE theo endpoint, các quota nghiệp vụ chat/proposal không bị đổi thành khóa toàn app. Guest/auth và các generation có scope riêng.
- SSE đọc code/deadline; REST hydrate gặp 429 chờ rồi xử lý lại cùng frame/socket, không acknowledge cursor sớm. Handshake 429 giữ cooldown qua focus/retry và chia sẻ giới hạn request chung với HTTP nếu code xác định được.
- Outbox lưu thêm optional `rateLimitedUntil` trong schema v1 tương thích dữ liệu cũ; reconnect/restart không bỏ hạn chờ, giữ clientMessageId/reconciliation/thứ tự. Poll pending tăng từ 2 giây lên tối đa 30 giây theo số lần kiểm.
- Gửi text thành công cập nhật cache thread/preview thay vì invalidate toàn Inbox. Chat, Proposal và Learning Path command dùng target invalidation theo resource; accept Proposal chỉ invalidate chính xác list Conversation.
- App recovery/pull refresh chia sẻ một flight theo QueryClient; dùng lại các page thông báo giữa badge/list và tail history khi cập nhật read receipts. Vẫn đọc đủ trang khi cần xác định unread, không tự suy count/readAt.
- Feedback phân biệt mã quota; ConnectionFeedback chỉ cho retry đọc sau deadline. Giữ draft, cached content, 403/404 và generation guards.
- Theo yêu cầu UX mới, riêng Calendar/Discovery/Inbox dùng loading và tự phục hồi GET âm thầm cho429/5xx/network; giữ cache/empty đã biết và trạng thái denied/session. Trace dài đã được thay bằng log dev ngắn có gộp trùng; xem UX bên dưới.

## Bằng chứng kiểm chứng

Môi trường Node v22.19.0, binary đã có trong workspace. `pnpm --filter mobile exec ...` bị wrapper yêu cầu install rồi dừng ở no-TTY; không purge/cài lại dependencies. Đã chạy trực tiếp cùng công cụ của package scripts từ `apps/mobile`.

| Kiểm tra                 | Kết quả và giới hạn                                                                                                                                                                                                                                                                                                                      |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Full mobile tests        | **855/855 PASS, 0 FAIL/skipped/cancelled** sau review loading/editor; baseline trước review 847/847. Log ignored `.expo/review-full-final.log`.                                                                                                                                                                                          |
| Regression mới           | 4 test mới trong `screen-loading.test.ts`: gom nhiều read/scope độc lập, cleanup hook/unmount, giữ children và một loader ở giữa/focus, Wallet cache/denial. Mở rộng `loading-indicator.test.ts` để kiểm grouped/inline/placeholder/silent và fallback căn giữa. Các regression HTTP/SSE/owner/session hiện có vẫn nằm trong full suite. |
| ESLint                   | PASS `node node_modules/eslint/bin/eslint.js . --max-warnings 0`.                                                                                                                                                                                                                                                                        |
| TypeScript               | PASS `node node_modules/typescript/bin/tsc --noEmit`.                                                                                                                                                                                                                                                                                    |
| Structure                | PASS `node scripts/check-structure.mjs`, 788 source files.                                                                                                                                                                                                                                                                               |
| Android/iOS/web export   | PASS `.expo/review-export-final`; log ignored `.expo/review-export-final.log`. Chỉ chứng minh bundle.                                                                                                                                                                                                                                    |
| Formatting/diff          | Prettier cho TS/TSX thay đổi và `git diff --check` PASS; diff chỉ thuộc `apps/mobile`.                                                                                                                                                                                                                                                   |
| Real API / Android / iOS | Agent chưa chạy nghiệm thu toàn bộ API/native hoặc đo request production. Người dùng xác nhận riêng mở/quay lại Khám phá không còn thấy lỗi sau Reload; xem DISC bên dưới.                                                                                                                                                               |

Follow-up gom loading kiểm chứng tại 2026-10-25T19:55:46+07:00: logs types/lint `.expo/screen-loading-types.log`, `.expo/screen-loading-lint.log`; focused `.expo/screen-loading-focused.log`. Chỉ sửa mobile, không thêm dependency hoặc đổi HTTP/auth/cache/retry/mutation semantics. Không stage/commit/push; không suy ra đã nghiệm thu thiết bị hoặc hết mọi429 từ các kết quả này. Cần kiểm mở lạnh/cached, chuyển tab/modal, Back, keyboard/draft, pull refresh và thanh toán đang xử lý trên điện thoại.

### Review focus và editor sau gom loading

Review 2026-10-25T20:19:39+07:00: full855/855, focused32/32, TypeScript/ESLint/structure788/format/diff và export Android/iOS/web đạt. Logs ignored `.expo/review-full-final.log`, `.expo/review-focused-final.log`, `.expo/review-types-final.log`, `.expo/review-lint-final.log`, `.expo/review-export-final.log`. Regression focus kiểm React DOM markup inert/visibility và Keyboard.dismiss qua host mock, chưa thao tác Tab/bàn phím trên browser/điện thoại thật. Review cũng sửa mất draft editor khi polling; chi tiết thuộc [work thỏa thuận](../phase-05-proposal-learning-agreement/status.md). Không stage/commit/push.

### Bốn lỗi baseline đã xác minh riêng

Đã dùng `git archive HEAD` lấy source/tests `dev` vào thư mục ignored `.expo/rate-limit-baseline` và chạy bốn file test liên quan bằng cùng Node/tsx. Kết quả **18 PASS / 22, cùng 4 FAIL**; log `.expo/rate-limit-baseline/apps/mobile/baseline-tests.log`. Không reset/stash/checkout hoặc sửa source baseline để làm test xanh.

- `learning-path-rules.test.ts`: assertion chờ chữ `lộ trình khác`, source trả `Learning Path khác`.
- `proposal-landing-ui.test.ts`: harness không tìm thấy form (`undefined == true`).
- `skills-read-ui.test.ts`: hai ca thiếu mock `@/components/RefreshableFlatList`.

Test Learning Request giả lập liên tiếp 403/429/503 đã chuyển sang client riêng cho mỗi ca độc lập: cooldown 429 mới phải chặn lần gọi tiếp trên cùng client. Không bỏ assertion về HTTP/code hoặc số mutation gửi đến server.

### Sửa test baseline theo yêu cầu tiếp nối

2026-10-23T21:48:04+07:00: Người dùng yêu cầu xử lý4 lỗi test trên nhánh hiện tại `fix/mobile-chat-rate-limit`. Chỉ sửa3 file test: kỳ vọng thông báo khớp “Learning Path khác”; harness Proposal render component trình bày con để kiểm ApiProposalForm thật qua mock; Skills mock rõ RefreshableFlatList. Giữ các assertion về gửi thành công/thất bại, eligibility, trùng đề xuất và che dữ liệu khi403/404.

Chạy trước sửa:10/14 đạt, tái hiện đúng4 lỗi. Sau sửa:14/14 ở3 file liên quan và762/762 toàn bộ mobile tests đạt, không skip/cancel. Evidence ignored: `.expo/stale-tests-before.log`, `.expo/stale-tests-full.log`. TypeScript, ESLint, Prettier và structure761 source files đạt. Không thay source nghiệp vụ; chưa commit phần sửa test.

## Tối ưu tiếp nối OPT-01–05

2026-10-23T22:13:07+07:00: Hoàn tất source và host checks theo yêu cầu người dùng, giữ nhánh hiện tại và4 test baseline đã sửa.

- Inbox/Chat dùng chung flight trang tin nhắn mới nhất theo QueryClient + owner/session + conversation. Chỉ gộp request đồng thời; pagination/afterSequence/limit riêng không đổi. Hủy một consumer không ngắt consumer còn lại, consumer cuối rời đi hủy transport; logout vẫn cancel theo scope. Không giữ thêm bản tail lâu dài (gcTime0).
- Event mới hủy tail bắt đầu trước event rồi tải snapshot mới; session guard kiểm lại sau bước async để không tạo cache receipt cho phiên cũ. Regression xác nhận2 consumer chỉ có1 request thay thế và response cũ không ghi đè cache mới.
- Đối chiếu read-only events.controller.ts của BE: ready mang cursor hiện tại và được gửi trước replay/pump. Full recovery vẫn chạy ở stream đầu/reset/cursor bị từ chối; resume với cursor và snapshot đã thành công không full reload lại. Replay vẫn reload resource đích và acknowledge sau thành công; receive callback (gồm payment) vẫn nhận ready.
- Inbox lập Map cho preview và nhóm outbox theo conversation, Set cho conversation có outbox; giữ thứ tự gửi, pending/failed, nội dung preview và sort. Bỏ findIndex/filter/some lặp trên toàn danh sách cho từng hội thoại.
- Resource chủ đề gắn conversation IDs vào query meta, tồn tại cùng vòng đời resource. Refresh chỉ làm stale dependency đã đọc cho hội thoại hiện tại, kể cả fallback/lỗi; resource dùng chung vẫn được invalidated, resource khác và session khác giữ nguyên.

12 regression mới trong message-tail, chat-event-recovery, conversation-preview và conversation-resource; toàn bộ774 tests đạt. TypeScript, ESLint max-warnings0, structure762 source files, Prettier và diff check đạt. Chỉ thay mobile; chưa commit/push phần follow-up. Chưa đo request/latency thực tế hoặc nghiệm thu trên API/native.

2026-10-23T22:18:42+07:00: Audit lại concurrency/cancel/SSE, thêm regression event đến khi Inbox/Chat đang tải lần đầu (chưa có cached data). Hydration vẫn đạt, không phát sinh reconnect lỗi; không cần đổi source. Full suite775/775 đạt; types/lint/structure/format/diff đạt. Tổng13 regression tối ưu mới; log `.expo/message-optimization-audit.log`.

## Khám phá DISC-01–04

2026-10-23T22:30:02+07:00: Người dùng báo vẫn dễ429 ở Khám phá và xác nhận trigger “Vừa mở màn / quay lại tab”. Source có3 nguồn: list refetch vô điều kiện theo focus, index đề xuất quét mọi trang theo focus, card tải profile/avatar cả khi ở ngoài vùng nhìn thấy.

- Feed/recommended chỉ focus-refetch khi stale, chia sẻ request đang chạy; tab blur disable list/index và cancel query inactive, giữ query còn được consumer khác sử dụng. Kéo refresh vẫn đọc đủ cursor chain, không tự cancel/restart request đang chạy. Scope mine/detail và command preflight giữ cách đọc nghiệp vụ hiện có.
- Card chỉ enable profile khi đang nhìn thấy và tab active; viewability minimum200ms giảm lượt tải khi lướt nhanh. Tên dùng dữ liệu list có sẵn; card vẫn tải avatar khi được xem, không bỏ tính năng avatar. Cache profile dùng chung owner/session như trước.
- Skill/tag catalog không fetch khi selector đóng/rỗng; tag đã chọn vẫn được tải nhãn ở form readonly. List, catalog search và skill detail nhận AbortSignal; query tìm kiếm cũ bị hủy khi đổi filter.
- 5 test mới trong discovery-request-pressure/discovery-feed-ui/discovery-catalog-ui và bổ sung assertion card offscreen trong sent-request-proposals. Focused16/16, full780/780 đạt; ESLint, structure762, Prettier và diff check đạt. Types được kiểm trước full suite và kiểm lại sau cùng.

Host evidence: tải2 trang rồi focus5 lần khi cache mới không phát sinh thêm request list; stale/explicit refresh vẫn đọc2 trang. Test xác nhận keyword cũ abort transport; UI harness kiểm focus/visibility/catalog và giữ avatar/status khi visible. Logs ignored `.expo/discovery-pressure-focused.log`, `.expo/discovery-pressure-full.log`. Chỉ sửa mobile, chưa commit/push phần follow-up.

2026-10-23T22:31:56+07:00: Types/lint/structure/format/diff và export Android/iOS/web đạt (log `.expo/discovery-pressure-export.log`). Người dùng Reload app, mở/quay lại Khám phá và trả lời “Không còn thấy lỗi”. Đây là xác nhận riêng trigger đã báo; không suy thành nghiệm thu mọi nguồn429, số request production hoặc toàn bộ native/API flows.

## Lịch học CAL-01–03

2026-10-23T22:39:46+07:00: Người dùng xác nhận HTTP429 ngay khi mở Lịch học. Source list dùng staleTime0 và focus/foreground refetch vô điều kiện; Calendar không disable list khi tab inactive. Không có HTTP theo từng card lịch.

- List Session giữ cache30s theo tháng/timezone/owner/generation; focus/foreground chỉ đọc stale query hiện tại và chia sẻ request đang chạy. Tab Calendar inactive disable/cancel list inactive, giữ consumer khác nếu có; chuyển ngày vẫn chỉ lọc tháng đang đọc.
- Detail giữ staleTime0 và đường đọc completion/reschedule hiện có. Explicit retry không cancel/restart read đang chạy; invalidate sau completion vẫn làm stale list.
- SessionFeedback dùng ConnectionFeedback cho429: giữ retryAt, không hiện nút retry trước deadline; cached content vẫn hiển thị,403/404 vẫn ẩn nội dung bị denied.

3 regression mới trong calendar-request-pressure/calendar-feedback-ui. Focused13/13 và full783/783 đạt; TypeScript/ESLint/structure762 source files/format/diff và export Android/iOS/web đạt. Test hook thực xác nhận cache tháng/focus/return, cancel khi blur, detail freshness và403; UI host kiểm feedback429/cached content. Logs `.expo/calendar-pressure-focused.log`, `.expo/calendar-pressure-full.log`, `.expo/calendar-pressure-export.log`. Đã yêu cầu người dùng Reload và kiểm tra lại trigger; chưa ghi nhận kết quả nghiệm thu sau sửa tại mốc này. Chưa commit/push.

## Chuyển nhanh nhiều tab TAB-01–03

2026-10-23T22:49:56+07:00: Người dùng xác nhận sau sửa CAL, chuyển nhanh nhiều tab vẫn gặp429. Không coi kết quả tests CAL hoặc xác nhận DISC trước đó là hết lỗi. Audit source thấy GET coordinator chỉ giới hạn concurrency nên response nhanh vẫn cho phép burst liên tục; Home wallet ép refetch mỗi focus dù snapshot còn mới, preview kỹ năng Hồ sơ cũng stale0 và refetch mỗi focus.

- Coordinator GET dùng chung giãn lượt bắt đầu theo cửa sổ trượt: tối đa4 lượt/1 giây và vẫn tối đa4 đang chạy. Đây là policy client để giảm burst, không phải quota được xác nhận của server. Các list/preview lạnh lớn có thể cần thêm thời gian chờ. Abort loại request đang chờ và dọn timer; generic429 từ HTTP/SSE loại request chờ ngay, không đợi rồi replay sau cooldown. Business/endpoint quota vẫn đúng scope; mutation giữ cách gửi trực tiếp hiện có.
- Wallet focus/foreground chỉ đọc query active/stale và gộp in-flight; giữ staleTime30s đã có, explicit refresh, invalidation và financial command preflight. Không đổi cách tính số dư hoặc payment outcome.
- Riêng preview kỹ năng trên Hồ sơ dùng freshness30s, disable khi tab inactive và focus refresh khi stale; refresh đang chạy được gộp. Màn quản lý/detail vẫn stale0, explicit refresh và403/session guards giữ nguyên.

4 regression mới kiểm burst12 reads qua nhiều endpoint với response tức thì, abort khi chờ, mutation không bị xếp hàng/replay,429 loại hàng đợi, wallet8 lượt focus/foreground, invalidation/explicit refresh, preview skill/cache/denial và management freshness. Focused31/31, full787/787; TypeScript, ESLint max-warnings0, structure762 source files, format/diff và export Android/iOS/web đạt. Logs ignored `.expo/tab-pressure-focused.log`, `.expo/tab-pressure-full.log`, `.expo/tab-pressure-export.log`. Chưa commit/push. Chưa đo lưu lượng server online hoặc nghiệm thu lại chuyển nhanh tab sau follow-up này.

## Tái hiện sau TAB và chẩn đoán TRACE-01–03

2026-10-23T23:01:33+07:00: Người dùng vẫn gặp lỗi sau TAB, xác nhận ở Lịch học/Khám phá rồi bổ sung Tin nhắn. Bộ giới hạn4 GET/giây chỉ giảm burst, không bảo đảm tuân thủ quota theo phút hoặc quota IP dùng chung. Đọc source SharedRequestGuard thấy quota chung theo IP cho mọi endpoint trừ Health; cấu hình local hiện120 request/60s, không có bằng chứng đây là cấu hình server mà thiết bị đang dùng. Không sửa BE hoặc cấu hình môi trường.

- Tin nhắn trước đó vẫn bật list/preview và query profile/context của các row trên tab được giữ mounted. Theo focus, nay disable list/preview/profile/context và cancel query inactive bằng exact key/prefix phù hợp. Query còn consumer active không bị hủy; giữ cache, denied/session guards. Invalidation từ SSE vẫn đánh dấu stale; consumer enable lại sẽ đọc dữ liệu cần cập nhật. Không tắt stream hoặc thay cursor acknowledgment.
- HTTP/SSE thêm log dev `[http:429]`: nguồn `server` là lỗi sau gọi transport; `client-cooldown` là request bị chặn trước transport. Ghi method, endpoint đã che ID/query, code chuẩn, thời gian chờ phía client và mẫu tối đa512 lượt transport trong60s nhóm theo endpoint. Không log token, body, headers, raw URL/query, ID hoặc dữ liệu hội thoại; production không thu buffer/emit. Cooldown log trùng được gộp đến deadline.
- Không có terminal app gắn với thread; Metro inspector local trả danh sách target rỗng khi kiểm tra. Chưa lấy được trace trên thiết bị. Đã yêu cầu người dùng Reload, tái hiện và gửi dòng `[http:429]` đầu tiên có `source:server`, thay vì chỉ hỏi còn lỗi hay không.

6 regression mới: phân biệt server/client-cooldown qua HttpClient thực, redaction/window/buffer/production, cancel disabled connection read giữ cache, Inbox blur không hủy query còn consumer active và row disable giữ cache identity. Focused22/22, full793/793 đạt; TypeScript, ESLint max-warnings0, structure763, Prettier và diff check đạt. Export Android/iOS/web đạt tại2026-10-23T23:03:43+07:00. Logs ignored `.expo/rate-trace-focused.log`, `.expo/rate-trace-full.log`, `.expo/rate-trace-export.log`. Chưa commit/push; chưa kết luận nguyên nhân online hoặc hết429.

## UX loading và phục hồi âm thầm UX-01–03

2026-10-24T13:13:18+07:00: Người dùng báo “ổn hơn rồi” và yêu cầu bỏ log không cần thiết, màn chưa tải kịp giữ loading, chỉ log kỹ thuật cho lỗi tạm thời. Đây là xác nhận cải thiện tương đối, không phải hết429 hoặc nghiệm thu mọi tab.

- Calendar, Discovery và Inbox không hiện banner/thông báo lỗi đọc429,5xx/network. Chưa có data hiển thị loading; có cache giữ content và cả empty state đã xác định từ lần đọc thành công. Paging gặp lỗi tạm thời giữ các trang trước và hiện loading ở footer. Preview/unread đã biết giữ nguyên khi refresh tạm lỗi, preview chưa đọc hiển thị “Đang tải tin nhắn…”. Không thay mutation feedback, quyền403/404, session hoặc business conflict thành loading.
- Chỉ các GET của màn này tự phục hồi:429 đợi đến retryAt (fallback60s); network/5xx backoff5/10/20/40s. Một timer mỗi consumer, gộp in-flight query, cancel timer khi inactive/fetching/unmount và reset backoff khi thành công. Inbox chỉ retry preview lỗi đang active; Discovery retry trang tiếp theo đúng cursor nếu paging lỗi. Không tự replay mutation hoặc bỏ qua guard session.
- Đã gỡ toàn bộ bộ đếm transport/mẫu512 requests và log `client-cooldown`. Log dev `[http:read]` chỉ giữ method, endpoint đã che ID/query, loại/status/code và thời gian chờ phía client cho lỗi tạm thời thực tế; gộp trùng ít nhất60s. Không thêm telemetry ngoài hệ thống; production giữ cấu hình không emit hiện có. Không còn yêu cầu người dùng thu trace dài cũ để nghiệm thu UX này.

Full796/796 tests đạt. Regression mới kiểm deadline/backoff, một timer, callback mới nhất, blur/fetch/permission/success; mở rộng UI Calendar/Discovery/Inbox về loading, cached content/empty và403; cập nhật log tests về redaction/dedupe và bỏ counters. Focused10/10 trước ca Inbox bổ sung, full suite đã bao gồm ca mới. TypeScript, ESLint, structure764 và format/diff đạt. Export lượt đầu bị dừng do bundler dùng nhiều CPU/memory và không tiến triển; chạy lại với max-workers2 đã đạt Android/iOS/web tại2026-10-24T13:20:58+07:00. Evidence ignored `.expo/quiet-read-focused.log`, `.expo/quiet-read-full.log`, `.expo/quiet-read-export.log`. Chưa commit/push; native UX cần kiểm trên app, không suy host tests thành nghiệm thu.

## Loading hai chấm UX-04

2026-10-24T13:27:55+07:00: Người dùng yêu cầu đổi loading, tham khảo TikTok. Tạo LoadingIndicator dùng chung: hai chấm đổi chỗ và co giãn nhẹ khi giao nhau, chu kỳ1s, màu brand/sage từ theme SkillHub. Đây là animation chỉ báo trạng thái tải, không thêm chuyển động khi đổi tab hoặc tác động API.

Dùng Reanimated CSS keyframes đã có trong SDK58, chỉ animate transform (translateX/scale), không setState theo frame hoặc thêm dependency. Dừng animation và giữ hai chấm tĩnh khi blur/background/reduced motion; theo dõi thay đổi accessibility preference và dọn listeners khi unmount. Root có progressbar/busy và nhãn đọc phù hợp, chỉ một phần tử accessibility cho cả loader.

Thay spinner trong feedback kết nối dùng chung, SessionFeedback, RequestLoading/footer và footer Inbox. Các màn khác dùng những component chung này cũng nhận hình loading mới; auth/profile/wallet không đổi guard, query hoặc mutation. RefreshControl kéo để tải lại vẫn dùng cơ chế nền tảng hiện có.

Focused8/8 và full797/797 đạt, gồm test loading lifecycle/reduced motion/accessibility và các regression cached/error trước đó. TypeScript, lint các file ảnh hưởng, structure765, format/diff và export web đạt. Logs ignored `.expo/loading-dots-focused.log`, `.expo/loading-dots-full.log`, `.expo/loading-dots-web.log`. Chưa kiểm cảm giác animation trên release build/thiết bị Android/iOS; không coi host tests hoặc web bundle là nghiệm thu native. Chưa commit/push.

## Loading đồng bộ và màn chờ kết nối UX-05–07

2026-10-24T13:48:53+07:00: Người dùng yêu cầu đồng bộ kéo tải xuống mọi screen, bỏ màn thông báo mất mạng và chọn loading phù hợp SkillHub theo tham chiếu các app. Chọn loading hai chấm cam brand/xanh sage, giữ màu/theme và chuyển động nhẹ đã có. Theo [nguyên tắc nhất quán của Material](https://m2.material.io/components/progress-indicators), dùng cùng chỉ báo trong các ngữ cảnh tải; không khẳng định mô phỏng chính xác hành vi Facebook/YouTube.

- Mọi native ActivityIndicator trong source mobile chuyển sang component chung, gồm startup/font/session, skills/evidence, profile, notifications và wallet/payment; không đổi command, quyền hoặc outcome. Size small/large vẫn được hỗ trợ. LoadingScreenBoundary cung cấp focus trong AppScreenLayout; component mặc định không gọi navigation hook nên dùng được trước khi navigator có sẵn.
- Pull-to-refresh qua wrapper chung cho scroll/list/form, thêm Notifications/TransactionHistory và gỡ các RefreshControl override riêng. Native giữ gesture và callback nền tảng, spinner native trong suốt, chỉ báo hai chấm dùng chung; touch observer chỉ hiển thị preview, không tự gọi refresh. Wrapper native giữ cùng vị trí child khi disable scroll để tránh mất form. Web vẫn giữ threshold/dọc/đầu danh sách và chỉ cập nhật UI theo mốc kéo, không setState từng pixel. Wallet không hiện thêm inline refresh khi boundary đã hiển thị loader.
- ConnectionScreen hiển thị skeleton card tĩnh và “Đang tải nội dung…”, bỏ icon Wi-Fi/thông báo lỗi/nút Thử lại. Preview offline dùng cùng màn này. ConnectionGate giữ router/form mounted; Chat giữ ngoại lệ text outbox hiện hữu và trạng thái gửi riêng. Recovery chờ5/10/20/30 giây, tối đa30 giây giữa các lần tiếp theo, chỉ một timer; background/unmount/đang retry dừng timer, thành công reset backoff. Foreground/reconnect qua cùng retry lock; thiết bị offline rõ ràng không gọi health HTTP. Chỉ active read được refetch, không replay mutation.

Full801/801 tests đạt (bao gồm4 regression mới: scheduler backoff/background/reset và probe chậm, native pull callback/preview/child identity, offline loading UI). TypeScript, ESLint max-warnings0, structure767 source files, Prettier và diff check đạt. Export Android/iOS/web max-workers2 đạt. Logs ignored `.expo/unified-loading-focused.log`, `.expo/unified-loading-ui.log`, `.expo/unified-loading-full-final.log`, `.expo/unified-loading-types.log`, `.expo/unified-loading-lint-final.log`, `.expo/unified-loading-export.log`. Không sửa BE/shared/root dependencies; chưa commit/push. Chưa kiểm native gesture, modal stacking, airplane mode/reconnect hoặc cảm giác motion trên điện thoại.

## Palette loading sáng hơn

2026-10-24T13:52:59+07:00: Theo yêu cầu làm sáng hai chấm loading, palette dùng chung đổi thành cam đào `#F07850` và xanh mint `#40AF91`. Gỡ color override của các consumer để startup/auth/profile/skills/notifications/wallet và pull refresh cùng nhận palette này; màu theme của nút/chữ không đổi. Ba tests loading/pull/offline UI hiện có, TypeScript và lint file ảnh hưởng đạt; không chạy lại toàn bộ suite/export cho thay đổi màu thuần presentation. Chưa xác nhận màu trên thiết bị, chưa commit/push.

## Rà lại sau đổi màu UX-08

2026-10-24T14:03:51+07:00: Full suite sau đổi màu đạt801/801. Audit tìm thấy một lỗi web pull: effect phụ thuộc callback refresh đổi identity khi parent render lại, dọn listeners và mất khoảng kéo đã đạt threshold; thả tay không gọi refresh. Regression mới tái hiện fail trước sửa (log `.expo/loading-audit-web-repro.log`). PullRefreshBoundary dùng ref callback mới nhất và giữ listeners khi chỉ callback đổi, nên cùng gesture gọi đúng callback hiện tại một lần; không đổi native gesture hoặc API.

Sau sửa: focused6/6 và full802/802 đạt. TypeScript, ESLint max-warnings0, structure767, Prettier và diff check đạt. Export Android/iOS/web trước sửa web effect đạt; export web sau sửa đạt. Evidence ignored `.expo/loading-audit-fixed.log`, `.expo/loading-audit-full-final.log`, `.expo/loading-audit-types-final.log`, `.expo/loading-audit-lint-final.log`, `.expo/loading-audit-export.log`, `.expo/loading-audit-web-final.log`. Chưa phát hiện lỗi khác qua source/host checks trong phạm vi rà lại; chưa chạy native/API acceptance hoặc khẳng định hết mọi429. Không commit/push.

## Giới hạn và bước tiếp theo

2026-10-24T14:22:54+07:00 — QA-01–03: Theo danh sách Sonar người dùng gửi sau commit ffa118c7, tách helper nhãn lỗi SessionFeedback, helper validateRequestOptions/readResponse của HTTP send và thay cờ attempted bằng nguồn diagnostics trực tiếp. Footer Inbox dùng if/else độc lập; props LoadingIndicator/LoadingScreenBoundary dùng Readonly; gộp import connections. Hydration429 dùng async retry tuần tự sau pause thay await trong loop, giữ cùng handler/signal và không chuyển sang xử lý frame song song.

Focused39/39 trước3 regression mới, full805/805 sau bổ sung đạt. Tests mới kiểm repeated429 không overlap/dừng sau cancel, aborted/non429 không retry, Axios rejected429 giữ Retry-After và cooldown. TypeScript, ESLint toàn mobile, rule no-await-in-loop/no-duplicate-imports trên file ảnh hưởng, structure767, Prettier/diff đạt. Logs ignored `.expo/sonar-cleanup-focused.log`, `.expo/sonar-cleanup-full.log`, `.expo/sonar-cleanup-types.log`, `.expo/sonar-cleanup-lint.log`, `.expo/sonar-cleanup-rules.log`. Không cài Sonar analyzer/package mới; local ESLint không có cognitive-complexity của Sonar, nên chưa ghi nhận analyzer score hoặc khẳng định remote issues đã đóng. Cần CI phân tích lại; chưa commit/push follow-up. Không đổi SDK/dependency/API/BE; không chạy lại native/export cho refactor này.

1. Nghiệm thu API/native với dữ liệu test: Inbox nhiều hội thoại, chuyển Inbox/Chat liên tục, foreground/reconnect và server 429; đo request thực tế. Host tests không thay nghiệm thu này.
2. BE chưa có summary/batch nên lần tải lạnh vẫn cần request theo từng conversation và quét trang để xác định unread; thay đổi hiện tại giảm số lần lặp và giới hạn đồng thời, không tạo contract mới.
3. Không xác nhận cấu hình limiter/IP của server online; FE không thể bảo đảm loại bỏ mọi 429 do BE/proxy hoặc quota hợp lệ.
4. Bốn lỗi test baseline đã được sửa theo yêu cầu tiếp nối bên trên; kết quả cũ giữ làm lịch sử. Người dùng xác nhận riêng Khám phá DISC; nghiệm thu các luồng API/native khác của thay đổi rate limit còn mở.
