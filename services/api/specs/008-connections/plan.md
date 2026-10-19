# Implementation Plan: Kết nối — Proposal và Chat

**Branch**: `feat/connections` | **Date**: 2026-10-09 | **Spec**: [spec.md](spec.md)

**Input**: `specs/008-connections/spec.md`. **Status**: Implementation added under this plan; migrations are not deployed. See [tasks](tasks.md), [approved policies](policies.md) and [validation](validation.md) for current evidence and remaining gates.

## Summary

Proposal nguồn Request/direct search, accept mở Conversation, chat text/file/read state và notification tối thiểu. Reuse identity, Learning Request lifecycle, Sharing Skill eligibility, PostgreSQL transaction/idempotency/outbox, private storage. Message thuộc MongoDB; không copy nội dung chat vào PostgreSQL.

User amendment 2026-10-09: chat, notification và application events dùng SSE chung `/api/v1/events`. HTTP mutations/history phục vụ thao tác, initial load/hydration/resync; live delivery qua durable per-user event log và SSE reconnect/replay, Redis wakeup hỗ trợ nhiều API instance. Chi tiết tại [SSE contract](contracts/sse.md).

Accept là một PG transaction, không gọi Mongo/Redis/S3; không Hold/tạo Path/Schedule/Session/MATCHED. Chat reserve identity trong PG → lưu Mongo DRAFT bền → commit PG publication intent/file binding/outbox → công bố Message idempotent. Sequence/read state dùng Mongo-local transaction; Compose đã cấu hình replica set và có explicit index migration, nhưng topology thật chưa được kiểm chứng.

Branch từ cached `origin/dev` tại `4596b79`, có OTP/password recovery fixes; không fetch/pull lần plan này. Git root là monorepo, Spec Kit root là API. `setup-plan.ps1 -Json` trả `HAS_GIT=false`, `BRANCH=008-connections` theo pointer; branch Git thực tế `feat/connections`.

## Technical Context

**Language/Version**: TypeScript 6.0.3; Node 22.12+ trên 22.x hoặc 24+ theo README.

**Primary Dependencies**: NestJS 11/Express/RxJS streaming HTTP SSE, Prisma 7.8/pg, Mongoose 8.19, Redis/BullMQ, Swagger và storage/scan hiện có. Fetch-compatible SSE with Bearer auth; không thêm socket service.

**Storage**: PG Proposal/Conversation/publication receipts/StoredFile/audit/outbox; Mongo Message DRAFT/PUBLISHED, technical stream counter/read state; S3 private bytes; Redis throttle/jobs. Mongo replica set bắt buộc cho publication/sequence atomic.

Bucket decision (2026-10-11): avatar, CHAT và Evidence dùng chung `S3_BUCKET=skillhub`, với prefix `avatars/` và `private/`. Cấu hình provider của hai adapter phải trỏ cùng dịch vụ chứa bucket này; đổi env không tự chuyển object cũ.

**Testing**: Node test runner; focused policy/service/DI/SSE tests and affected regressions. Real PG/Mongo suites require explicit isolated URLs and remain pending; Redis multi-instance, S3/scanner and performance proof remain release gates.

**Target Platform**: Node backend, multiple API/worker instances; không process-local throttle/delivery guarantee.

**Project Type**: API modular monolith trong pnpm/Turborepo.

**Performance Goals**: NFR-PERF-01 P95 ≤2s thao tác/list thông thường. Benchmark đề xuất 100k Proposal/10k Conversation/1m Message, 100 concurrent users; đây là fixture kỹ thuật, không capacity production. Đo riêng accepted→published latency/recovery backlog, không tự đặt SLA delivery.

**Constraints**: UTC, UUID, cursors; proposal text 10–1000, chat text 1–2000; file 15.000.000 bytes. No text/token/signed URL in logs/outbox. Credit suggestion decimal string → integer hundredths, không đổi financial runtime.

**Scale/Scope**: Ba module mới `proposals`, `conversations`, `application-events`; API owner contracts users/sharing/LR/storage/notifications/config. Module events chung phục vụ cả notification đã có và các owner sau. Không root tooling/packages/frontend/mobile/diagram v3/học/tài chính.

## Constitution Check

Constitution v1.2.0. Trước research/sau design: **Pass for design**, không exception. Runtime verification vẫn Pending.

