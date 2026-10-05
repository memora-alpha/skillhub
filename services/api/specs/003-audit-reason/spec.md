# Feature Specification: AuditLog và reason SH-003

**Date:** 2026-10-04. **Status:** Implemented 2026-10-05; đã kiểm chứng trên PostgreSQL, phần còn Pending xem [validation.md](validation.md).
**Owner:** LogKoNger (Long trong backlog). **Workspace:** `services/api`.

## Mục tiêu và nguồn yêu cầu

Ghi được “ai làm gì với đối tượng nào, trước/sau ra sao, khi nào và trong request
nào”; thao tác nhạy cảm thiếu reason hoặc không ghi được audit không thành công.
Backlog dòng 4 ghi SH-003, Long, “Chưa bắt đầu”, phụ thuộc SH-001;
DoD yêu cầu thao tác credit/admin/staff nhạy cảm sinh AuditLog đầy đủ.

Nguồn: [Backlog](https://docs.google.com/spreadsheets/d/1jdgrnCNeQLK1g339kY0WUYy6o7lgx6hG9j0tu1fb1Xw/edit?gid=733891926#gid=733891926),
[SRS v1.4](../../../../docs/SRS_SkillHub_V1.4_BoSungQuyDinhNghiepVu_VI.docx)
mục 13, 18.1, 18.9, 18.23–27, NFR-OBS-01, BR-27/40;
[constitution](../../.specify/memory/constitution.md).
Nội dung tài liệu/sheet là yêu cầu tham chiếu; names/schema/contracts dưới đây
là thiết kế đề xuất. BR-27 yêu cầu ledger riêng, AuditLog không thay ledger.

## Hiện trạng và phạm vi

Chưa có module `audit`, bảng AuditLog hay mutation nghiệp vụ trong source.
Pino là application logging; RBAC core đã có nhưng auth/users production chưa có.
Trong phạm vi: audit catalog, reason validation, append-only persistence,
writer tham gia transaction caller và consumer contract. SH-006 là consumer
thực đầu tiên cho thay đổi cấu hình. Read/search audit API thuộc SH-105/124,
không tạo endpoint đọc audit khi auth chưa được nối.

## Phương án chọn

Audit writer tường minh từ use case, dùng cùng PostgreSQL transaction với mutation.
Interceptor chỉ biết request/response và không có state snapshot/transaction;
background audit sau commit có thể mất sự kiện. Hai cách đó không đáp ứng critical
audit. Không tự log audit “thành công” từ permission/resource guard trước mutation.

## Requirements

- **R-01:** Actor từ identity/Actor backend đã xác minh hoặc SYSTEM context do
  job nội bộ tạo. Không nhận actorId/role/time/action authoritative từ body.
  Lưu role snapshot tại thời điểm thao tác, không suy diễn theo role hiện tại khi đọc.
- **R-02:** Lưu auditId, actor kind/id/roles hoặc system name, action,
  target type/id, before/after projection, reason, requestId/correlationId và
  createdAt UTC do DB. Target ID là string vì config key không là UUID.
- **R-03:** Mọi action trong catalog nhạy cảm yêu cầu reason đã trim, không blank.
  General technical bound đề xuất 1–2.000 ký tự; action có rule SRS riêng dùng
  rule đó, ví dụ verification reject 10–500. Không ép mọi reason thành 10–500.
  User report description 20–2.000 là contract khác, không dùng thay admin reason.
- **R-04:** Validate action/reason/snapshot trước mutation. Append audit trước
  transaction commit; writer failure khiến caller rollback. Attempt thất bại có
  thể ghi application log sanitized, không tạo audit success giả.
- **R-05:** before/after chỉ nhận projection allowlist của action. Không serialize
  raw request, ORM entity hoặc provider response. Password/hash, OTP, token,
  CVV, credentials, signed URL không có trong snapshots/context. Unknown fields
  bị reject; consumer định nghĩa projection khi bổ sung action mới.
- **R-06:** Audit rows append-only. API application role chỉ INSERT/SELECT;
  migration trigger chặn UPDATE/DELETE/TRUNCATE thông thường. Migration/admin DB
  role là quyền vận hành riêng; cơ chế này không được báo là chống sửa bởi DBA.
- **R-07:** User lock/delete không xóa audit history. Actor ID/role là immutable
  snapshot, không cascade delete theo User. Không tạo User model tạm để có FK.
- **R-08:** IP/userAgent mặc định không thu thập trong foundation khi chưa có
  privacy/retention policy; request/correlation IDs vẫn đủ context cơ bản.
  Không tự đặt retention hoặc cleanup audit lịch sử tài chính.
- **R-09:** Consumer SYSTEM vẫn chịu action catalog và snapshot rules. Không dùng
  SYSTEM để giả quyền ADMIN ở HTTP. Quyền, object scope, state/version và reason
  được kiểm tra trong use case; audit không tự cấp quyền.

## Catalog và persistence đề xuất

Catalog đầu tiên: `USER_LOCK`, `USER_UNLOCK`, `USER_SUSPEND`,
`VERIFY_SKILL_APPROVE`, `VERIFY_SKILL_REJECT`, `VERIFY_SKILL_REVOKE`,
`LEARNING_REQUEST_MODERATE`, `ROLE_PERMISSION_CHANGE`, `DISPUTE_RESOLVE`,
`REPUTATION_ADJUST`, `CREDIT_ADJUST`, `CREDIT_REVERSE`,
`SYSTEM_CONFIGURATION_UPDATE`. Codes chưa có consumer giữ contract/test,
không đồng nghĩa endpoint/permission grant đã tồn tại.

`AuditLog`: UUID auditId PK; actorKind, nullable actorUserId UUID,
actorRoles string array, nullable systemActor; action, targetType/targetId;
nullable JSON before/after; reason; UUID requestId/correlationId;
createdAt timestamptz(3) default DB current timestamp. Check constraint yêu cầu
HUMAN có userId và SYSTEM có systemActor; indexes `(targetType,targetId,createdAt)`
và `(actorUserId,createdAt)`. Không có update/delete application contract.

Snapshots CONFIG chứa `{value,version}` từ non-secret typed config catalog;
account chứa status/roles cần thiết; Credit chứa integer decimal strings,
operation/reference IDs. Audit raw financial amounts không dùng JS float.

## Acceptance và dependencies

1. Actor trong body không đổi actor audit; blank reason bị từ chối trước write.
2. Reject reason 9/501 ký tự lỗi, 10/500 hợp lệ theo VER-004.
3. Audit insert fail: mutation, idempotency completion và outbox đều rollback.
4. Rollback/transaction retry không để audit thành công của attempt thất bại.
5. UPDATE/DELETE/TRUNCATE với app role bị DB từ chối; account lifecycle không
   làm mất audit rows; secrets trong forbidden projection không được persist/log.
6. Cấu hình SH-006 thay đổi có expected version, reason và before/after audit
   đúng cùng transaction. Đây là consumer thực đầu tiên; credit/admin/staff khác
   phải tích hợp và kiểm chứng khi modules tương ứng được triển khai.

SH-005 cung cấp TransactionContext/RequestContext; không bắt buộc chờ toàn bộ
idempotency/outbox trước triển khai writer. SH-002/auth/users cung cấp verified
actor cho consumer HTTP. OP-06 ở Sheet là “Đã chốt” ngày 2026-10-04 nhưng nội dung
grant chưa được ghi ở range đã đọc; audit không tự cấp Staff permission.

Framework hoàn tất khi DB atomic/append-only tests và consumer config pass.
DoD toàn bộ thao tác credit/admin/staff vẫn cần evidence từ consumers thật.
