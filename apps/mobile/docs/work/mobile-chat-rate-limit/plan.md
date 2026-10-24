# Giảm request và xử lý HTTP 429 trên mobile

## Mục tiêu và phạm vi

Nhánh `fix/mobile-chat-rate-limit`, bắt đầu từ `dev`. Chỉ thay đổi `apps/mobile`, giữ API/BE, quyền và nghiệp vụ hiện tại. Nguồn: yêu cầu người dùng trong chat và audit source Inbox/Chat, HTTP, notifications, lifecycle. Không thêm endpoint/avatar/summary chưa có, không tự replay mutation.

## Task theo thứ tự thực hiện

- [x] RL-01: Giảm refresh do focus/foreground khi cache còn mới; gộp request đang chạy. Giữ explicit refresh và freshness của các thao tác nghiệp vụ.
- [x] RL-02: Tái sử dụng cache metadata Inbox/Chat, giới hạn request đọc đồng thời và giảm invalidation sau gửi tin/command xuống đúng resource.
- [x] RL-03: Giữ thông tin `Retry-After`, thêm cooldown theo scope đã biết cho HTTP 429, fallback có giới hạn; không retry mutation tự động và không coi 429 là mất mạng.
- [x] RL-04: SSE giữ code/thời gian chờ, tránh reconnect/hydrate liên tục khi gặp 429; không xác nhận cursor trước hydrate thành công.
- [x] RL-05: Outbox giữ cooldown qua reconnect/restart, gộp giới hạn chung khi phù hợp, giảm polling pending kéo dài; giữ ID, thứ tự và reconciliation.
- [x] RL-06: Phối hợp app recovery/pull refresh; tái sử dụng trang notification/read-receipt và hạn chế đọc lại không cần thiết mà không suy tổng unread/readAt.
- [x] RL-07: Feedback 429 theo code, không khuyến khích retry liên tục; giữ draft/cache và quyền/session boundaries.
- [x] RL-08: Regression về request counts, cache, cooldown, SSE cursor, outbox identity/lifecycle và logout; chạy mobile tests, lint, types, structure, review diff và cập nhật status. Full suite còn 4 lỗi baseline đã tái hiện trên source `dev`; xem status.

## Tối ưu tiếp theo theo yêu cầu

- [x] OPT-01: Inbox và Chat chia sẻ request trang tin nhắn mới nhất theo owner/session; event mới không dùng lại request bắt đầu trước event.
- [x] OPT-02: Stream mới/reset đồng bộ đầy đủ; reconnect có cursor đã xử lý snapshot thành công không lặp full reload, giữ replay và payment consumers.
- [x] OPT-03: Lập Map/Set cho kết quả preview và outbox để bỏ tìm kiếm lặp theo từng hội thoại; giữ thứ tự/pending/failed/unread.
- [x] OPT-04: Refresh chủ đề chỉ làm stale các resource thực sự đọc cho hội thoại đó, gồm fallback và lỗi, giữ scope session.
- [x] OPT-05: Regression concurrency/cancel/session/reset/denied, full tests và checks mobile; không sửa BE.

## Khám phá: mở màn và quay lại tab

- [x] DISC-01: Feed/recommended và trạng thái đề xuất dùng cache còn mới khi focus, chia sẻ refresh đang chạy; dừng query khi tab không hoạt động, giữ owner/detail preflight.
- [x] DISC-02: Card Khám phá chỉ tải avatar ở vùng nhìn thấy; catalog chỉ tải khi mở hoặc cần nhãn tag đã chọn. Giữ tên/avatar và status khi người dùng xem card.
- [x] DISC-03: Truyền AbortSignal cho list/catalog để đổi tìm kiếm/bộ lọc và blur không để request cũ tiếp tục; explicit refresh/load-more không tự hủy/restart request đang chạy.
- [x] DISC-04: Regression request count/focus/cancellation/visibility và full mobile checks; không sửa BE, không giả định quota server.

## Lịch học: HTTP429 khi mở màn

- [x] CAL-01: List lịch dùng freshness30s và refresh gộp theo query hiện tại; tab inactive dừng list, chọn ngày chỉ lọc dữ liệu tháng, chuyển tháng hủy read cũ. Detail/action vẫn đọc mới.
- [x] CAL-02: Feedback429 giữ cached content và chờ hết cooldown trước retry; không tự gửi mutation hay retry request liên tục.
- [ ] CAL-03: Regression request count/calendar focus/month/denial/cooldown, mobile checks và nghiệm thu lại trigger đã báo.

## Chuyển nhanh nhiều tab

