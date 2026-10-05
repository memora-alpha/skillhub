# SH-006 System Configuration, UTC và secrets Implementation Plan

> **For agentic workers:** Use `superpowers:executing-plans` triển khai theo từng task. Checklist ghi evidence thật; không commit/push khi chưa được yêu cầu.

**Goal:** Central typed/versioned policy, server time và provider env sạch để
auth/storage/scheduling/credit sử dụng thống nhất.
**Architecture:** Module system-configuration sở hữu current/history và update
use case; shared Clock chỉ cung cấp instants. Secrets nằm ngoài policy DB.
**Tech Stack:** NestJS 11, Prisma 7.8.0/PostgreSQL, Zod/Intl/Node hiện có.
**Spec:** [spec.md](spec.md). **Date:** 2026-10-04. **Status:** Implemented 2026-10-05; đã kiểm chứng trên PostgreSQL, phần còn Pending xem [validation.md](validation.md).
Paths tính từ `services/api`.

## Global Constraints

- Constitution v1.2.0; UTC, integer financial units và audited sensitive changes.
- V1.4 fixed policies giữ đúng catalog ban đầu; không seed policy còn mở.
- No secret DB/API fields; không thêm cloud SDK trước khi deployment provider có.
- Config/read DTO không phải raw JSON admin CRUD; giữ current HTTP error envelope.
- Tests đọc dist build trước; history/migration tests dùng DB test riêng.

## Review Focus

1. Seed rerun/stale concurrent update: không overwrite policy hoặc mất version (Task 2/3).
2. Audit fail hoặc multi-key invalid: config/history/audit rollback toàn bộ (Task 3).
3. Future effectiveAt/missing required value: không active policy sai thời điểm (Task 2/3).
4. Boundary cutoff/DST/local-only timestamp/client clock: cùng instant, cùng quyết định (Task 1).
5. Secrets trong URI/query/provider errors và disabled integrations: không rò rỉ, không đòi config không dùng (Task 4).

## Files và interfaces

| Create                                                                          | Trách nhiệm                                            |
| ------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `src/shared/time/clock.ts`                                                      | `Clock`, token `CLOCK`, ServerClock                    |
| `src/shared/time/timestamp.policy.ts`                                           | Absolute RFC3339 parsing và IANA validation            |
| `src/modules/system-configuration/domain/configuration.catalog.ts`              | Key/value schemas, mutability, fixed policy values     |
| `src/modules/system-configuration/application/configuration.types.ts`           | Typed snapshot và update command                       |
| `src/modules/system-configuration/application/system-configuration.service.ts`  | Read snapshot/required checks                          |
| `src/modules/system-configuration/application/update-configuration.use-case.ts` | Expected versions, atomic history+audit                |
| `src/modules/system-configuration/infrastructure/configuration.repository.ts`   | Private current/revision persistence                   |
| `src/modules/system-configuration/system-configuration.module.ts`               | DI/export read service và authorized internal use case |
| `prisma/seed-configuration.ts`                                                  | Insert-missing approved defaults/history               |

```ts
interface Clock { now(): Date; }
parseAbsoluteTimestamp(input: unknown): Date;
validateTimeZone(input: string): string;
type ConfigurationSnapshot<K extends ConfigurationKey> = {
  values: ConfigurationValues<K>; versions: Record<K, number>; readAt: Date;
};
SystemConfigurationService.getSnapshot<K extends ConfigurationKey>(
  keys: readonly K[], tx?: TransactionContext,
): Promise<ConfigurationSnapshot<K>>;
UpdateConfigurationUseCase.execute(input: {
  changes: ConfigurationChange[]; expectedVersions: Record<string, number>;
  actor: Actor; reason: string; context: RequestContext;
}): Promise<ConfigurationSnapshot<ConfigurationKey>>;
```

`ConfigurationKey/ConfigurationValues/ConfigurationChange` derive từ catalog;
change là discriminated union `{key,value}`. Expected version 0 dùng insert key
chưa tồn tại. Consumers gọi read service, không query/write config table trực tiếp.
Update use case recheck `system-config:update` qua finalized users contract
trong tx khi production auth có; không giả quyền chỉ từ role name.

## Tasks

### Task 1: Server Clock và UTC boundary

**Create:** time files ở bảng, `test/time-policy.test.mjs`.
**Consumes:** Node Date/Intl. **Produces:** Clock/token/parsers.

- [ ] Viết tests absolute `Z`/offset cùng epoch; reject local-only/invalid
      2026-02-30/invalid timezone; output ISO Z không tùy process TZ.