| Principle            | Before / after design                               | Evidence and gate                               |
| -------------------- | --------------------------------------------------- | ----------------------------------------------- |
| 1 architecture/scope | Pass / Pass: API-only, owner modules                | Research inventory; DI/lint/types/build Pending |
| 2 stores             | Pass / Pass: PG relational, Mongo Message, S3 bytes | Data model; indexes/replica set Pending         |
| 3 atomicity          | Pass / Pass: one PG accept, no financial writes     | Races/rollback/migration Pending                |
| 4 security           | Pass / Pass: live auth, permission, membership      | IDOR/revoke/restriction HTTP tests Pending      |
| 5 contracts          | Pass / Pass: HTTP/UTC/decimal/cursor/private scan   | Swagger/schema/file E2E Pending                 |
| 6 evidence           | Pass / Pass: explicit validation matrix             | Planning only; runtime Pending                  |
| 7 ownership          | Pass / Pass: owner contracts + explicit tx          | Internal contracts; no foreign repositories     |
| 8 delivery           | Pass / Pass: outbox/dedupe/reconcile                | Crash/stale/replay/unknown-event Pending        |
| Git                  | Pass / Pass: feat/connections, numeric spec riêng   | No commit/push                                  |

Financial operations không áp dụng; regression phải chứng minh accept/send không đổi Wallet/Ledger/Session. Product activation gates không phải constitutional exception.

## Project Structure

### Documentation (this feature)

```text
specs/008-connections/
  spec.md
  plan.md
  research.md
  data-model.md
  contracts/http.md
  contracts/internal.md
  contracts/sse.md
  quickstart.md
  checklists/requirements.md
  validation.md
```

`tasks.md` đã được tạo theo Spec Kit và cập nhật khi implement; các real-store release tasks vẫn Pending.

### Source Code (relative to services/api; design map)

```text
src/modules/proposals/
  proposals.module.ts
  presentation/http/
  application/ (create/list/detail/update/accept/reject/withdraw/expiry)
  domain/ (input/state/source/suggestion policies)
  infrastructure/ (Prisma repository, expiry worker/scheduler)
src/modules/conversations/
  conversations.module.ts
  presentation/http/ (message/file/read/delivery endpoints)
  application/ (access/send/publication/read/file use cases)
  domain/ (message/structured-event policies)
  infrastructure/ (PG receipts, Mongoose schemas/repositories,
                   publication/outbox/reconciliation)
src/modules/application-events/
  application-events.module.ts
  presentation/http/ (authenticated SSE endpoint)
  application/ (recipient event append, replay, current-access projection)
  infrastructure/ (PG feed, Redis wakeup, bounded streams/cleanup)
test/connections/ (policies, HTTP/SSE, PG/Mongo/Redis/files/recovery/performance)
```

Affected existing API paths: `app.module.ts`, users actor/eligibility exports, sharing-skills eligibility/public adapter, LR dependency bindings/lifecycle, Notifications owner exports/SQL producer triggers, permission catalog/seed, storage CHAT binding/download, runtime-schema generator/additive migration, API package scripts/Compose/`.env.example`/README/Prisma README. Changes stay within services/api; no dependency or root/frontend change was required.

## Phase 0 — Research

[research.md](research.md) records source contracts, SRS/model conflicts, alternatives and policy gates. Technical choices are specified; absent product values remain activation gates, not invented defaults.

Prerequisites include LR unavailable readers, locking teacher eligibility, users restrictions, CHAT attach/status, Mongo Message/indexes and outbox routing. Core LR source does not prove integrated behavior.

## Phase 1 — Design

See [data model](data-model.md), [HTTP](contracts/http.md), [SSE](contracts/sse.md), [internal contracts](contracts/internal.md), [quickstart](quickstart.md).

Ownership: proposals owns Proposal; conversations owns Conversation/Message/stream/read/publication receipts. LR owns Request status; users owns accounts/grants/restrictions; sharing-skills owns eligibility; storage owns files/binding; notifications owns inbox.

Application-events owns technical PG recipient feed/cursors and SSE connection lifecycle, never authoritative chat/inbox content. Existing notification create/read paths append events atomically; Mongo read-state changes use a durable Mongo event intent before bridging to PG. PG event counter locks are last in common ordering, sorted by recipient; commit-ordered allocation prevents replay gaps. Stream authenticates Bearer before headers, rechecks live auth/domain access, closes on expiry/revoke, uses bounded buffers and teardown. Redis broadcasts wakeups on a dedicated subscriber; persisted feed/server-side catch-up covers lost wakeups. No client polling primary transport.

