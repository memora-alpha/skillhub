# Boundary kết nối toàn app

## Đang có và nguồn

[ConnectionGate](../src/providers/ConnectionGate.tsx) ở trong AuthSessionProvider, ngoài SessionGate. [Store](../src/lib/network/connection-store.ts), [probe](../src/lib/network/probe-connection.ts), [use-app-connection](../src/providers/use-app-connection.ts), [HTTP client](../src/lib/http/client.ts), [ConnectionScreen](../src/components/ConnectionScreen.tsx) đã đối chiếu working tree tại HEAD ed5a17dd9f1a6d5e45e1b6af33b17dd4518b46fd.

Offline hiển thị “Bạn đang ngoại tuyến”; transport unreachable “Kết nối bị gián đoạn”; retry “Đang kết nối lại…” và khóa CTA. Dùng theme/fonts hiện hữu. Router và form memory vẫn mounted dưới overlay, touch/accessibility bị chặn; không có offline editing/queue/persistent draft vì điều này.

Device chỉ explicit isConnected=false hoặc isInternetReachable=false mới offline; unknown ban đầu không tự offline. Business HTTP error, protocol/config, cancel và old-session response không thành mất mạng.

## Recovery hiện hành

Manual retry, reconnect hoặc foreground khi đang blocked cùng đi qua retry lock/ticket:

1. Kiểm device connectivity bằng expo-network.
2. GET /api/health tại configured origin, timeout7 giây, no-store/credentials omit; bất kỳ HTTP response chứng minh reachability, không readiness nghiệp vụ.
3. Nếu Auth controller offline thì bootstrap lại.
4. Refetch active Query reads với throwOnError:false. Clear overlay khi connected và ticket không có network failure mới; business read error vẫn thuộc feature, không yêu cầu mọi query business đều success.

Không replay save/upload/verification/payment create hay mutation khác. Retry/read/paging policy từng domain tại [state/session](guides/state-and-session.md); ConnectionGate không thay denied/error/unknown-outcome UI. Thay provider/lifecycle cần kiểm consumer app-wide.

## Pull-to-refresh

Màn cuộn dọc dùng `RefreshableScrollView`, `RefreshableFlatList` hoặc `KeyboardFormScrollView`; native dùng `RefreshControl`, web nhận thao tác kéo chuột/chạm ở đầu danh sách. `AppRefreshProvider` nằm dưới QueryProvider, mặc định refetch các read query đang active và gộp các lần kéo chồng nhau. List có callback refresh riêng vẫn dùng callback đó. Không chạy lại mutation hay query disabled/inactive; form và draft tiếp tục được giữ nguyên. Lỗi vẫn do feature hoặc ConnectionGate xử lý.

## Bằng chứng và giới hạn

[Validation2026-10-10](archive/network-validation-2026-10-10.md) giữ số tests/browser/evidence local được ghi nhận ở lần chạy trước; migration chỉ review source, không chạy lại. Evidence .expo ignored không phải artifact chia sẻ qua Git và chưa xác minh toàn bộ còn tồn tại. Android/iOS airplane mode, modal stacking, hardware Back/foreground resume còn cần thiết bị; web fixture không chứng minh native. Không thêm một offline fullscreen boundary khác cạnh tranh trong feature mới.
