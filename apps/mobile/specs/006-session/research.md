# Research: Session mobile

Đối chiếu source HEAD `01ced64`, ngày 2026-10-14; research read-only, chưa gọi API thật.

## Hạ tầng và cache

- **Decision**: Dùng Auth runtime.client, QueryProvider và Zod; SessionsProvider theo pattern RequestsProvider, key user/generation, cancel/remove khi đổi phiên.
- **Rationale**: HTTP có generation boundary/replayAfterRenewal; Query đã tắt retry. Không cần client/dependency mới.
- **Alternatives considered**: Local preview không phản ánh account thật; client riêng lặp auth; offline/persistent cache ngoài scope.
- **Evidence**: `src/lib/http/client.ts`, `src/providers/QueryProvider.tsx`, `src/features/learning-requests/context.tsx`.

## Màn và form

- **Decision**: Giữ MonthCalendar/routes/UI, tách sessions/screens.tsx theo màn để đạt file-size rule. Form dùng ControlledInput/RHF và parseLocalDateTime hiện có, không thêm picker.
- **Rationale**: DataForm nhận callback đồng bộ và thiếu pending/disabled cho HTTP. Form feature hỗ trợ async tránh sửa tất cả consumer.
- **Alternatives considered**: Sửa DataForm toàn app hoặc import picker private của Learning Request làm scope lớn hơn.

## Mutations

- **Decision**: Ref khóa double tap + pending; POST không retry/replay. Success giữ receipt và refetch; timeout/5xx đọc lại trước retry.
- **Rationale**: Chưa có guarantee idempotency cho commands. Completion trả id/status, propose trả version nhưng không confirm tác giả.
- **Alternatives considered**: Optimistic COMPLETED, tự tăng version, Idempotency-Key chưa được backend hỗ trợ hoặc tự replay đều bị loại.

## Dependency

- **Decision**: US4 không gửi command khi chưa có read contract; GAP-02 backend owner xác minh. Gate HTTP detail trước nghiệm thu US2/US3.
- **Rationale**: Scheduling chỉ có POST. Detail trả raw Session có BigInt; success() chỉ bọc data, chưa thấy serializer ở main/app.module. Có thể lỗi JSON, chưa kết luận runtime fail.
- **Alternatives considered**: Giữ proposal trên máy người gửi hoặc dùng preview cho đối phương không đáp ứng reload/two-user scenarios.
- **Evidence**: [checkpoint](contracts.md); backend learning-sessions/scheduling services, Prisma schema và shared/http/response.ts.

## Lịch và projection

- **Decision**: Query from/to tháng rõ, lịch gắn ngày bắt đầu theo timezone thiết bị; không chỉ lọc CONFIRMED. Cap 100 có cảnh báo. Tên đối tác tải từ public profile ở detail qua public export; không GET profile theo từng card.
- **Rationale**: mine không cursor/total; Session không trả name/plan title. Không dùng preview bù field thiếu.
- **Alternatives considered**: Tải toàn lịch sử hoặc chia nhiều requests để giả định đủ dữ liệu làm scope tăng.

Các quyết định thiết kế đã rõ; gap ngoài mobile là điều kiện nghiệm thu, chưa được xử lý.
