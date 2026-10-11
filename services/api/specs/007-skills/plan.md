# Implementation Plan: Kỹ năng

**Branch**: `feat/skills` | **Date**: 2026-10-07 | **Spec**: [spec.md](spec.md)
**Input**: `specs/007-skills/spec.md`. **Status**: Source implemented; local validation passed. External S3/ClamAV end-to-end release gate pending — see [validation.md](validation.md).

## Summary

Catalog chuẩn, Sharing Skill, search/public profile và evidence/Staff Verification theo SRS v1.6. Ba module sở hữu nghiệp vụ `skills`, `sharing-skills`, `verifications`; reuse identity, PostgreSQL/Prisma, storage/scan, transaction/idempotency, audit/outbox. Evidence tối đa10 MB/file. Proposal/Learning Path và UI nằm ngoài feature.

Branch bắt đầu từ commit `1141481` trên `refactor/data-model-v3`, giữ cập nhật runtime v3/Sonar. Spec Kit root là `services/api`; setup-plan trả HAS_GIT=false do root này không chứa `.git`; branch Git thực tế là `feat/skills`, độc lập số spec007.

## Technical Context

**Language/Version**: TypeScript6.0.3; Node22.12+ hoặc24+ theo workspace.
**Primary Dependencies**: NestJS11, Prisma7.8.0, class-validator, Swagger, BullMQ/AWS S3 adapter hiện có; không thêm search engine.
**Storage**: PostgreSQL metadata/audit/outbox, S3 private bytes, StoredFile authoritative scan; không dùng MongoDB trong feature.
**Testing**: Node test runner; unit policies, HTTP Nest app thật, PostgreSQL disposable schema, S3/ClamAV end-to-end.
**Target Platform**: Backend Node server theo deployment hiện hành.
**Project Type**: API modular monolith.
**Performance Goals**: SC-005, p95 search≤1s với10k Skill/100k SharingSkill; EXPLAIN/benchmark trước tối ưu thêm.
**Constraints**: Evidence≤10.000.000 bytes/file,1–5 file; cursor pagination, UTC, private evidence, atomic/idempotent decisions.
**Scale/Scope**: 3 module,5 entity hiện có và storage binding; profile/counter owner contracts; learned skill/Proposal chỉ handoff.

## Constitution Check

Constitution v1.2.0. Trước research và sau design **Pass design**, không exception. Source và local runtime checks đã pass; provider E2E/deployment còn Pending theo [validation.md](validation.md).

| Principle           | Trước research / sau design                              | Verification Pending            |
| ------------------- | -------------------------------------------------------- | ------------------------------- |
| 1 kiến trúc/backend | Pass / Pass: 3 module, API-only                          | DI/lint/types/build             |
| 2 store             | Pass / Pass: PostgreSQL metadata/S3 bytes                | FK/migration/file E2E           |
| 3 atomic            | Pass / Pass: decision/badge/counter/audit/outbox cùng tx | Concurrency/rollback            |
| 4 security          | Pass / Pass: live session/grants/ownership               | Permission wiring/negative HTTP |
| 5 contracts         | Pass / Pass: validation/envelope/cursor/UTC              | Swagger/decimal/boundaries      |
| 6 evidence          | Pass / Pass: acceptance matrix                           | Runtime validation report       |
| 7 ownership         | Pass / Pass: storage owns file, users owns count         | Cross-module contracts          |
| 8 delivery          | Pass / Pass: outbox/dedupe/no provider in tx             | Crash/retry/dead-letter/replay  |
| Git/scope           | Pass / Pass: feat/skills, không commit/push              | Staged review khi được yêu cầu  |

## Project Structure

### Documentation (this feature)

```text
specs/007-skills/
  spec.md
  plan.md
  research.md
  data-model.md
  quickstart.md
  contracts/http.md
  contracts/internal.md
  checklists/requirements.md
```

Implementation tasks and progress are in [tasks.md](tasks.md); measured evidence is in [validation.md](validation.md).

### Source Code (relative to services/api)

```text
src/modules/skills/
  skills.module.ts
  presentation/http/ (catalog/skills controllers, DTOs)
  application/, domain/, infrastructure/
src/modules/sharing-skills/
  sharing-skills.module.ts
  presentation/http/ (owner management/search DTOs/controllers)
  application/, infrastructure/
src/modules/verifications/
  verifications.module.ts
  presentation/http/ (owner/Staff controllers, DTOs)
  application/, infrastructure/
test/skills/ (policies, HTTP, persistence, concurrency, files, events)
```

Modify: `app.module.ts`, `modules/identity.module.ts`, users-owned permissions/counter/profile contracts; `shared/authorization/permission.catalog.ts`; storage public status/attachment/lifecycle APIs; audit action catalog/outbox publisher registration; runtime schema generator/additive migration; API package test scripts/README/Prisma docs. Shared source này thuộc API, không sửa frontend hoặc packages.

