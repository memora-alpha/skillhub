# Trạng thái giảm HTTP 429 mobile

- Cập nhật: 2026-10-23T17:26:02+07:00.
- Trạng thái: Ready for review — triển khai và source checks hoàn tất, API/native chưa nghiệm thu.
- Nhánh: `fix/mobile-chat-rate-limit`.
- Task RL-01 đến RL-08 ở [plan](plan.md) đã thực hiện. Chỉ thay đổi mobile, không sửa BE, web, dependencies hoặc contract API. Không có thay đổi SDK 58; chưa push.

## Source hiện tại

- Inbox/Chat/profile chỉ tự refetch khi stale; explicit refresh vẫn đọc mới. Snapshot nghiệp vụ Proposal/Learning Path giữ chính sách freshness hiện có.
- Metadata proposal/request/skill dùng chung cache theo owner/session giữa nhãn Inbox/compact Chat; tên và profile dùng cùng query. Không tăng TTL avatar hoặc giả thêm field Conversation.
- HTTP tối đa 4 GET đồng thời cho mỗi coordinator/session; request đang chờ bị abort hoặc thuộc session cũ không gửi đến transport. Mutation không được xếp hàng để tự phát lại.
- HTTP giữ retry deadline từ `Retry-After` nếu đọc được, fallback kỹ thuật 60 giây khi thiếu/không hợp lệ. `RATE_LIMITED` trên endpoint ngoài auth dùng cooldown chung; auth/unknown/SSE theo endpoint, các quota nghiệp vụ chat/proposal không bị đổi thành khóa toàn app. Guest/auth và các generation có scope riêng.
- SSE đọc code/deadline; REST hydrate gặp 429 chờ rồi xử lý lại cùng frame/socket, không acknowledge cursor sớm. Handshake 429 giữ cooldown qua focus/retry và chia sẻ giới hạn request chung với HTTP nếu code xác định được.
- Outbox lưu thêm optional `rateLimitedUntil` trong schema v1 tương thích dữ liệu cũ; reconnect/restart không bỏ hạn chờ, giữ clientMessageId/reconciliation/thứ tự. Poll pending tăng từ 2 giây lên tối đa 30 giây theo số lần kiểm.
- Gửi text thành công cập nhật cache thread/preview thay vì invalidate toàn Inbox. Chat, Proposal và Learning Path command dùng target invalidation theo resource; accept Proposal chỉ invalidate chính xác list Conversation.
- App recovery/pull refresh chia sẻ một flight theo QueryClient; dùng lại các page thông báo giữa badge/list và tail history khi cập nhật read receipts. Vẫn đọc đủ trang khi cần xác định unread, không tự suy count/readAt.
- Feedback phân biệt mã quota; ConnectionFeedback chỉ cho retry đọc sau deadline. Giữ draft, cached content, 403/404 và generation guards.

## Bằng chứng kiểm chứng

Môi trường Node v22.19.0, binary đã có trong workspace. `pnpm --filter mobile exec ...` bị wrapper yêu cầu install rồi dừng ở no-TTY; không purge/cài lại dependencies. Đã chạy trực tiếp cùng công cụ của package scripts từ `apps/mobile`.

| Kiểm tra                 | Kết quả và giới hạn                                                                                                                                                                                                                 |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Full mobile tests        | **748 PASS / 752 tổng, 4 FAIL, 0 skipped/cancelled**. Không ghi full suite PASS. Log ignored `.expo/rate-limit-full-tests.log`.                                                                                                     |
| Regression mới           | 14 test mới (đã nằm trong tổng trên): cache/in-flight, exact invalidation, metadata/page reuse, Retry-After, GET concurrency/abort, session switch, SSE cursor/cancel, outbox reconnect/restart, read-receipt tail reuse. Đều PASS. |
| ESLint                   | PASS `node node_modules/eslint/bin/eslint.js . --max-warnings 0`.                                                                                                                                                                   |
| TypeScript               | PASS `node node_modules/typescript/bin/tsc --noEmit`.                                                                                                                                                                               |
| Structure                | PASS `node scripts/check-structure.mjs`, 754 source files.                                                                                                                                                                          |
| Formatting/diff          | Prettier cho TS/TSX thay đổi và `git diff --check` PASS; diff chỉ thuộc `apps/mobile`.                                                                                                                                              |
| Real API / Android / iOS | NOT_RUN. Không có log 429 online hoặc bằng chứng user/native acceptance.                                                                                                                                                            |

### Bốn lỗi baseline đã xác minh riêng

Đã dùng `git archive HEAD` lấy source/tests `dev` vào thư mục ignored `.expo/rate-limit-baseline` và chạy bốn file test liên quan bằng cùng Node/tsx. Kết quả **18 PASS / 22, cùng 4 FAIL**; log `.expo/rate-limit-baseline/apps/mobile/baseline-tests.log`. Không reset/stash/checkout hoặc sửa source baseline để làm test xanh.

- `learning-path-rules.test.ts`: assertion chờ chữ `lộ trình khác`, source trả `Learning Path khác`.
- `proposal-landing-ui.test.ts`: harness không tìm thấy form (`undefined == true`).
- `skills-read-ui.test.ts`: hai ca thiếu mock `@/components/RefreshableFlatList`.

Test Learning Request giả lập liên tiếp 403/429/503 đã chuyển sang client riêng cho mỗi ca độc lập: cooldown 429 mới phải chặn lần gọi tiếp trên cùng client. Không bỏ assertion về HTTP/code hoặc số mutation gửi đến server.

## Giới hạn và bước tiếp theo

1. Nghiệm thu API/native với dữ liệu test: Inbox nhiều hội thoại, chuyển Inbox/Chat liên tục, foreground/reconnect và server 429; đo request thực tế. Host tests không thay nghiệm thu này.
2. BE chưa có summary/batch nên lần tải lạnh vẫn cần request theo từng conversation và quét trang để xác định unread; thay đổi hiện tại giảm số lần lặp và giới hạn đồng thời, không tạo contract mới.
3. Không xác nhận cấu hình limiter/IP của server online; FE không thể bảo đảm loại bỏ mọi 429 do BE/proxy hoặc quota hợp lệ.
4. Các lỗi baseline nêu trên giữ ngoài scope sửa rate limit. Nghiệm thu người dùng: chưa thực hiện.
