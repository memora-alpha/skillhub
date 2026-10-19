# HTTP client và lỗi

Đọc khi gắn API, envelope, lỗi, cancel hoặc retry.

## Đang có và nguồn đối chiếu

[client](../../src/lib/http/client.ts), [response](../../src/lib/http/response.ts), [errors](../../src/lib/http/errors.ts), [env](../../src/config/env.ts). Timeout Axios mặc định 20_000 ms, AppError có kind/status/code; request trả unknown, requestPage giữ pagination. Protected 401 renew/replay tối đa một lần cùng generation; replayAfterRenewal:false chặn replay bytes.

## Quy chuẩn cho thay đổi mới

- Điểm vào hiện tại nằm ở `src/lib/http/client.ts`, `response.ts`, `errors.ts`; không tạo một `services/api.ts` thứ hai vì prompt mẫu dùng tên đó.
- Luồng trách nhiệm điển hình: route → feature screen/view → hook/controller/runtime → API adapter → shared HTTP client. Cho phép composition hiện có; không bắt thêm controller hook nếu chỉ chuyển tiếp không có logic.
- API adapter chỉ nhận tham số, gọi đúng endpoint, parse response và trả dữ liệu/domain error. Feedback, navigation và text hiển thị thuộc tầng UI/runtime phù hợp.
- Bóc envelope và pagination bằng helper hiện có. Giữ đúng `204` không có body, lỗi HTTP, protocol và metadata; không bọc thêm một envelope mới ở feature.
- Dùng `AppError` hiện có và các field thực tế (`kind`, `status`, `code` tại baseline). Không đổi tên sang `ApiError`, không thêm `requestId` giả hoặc `NETWORK_ERROR` giả chỉ để giống dự án khác.
- Quyết định UI theo error code/status/kind được contract/runtime cung cấp, có fallback an toàn. Không đưa thẳng arbitrary server message, stack trace hoặc response body lên màn hình.
- Timeout mặc định source hiện tại là 20 giây; ghi là thực trạng. Timeout riêng cho upload/long operation phải có căn cứ và được xác nhận trong công việc liên quan, không thay bằng các con số của Memora.
- Truyền AbortSignal khi runtime hỗ trợ; phân biệt cancel với network failure. Abort không đủ để ngăn late response tác động phiên mới: vẫn cần scope/generation guards theo runtime.
- Không bypass shared client hoặc gắn Authorization thủ công ở component. Presigned upload có thể dùng transport riêng theo contract, không gửi bearer tới host storage/provider.
- `Idempotency-Key`, retry hoặc replay chỉ dùng nơi endpoint và workflow hỗ trợ. Không gắn một key ngẫu nhiên mới cho mỗi lần retry cùng một ý định.
- Phân biệt automatic query retry, auth renewal/replay và explicit business replay. Ba cơ chế này không được coi là một.
- Với mutation có kết quả không rõ, chỉ lặp lại khi semantics contract bảo đảm và workflow cho phép; không retry mù vì timeout/401.

## Giới hạn và đề xuất

Transport hỗ trợ renewal/replay không đồng nghĩa mọi mutation đã có business idempotency; LR chưa có guarantee đó. Quy chuẩn không tự cấp quyền sửa code cũ ngoài scope.