- [ ] Viết cutoff fixture dùng injected Clock: exact 60 min pass, thiếu 1 ms fail;
      clientNow field bị ignore/reject ở fixture, không dùng trong decision.
- [ ] Build/test RED, implement strict RFC3339 instant parsing + calendar validation
      và Intl IANA validation, không chỉ dựa `new Date(string)` normalize ngày sai.
- [ ] Test với process TZ UTC/Asia_Ho_Chi_Minh/America_New_York; DST display không
      làm thay instant. Local wall-time→instant/gap/fold conversion thuộc scheduling
      spec sau này, không âm thầm đoán offset.

### Task 2: Typed catalog, history migration và safe seed

**Create:** catalog/types/repository/read-service/module/seed ở bảng;
`prisma/migrations/<timestamp>_sh006_configuration_history/migration.sql`,
`test/configuration-policy.test.mjs`, `test/configuration-persistence.test.mjs`.
**Modify:** `prisma/schema.prisma`, `prisma.config.ts` (seed command).
**Consumes:** SH-005 TransactionContext. **Produces:** typed read snapshots.

- [ ] Viết tests các values/fixed/mutable flags đúng spec; unknown/secret key,
      malformed values, settlement bps sai tổng bị reject. Missing required key không
      trở thành undefined/0 được consumer hiểu là unrestricted.
- [ ] Thêm revision model/unique/checks/index và append-only protection; giữ
      current baseline table. Migration backfill known catalog rows hợp lệ, không
      overwrite/delete unknown rows hoặc dump giá trị private ra output.
- [ ] Implement `getSnapshot` đọc required keys trong một query; validate current
      value/version/effectiveAt; future row chưa hỗ trợ phải báo not-ready, không dùng sớm.
- [ ] Module đăng ký `{provide: CLOCK,useClass: ServerClock}`, export CLOCK/read
      service, giữ repository private; storage và consumers import provider cùng contract.
- [ ] Implement seed insert missing defaults ở spec và revision baseline cùng tx;
      existing fixed value khác SRS báo key cần reconcile, không silent overwrite.
- [ ] Test rerun seed sau mutable TTL update giữ version/value/history; missing
      evidence cap giữ missing. Migration fresh/upgrade không reset user-auth config.

### Task 3: Audited optimistic update use case

**Create:** update use case ở bảng, `test/configuration-update.test.mjs`.
**Modify:** `src/app.module.ts`, RBAC catalog thêm `system-config:update`
chỉ khi có protected consumer; không grant Staff/Admin tự động.
**Consumes:** read/repository, SH-003 AuditWriter, SH-005 runner/context.
**Produces:** `UpdateConfigurationUseCase.execute` theo signature trên.

- [ ] Viết DB tests TTL120→60 có history/audit; concurrent expectedVersion=1 chỉ
      một pass; blank reason/malformed patch/audit insert fail giữ nguyên mọi key.
- [ ] Validate toàn patch trước writes, chỉ keys mutable; reject input effectiveAt
      tương lai. Read trước/sau projection từ dữ liệu server, không snapshot body.
- [ ] Implement optimistic update counts/expected versions trong caller tx,
      immediate DB effectiveAt, revision + audit SYSTEM_CONFIGURATION_UPDATE cho từng key cùng tx.
- [ ] Production use case phải có verified Actor/current permission recheck qua
      users contract; trước khi users tồn tại chỉ internal/test wiring, không mở HTTP.
- [ ] Test reader snapshot sau commit; business fixture lưu config versions không
      đổi khi config hiện tại đổi. Gate thật cho path/credit snapshots thuộc consumers.

### Task 4: Operational env, provider secrets và logs

**Modify:** `src/configs/environment.ts`, `src/app.module.ts`,
`src/configs/logging.config.ts` (SH-005), `src/configs/redis.config.ts`,
`src/infrastructure/database/prisma.service.ts`,
`src/infrastructure/database/database.module.ts`, `.env.example`.
**Create:** `test/provider-configuration.test.mjs`, `test/log-privacy.test.mjs`.
**Consumes:** current ConfigModule/Pino. **Produces:** bootstrap-only env values.

- [ ] Viết tests rate-limit integers default120/60000, invalid/nonpositive lỗi;
      enabled storage thiếu required fields lỗi names, disabled storage không đòi secrets.
- [ ] Thêm `API_RATE_LIMIT_LIMIT`/`API_RATE_LIMIT_TTL_MS`; wiring ThrottlerModule
      đọc validated values. Không đưa hot reload hoặc shared Redis throttle vào task này.
