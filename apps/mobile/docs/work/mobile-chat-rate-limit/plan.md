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