- [x] TAB-01: Giãn các lượt GET trên coordinator chung, giữ concurrency, abort/session và cooldown; mutation không xếp hàng hoặc replay.
- [x] TAB-02: Bỏ focus refetch vô điều kiện của Home wallet và preview kỹ năng Hồ sơ; dùng cache mới, giữ explicit refresh, invalidation và detail/action preflight.
- [ ] TAB-03: Regression burst nhiều endpoint, request bị hủy trong hàng đợi, 429/session switch và focus cache đã đạt cùng mobile checks; còn nghiệm thu lại chuyển nhanh nhiều tab trên app.

- [x] TRACE-01: Ghi nhận TAB vẫn lỗi trên Lịch học/Khám phá/Tin nhắn; phân biệt429 từ server với cooldown client bằng log dev có endpoint ẩn ID/query và đếm transport gần đây.
- [x] TRACE-02: Dừng list/preview/profile/context Tin nhắn khi tab inactive, giữ query đang có consumer khác và SSE/session semantics; thêm regression lifecycle.
- [ ] TRACE-03: Chạy checks và lấy log429 đầu tiên từ app để xác minh nguyên nhân online, không khẳng định quota hoặc hoàn tất nghiệm thu từ host tests.

## Trải nghiệm tải dữ liệu

- [x] UX-01: Theo yêu cầu mới, lỗi đọc tạm thời chuyển sang loading khi chưa có dữ liệu, giữ cache khi refresh; giữ denied/session và trạng thái empty thật.
- [x] UX-02: GET tự phục hồi có backoff/Retry-After khi màn active, hủy timer khi blur; không replay mutation.
- [x] UX-03: Bỏ trace đếm request và log cooldown lặp, giữ log kỹ thuật ngắn đã che dữ liệu riêng; kiểm tra recovery/UI và cập nhật nghiệm thu. Native UX sau thay đổi chưa được người dùng xác nhận.
- [x] UX-04: Loading hai chấm đổi chỗ/chồng nhẹ theo tham chiếu TikTok người dùng nêu, màu brand/sage SkillHub; dùng component chung cho feedback đọc, Calendar, Discovery và Inbox; giữ reduced motion/focus/foreground/accessibility. Host checks/web export đạt, native feel chưa kiểm.

- [x] UX-05: Đồng bộ mọi ActivityIndicator và pull refresh sang LoadingIndicator; startup không cần navigation context, refresh giữ gesture gốc, callback/rate-limit và trạng thái form/tài chính.
- [x] UX-06: Regression wrapper/native gesture, caller callbacks, loading accessibility/focus và kiểm các consumer toàn mobile; native feel/gesture còn cần nghiệm thu thiết bị.
- [x] UX-07: Đổi offline/unreachable thành màn loading với skeleton, bỏ thông báo mất mạng và nút thử lại; tự phục hồi qua retry lock/backoff có giới hạn, background dừng timer, không replay mutation. Chat giữ text outbox hiện hữu.
- [x] UX-08: Rà lại sau đổi màu; sửa web pull mất gesture khi parent cập nhật callback giữa lúc kéo, thêm regression và chạy lại full mobile checks.

## Tiêu chí nghiệm thu

- Mở Inbox → Chat → quay lại trong freshness window không ép tải lại dữ liệu đã mới; explicit refresh vẫn đọc server.
- Request đọc có giới hạn đồng thời, abort/session cũ không thực hiện tác động mới; 403/404 vẫn che dữ liệu bị denied.
- 429 không tự renew session, không kích hoạt mất mạng, không tự phát lại mutation; cooldown không bị bỏ qua bởi focus/reconnect.
- SSE vẫn đọc bù và chỉ xác nhận cursor sau dữ liệu tương ứng thành công; không mất sự kiện khi gộp refresh.
- Outbox không gửi trùng, giữ clientMessageId và thứ tự, vẫn đối chiếu kết quả chưa rõ.
- Không cache avatar vượt hạn URL mà không có cách làm mới; không tăng staleTime chung cho snapshot nghiệp vụ.
- Test host không thay nghiệm thu API online/hai tài khoản/native. Chưa có log server để khẳng định hết mọi nguồn 429.

## Kiểm tra

Focused Node/tsx tests với fake clock, transport và QueryClient thật khi phù hợp; `pnpm --filter mobile test`, `lint`, `check-types`, `check-structure`. API/native thực hiện riêng khi có môi trường/tài khoản, ghi NOT_RUN nếu chưa chạy. Commit theo yêu cầu tiếp theo của người dùng; không push/deploy trong phạm vi này.
