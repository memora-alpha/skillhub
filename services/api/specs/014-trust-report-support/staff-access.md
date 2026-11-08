# Staff access — backend draft

Base dev 30d9221d, 2026-11-08. Branch feat/staff-access.

- GET /api/v1/admin/staff-permissions/catalog: mã quyền vận hành đã cài đặt.
- GET /api/v1/admin/staff-permissions/:userId: version, quyền hiệu lực và overrides.
- PUT /api/v1/admin/staff-permissions/:userId/:code: effect GRANT/DENY/RESET,
  expectedVersion, reason và reauthToken (luồng reauth Admin hiện hữu).
- Yêu cầu ADMIN + staff-permissions:manage; GRANT/DENY chỉ trong allowlist vận hành.
  Quyền tham gia kế thừa từ USER, không được deny bằng override vận hành.
- Đổi quyền tăng securityVersion của Staff, yêu cầu đăng nhập lại; SSE sẽ bị
  từ chối khi kiểm tra lại phiên. Gỡ/đổi role xóa override để tránh hồi sinh quyền.
- Staff nộp kỹ năng không tự duyệt hoặc duyệt Staff khác. Role tại lúc nộp được
  lưu submittedRole; hồ sơ nộp khi STAFF vẫn cần Admin sau khi bị gỡ role.
  Hồ sơ legacy không có snapshot dùng role hiện tại, không đoán lịch sử.
- Áp migration 20261108000000_staff_permissions trước code. Generator đọc thêm
  prisma/staff-permissions.prisma; không sửa lịch sử migration cũ.

Validation: TypeScript, build, ESLint và 22 test quyền/đăng ký/HTTP đạt,
bao gồm hồ sơ Staff sau khi đổi role. Chưa có PostgreSQL test thật,
chưa xác minh SSE nhiều instance hoặc UI quản lý quyền.

Constitution: module ownership/storage pass thiết kế; authorization/concurrency/
rollback thực tế pending integration. Không ngoại lệ. Chưa commit/deploy.
