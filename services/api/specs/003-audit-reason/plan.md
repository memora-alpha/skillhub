# SH-003 AuditLog và reason Implementation Plan

> **For agentic workers:** Use `superpowers:executing-plans` để triển khai theo task. Checklist chưa được đánh dấu đạt. Không commit/push nếu chưa có yêu cầu.

**Goal:** Thao tác nhạy cảm có reason hợp lệ và audit append-only atomic với
mutation; cung cấp writer dùng lại cho config, credit, moderation và auth/admin.
**Architecture:** Module audit sở hữu persistence; use case caller cung cấp
trusted actor và allowlisted state snapshots, truyền transaction context rõ ràng.
**Tech Stack:** NestJS 11, Prisma 7.8.0/PostgreSQL 17, Zod hiện có, `node:test`.
**Spec:** [spec.md](spec.md). **Date:** 2026-10-04. **Status:** Implemented 2026-10-05; đã kiểm chứng trên PostgreSQL, phần còn Pending xem [validation.md](validation.md).
Paths tính từ `services/api`; SH-005 Task 1/2 là dependency kỹ thuật.

## Global Constraints

- Constitution v1.2.0; critical audit ở PostgreSQL cùng transaction business.
- Giữ ledger riêng; không raw before/after dumps, secret hoặc fake actor.
- Không frontend, unsecured admin endpoint hoặc User model tạm.
- SRS action-specific validation ưu tiên hơn general technical reason bound.
- Thêm scripts build-before-test; real-store tests chỉ dùng DB test riêng.

## Review Focus

1. Audit storage fail sau mutation: rollback toàn bộ (Task 2/3).
2. Body giả actor/role hoặc raw entity snapshot: không được ghi (Task 1/3).
3. Blank, boundary-length hoặc action không nhận diện: bị chặn trước write (Task 1).
4. DB update/delete/truncate và User lifecycle: history vẫn bất biến (Task 2).
5. Retry/replayed command: không có audit success trùng hoặc audit mồ côi (Task 3).

## File structure và interfaces

| Create                                                 | Trách nhiệm                               |
| ------------------------------------------------------ | ----------------------------------------- |
| `src/modules/audit/application/audit.types.ts`         | AuditActor/Input và exported contract     |
| `src/modules/audit/domain/audit-action.catalog.ts`     | Action-specific reason/snapshot schemas   |
| `src/modules/audit/domain/reason.policy.ts`            | Trim, required và length validation       |
| `src/modules/audit/application/audit-writer.ts`        | Validation và append trong caller tx      |
| `src/modules/audit/infrastructure/audit.repository.ts` | Insert-only Prisma persistence            |
| `src/modules/audit/audit.module.ts`                    | DI/export writer, không export repository |

```ts
type AuditActor =
  | { kind: "HUMAN"; userId: string; roles: readonly RoleCode[] }
  | { kind: "SYSTEM"; name: string };
type AuditInput = {
  actor: AuditActor; action: AuditAction;
  target: { type: string; id: string };
  before?: JsonValue; after?: JsonValue; reason: string;
  context: RequestContext;
};
validateReason(value: unknown, bounds: { min: number; max: number }): string;
AuditWriter.validate(input: AuditInput): AuditInput;
AuditWriter.append(
  tx: TransactionContext, input: AuditInput,
): Promise<{ auditId: string }>;
```

RoleCode dùng từ RBAC core; TransactionContext/RequestContext dùng SH-005.
Caller gọi validate trước mutation, append sau mutation nhưng trước commit.
Writer validate lại để caller khác không bỏ qua. Before/after schema theo action;
CONFIG value chỉ từ typed non-secret catalog SH-006, không generic arbitrary JSON.

## Tasks

### Task 1: Action catalog, reason và snapshot validation

**Create:** types/catalog/reason files ở bảng; `test/audit-policy.test.mjs`.
**Consumes:** RoleCode/RequestContext; **Produces:** `AuditInput`, `AuditAction`,
`validateReason`, pure `validateAuditInput(input): AuditInput`.

- [ ] Viết boundary tests: blank/whitespace, unknown action, HUMAN thiếu userId,
      SYSTEM kèm userId; general bound 1–2.000 và reject-specific 10–500.
- [ ] Viết snapshot tests: passwordHash, OTP, token, CVV, storage signed URL hoặc
      unknown field trong nested config/account/credit bị reject trước persistence.
- [ ] Build/chạy tests và xác nhận RED do policy chưa có.
- [ ] Implement catalog nhỏ theo spec bằng strict schemas; reason trim trước
      đếm code points, không sửa password/body. Config key/value validator nối từ
      SH-006 tại consumer; không đưa secret storage key vào config action.
- [ ] Chạy policy tests; lỗi validate không echo rejected values/secret ra client/log.

### Task 2: Append-only schema và writer

**Create:** writer/repository/module ở bảng;
`prisma/migrations/<timestamp>_sh003_audit/migration.sql`,
`test/audit-persistence.test.mjs`.
**Modify:** `prisma/schema.prisma`, `src/app.module.ts`.
**Consumes:** Task 1, TransactionContext. **Produces:** exported AuditWriter.

- [ ] Viết PostgreSQL test: insert đủ actor/action/target/context, UTC DB time;
      app-role UPDATE/DELETE/TRUNCATE bị từ chối. Audit insert fail rollback fixture mutation.