Lock order: users sorted UUID → Request (nếu có) → catalog/SharingSkill sorted IDs → Proposal → Conversation → publication receipt → StoredFile sorted IDs. Order này phù hợp LR edit/publish hiện khóa Request trước catalog. Discover references without locking, then lock/revalidate; owner adapters share order. Idempotency authorization callback khóa cả hai account ngay lần đầu, không khóa principal rồi mới bổ sung recipient trong work. Workers use a suffix and never acquire earlier locks afterward. LR cancel/future final-lock must share order. No nested transaction runner in owner contracts.

Create/update/accept recheck source/skill/accounts in PG tx and use version CAS/partial uniques. Nonexpired sibling PENDING can reject/withdraw after source changes but cannot accept. Idempotency replay checks live access/membership before hydrate. Audit/outbox failures rollback accept.

Send: live auth + stable PREPARING PG receipt → immutable durable Mongo DRAFT keyed sender/conversation/clientMessageId → PG tx rechecks live access, seals draft digest, binds CLEAN CHAT files, records COMMITTED intent + reference-only outbox → Mongo-local transaction increments stream sequence and publishes DRAFT → PG CAS delivered receipt + exactly-once notification event identity. No visible DRAFT and no success-as-delivered from enqueue. Crash/retry semantics are in data-model/internal contracts.

No auto purge while retention policy unresolved. Enabled cleanup first cancels uncommitted receipt/tombstones under same PG locks before deleting draft/file; publisher never publishes cancelled intent. Delivered receipt/file never orphan. Missing Mongo draft is retained failure, never fabricated empty message. Mongo sequence yields stable replay/read watermark; retry after publication returns original message/sequence.

## Phase 2 — Implementation Sequence (progress in tasks.md)

1. **Policy/prerequisites**: Activation values, validated config, users restriction actions/recipient checks, LR owner adapters. Path/Schedule lock reader stays fail-closed while its owner is unavailable; list affected flows explicitly.
2. **Persistence**: Proposal version/timestamps/hint/checks/partial uniques; Conversation uniqueness and publication receipt; Mongo schemas/index deployment/replica-set setup. Preflight collision/null expiry without auto-delete/reject. Update generator inputs, not only generated Prisma.
3. **Proposal slice**: Create/list/detail/update/withdraw/reject/expiry; live role/eligibility, CAS/idempotency/shared throttle/source derivation.
4. **Accept slice**: Owner contracts in one tx, one Request winner, Conversation unique, audit/outbox registry; PG race/rollback tests, no downstream writes.
5. **SSE infrastructure**: Technical user feed/idempotent append, signed resume cursor/replay window, Nest streaming handler/auth/token expiry, Redis fanout, heartbeat/backpressure/connection caps/cleanup; real two-instance/proxy/reconnect tests.
6. **Text chat slice**: Participant HTTP commands, durable DRAFT/publication saga, Mongo sequence/transaction, SSE committed-message/delivery events, history/resync; replica-set gate.
7. **File/read slice**: CHAT-specific storage binding/status/download, scan-safe saga, read watermark + durable Mongo event intent, SSE read/file-status producers, crash/reconciliation.
8. **Notifications/cards**: Existing inbox create/read SSE adapters and proposal/chat event dedupe; Path/Schedule contract tests, producer E2E Pending until owner implemented.
9. **Release**: Swagger/docs/operators including SSE/proxy config, lint/types/build, regressions, real stores/provider/SSE suites, benchmark and validation. No commit/push/deploy in plan scope.

## Verification & Release Gates

[validation.md](validation.md) maps acceptance/tests. Required races: accept/accept/reject/withdraw/expiry/cancel/skill revoke/account lock; same key same/different body; concurrent send/file claims; Mongo commit before PG ack; old/new read watermark; duplicate/stale/unknown outbox; cleanup versus commit; live revoke on retry/download; unchanged wallet/session data.

Approved activation values are recorded in policies.md and implemented as defaults. Optional suggestion session-count and ONE_WAY min/max still require explicit configuration when supplied. Production gates: chat/file retention/deletion, report-message handling/case-scoped staff access, external notification channels. Missing topology/index/hint capability returns unavailable; real-store proof remains mandatory before release.

HTTP commands/history + SSE live-delivery baseline by explicit user instruction. REST forward history/status remain recovery tools. Presence/typing, message edit/delete, close/reopen negotiation, general staff browsing, finances, UI/full dispute excluded. Actual Path/Schedule producers adopt SSE through owner adapters when implemented.

## Complexity Tracking

No exception. Technical publication receipt/Mongo stream counter support safe binding/order; per-user PG event feed supports shared SSE replay without copying message text or replacing owner state. Application-events is an in-process API module, not a new service. Mongo transaction is local; replica set rollout remains prerequisite. Distributed transactions and separate realtime service rejected as unnecessary.