- [ ] Provider validators chỉ được thêm khi adapter được bật (SH-004 trước);
      env example dùng placeholder, DB catalog reject credential keys. Production
      TLS/public HTTPS rules rõ ràng, local S3/clamd dev endpoints có exception dev-only.
- [ ] Production DB/Mongo/Redis TLS options xác minh certificates, reject false/
      bypass flags; Redis dùng rediss, CA override chỉ qua ignored/env-managed path.
      Test validator/options và real handshake ở deployment environment; URL scheme
      check đơn thuần không được báo là đã kiểm chứng TLS.
- [ ] Pino request serializer log path đã bỏ query, redact sensitive headers;
      không raw request body/config dump/provider exception messages chứa DSN.
- [ ] Capture logs từ request token query/provider-error fixtures và startup
      failure; assert credential/OTP/token value vắng, request/correlation vẫn có.
- [ ] Tài liệu hóa inject env từ secret manager và rotation/restart theo provider;
      không thêm plaintext secret file được track hoặc admin API quản lý secret.

### Task 5: Consumer contracts và validation report

**Modify:** README/package.json; **Create:** `validation.md` tại spec này.
**Consumes:** Tasks 1–4. **Produces:** snapshot/Clock/config usage guide.

- [ ] Thêm `test:configuration` và `test:configuration:integration`, build-before-test.
- [ ] Chạy lint/check-types/build, UTC/env/log tests và DB seed/history/audit tests.
      Record missing app-role/auth/runtime checks Pending riêng.
- [ ] Handoff auth TTL/OTP/rate limit cho Huy: values chưa chốt được giữ ngoài seed;
      storage cap/TTL cho SH-004; time/snapshot contract cho scheduling/credit.
- [ ] Ghi production NTP/TLS enforcement, multi-instance throttle và admin HTTP
      authorization là gates triển khai tương ứng; không tuyên bố đạt chỉ từ local mocks.

## Spec coverage

R-01/02/04/05/06 → Task 2/3; R-03 → Task 3; R-07/08 → Task 1;
R-09/10/11 → Task 4. Task 5 ghi business/deployment evidence chưa có.

## Verification commands

Từ `services/api`, chạy `pnpm build` trước tests đọc dist; RED phải fail vì
behavior chưa có, GREEN exit 0 với assertions của task.

| Task | Command sau build                                                                                               |
| ---- | --------------------------------------------------------------------------------------------------------------- |
| 1    | `pnpm exec node --test test/time-policy.test.mjs` (fixture subprocess với các TZ trong Task 1)                  |
| 2    | `pnpm exec node --test test/configuration-policy.test.mjs test/configuration-persistence.test.mjs`              |
| 3    | `pnpm exec node --test test/configuration-update.test.mjs`                                                      |
| 4    | `pnpm exec node --test test/provider-configuration.test.mjs test/log-privacy.test.mjs`                          |
| 5    | `pnpm lint`, `pnpm check-types`, `pnpm build`, `pnpm test:configuration`, `pnpm test:configuration:integration` |

Scripts Task 5 chưa có. DB/TLS tests yêu cầu môi trường test/deployment riêng,
chưa có environment thì giữ Pending, không báo options test là handshake evidence.

## Constitution Check và Complexity Tracking

| Principles | Design / evidence gate                                                                                  |
| ---------- | ------------------------------------------------------------------------------------------------------- |
| 1, 7       | Pass design: module config sở hữu current/history; Clock chỉ kỹ thuật.                                  |
| 2, 3       | Pass design; Pending atomic history/audit và optimistic concurrency tests.                              |
| 4, 5       | Pass design: secrets ngoài DB/source, UTC, typed boundary; Pending log/TLS evidence.                    |
| 6, 8       | Pending implementation tests; update không external provider call trong tx, không async critical audit. |

Không có exception. Không thêm policy cache, future scheduler hay cloud-specific
secret manager trước khi có deployment requirement.

## References và handoff

[PostgreSQL 17 date/time](https://www.postgresql.org/docs/17/datatype-datetime.html)
giải thích timestamptz lưu instant và render theo session timezone; explicit UTC
JSON contract vẫn cần serializer/tests của dự án. V1.4 giải quyết các values
đã ghi fixed, không dùng deferred values của logical model v1.3 để seed.

Source đã có cho Tasks 1–5; history/audit đã kiểm chứng trên PostgreSQL, TLS
deployment còn Pending (xem [validation.md](validation.md)). Không đổi task status sheet hoặc
bật integration provider trong lần này.
