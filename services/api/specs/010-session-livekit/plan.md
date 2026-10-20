# Session và LiveKit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans`
> để triển khai từng task trong phiên làm việc. Chỉ dùng subagent khi người dùng
> yêu cầu. Checklist không tự cho phép commit, push hoặc triển khai production.

**Goal:** Hoàn thiện Session hiện hữu và tích hợp LiveKit an toàn theo SH-070..075,
với phạm vi backend và contract SH-074.
**Architecture:** LearningSessionsModule sở hữu Session/policy/transition;
LiveKitService bọc SDK chính thức. Tái sử dụng configuration, Clock, transaction,
outbox/receipt; giữ room và attendance trên Session theo ERD v3.
**Tech Stack:** NestJS 11, TypeScript 6, Prisma 7.8/PostgreSQL, Node test runner,
Zod và `livekit-server-sdk` sẽ thêm khi thực thi.
**Spec:** [spec.md](spec.md). **Ngày:** 2026-10-19.
**Trạng thái:** Backend đã triển khai; [validation](validation.md) ghi evidence và các bước Cloud/UI còn lại.

**Execution recheck 2026-10-19:** Backend, Cloud media/reconnect và signed HTTPS
webhook smoke đã pass; 110/110 regression và lint/type/build pass. Constitution
checks trong scope backend (ownership, transaction, auth/secrets, UTC/contracts,
idempotency/recovery) được kiểm chứng bằng source và evidence trong validation.
Early/late production policy, SH-074 UI, quality/load và force-disconnect vẫn mở.
Cloud smoke bổ sung ánh xạ opaque event ID sang UUID receipt và clock-skew clamp
kỹ thuật tối đa 5 giây; không thay join window nghiệp vụ hay schema.

Paths phía dưới tính từ `services/api`; lệnh pnpm chạy từ repository root trừ
khi ghi rõ. Branch hiện tại `feature/livekit-session` được giữ nguyên; không
rename branch hoặc sửa phần `.env.example` người dùng đang thay đổi trong bước plan.

## Global Constraints

- Giữ `Session` và enum hiện có; không tạo lại LiveKitRoom/SessionAttendance.
- Chỉ sửa backend; frontend/mobile chỉ có contract handoff và smoke bằng Meet.
- Người dùng chọn giữ early/late grace mở; không seed default production hoặc
  lấy fixture 10/10 phút làm policy. Task 1 phải hỗ trợ config thiếu an toàn.
- Không tự chốt completion timeout, dispute window, no-show/cancellation policy.
- Secret ở env; token chỉ trả qua endpoint có auth + membership và no-store.
- Không dùng client clock/userId/roomName tùy ý; không coi cấp token là đã vào học.
- Giữ contract array `/sessions/mine`, role/field names và BIGINT serialization.
- Giữ khóa Path → Session; không gọi LiveKit trong transaction DB.
- Test import dist phải build trước; PostgreSQL integration dùng TEST_DATABASE_URL
  riêng qua `test/require-integration-env.mjs`, không fallback DB development.

## Constitution Check

| Nguyên tắc                         | Đánh giá thiết kế                                            | Evidence phải có khi thực thi                                 |
| ---------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------- |
| Modular monolith, không layer rỗng | Pass — Session là owner, một SDK wrapper trong module        | Review DI/exports, không controller ghi bảng                  |
| Authoritative store                | Pass — PostgreSQL Session, LiveKit chỉ observation           | Tests mapping/state, không phụ thuộc MongoDB                  |
| Atomic financial workflow          | Pending — chỉ tái dùng settlement core/guard                 | Regression rollback/idempotency/dispute bằng DB thật          |
| Auth, permissions, secrets         | Pending — permission + participant, allowlist/no-store       | HTTP outsider tests, log-privacy tests                        |
| Env, UTC, contract                 | Pending — conditional provider config, versioned join policy | Startup/missing policy/boundary/OpenAPI tests                 |
| Verification                       | Pending — chưa có implementation                             | Lint/type/build/focused + integration evidence                |
| Module ownership                   | Pass trong thiết kế — Session cung cấp application contract  | Webhook/worker chỉ gọi contract, Credit/Reports giữ ownership |
| Retry/outbox/recovery              | Pending — reuse receipt/outbox, sweep sau restart            | Duplicate/stale/crash/provider outage tests                   |