- [ ] Thêm model/check constraints/indexes theo spec; actor UUID snapshot không FK
      tới model User chưa tồn tại. Target ID cho phép config key, không ép UUID chung.
- [ ] Migration tạo update/delete row triggers và truncate statement trigger;
      tài liệu hóa separate migration/app roles, app không là table owner/superuser.
      Không hard-code credential/role secret vào migration.
- [ ] Implement insert-only repository dùng caller tx; writer không injected root
      Prisma để tự ghi transaction khác. auditId do backend tạo, createdAt default DB.
- [ ] Test không cascade mất history; cùng tx rollback không còn audit success;
      chạy migration fresh và upgrade baseline. Không báo quyền DBA là đã bị ngăn sửa.

### Task 3: Consumer transaction và identity contract

**Create:** `test/audit-transaction.test.mjs`, `test/audit-http.test.mjs`.
**Modify:** `specs/002-rbac-ownership/plan.md`/validation khi auth integration thực có.
**Consumes:** Tasks 1/2, SH-005 runner/idempotency và RBAC Actor.
**Produces:** convention cho module use cases; HTTP fixture chỉ test guard/use case.

- [ ] Viết real-store fixture use case: validate input → mutation → append →
      commit; audit failure rollback mutation/result/outbox, retry không giữ failed audit.
- [ ] Viết HTTP fixture: body actorId/role không được accept; caller map AuditActor
      từ request.actor. Missing reason lỗi 400; permission thiếu lỗi 403 trước mutation.
- [ ] Test idempotent replay không thêm audit lần hai; khác command fingerprint
      lỗi 409. SYSTEM job context được tạo trong code nội bộ, không từ HTTP field.
- [ ] Tài liệu hóa mapper `auditActorFromActor(actor: Actor): AuditActor`; không
      tạo production auth fixture. Khi SH-012 sẵn sàng, lặp lại case với JWT thật.
- [ ] Nối SH-006 update use case vào writer cùng tx; regression config mutation
  - reason + before/after audit là gate consumer thực, không thay bằng mock rồi tick đạt.

### Task 4: Verification và handoff cho consumers

**Modify:** API README/package.json; **Create:** `validation.md` tại spec này.
**Consumes:** Tasks 1–3. **Produces:** evidence và checklist adoption.

- [ ] Thêm `test:audit` (unit/HTTP) và `test:audit:integration` (PostgreSQL/app role);
      scripts generate/build trước đọc dist.
- [ ] Chạy lint/check-types/build, policy/HTTP/DB rollback/immutability tests.
      Record exact app-role permissions, UTC/atomic evidence và missing runtime riêng.
- [ ] Handoff SH-016/022/025/032/082/091/093/100–105/114/124: action code,
      reason bounds, before/after projection và cùng tx phải được ghi trong consumer spec.
- [ ] Không tick DoD tất cả credit/admin/staff nếu chưa có consumers; audit read
      API và retention vẫn thuộc feature/policy tương ứng.

## Spec coverage

R-01/09 → Task 1/3; R-02/06/07/08 → Task 2/4; R-03/05 → Task 1;
R-04 → Task 2/3. Consumer config atomic audit là gate Task 3, không chỉ policy test.

## Verification commands

Từ `services/api`, chạy `pnpm build` trước các commands đọc dist. Mỗi task RED
phải fail vì behavior/contract chưa có, GREEN phải exit 0 và đúng assertions.

| Task | Command sau build                                                                               |
| ---- | ----------------------------------------------------------------------------------------------- |
| 1    | `pnpm exec node --test test/audit-policy.test.mjs`                                              |
| 2    | `pnpm exec node --test test/audit-persistence.test.mjs`                                         |
| 3    | `pnpm exec node --test test/audit-transaction.test.mjs test/audit-http.test.mjs`                |
| 4    | `pnpm lint`, `pnpm check-types`, `pnpm build`, `pnpm test:audit`, `pnpm test:audit:integration` |

Scripts của Task 4 chưa có ở thời điểm lập plan. Tests có DB phải yêu cầu
`TEST_DATABASE_URL`/test application role, missing runtime ghi Pending.

## Constitution Check và Complexity Tracking

| Principles | Design / implementation gate                                                                               |
| ---------- | ---------------------------------------------------------------------------------------------------------- |
| 1, 7       | Pass design: audit module insert contract, private repository; verify no consumer writes table directly.   |
| 2, 3       | Pass design; Pending DB proof mutation/audit/result/outbox atomic.                                         |
| 4, 5       | Pass design: trusted actor, strict projections, UTC; Pending auth/privacy runtime integration.             |
| 6          | Pending real-role immutability/concurrency tests and consumer evidence.                                    |
| 8          | Pass design: audit inside tx, not asynchronous success; SYSTEM event consumer dedup thuộc SH-005/consumer. |

Không có exception. Không thêm hash chain, audit search engine hoặc asynchronous
critical audit; backup/DB operator controls thuộc deployment/SH-001 follow-up.

## Handoff

Framework có thể triển khai sau SH-005 context/runner. Consumer config SH-006
không chờ User schema để có internal contract, nhưng HTTP exposure phải đợi
production authorization. Không đổi sheet status hoặc commit trong lần planning này.
