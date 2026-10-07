# Phase 0 Research — Kỹ năng

Date:2026-10-07. Source audit và SRS v1.6; README breakdown không chứng minh implementation.

## Scope and current implementation

**Decision**: Catalog/sharing/search/verification; FR-SK-05 và gửi Proposal trong FR-SK-07 handoff.
**Rationale**: Source chưa có ba module; runtime schema/migration `20261007000000_runtime_v3` có bảng nhưng chưa có use cases/controllers.
**Alternatives considered**: Catalog-only thiếu luồng Kỹ năng; gom LearningPath/Proposal quá phạm vi. Category hiện có dùng FK/read-only, không mở taxonomy CRUD.

## Normalization and search

**Decision**: nameKey=Unicode NFC,trim,collapse whitespace,lowercase locale-independent, giữ dấu tiếng Việt; unique nameKey/slug; Skill/slug là tag chuẩn. Slug hệ thống sinh lowercase URL-safe; collision trả409 để chọn slug khác. Search literal substring escape `%`, `_`, `\\`, q2–100; limit1–50/default20; keyset nameKey/id hoặc submittedAt/id.
**Rationale**: SRS yêu cầu catalog unique/tag chuẩn, chưa chỉ định multi-tag aliases. Query bounded ở PostgreSQL.
**Alternatives considered**: Bỏ dấu có thể đổi nghĩa; Elasticsearch/trigram chờ benchmark; không mở tag free-text thay skillId.

## Verification aggregation

**Decision**: Approval còn hiệu lực giữ VERIFIED khi batch mới pending/rejected. Không còn approval: PENDING nếu có request chờ, REJECTED nếu quyết định cuối reject/revoke, UNVERIFIED nếu chưa gửi. Batch approve/reject toàn file mới; revoke theo file; REVOKED lưu evidence/history.
**Rationale**: VER-006 giữ approval cũ; badge bốn trạng thái SRS; sửa mô tả/level thường không mất VERIFIED.
**Alternatives considered**: Mỗi submit ghi PENDING đè badge sai semantics; expiry cron trái BR-06; partial file approval thêm trạng thái batch không cần thiết.

## Runtime authorization

**Decision**: Reuse `shared/auth/identity.guard.ts`, `SessionsService.principal/assertLive`; thêm Principal→Actor bridge và users-owned tx permission checks; wiring guards/export/seed grants.
**Rationale**: Foundation PermissionGuard/ResourceAccessGuard chưa nối AppModule; AUTHORIZATION_READER chưa implementation/binding. Runtime có `request.principal`, khác foundation `authenticatedIdentity/actor`; seedRoles hiện chỉ bốn admin permissions.
**Alternatives considered**: Check STAFF role chung không đáp ứng explicit permissions; auth implementation mới trùng session logic. Bridge dùng owner contract, không export repository.

## Evidence storage

**Decision**: Reuse FileStorageService.upload/issueDownload; bổ sung status/attach API. storedFileId unique FK, READY exact generation/hash; cap EVIDENCE=min(config,10.000.000 bytes). Default10 MB hiện có, config mutable tới100 MB nên default không đủ; REPORT/CHAT giữ cap hiện hành.
**Rationale**: StorageModule chỉ export service; verification không query internal repository. Evidence chưa có StoredFile link. READY orphan chưa được cleanup; add durable attach và grace24h, cleanup lock/CAS chống submit race. Evidence attached không auto-expire.
**Alternatives considered**: Provider upload trong tx kéo dài/retry unsafe; client storageKey/metadata gây ownership bypass; tạo lại scanner trùng infrastructure.

## Atomic decisions and delivery

**Decision**: TransactionRunner.run, IdempotencyService.execute, AuditWriter.append, OutboxWriter.append dùng chung tx; add explicit verification event publisher/consumer, dedupe notification tối thiểu.
**Rationale**: Serializable retry tối đa3, callback chỉ DB. Identity AuditService khác foundation AuditWriter; import AuditModule và verification actions. Outbox unknown type fail permanent; identity email worker không xử lý kết quả xác minh.
**Alternatives considered**: Mail trong tx không rollback; async critical audit mất traceability; outbox-only không handler chưa hoàn thành delivery.

## Database enforcement

**Decision**: Partial unique active SharingSkill và PENDING verification; locks/CAS, composite FK submission hiện có; add nameKey/file FK.
**Rationale**: V3 migration có indexes thường, chưa enforce hai partial uniques; PostgreSQL hỗ trợ unique subset theo predicate. Lock parent serialize conflicting operations.
**Alternatives considered**: Precheck không chống race; unique toàn history chặn create lại sau archive.

Verified primary references: [PostgreSQL partial indexes](https://www.postgresql.org/docs/current/indexes-partial.html), [explicit locking](https://www.postgresql.org/docs/current/explicit-locking.html). Test trên PostgreSQL deployment thật trước release; đọc docs không chứng minh migration đã chạy.

## Product policies outside automated behavior

Không còn clarification chặn feature. Điều kiện chuyên môn đủ VERIFIED do reviewer quyết định; thay đổi trọng yếu auto-invalidate, anti-spam Proposal chưa xác định nên không tự đặt thresholds. Learned skill chỉ ghi khi LearningPath feature xác nhận hoàn tất đúng learner/plan.