Không có ngoại lệ được yêu cầu. Planned compliance không phải runtime evidence.

## Review Focus

1. Retry confirm trước khi đối phương confirm phải giữ timestamp/note (Task 4).
2. Webhook trễ sau reschedule/cancel/dispute không revive hoặc lùi state (Task 3).
3. Hai token request đầu đồng thời phải cùng room, identity không từ client (Task 2/5).
4. JWT expiry không ngắt media; cấp lại sau endAt phải theo lựa chọn được duyệt,
   không bypass closesAt/terminal state (Task 2/3/5).
5. Hai plan TWO_WAY khác số buổi hoặc thiếu dispute policy không được settle sớm
   hoặc báo sai N/M (Task 4/5).

## File map

| Tạo / chỉnh                                                                                                    | Trách nhiệm                                                                                      |
| -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Create `src/modules/learning-sessions/session.policy.ts`                                                       | Pure UTC window/state/identity/projection helpers và types dùng chung                            |
| Create `src/modules/learning-sessions/livekit.service.ts`                                                      | SDK token, verify webhook, room observation + provider config parser                             |
| Modify `src/modules/learning-sessions/learning-sessions.service.ts`                                            | Authorization/mapping, read projection, completion và application contracts                      |
| Modify `src/modules/learning-sessions/learning-sessions.controller.ts`, `.dto.ts`                              | Token route, query validation, no-store, response Swagger                                        |
| Create `src/modules/learning-sessions/learning-sessions.responses.ts`                                          | Explicit public DTO, progress/join metadata, không spread persistence row                        |
| Create `src/modules/learning-sessions/livekit-webhook.controller.ts`                                           | Raw-body/auth ingress, standard errors                                                           |
| Create `src/modules/learning-sessions/session-lifecycle.worker.ts`                                             | Bounded sweep, provider reconciliation, restart/shutdown                                         |
| Create `src/modules/learning-sessions/session-completion.handler.ts`                                           | Completion signal và settlement application-core retry                                           |
| Modify `src/modules/learning-sessions/learning-sessions.module.ts`                                             | SDK/service/controllers/worker DI; import config + OutboxModule                                  |
| Modify `src/configs/environment.ts`, `src/main.ts`                                                             | Provider startup validation, scoped webhook content-type parser                                  |
| Modify `src/modules/system-configuration/domain/configuration.catalog.ts`, `application/seed-configuration.ts` | Typed joinWindow không có default, seed chỉ key được chốt                                        |
| Modify `src/modules/learning-paths/learning-paths.service.ts`                                                  | Chỉ khi cần dùng chung progress/application contract; giữ finalize transaction                   |
| Modify `package.json`, root `pnpm-lock.yaml`                                                                   | SDK dependency và focused test scripts; root lockfile cần thiết vì pnpm workspace                |
| Modify `.env.example`, `README.md`                                                                             | Merge placeholder keys hiện hữu, setup/policy/webhook/runbook; không overwrite thay đổi của user |
| Create `test/learning-sessions/*.test.mjs`, `specs/010-session-livekit/validation.md`                          | Unit/HTTP/PostgreSQL evidence, manual Cloud checklist                                            |

Không tạo migration chỉ vì có feature mới. Nếu execution phát hiện schema/index
thiếu, bổ sung migration mới và cập nhật spec/plan với bằng chứng trước khi áp dụng.

## Task 1 — Provider configuration và join policy có kiểm chứng

**Files:** livekit.service.ts, session.policy.ts, environment.ts, catalog/seed;
`test/learning-sessions/configuration.test.mjs`, `policy.test.mjs`;
`test/configuration-policy.test.mjs`, `test/provider-configuration.test.mjs`.
**Interfaces:**

```ts
type LiveKitConfiguration = { enabled: false } | {
  enabled: true; url: string; apiKey: string; apiSecret: string;
};
type JoinWindowPolicy = { earlyMinutes: number; lateMinutes: number };
type JoinWindow = { opensAt: Date; closesAt: Date };
liveKitConfiguration(input: Record<string, unknown>): LiveKitConfiguration;
sessionJoinWindow(startAt: Date, endAt: Date, policy: JoinWindowPolicy): JoinWindow;
```

