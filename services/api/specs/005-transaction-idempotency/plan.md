# SH-005 Transaction, idempotency và correlation Implementation Plan

> **For agentic workers:** Use `superpowers:executing-plans` để triển khai task-by-task. Theo dõi bằng checkbox; không commit/push nếu chưa được người dùng yêu cầu.

**Goal:** Cung cấp transaction/idempotency/outbox/correlation primitives có
kiểm chứng trên PostgreSQL và Redis cho các consumer foundation và tài chính.
**Architecture:** Context transaction truyền tường minh; claim/result và outbox
commit cùng dữ liệu nghiệp vụ. Request context riêng từng execution; delivery
at-least-once với consumer idempotent.
**Tech Stack:** NestJS 11, TypeScript 6, Prisma/adapter-pg 7.8.0,
PostgreSQL 17, Redis/BullMQ hiện có; `node:test` và Node crypto.
**Spec:** [spec.md](spec.md). **Date:** 2026-10-04.
**Status:** Implemented 2026-10-05; đã kiểm chứng trên PostgreSQL, phần còn Pending xem [validation.md](validation.md).
Paths dưới đây tính từ `services/api`.

## Global Constraints

- Constitution v1.2.0; PostgreSQL là store authoritative cho critical state.
- Giữ API prefix/error envelope hiện có; không thay frontend/root tooling.
- Không provider calls trong transaction; không transaction xuyên stores.
- Không nâng Prisma, không tạo User/wallet/payment tạm trong production schema.
- Mọi test script đọc `dist` phải generate/build trước chạy; real-store tests
  chỉ dùng `TEST_DATABASE_URL`/`TEST_REDIS_URL` được chỉ rõ là môi trường riêng.

## Review Focus

1. Lost response sau commit: replay không execute lần hai (Task 3).
2. Callback lỗi/deadlock: mọi write/claim/outbox rollback, bounded retry (Task 2/3).
3. Key trùng nhưng actor/payload khác: không lộ result hoặc hợp thức hóa command khác (Task 3).
4. Crash ở khe publish/ack: duplicate event không nhân side effect (Task 4).
5. Request headers giả/đa giá trị và request song song: context không lẫn (Task 1).

## File structure và contracts

| Area        | Files tạo / trách nhiệm                                                                                                                                   |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Context     | `src/shared/http/request-context.ts`: types/header normalization; `src/configs/logging.config.ts`: Pino ID/serializer wiring                              |
| Transaction | `src/infrastructure/database/transaction-context.ts`, `transaction-runner.ts`, `transaction-errors.ts`: explicit context, bounded retry và classification |
| Idempotency | `src/infrastructure/idempotency/idempotency.types.ts`, `idempotency.service.ts`, `idempotency.module.ts`: claim/result ownership, fingerprint             |
| Outbox      | `src/infrastructure/events/outbox.types.ts`, `outbox-writer.ts`, `outbox-dispatcher.ts`, `outbox.module.ts`: persistence/lease/publish/recovery           |

```ts
type TransactionContext = Prisma.TransactionClient;
type RequestContext = { requestId: string; correlationId: string };
type TransactionOptions = {
  isolationLevel?: "Serializable" | "ReadCommitted";
};
TransactionRunner.run<T>(
  work: (tx: TransactionContext) => Promise<T>, options?: TransactionOptions,
): Promise<T>;
IdempotencyService.execute<T extends JsonValue>(
  input: { scope: string; operation: string; key: string; command: JsonValue },
  work: (tx: TransactionContext) => Promise<T>,
): Promise<{ value: T; replayed: boolean }>;
type OutboxMessage = {
  eventId: string; type: string; version: number;
  payload: JsonValue; correlationId: string;
};
OutboxWriter.append(tx: TransactionContext, event: OutboxMessage): Promise<void>;
interface OutboxPublisher { publish(event: OutboxMessage): Promise<void>; }
```

`Prisma` import từ generated client hiện có. `JsonValue` chỉ JSON primitives,
arrays và objects; monetary BIGINT phải chuyển decimal string trước fingerprint.
Publisher được module consumer đăng ký theo event type cụ thể; unknown type bị
giữ failed, không tự gọi URL/topic từ payload.

## Tasks

### Task 1: Request context và logging

