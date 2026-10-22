# State session cache và mạng

Đọc khi đổi auth, cache, draft hoặc lifecycle.

## Đang có và nguồn đối chiếu

[SessionController](../../src/features/auth/context/session-controller.ts), [AuthSession](../../src/features/auth/context/AuthSession.tsx), [auth-token-store](../../src/lib/storage/auth-token-store.ts), [token-store](../../src/lib/storage/token-store.ts), [QueryProvider](../../src/providers/QueryProvider.tsx), [network boundary](../network-state.md). Native refresh dùng SecureStore; web chủ ý memory-only, access trong controller RAM. Query retry:false, staleTime:30_000, refetchOnWindowFocus:false, networkMode:always; mutation retry:false/networkMode:always.

## Quy chuẩn cho thay đổi mới

- Tái sử dụng auth session/controller và token store hiện có. Đọc source trước khi mô tả access token/refresh token nằm ở đâu, refresh single-flight và logout thực hiện như thế nào.
- Native refresh-token storage hiện dùng SecureStore; web preview auth hiện có chủ ý memory-only. Không thêm localStorage/cookie persistence hoặc fallback web từ giả định “phải giống native”.
- Web mất session sau full reload có thể là giới hạn đã biết; không sửa bảo mật/lưu trữ chỉ để browser harness chạy qua.
- Bắt scope owner/session trước async operation và kiểm tra scope còn hiện hành trước cập nhật state/cache/navigation. Logout/account switch/expiry phải vô hiệu hóa kết quả của phiên cũ.
- Một response 401 đến muộn không được làm hết hạn phiên mới. Refresh concurrent không được tạo nhiều chuỗi renewal ngoài thiết kế runtime.
- Query key riêng tư bao gồm owner/session hoặc scope đủ mạnh theo cơ chế đang có. Cần phân biệt hai session của cùng một user khi runtime yêu cầu.
- Logout xóa private queries, jobs/listeners và credential theo contract; không chỉ đổi màn hình rồi để dữ liệu riêng còn hiện ở provider cũ.
- Credential/storage initialization lỗi phải có trạng thái rõ. Không fallback sang bộ nhớ kém bền vững nếu workflow cần durable correlation để tránh lặp giao dịch.
- Hợp đồng vòng đời của draft phải ghi cụ thể: chỉ trong route, trong session, hay persisted. Không hứa giữ dữ liệu sau đóng app nếu source chưa làm.
- Storage schema/key có version và migration/cleanup khi thay đổi đáng kể. Không xóa record không rõ trạng thái tài chính để cho phép tạo intent mới.
- Phân biệt secure auth credential, durable payment intent và cache hiển thị. Không coi tất cả là cùng loại dữ liệu lưu trữ.

## Query, mutation, cache và network boundary

- Server state dùng Query infrastructure hiện có. Query keys tập trung theo feature ở nơi source đang tổ chức; không bắt chuyển tất cả về một thư mục mới.
- Provider hiện tại mặc định `retry: false`, `staleTime: 30_000`, `refetchOnWindowFocus: false`, `networkMode: always`; đã đối chiếu tại baseline. Không ghi thành “đã retry network/5xx” nếu code chưa làm.
- Retry riêng cho read phải hữu hạn, có điều kiện và phù hợp 429/backoff/contract. Mutation không retry tự động khi không có bảo đảm cụ thể.
- Sau mutation invalidate/update đúng owner scope và query liên quan. Tránh invalidate toàn app nếu chỉ đổi một tài nguyên.
- Tách initial loading, empty, unavailable/prerequisite waiting, refreshing, stale-with-error và denied theo nhu cầu feature. Disabled query chưa có dữ liệu không tự động là empty hoặc loading vô hạn.
- 403/404 và policy denial được xử lý theo contract. Khi denial đã loại private data, một lỗi transport sau đó không được hồi sinh dữ liệu bị từ chối.
- Không fallback detail sang cached list nếu detail/ownership check đã thất bại và contract không cho phép.
- Giữ query pagination/cursor/order/filter theo server; refresh phải xử lý continuation snapshot đúng. Không ghép trang từ owner/filter khác.
- `ConnectionGate` là boundary mạng toàn app hiện có. Không thêm mỗi feature một cơ chế full-screen offline cạnh tranh.
- Network failure khác business HTTP error, protocol error, cancellation và stale session. Không biến mọi lỗi thành “mất mạng”.
- Reconnect/app resume phục hồi auth bootstrap/read đang cần; không tự replay save, upload, submit, payment create/cancel hoặc mutation khác. Cancel dùng identity riêng ổn định theo Payment ID và chỉ retry từ xác nhận người dùng; timeout không clear durable create correlation.
- Màn bị che bởi connection boundary không nhận touch/accessibility focus. Router và draft có thể vẫn được giữ theo implementation hiện có; điều này không đồng nghĩa offline editing/queue.
- Polling/realtime subscriptions tuân focus/foreground/session và có cleanup. Không để màn hidden hoặc preview tiếp tục đọc tài khoản thật ngoài thiết kế.

## Giới hạn và đề xuất

Không có offline mutation queue hoặc durable evidence jobs. Native durable payment correlation đã có source trong wallet; xem [contract](../contracts/wallet-payments.md) và [status](../work/phase-03-wallet-topup/status.md) để phân biệt synthetic tests với SecureStore/process-kill acceptance chưa được xác minh. Quy chuẩn không tự cấp quyền sửa code cũ ngoài scope.