- [ ] Thêm failing tests: cả ba env vắng => disabled; partial/URL credentials/
      production ws => reject chỉ tên field; đủ env hợp lệ => enabled.
- [ ] Test config chưa có/invalid/future => join unavailable, normal Session read
      vẫn dùng được; seed lần hai không reset config có audit/version.
- [ ] Dùng fixture `startAt=2026-11-02T03:00:00Z`, `endAt=04:00:00Z`, policy
      10/10: opensAt=02:50Z, closesAt=04:10Z; opensAt hợp lệ, thiếu 1ms không;
      closesAt từ chối; offset +07 cùng instant; negative/unsafe/overflow bị reject.
- [ ] Thêm SDK qua `pnpm --filter api add livekit-server-sdk`; chạy build/test
      để thấy assertion thiếu implementation; sau đó viết implementation tối thiểu.
- [ ] Sửa catalog/seed để key không có default không làm seed lỗi hoặc tự insert;
      giữ baseline revision/validation của các key có default hiện hữu.
- [ ] Thêm script `test:learning-sessions`: `nest build && node --test test/learning-sessions/*.test.mjs`.
      Integration files đặt thư mục con để script này không tự gọi DB.
- [ ] Verify: `pnpm --filter api test:learning-sessions` và
      `pnpm --filter api test:configuration`; expected exit 0, các case trên pass.

**Deliverable:** config + UTC policy dùng được; production grace vẫn chưa seed.

## Task 2 — Session token API và projection để client tích hợp

**Files:** service/controller/dto/responses/module ở file map;
`test/learning-sessions/token.test.mjs`, `http.test.mjs`, `reads.test.mjs`.
**Consumes:** Task 1 + IdentityGuard/permission catalog + configuration snapshot.
**Produces:**

```ts
LearningSessionsService.issueLiveKitToken(
  actor: Principal, sessionId: string,
): Promise<LiveKitTokenResponse>;
LiveKitService.issueParticipantToken(input: {
  roomName: string; identity: string; expiresAt: Date;
}): Promise<string>;
```

`LiveKitTokenResponse` và join/progress DTO có shape ở spec §6; serialize UTC ISO.

- [ ] Viết failing HTTP tests 401/403/404/409/503, empty body only, invalid UUID,
      reject body userId/identity/roomName; STAFF outsider cũng bị từ chối.
- [ ] Unit tests decode/verify JWT với test key: đúng room/identity, không admin,
      publish/subscribe hợp lệ, TTL ≤120s và ≤closesAt. Không gọi provider thật.
- [ ] Test repeated join cùng mapping; read DTO không lộ roomMetadata/internal
      cancellation fields không được phép; tokens không ở GET, logs hoặc audit.
- [ ] Implement guard và `issueLiveKitToken`: khóa Path → Session, load lại
      policy/schedule/state, set mapping nếu null, ký local và trả no-store.
      Giữ mapping có trước; không room-create network call trong transaction.
- [ ] Add join metadata và computed lifecycle trên explicit read projection;
      thiếu config => canJoin=false, không fail cả list/detail. Giữ array mine.
- [ ] Validate from/to bằng shared absolute timestamp policy thay Date.parse
      chấp nhận local-only; không tự đổi nghĩa lọc date hay thêm pagination mới.
- [ ] Verify focused script, fixture raw signing không ghi token ra test output;
      expected all pass. Behavior của ONGOING/AWAITING token chỉ chốt theo spec §5
      sau review, không chọn ngầm lúc viết code.

**Deliverable:** token endpoint thật và contract BE cho SH-074; chưa phải video UI.

## Task 3 — Lifecycle, signed webhook và phục hồi sau restart

**Files:** webhook controller, lifecycle worker, session.policy/service/module,
main.ts; `test/learning-sessions/lifecycle.test.mjs`, `webhook.test.mjs`.
**Consumes:** Task 1/2; `OutboxConsumer.processOnce` + TransactionContext.
**Produces:**