## Phase 0 — Research

[research.md](research.md) chốt source gaps, normalization, badge aggregate, storage binding, concurrency và handoff. Không còn technical NEEDS CLARIFICATION. Chính sách nội dung trọng yếu tự revoke, chống spam Proposal chưa có không được tự seed hoặc áp dụng.

## Phase 1 — Design

[data-model.md](data-model.md) và [HTTP](contracts/http.md)/[owner contracts](contracts/internal.md) là ranh giới triển khai.

Khóa theo thứ tự user/session → catalog → SharingSkill → verification → evidence/StoredFile; ID tăng dần trong mỗi nhóm. Users-owned contract khóa user để serialize counter và permission updates. Catalog transition/tạo SharingSkill khóa cùng catalog; archive SharingSkill có PENDING trả409. Reviewer recheck session/grants trong tx; không provider upload/sign/scan trong callback retry.

Decision tx: CAS PENDING→APPROVED/REJECTED, update file approval, sharing-owned badge recompute, users-owned count, audit, outbox, idempotency result. Revoke một evidence tương tự; không sửa quyết định APPROVED của batch cũ. Public projection gọi sharing reader, không query repository khác.

Upload tách submit; poll scan rồi attach READY bằng owner API trong cùng submit transaction. Metadata từ server; link chống cleanup race. READY chưa attach có grace24h (operational recovery default); file đã attach giữ cho lịch sử, không tự expiry/delete trong feature. Hard ceiling purpose EVIDENCE=min(config,10.000.000), không giảm cap REPORT/CHAT hiện hành.

## Phase 2 — Implementation Sequence (planning only)

1. **DB/domain**: validators/nameKey/badge reducer, storage FK/timestamps/version, partial uniques; additive migration, fresh/upgrade tests. Preflight collision báo IDs, không tự merge/archive dữ liệu.
2. **Identity integration**: live Principal→Actor adapter, users-owned tx permission checks, guards wiring/export; seed feature matrix idempotent, counter contract; identity regression.
3. **Catalog/sharing**: use cases/controllers/paging/ownership/archive/restore; concurrent create-vs-deactivate và create-vs-restore. Archive được đảo qua restore riêng theo [restore amendment](restore.md); vẫn có thể tạo bản mới khi skill ACTIVE.
4. **Search/profile**: visible+ACTIVE joins, verified filter/public projection; count VERIFIED chưa archive, visibility không đổi count; benchmark SC-005.
5. **Storage binding**: upload/status/attach API,10 MB ceiling; MIME/scan/generation; READY orphan cleanup race-safe.
6. **Verification**: submit/history/review/revoke/download; state CAS, atomic badge/counter/audit/outbox; idempotency replay rechecks current auth trước hydrate.
7. **Delivery/release**: register event publisher+consumer, notification tối thiểu cho kết quả xác minh với dedupe; HTTP/DB/S3/ClamAV thật, Swagger/README/validation. Không chỉ enqueue unknown event hoặc coi identity email worker đã xử lý business events.

## Verification & Release Gates

Implementation đã bổ sung `test:skills`, `test:skills:integration`, `test:skills:performance`. Kết quả API lint/check-types/build, identity/runtime-v3/rbac/files/audit/consistency và PostgreSQL Skills được ghi trong [validation.md](validation.md).

Required behavior: normalized duplicate concurrent; duplicate active/pending; approve-vs-reject; revoke-vs-submit; live permissions/session revoke; audit/outbox failure rollback; idempotency same/different body; other-owner/wrong-purpose/non-READY file;10.000.000 bytes và+1; infected/unknown scan; cleanup-vs-attach; signed TTL; public/private projection; envelope/Swagger/counter rebuild.

Runtime thiếu môi trường phải giữ Pending, không gọi mocks là E2E. Plan này không deploy migration, commit hoặc push.

## Complexity Tracking

Restore amendment: reuse PostgreSQL transaction/idempotency/live permission/audit và users-owned counter; không thêm schema hoặc provider. Catalog restore và Sharing Skill restore dùng permission riêng. Constitution principles 1–5/7 Pass implementation; principle 6 Pass lint/types/build và behavioral HTTP/DB/rollback/concurrency checks; principle 8 không có delivery mới (restore không tạo notification). Scope chỉ backend; deployment/UI chưa kiểm chứng. Xem [restore.md](restore.md) và [validation.md](validation.md) cho bằng chứng cuối.

Không exception. Không thêm search service, auto-reverification, toàn notification subsystem hoặc tài chính. Owner contracts được bổ sung có chủ đích thay vì cross-module repository writes.
