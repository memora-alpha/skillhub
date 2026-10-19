# Bảo mật và quyền riêng tư

Đọc khi xử lý credentials, public projection, quyền hoặc private file.

## Đang có và nguồn đối chiếu

[auth token store](../../src/lib/storage/auth-token-store.ts), [public profile API](../../src/features/profile/api/public-profile-api.ts), [skills contracts](../../src/features/skills/api/skill-contracts.ts), [.env.example](../../.env.example). Chính sách owner/session/storage xem [state/session](state-and-session.md), không có authority session thứ hai.

## Quy chuẩn cho thay đổi mới

- `EXPO_PUBLIC_*` là cấu hình công khai, không chứa API secret, private signing key hoặc server credentials.
- Dùng `.env.example` cho ví dụ; `.env`, token, OTP, password, reset token, signed private URL không vào docs/log/screenshot được chia sẻ.
- Không log full request/response body mặc định, Authorization hoặc financial recovery secret. Error report chỉ có context tối thiểu đã redaction.
- Không thêm telemetry provider để đáp ứng guide. Nếu hiện chưa có production logger, ghi rõ chưa có; logger mới là công việc riêng.
- UI guard không thay authorization server. Profile public dùng allowlist/public DTO, không lấy private owner DTO rồi chỉ ẩn vài field.
- Public self-preview cũng tuân public projection. Public profile/evidence/material entitlement không được lộ private files khi đổi route/cache.
- User-generated content hiển thị theo cơ chế an toàn của framework; rich HTML/URLs cần policy riêng. Không coi native Text là bằng chứng backend đã sanitize dữ liệu.
- Permission camera/photos/files được xin theo nhu cầu và có denied/restricted/cancel states; không yêu cầu toàn bộ quyền khi khởi động.
- Destructive action có xác nhận phù hợp, hiển thị hệ quả và không cho double dispatch. Không thêm thông báo xác nhận cho mọi thao tác vô hại.

## Giới hạn và đề xuất

Không xác minh production logging/telemetry; migration không thêm provider. Public allowlist/native Text không chứng minh backend sanitize hoàn chỉnh. Quy chuẩn không tự cấp quyền sửa code cũ ngoài scope.