```ts
LiveKitService.verifyWebhook(rawBody: string, authorization: string): Promise<WebhookEvent>;
LiveKitService.listActiveParticipants(roomName: string): Promise<{
  roomSid: string; identities: string[];
} | null>;
LearningSessionsService.applyLiveKitActivity(
  tx: TransactionContext, event: WebhookEvent,
): Promise<void>;
SessionLifecycleWorker.sweep(now: Date, limit: number): Promise<void>;
```

- [ ] Failing tests: exact raw bytes/content type, invalid signature => zero
      receipts/writes, forged room/identity, unknown event ack, transaction rollback
      cho phép retry, duplicate event chỉ apply một lần.
- [ ] Test state table spec §5: không READY khi policy thiếu; không ONGOING chỉ
      vì cấp token; valid media mới ONGOING; endAt chuyển awaiting; terminal giữ
      nguyên; worker tắt provider không phá state lõi.
- [ ] Test early join + missed webhook được room snapshot phục hồi; stale snapshot
      sau reschedule/cancel/dispute không ghi; SID cũ không đè room incarnation mới;
      event trễ sau endAt không làm quay lại ONGOING.
- [ ] Implement receiver dùng SDK, receipt namespace `livekit.session-lifecycle`,
      Session application contract trong cùng tx; không tạo receipt table mới.
      Verify signature trước receipt; body/token/provider error không được log.
- [ ] Implement bounded sweep 100 rows/page, technical interval 30s, không overlap;
      cursor tiếp tục đến hết eligible batch, không bỏ đói row sau 100. Provider
      observation ngoài tx có timeout; revalidate thời gian/schedule/state khi ghi.
- [ ] Bootstrap quét catch-up, shutdown clear timer; worker nhiều instance dùng
      conditional updates/locks idempotent. Webhook parser chỉ nhận route/content
      type cần thiết, không làm hỏng payOS/JSON body routes.
- [ ] Verify unit/HTTP tests; test nhận rõ provider webhook cần public HTTPS.
      Chưa tuyên bố test local fake là bằng chứng Cloud delivery.

**Deliverable:** lifecycle không dựa client self-report, webhook an toàn và recoverable.
Attendance seconds giữ trạng thái unavailable, không tự cộng giờ từ first/last.

## Task 4 — Completion idempotent, progress và completion trigger

**Files:** sessions service/responses, completion handler/module, learning-path
read projection nếu cần; `test/learning-sessions/completion.test.mjs`,
`test/learning-platform/phase2.test.mjs`, fixtures/fake-db chỉ mở rộng tối thiểu.
**Consumes:** locks/TransactionRunner, PathSettlementPort, ReportsService guard,
OutboxConsumer/registry hiện hữu. **Produces:**

```ts
LearningSessionsService.trySettleCompletedPath(pathId: string): Promise<
  { outcome: 'SETTLED' | 'WAITING' | 'ALREADY_SETTLED' }
>;
SessionCompletionHandler.publish(event: OutboxMessage): Promise<void>;
```

Public `settlePath(actor, pathId)` giữ auth hiện tại và delegate cùng private
application core; worker không giả actor hoặc dùng HTTP để gọi lại chính API.

- [ ] Failing tests: A confirm lần 1, A retry với note khác, B confirm => note/
      timestamp A không đổi; B retry cũng không đổi; outsider/before end/terminal
      bị chặn; hai confirm đồng thời chỉ có một completion event.
- [ ] Test progress bằng fixture TWO_WAY plan A có 2 Session, plan B có 3:
      1 completed mỗi plan => plan counts 1/2, 1/3 và agreement 2/5; không cộng
      Session draft/version khác. ONE_WAY chỉ đếm một chiều học.
- [ ] Implement idempotent confirm + outbox `learning-path.sessions-completed`
      một lần khi tất cả Session hoàn tất; event chỉ pathId/lockedVersion,
      dedupe key `path.sessions-completed:${pathId}:${lockedVersion}`.
- [ ] Wire handler vào registry; settlement core recheck full completion/dispute/
      deadline trong transaction hiện hữu. WAITING vì dispute/policy không mất
      khả năng retry: sweep lại eligible completed-but-unsettled paths sau
      restart/deadline; lỗi DB bất ngờ để outbox retry, không nuốt thành WAITING.
