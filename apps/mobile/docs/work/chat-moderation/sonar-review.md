# Rà Sonar phần chat mobile

Nguồn: danh sách finding người dùng dán ngày 2026-11-27, đối chiếu source sau `dd2a4d43` và working tree của lượt sửa này. Danh sách không có issue key hoặc revision của analysis; không coi số finding hay trạng thái cloud là đã xác minh. Không thay cấu hình Sonar, thêm NOSONAR hoặc áp dụng disposition lên cloud.

## Các thay đổi source

- `refresh-loaded-attachments.ts`: thêm initial value rõ ràng cho reduce, giữ phép chọn sequence thấp nhất trong danh sách không rỗng.
- `ChatOutbox.tsx`: listener đồng bộ không dùng async; kiểu listener chấp nhận void/Promise. Dispatcher chuyển mỗi listener thành Promise để vẫn gọi đủ các listener và truyền lỗi qua Promise.all, kể cả callback đồng bộ ném lỗi.
- `chat-attachment-kind.ts`: replaceAll với literal cho từ `tệp`; giữ regex phân biệt đầu câu `Tệp` vì cần capture context.
- Import ảnh đã dán native/web và callback lưu tệp web: bỏ async không có await, giữ Promise/rejection tại boundary. Mã copy/validate/cleanup vẫn giữ owner và AbortSignal hiện có.
- `ChatImageCard`, `ChatWorkflowCard`, `MessageBubble`, `QueuedMessageBubble`: tách lời nhắc ảnh, avatar và header; bỏ các biểu thức lồng nhau, giữ layout/action/khả năng xem ảnh và accessibility.
- `ChatImageMessage`, `ChatFileCard`, `ChatNotice`, `chat-send-notice.ts`, `conversation-preview.ts`: dùng biến và helper có tên cho trạng thái, nội dung cảnh báo và preview; bỏ nested ternary/template, giữ thứ tự sequence và quyền hiển thị tệp.
- `ApiChatScreen.tsx`: enqueue text/tệp trả boolean đồng bộ, bỏ await và async của handler. Guard gửi lặp, reset draft khi enqueue thành công và scroll vẫn giữ.
- `attachment-outbox.ts`: run điều phối các helper chuẩn bị, delivery và failure. Upload được ghi nhận trước khi kiểm tra trạng thái tiếp; phase check được persist trước POST; nhận receipt muộn vẫn giữ file/ID và không replay khi background/đổi owner. Bước hoàn tất tách riêng, giữ bàn giao cleanup ảnh local và chỉ báo delivered từ receipt BE.
- `watch-chat-attachment.ts`: phân loại lỗi pending/tạm thời trong helper, dùng chung backoff và điều kiện lỗi tạm với generic upload watcher; không tăng số retry hoặc tạo READY giả.
- `client.ts`: tách binary response và lần gửi lại sau renewal thành helper; giữ byteOffset/byteLength, lỗi JSON từ binary, generation guards, một lần renew/replay và replayAfterRenewal:false. Đây là HTTP dùng chung trong mobile: phải kiểm auth, chat, profile/evidence và materials qua các regression workspace hiện có.
- `watch-upload-status.ts`: tách đọc/validate status, giữ Promise.all cho các file độc lập trong cùng lượt; gộp cập nhật sau lượt đọc thành công.
- Fixture attachment outbox: bỏ async không có await ở các stub, giữ interface trả Promise.

## Kiểm tra tĩnh cục bộ

Dùng eslint-plugin-sonarjs 4.2.3 với ngưỡng cognitive complexity15, no-nested-conditional, no-nested-template-literals, reduce-initial-value; kết hợp các rule TypeScript await-thenable/require-await. Chạy trên28 file source/fixture được sửa hoặc được nêu trong finding: **0 errors**. Bao gồm helper mới và hàm request HTTP vốn còn complexity22 khi mở rộng kiểm tra cục bộ. Không coi bộ rule/package này tương đương toàn bộ quality profile hoặc version analyzer của SonarCloud.

Tool/script/report chỉ nằm trong `.expo/sonar-check` và `.expo/chat-sonar-analysis.json`, đều ignored; không thêm dependency hoặc lockfile của ứng dụng. Kết quả có8 cảnh báo no-await-in-loop, được rà theo semantics bên dưới.

## Await tuần tự cần giữ — đề xuất Accepted cho S9382

Đây là đề xuất có căn cứ từ source, chưa phải disposition trên SonarCloud. Không thay bằng Promise.all hay đổi sang recursion chỉ để né rule. Scan mới có thể đổi vị trí/issue key sau refactor.

| File | Vị trí await cục bộ | Lý do cần tuần tự |
| --- | --- | --- |
| [attachment-delivery](../../../src/features/messages/outbox/attachment-delivery.ts) |2| Delay backoff phải kết thúc rồi mới GET delivery tiếp; kết quả GET quyết định có cần lượt khác không. Chạy đồng thời có thể gửi thêm GET sau khi terminal hoặc vượt deadline và làm sai guard interruption. Đây là hai vị trí đã chuyển từ run của attachment-outbox. |
| [watch-chat-attachment](../../../src/features/messages/outbox/watch-chat-attachment.ts) |2| GET verdict hiện tại quyết định dừng hay chờ; delay là backoff/đánh thức bằng SSE trước lượt đọc kế. Không tự POST hoặc quét lại. Danh sách người dùng chỉ nêu await delay; rule cục bộ cũng đánh dấu GET trong try/catch. |
| [refresh-loaded-attachments](../../../src/features/messages/utils/refresh-loaded-attachments.ts) |1| Trang vừa đọc xác định những loaded message ID còn thiếu và sequence của batch tiếp theo; giữ cursor hiện tại và tránh tải các gap không cần thiết. Không có một danh sách request độc lập để chạy song song tương đương. |
| [watch-upload-status](../../../src/lib/http/watch-upload-status.ts) |2| Các file trong một lượt đã đọc song song; lượt tiếp và delay phụ thuộc verdict, thời gian còn lại và active/signal của lượt hiện tại. Hai vị trí này là cảnh báo bổ sung của rule cục bộ, không có trong danh sách gốc. |
| [fixture until](../../../tests/fixtures/attachment-outbox.ts) |1| Test cần quan sát state sau từng event-loop turn và dừng khi điều kiện đạt, tối đa30 lượt. Xếp các flush đồng thời không kiểm được các state trung gian như polling tuần tự. |

## Giới hạn nghiệm thu

Source review và kiểm tra tự động không chứng minh SonarCloud đã đóng finding hoặc Quality Gate đã đạt. Cần analysis mới cho revision sửa và disposition riêng cho các await tuần tự. Không chạy API/worker/provider hoặc Android/iOS thật trong lượt xử lý finding này; xem [status](status.md) cho kết quả checks cuối.