**Create:** context/logging files ở bảng trên, `test/request-context.test.mjs`.
**Modify:** `src/app.module.ts`, `src/main.ts` (expose response headers), `package.json`.
**Consumes:** Pino/Nest HTTP hiện có. **Produces:** `RequestContext`,
`createRequestContext(headers): RequestContext` và request/log/response IDs đồng nhất.

- [ ] Viết tests: hai requests cùng correlationId vẫn khác requestId; missing,
      CR/LF, overlong, array headers sinh correlation mới; error response có IDs.
- [ ] Build rồi chạy test; xác nhận FAIL do contract chưa có, không phải do import/install.
- [ ] Implement normalize UUID headers, server UUID và Pino `genReqId` trước
      request logging; gắn context lên request, không singleton mutable state.
- [ ] Chạy HTTP fixture song song và assertions header/log ID; giữ error body hiện có.

### Task 2: Explicit transaction runner và retry

**Create:** transaction files ở bảng, `test/transaction.test.mjs`,
`test/transaction-persistence.test.mjs`.
**Consumes:** `PrismaService`. **Produces:** `TransactionContext`, `TransactionRunner.run`.

- [ ] Viết tests: write #2 throw rollback #1; callbacks nhận cùng tx; không retry
      validation/P2002/connection loss; attempts không vượt 3.
- [ ] Viết real PostgreSQL tests với hai connections gây serialization conflict
      và deadlock; lưu error shape đã sanitize của adapter 7.8.0 làm regression fixture.
- [ ] Implement `$transaction(callback, options)`, mặc định Serializable,
      maxWait 2.000/timeout 5.000 ms; retry backoff theo spec, mỗi attempt là tx mới.
- [ ] Implement `isRetryableDatabaseConflict(error): boolean` cho Prisma P2034
      và driver SQLSTATE 40001/40P01 ở validated driver-adapter cause. Local adapter
      7.8 chỉ map 40001 thành conflict; không giả định mọi deadlock đều là P2034.
- [ ] Chạy unit và real tests; callback helper nhận tx thay vì tự mở transaction.
      Không retry unknown commit outcome; caller dùng lại idempotency identity.

### Task 3: Idempotency persistence và concurrency

**Create:** idempotency files ở bảng, `test/idempotency.test.mjs`,
`test/idempotency-persistence.test.mjs`; migration `sh005_idempotency_outbox`.
**Modify:** `prisma/schema.prisma`.
**Consumes:** Task 2. **Produces:** `IdempotencyService.execute`.

- [ ] Viết tests: canonical key ordering ổn định; key invalid trả 400; cùng
      scope/key khác normalized command trả 409; actor scope khác không replay chéo.
- [ ] Viết test PostgreSQL concurrent cùng key, callback count/fixture mutation
      đúng một; response lost sau commit replay reference; callback lỗi không giữ claim.
- [ ] Tạo schema unique `(scope,operation,keyDigest)`, resultReference/completedAt.
      Repository claim dùng parameterized `INSERT ... ON CONFLICT DO NOTHING`, rồi
      đọc record; cạnh tranh Serializable đi qua runner retry. Không catch P2002 rồi
      query tiếp một PostgreSQL transaction đã abort.
- [ ] Implement SHA-256 fingerprint/digest, private claim/complete trong một tx;
      completed result trả ra sau commit. Không lưu raw request hoặc secret response.
- [ ] Test missing completion không được tạo committed claim qua public service;
      reauthorize/rebuild projection tại caller; không thêm global HTTP replay interceptor.
- [ ] Chạy real concurrency/rollback tests, xác nhận mutation/result cùng tồn tại
      hoặc cùng vắng; không cleanup financial identities bằng TTL.

### Task 4: Durable outbox và delivery recovery

**Create:** outbox files ở bảng, `test/outbox-persistence.test.mjs`,
`test/outbox-delivery.test.mjs`.
**Modify:** schema/migration Task 3, `src/app.module.ts`.
**Consumes:** Task 2, QueueModule và module-owned publisher.
**Produces:** writer, `OutboxDispatcher.dispatchBatch(): Promise<number>`;
`retryFailed(eventId: string): Promise<void>` cho authorized internal caller.

- [ ] Viết rollback test: business fixture + outbox cùng tx; failed transaction
      không publish. Viết hai-dispatcher lease tests trên PostgreSQL.
- [ ] Implement pending index, atomic claim bằng `FOR UPDATE SKIP LOCKED`, lease
      token CAS khi acknowledge/retry; không giữ row lock trong provider call.