- [ ] Test held/ledger giữ nguyên sau từng buổi, duplicate trigger không trả hai
      lần, dispute xuất hiện giữa read và write vẫn chặn; existing 96/4 giữ nguyên.
- [ ] Verify `pnpm --filter api test:learning-platform`, focused Session script;
      expected all pass, chưa tự tăng/reseed dispute window đang còn mở.

**Deliverable:** SH-072 hoàn thiện hành vi còn thiếu mà không đổi policy tài chính.

## Task 5 — PostgreSQL integration, rollout và handoff

**Files:** `test/learning-sessions/integration/persistence.test.mjs`,
`integration/http.test.mjs`, package.json, `.env.example`, README.md,
`specs/010-session-livekit/validation.md`.

- [ ] Thêm `test:learning-sessions:integration`:
      `node test/require-integration-env.mjs && nest build && node --test --test-concurrency=1 test/learning-sessions/integration/*.test.mjs`.
- [ ] Trên DB test đã migrate, kiểm chứng concurrent first token requests, unique
      mapping, concurrent confirms, receipt rollback/replay, reschedule/webhook race
      và settlement/dispute race. Dùng isolated fixtures; không DB development.
- [ ] Test application boot với provider vắng/partial/đủ env, JSON/payOS routes
      còn parse đúng sau parser mới; không dùng SDK credentials thật trong CI.
- [ ] Chạy tuần tự từ root: `pnpm --filter api lint`,
      `pnpm --filter api check-types`, `pnpm --filter api build`,
      `pnpm --filter api test:learning-sessions`,
      `pnpm --filter api test:learning-sessions:integration`,
      `pnpm --filter api test:learning-platform`,
      `pnpm --filter api test:configuration`.
- [ ] Chạy `pnpm --filter api test:learning-platform:integration` cho finalize/
      existing financial regressions khi DB test sẵn sàng. Kết quả thiếu DB phải
      ghi Pending, không ghi Pass vì fake tests xanh.
- [ ] Cập nhật Swagger, README và placeholders bằng cách merge `.env.example`
      hiện có. Ghi cách operator đặt joinWindow qua configuration use case có
      audit; không dùng SQL tùy ý hoặc seed fixture vào production.
- [ ] Sau khi có deployment/policy cho test: hai tài khoản participant lấy token
      qua API rồi join cùng room bằng Meet; outsider bị 403; verify reconnect,
      webhook signed đến đúng endpoint và lỗi provider không đổi credit/state lõi.
      Cloud smoke là manual check cần thực hiện, không dùng CLI token để chứng
      minh membership guard của API.
- [ ] Ghi validation gồm commands/revision/evidence, các policy còn mở và giới
      hạn attendance/SH-074. Không đánh dấu video UI đã hoàn thành.

**Deliverable:** bằng chứng kiểm thử và runbook đủ để tiếp tục tích hợp frontend.

## Thứ tự và điều kiện tiếp tục

Thứ tự: **Task 1 → 2 → 3 → 4 → 5**. Ưu tiên mốc có thể thử hai participant vào
đúng phòng sau Task 2; lifecycle/recovery và completion vẫn cần làm trước khi
đánh dấu toàn bộ feature xong. Không cần worktree hoặc dependency install để
review tài liệu này.

Trước execution, review lựa chọn spec §5. Early/late được phép tiếp tục giữ mở:
code/test triển khai được nhưng production join vẫn disabled cho tới khi operator
có policy được duyệt. Các thay đổi state/token behavior đề xuất khác không được
biến thành policy đã duyệt chỉ vì đã viết trong plan.

## Complexity Tracking

Không có ngoại lệ kiến trúc. Reuse receipt không thêm table; worker batch phục vụ
recovery thật, không phải hạ tầng dự phòng. Root lockfile là ảnh hưởng shared tooling
duy nhất dự kiến; package dependency chỉ thuộc API. Không thêm recording, ingress/
egress, AI agent, media server riêng, full attendance ledger hoặc thay đổi mobile.