- [ ] Implement batch 20/lease 30 s/timeout 10 s/8 attempts/backoff theo spec;
      log error code an toàn và giữ failed event. Job poll tắt khi không có publisher.
- [ ] Test crash trước publish, sau publish trước ack và lease expiry; publisher
      nhận lại cùng eventId. Redis/BullMQ fixture processor deduplicates side effect
      bằng PostgreSQL record; queue jobId chỉ là lớp hỗ trợ, không là bảo đảm duy nhất.
- [ ] Test shutdown chờ in-flight bounded, stopped dispatcher không claim thêm;
      manual retry reset delivery state/cycleAttempts, tăng replayCount, giữ eventId/
      totalAttempts/last failure evidence; không tạo event mới để mất identity lịch sử.

### Task 5: Export contracts và handoff

**Modify:** API README/package.json; **Create:** `validation.md` trong spec này.
**Consumes:** Tasks 1–4. **Produces:** provider exports và evidence report.

- [ ] Thêm `test:consistency` cho unit/HTTP; `test:consistency:integration` cho
      PostgreSQL/Redis. Scripts generate/build trước test, không đọc dist cũ.
- [ ] Tài liệu hóa schema fixture riêng, cleanup chỉ trong schema test đã verify;
      không truncate/reset DB development hoặc production.
- [ ] Chạy API lint/check-types/build, tests tương ứng và migration fresh/upgrade.
      Ghi thiếu runtime thành Pending; không đổi thành pass bằng mocks.
- [ ] Cập nhật consumers SH-003/004/006 dùng đúng interfaces; financial business
      tests SH-055/060/063/067 vẫn Pending tới khi có modules thật.

## Spec coverage

R-01/02 → Task 2; R-03/08/10 → Task 4; R-04/05/06/07 → Task 3;
R-09 → Task 1. Task 5 ghi consumer financial evidence còn Pending.

## Verification commands

Từ `services/api`, `pnpm build` trước commands đọc dist; mỗi RED fail vì contract
chưa có và GREEN exit 0 với assertions của task.

| Task | Command sau build                                                                                           |
| ---- | ----------------------------------------------------------------------------------------------------------- |
| 1    | `pnpm exec node --test test/request-context.test.mjs`                                                       |
| 2    | `pnpm exec node --test test/transaction.test.mjs test/transaction-persistence.test.mjs`                     |
| 3    | `pnpm exec node --test test/idempotency.test.mjs test/idempotency-persistence.test.mjs`                     |
| 4    | `pnpm exec node --test test/outbox-persistence.test.mjs test/outbox-delivery.test.mjs`                      |
| 5    | `pnpm lint`, `pnpm check-types`, `pnpm build`, `pnpm test:consistency`, `pnpm test:consistency:integration` |

Scripts Task 5 chưa có. Real suites yêu cầu `TEST_DATABASE_URL`/`TEST_REDIS_URL`;
capture adapter deadlock shape từ actual database, không thay bằng P2034 giả.

## Constitution Check và Complexity Tracking

| Principles | Trạng thái ở design / gate implementation                                                                       |
| ---------- | --------------------------------------------------------------------------------------------------------------- |
| 1, 7       | Pass design: technical infrastructure, explicit module contracts; verify consumers không ghi chéo repositories. |
| 2, 3       | Pass design; Pending real atomic/concurrency/rollback tests. PostgreSQL không chia transaction với Mongo/S3.    |
| 4, 5       | Pass design: IDs không là auth, payload không secrets; Pending HTTP/log evidence.                               |
| 6, 8       | Pending runtime: concurrency, crash/duplicate delivery, failure retention và shutdown.                          |

Không có exception. Outbox cần thiết cho durable scan/delivery của SH-004;
không thêm event broker, transaction decorator hoặc generic saga framework.

## References và handoff

[Prisma ORM v7 transactions](https://www.prisma.io/docs/orm/v7/prisma-client/queries/transactions)
và [adapter-pg deadlock issue](https://github.com/prisma/orm/issues/29716)
được đối chiếu với generated client/local adapter 7.8.0. Không lấy API ORM 8 từ
trang latest để thay `$transaction` hiện có.

Source đã có cho Tasks 1–5; integration suite PostgreSQL đã pass, Redis/BullMQ
còn Pending (xem [validation.md](validation.md)). Không bật financial endpoint hoặc tuyên bố SH-005
đã chứng minh payment production chỉ từ fixture.
