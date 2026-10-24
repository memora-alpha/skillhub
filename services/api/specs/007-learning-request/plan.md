# Learning Request Implementation Plan

**Inline tag amendment — 2026-10-24:** [Design, contract, transaction boundary and
Constitution check](proposed-tags.md) cover inline tag proposals reviewed with the
post. Only backend Request, Skills, audit snapshots and runtime storage change.

**FE amendment — 2026-10-12:** User approved [design](fe-extension-design.md) and requested immediate implementation. [Extension plan](fe-extension-plan.md) covers teaching overview, owner's offered Sharing Skills, weekly availability, desired hourly Credit, ACTIVE Tag lookup and additive migration. Retain existing lifecycle/permission/moderation/legacy slots.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or superpowers:subagent-driven-development to implement this plan task-by-task. User approved options A for all eight reviewed decisions and requested implementation. Core implementation is in progress; upstream and real-infrastructure gates remain open. No commit/push is authorized.

**Goal:** Hoàn thành backend SH-030–034: tạo/publish, moderation, reason/audit/notification, edit/cancel/expiry và tìm Request phù hợp.

**Architecture:** Learning Requests sở hữu state/persistence; Catalog/Sharing Skill và Path/Schedule tích hợp qua owner contracts. Dùng Principal auth runtime, PostgreSQL transaction/version/row locks, AuditWriter/outbox. Notifications thêm slice IN_APP hoàn chỉnh cho rejection.

**Tech Stack:** NestJS 11, TypeScript 6, Prisma 7.8/PostgreSQL, Redis/BullMQ, class-validator/Swagger và node:test; API sanitizer packages được thêm khi implement.

**Spec:** [spec.md](spec.md). **Branch:** `feat/learning-request`. **Date:** 2026-10-06. **Status:** Implementation authorized. LR-D01/02, Catalog tags, grant matrix and IN_APP rejection are accepted; exact initial moderation rules and real SH-022/023/Path adapters remain gates.

**SRS baseline:** [V1.5](../../../../docs/SRS_SkillHub_V1.5-1.docx), revision 03/10/2026. [Change report](srs-v1.5-changes.md) xác nhận core LR không đổi; cập nhật owner contracts, Task 2/5/7 và G3 cho LearningPath là thỏa thuận tổng, LearningPlan theo learner, TWO_WAY/ONE_WAY và completion toàn thỏa thuận.

**ERD alignment — 2026-10-07:** The user supplied ERD v3 and SRS V1.6 for checking Tag. [Alignment report](erd-v3-alignment.md) supersedes the earlier LR storage choices: preferred_slots JSONB, verified_teacher_only, mapped content_version/flagged_rules/reject_reason/reviewed_by_user_id/reviewed_at and optional downstream Request FKs. Tag remains because V1.6 18.10/FR-LR-01/07/08 explicitly requires it. V1.5 downstream analysis is retained as historical evidence; this request does not re-audit every V1.6 downstream policy.

## Global Constraints

- Phạm vi services/api; Git/pnpm ở root; không sửa apps/web hoặc root tooling. Nếu thêm API dependencies, root pnpm-lock.yaml chỉ thay generated dependency metadata để cài tái lập.
- “Chỉ User ACTIVE được tạo Learning Request.” SRS LR-001; live session, explicit permission and new-activity restrictions remain enforced. USER grants create/read/update/cancel:self and own notifications; STAFF has explicit queue/read/approve/reject grants; ADMIN receives moderation only by explicit grant. Roles do not inherit permissions.
- title 10–120; description 20–3000, sanitize; learningGoal 10–1000; Skill ACTIVE; tối đa 10 tags hợp lệ và 5 future slots; rejectReason 10–500.
- “Publish phải chạy word/pattern filter. Flagged -> PENDING_MODERATION; clear -> OPEN.” SRS LR-003.
- “Staff Reject phải có rejectReason và notification.” SRS LR-004; sensitive action có reason/audit BR-40.
- “Chỉ OPEN mới nhận Proposal mới.” SRS LR-005; cancel trước lock, giữ Proposal history; LR không Hold Credit/tạo Session.
- Backend/DB UTC clock. Default TTL is 30 days after publish; user-selected expiry is future and at most 90 days after publish. Only OPEN/PENDING_MODERATION auto-expire. Edit ends at NEGOTIATING; owner cancellation ends at Schedule LOCKED.
- Request uses canonical Catalog tag IDs, max 10. Versioned moderation rules normalize Unicode NFKC/case/whitespace while preserving Vietnamese accents; Admin configures, Staff reviews. Exact initial keywords/patterns need PO review; absent/empty/malformed rule sets never fail open.
- Authoritative state PostgreSQL, owner ports; state/audit/outbox atomic; delivery có dedupe/retry/recovery.
- Memora envelope, versioned Swagger, expectedVersion; không tin owner/status từ body.
- exchangeType/teacherId/learnerId/negotiatedCredit/fee thuộc Proposal/Chat/Path/Wallet owners theo SRS, không thêm vào LR DTO/schema. Request version không thay thế agreement/plan version.
- MATCHED chỉ từ final lock flow đủ plan/learner/agreement/schedule confirmations theo exchangeType; CLOSED chỉ sau mọi Session của mọi plan hoàn tất và settlement thành công. LR không tính Hold/fee/earning hoặc tự đồng bộ skill đã học.
- Reuse feat/learning-request; commit chỉ khi user authorize, không bypass hooks. Core source and ERD corrections are present; completion evidence and remaining integration gates are tracked in validation.md.

## Review Focus

1. Account/grant bị thu hồi giữa guard và mutation: assertLive + permission trong transaction; test Task 2/4.
2. Owner sửa hoặc config đổi khi filter/Staff review chạy: stale version không publish/approve; test Task 3/4.
3. Expiry job chậm và cancel/accept/lock race: action đọc expiry trực tiếp, dùng cùng row lock; real PostgreSQL test Task 5.
4. Duplicate/restart/delayed rejection delivery: một notification, reason của reviewed version; test Task 4.
5. List/detail/count/cursor lộ private status/reason/rules: cùng scope predicate và allowlist projection; test Task 6.
6. Lock/completion dùng giả định một lộ trình cũ: owner flow phải validate hai plan đối ứng TWO_WAY hoặc một plan ONE_WAY và current confirmations; không MATCHED/CLOSED sớm. Contract/concurrency evidence Task 5/7.

## Technical Context

Package api, Node theo root engines >=22.12 <23 hoặc >=24; dependencies như package hiện có. Request không dùng MongoDB; MongoDB chỉ chat tương lai. Tests theo convention .mjs import dist, HTTP tests khởi tạo Nest application, DB integration dùng TEST_DATABASE_URL riêng qua test/require-integration-env.mjs.

NFR-PERF-01 mục tiêu P95 <= 2 giây. Dataset/concurrency/hardware phải thống nhất trước benchmark release; không bịa workload. Pagination đề xuất 20/max100; expiry batch bounded. [Research](research.md) đã kiểm tra source/migrations; công nghệ được chọn không chứng minh feature đã chạy.

## Constitution Check

Constitution v1.2.0, review trước research và sau design ngày 2026-10-06. Pass design chỉ là phù hợp thiết kế; runtime còn Pending.

| Principle                 | Design gate | Evidence / implementation gate                                                                                                                            |
| ------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 Scope/modular monolith  | Pass        | API-only; LR module + necessary notification slice, không microservice/empty layer.                                                                       |
| 2/3 Storage/atomic state  | Pass        | Request/slots/tags/Notification/Audit/Outbox PostgreSQL; Task 1/4/5 verify rollback/concurrency. Runtime Pending.                                         |
| 4 Auth/security           | Pass        | IdentityGuard/Principal + action/owner/live account; grants/eligibility adapter Pending Task 2.                                                           |
| 5 Validation/API/time     | Pass        | Exact bounds, UTC parser, projection/pagination/Swagger Task 3/6. Runtime Pending.                                                                        |
| 6 Verification            | Partial     | Core unit/build checks passed; ERD attribute and persistence regression checks added. Real DB/Redis/consumer evidence remains pending; see validation.md. |
| 7 Owner contracts         | Pass        | Catalog/Users/Sharing Skill/lock/lifecycle ports; concrete adapters/catalog migration Pending.                                                            |
| 8 Jobs/delivery           | Pass        | Rejection consumer/receipt và expiry retry/recovery Task 4/5. Runtime Pending.                                                                            |
| Governance/business gates | Partial     | User approved core policies/grants/IN_APP; exact production moderation terms/categories need PO approval; OP-13 is downstream.                            |
| Git workflow              | Pass design | Đúng branch; chưa stage/commit/push.                                                                                                                      |

Không có constitution exception. Các lựa chọn nghiệp vụ A đã được duyệt; chỉ bộ moderation rules thực tế cần PO duyệt trước production.

## Project Structure

Feature docs gồm spec.md, plan.md, research.md, data-model.md, contracts/http.md, contracts/module-ports.md, quickstart.md, checklists/requirements.md, srs-v1.5-changes.md, erd-v3-alignment.md và validation.md. Core source paths đã được implement, tương đối services/api:

```text
src/modules/learning-requests/
  learning-requests.module.ts
  domain/{learning-request.policy,moderation.policy,request-text.policy}.ts
  application/contracts/{learning-request.types,learning-request-rejection.event}.ts
  application/ports/{learning-request-repository,learning-request-dependencies}.ts
  application/services/{learning-request-access,learning-request-lifecycle}.service.ts
  application/use-cases/{create,edit,publish,moderate,cancel,expire,list,get}-learning-request*.ts
  infrastructure/persistence/prisma-learning-request.repository.ts
  infrastructure/jobs/{learning-request-expiry.scheduler,learning-request-expiry.worker}.ts
  presentation/http/{learning-requests.controller,request-moderation.controller,
    learning-requests.dto,learning-requests.responses}.ts
src/modules/notifications/
  notifications.module.ts
  application/ports/notification-repository.ts
  application/use-cases/{list-notifications,mark-notification-read}.use-case.ts
  infrastructure/events/learning-request-rejection.publisher.ts
  infrastructure/persistence/prisma-notification.repository.ts
  presentation/http/{notifications.controller,notifications.dto,notifications.responses}.ts
test/learning-requests/*.test.mjs
```

Không di chuyển identity email code. Composition/package/config/audit/permission/migration tooling chỉ sửa trong task sở hữu nhu cầu; existing identity bootstrap phải regression khi seed được mở rộng. File use-case tên rõ ràng theo class trong module-ports, ví dụ create-learning-request.use-case.ts và expire-learning-requests.use-case.ts.

## Dependency order and gates

| Gate | Điều kiện                                                                                                                                                | Kết quả cho phép                                                                                                                     |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| G0   | User selected options A for expiry/edit/cancel/tags/moderation/grants/IN_APP. PO must approve exact initial moderation words/patterns before production. | Implement core LR; publish rejects an absent/malformed/empty rule set as unavailable, never auto-clean. Fixture rules are test-only. |
| G1   | SH-022 Skill/Tag API+migration và Users new-activity contract thật                                                                                       | SH-030/031 end-to-end, no permissive runtime stub.                                                                                   |
| G2   | Approved explicit grants + moderation/audit + in-app notification consumer/inbox                                                                         | SH-032 DoD đầy đủ; outbox-only không đạt.                                                                                            |
| G3   | SH-042/051/055 và Path/Session/Wallet owner contracts theo V1.5                                                                                          | SH-033 NEGOTIATING/MATCHED/CLOSED and races; core LR may use contract fakes, real consumer behavior remains Pending.                 |
| G4   | SH-023 matching snapshot adapter + agreed load dataset                                                                                                   | SH-034 gợi ý thật/performance; feed/filter kiểm chứng sớm hơn.                                                                       |

Upstream module do feature/owner của chúng triển khai; LR chỉ định nghĩa/consume contracts, không làm toàn bộ SH-022/023/042/055.

OP-13 (bảng Open Items và mục 18.40 of SRS) remains a downstream Path/Wallet gate for ONE_WAY fee/min-max/refund/cancel/no-show. Do not use TWO_WAY 4%/20 Credit defaults. It does not block core LR create/moderation/search; claim ONE_WAY end-to-end only when owner policy/adapters exist. OP-14/Material is outside LR.

## Task 1: Scoped persistence and owner contracts

**Files:** Modify prisma/schema.prisma, scripts/write-identity-schema.mjs, prisma/README.md; create generated prisma/migrations/<timestamp>_learning_requests/migration.sql (Prisma chooses timestamp), LR application/contracts/learning-request.types.ts, application/ports/learning-request-repository.ts, application/ports/learning-request-dependencies.ts và infrastructure/persistence/prisma-learning-request.repository.ts. Test test/learning-requests/schema.test.mjs, persistence.test.mjs.

**Interfaces:** Consumes TransactionContext, approved Catalog IDs/migrations. Repository produces get(tx,id), lock(tx,id), create(tx,input), replaceContent(tx,id,expectedVersion,input), transition(tx,id,expectedVersion,from,to), list/expiry queries. Return fields follow data-model; conflicts typed, no unconditional writes. Public/dependency shapes in contracts/module-ports.md.

- [x] Write failing schema tests: preserve previously deployed models/enums; add LR/request-tag/Notification and approved Catalog dependencies. Slots are a JSON field after the v3 alignment. Generic relation-pruning regression keeps downstream models outside deployment scope.
- [x] Run `pnpm --filter api exec node --test test/learning-requests/schema.test.mjs`; expected FAIL for absent feature models/pruning, not credentials.
- [x] Extend scoped snapshot for all selected models; preserve hand-written CHECK/trigger/index migrations. Add fields/enums/constraints/indexes from data-model. Verify live legacy data/consumers before removing old LR fields.
- [x] Persist default/custom expiry mode so a 30-day default starts at publish and a rejected republish can start a new window. Custom expiry is capped at 90 days from publish. Only OPEN/PENDING_MODERATION are expiry-eligible.
- [ ] After G1 generate/review scoped migration and validate full/deployment schemas; apply only isolated test DB. Persistence tests assert invalid FK/field/reject bounds, slot ordering, version conflict and atomic replacement rollback.
- [x] Run schema tests, `pnpm --filter api db:validate`, `pnpm --filter api exec prisma validate --schema prisma/identity.prisma` and built persistence tests. Expected pass; unavailable DB remains Pending, client generation is not persistence evidence.

## Task 2: Live access policy and explicit grants

**Files:** Create LR application/services/learning-request-access.service.ts, learning-requests.module.ts; modify src/app.module.ts, src/shared/authorization/permission.catalog.ts, Users-owned prisma-users-repository.ts and scripts/identity-bootstrap.mjs for additive bootstrap. Test test/learning-requests/access.test.mjs and existing authorization/identity suites.

**Interfaces:** Consumes SessionsService.assertLive/Principal and Users-owned NewActivityEligibilityReader; produces assertAction from module-ports. Add `learning-request:read`, `learning-request:update:self`, `learning-request:cancel:self`, `learning-request:moderation:read`, `learning-request:moderation:configure`, `notification:read:self`, `notification:update:self` to existing create/approve/reject actions. Seed USER owner/inbox and STAFF reviewer actions additively; ADMIN gets moderation/configuration only by explicit grant. No role inheritance.

- [x] Write fail cases: non-ACTIVE/non-USER/restricted create, wrong owner/action, STAFF approve cannot imply reject/admin, revoked JWT/current permission denied. Test fixture grants explicit, not production approval.
- [x] Add access regression: ACTIVE USER có session/grant hợp lệ và chỉ bị OTP email cooldown vẫn được create/publish nếu không có restriction khác; không đọc OTP guard để khóa LR. BR-41/OTP-008 thuộc Identity, không triển khai OTP softban ở task này.
- [x] Build/run `pnpm --filter api exec node --test test/learning-requests/access.test.mjs`; expected FAIL for absent access service/provider.
- [x] Implement on runtime Principal; import IdentityModule for SessionsService and register IdentityGuard locally or export it deliberately. Do not attach generic guards without reader/request bridge. Mutation uses identity sorted user locks before Request row for account-change races.
- [x] Extend Users-owned additive seed with the accepted role grants; preserve existing dot-style identity codes and revoked grants, no automatic naming migration or role inheritance. Strict adapters/unavailable errors, no allow-all runtime binding.
- [x] Run new tests, `pnpm --filter api test:rbac` and `pnpm --filter api test:identity`; expected pass. Real account/grant race checks belong to Task 7.

## Task 3: Draft, publish and deterministic filter

**Files:** Create LR domain policies, Create/Publish use cases, DTO/controller/responses; modify src/modules/system-configuration/domain/configuration.catalog.ts, authorized rule-config use case/controller/module wiring, and seed/tests; update API package.json and generated root pnpm-lock.yaml only if an approved dependency is needed. Test test/learning-requests/input-policy.test.mjs, moderation-policy.test.mjs, create-publish.test.mjs, and moderation-rules-http.test.mjs.

**Interfaces:** Consumes Tasks 1/2, Catalog/eligibility ports and versioned config. Produces Create/Publish signatures in module-ports; normalizeRequestText(input:string):string and evaluateModeration(content,ruleSnapshot):{flagged:boolean;categories:string[];ruleSetVersion:number}.

- [x] Bounds tests cover every field minimum/maximum, code points, sanitized HTML/entities, 11 tags, 6 slots, invalid calendar/offset/order, and Catalog canonical-selection rejection. Active-state enforcement stays with the G1 Catalog adapter.
- [x] Tests cover all four content sources, clear/flagged outcomes, missing/empty/malformed configuration -> 503 without mutation, bounded wildcard matching, and stale content/configuration during scan.
- [x] Added Admin GET/PUT for only the moderation-rule key; live session, ADMIN role and explicit grant are rechecked in the write transaction, with expectedVersion, reason, audit and nonempty rules.
- [x] Observed RED for missing policies/use cases, then added exact API dependencies sanitize-html 2.18.0, html-entities 2.6.0 and @types/sanitize-html 2.16.2. Server sanitizer removes markup/attributes/script/style; decoded output is stored as plain JSON data and must be rendered as text.
- [x] Implemented draft/publish with immutable filter snapshot and live owner/account/Catalog/time/content/config version checks at commit. DEFAULT expires 30 days after publish; CUSTOM uses requestedExpiresAt and is capped at 90 days. Edit/approval/rejected-republish handling remains Task 5. Missing/malformed/empty rules fail unavailable; no Hold/Session/Proposal side effect.
- [x] LR unit/static suites, System Configuration 17/17, focused authorization 13/13, Identity 11/11, API check-types/build and focused ESLint pass. Tests reject a different owner/non-DRAFT state and assert returned version. Database HTTP/persistence remains a later gate.

## Task 4: Staff moderation, audit and owner notification

**Files:** Create Moderate use case, request-moderation.controller, Notifications files from structure; modify src/modules/audit/domain/audit-action.catalog.ts and AppModule wiring; Reuse the Notification table/index added in Task 1; no additional migration is needed for this delivery slice. Test moderation.test.mjs, notification-delivery.test.mjs, moderation-persistence.test.mjs under test/learning-requests plus test/audit-policy.test.mjs.

**Interfaces:** Consumes Request/access/AuditWriter/OutboxWriter/Registry/Consumer; produces Moderate signature, learning-request.rejected v1 and real IN_APP publisher/inbox/read contracts. Registry type/consumer name exactly module-ports.

- [x] Write pending approve -> OPEN/APPROVED, reject reason 9/10/500/501, missing reason, stale reviewer/two-reviewer/expired pending fail cases; live permissions checked in tx.
- [x] Add transaction failures: audit/outbox insert error leaves pending and no event. Extend audit projection with positive requestVersion; status means moderation PENDING/APPROVED/REJECTED, not OPEN. Reject-specific audit bounds10–500; approve generic1–2000; preserve other actions, exclude raw content/rules.
- [x] Test two deliveries -> one Notification/receipt; receipt+insert rollback; restart/replay; owner edit before delayed event retains old reason/version. Recipient inbox/read succeeds, outsider404.
- [x] Build/run unit files expecting FAIL; implement Request+audit+outbox atomic, eventId generated outside transaction retry callback. Register Notifications-owned processOnce publisher, Notification.id=eventId; snapshot reason, no mutable LR read/provider calls in tx.
- [x] Run new moderation/notification unit tests and `test:audit` / `test:consistency`; 76 Learning Request/configuration/audit/outbox tests pass.
- [x] Expose owner IN_APP inbox and recipient-scoped mark-read; unit tests cover pagination, snapshot content and outsider 404.
- [ ] Verify rollback/dedupe against an isolated migrated PostgreSQL database; no isolated test database is configured and the scoped migration remains unapplied.
- [x] Keep OP-05 email/push channels outside this feature; rejection delivery is IN_APP.

## Task 5: Edit, cancel, expiry and lifecycle integration

**Files:** Create Edit/Cancel/Expire use cases, lifecycle.service, expiry scheduler/worker; update LR controller/DTO/module. Test lifecycle.test.mjs, expiry.test.mjs, lifecycle-persistence.test.mjs, expiry-recovery.test.mjs under test/learning-requests.

**Interfaces:** Consumes approved expiry/edit policy, repository/access/RequestLockReader; produces lifecycle signatures in module-ports. Queue learning-request-expiry carries scan trigger; worker uses backend current state/time, not job's old state.

V1.5 integration semantics do Path/Schedule/Session/Wallet owners enforce, LR chỉ mutation state qua internal contract. `markMatched` sau lock; `markClosed` sau completion toàn thỏa thuận và settlement, không sau một LearningPlan. Không pull LearningPlan/Credit models vào migration LR. Không reset Request version/state khi plan được sửa; amendment sau LOCK do downstream owner xử lý.

- [x] Implement and test edits for DRAFT/OPEN/PENDING_MODERATION/REJECTED; published skill is immutable and edits stop at NEGOTIATING. Published edits re-filter; REJECTED -> DRAFT -> republish starts a new default window and retains prior review/event history.
- [x] Implement and unit-test expiry at the exact deadline for OPEN/PENDING_MODERATION only. Other states never expire; stale/replayed worker cannot overwrite a newer state/version.
- [ ] Add PostgreSQL cancel-vs-accept, expire-vs-accept, cancel-vs-lock through lifecycle contracts; one conflicting outcome commits. Owner may cancel through NEGOTIATING before Schedule LOCKED. Lock flow sees CANCELLED and cannot create an orphan match. No financial/session writes in LR.
- [x] Author opt-in PostgreSQL coverage for atomic child replacement rollback and cancel-vs-proposal negotiation serialization. Not executed: `TEST_DATABASE_URL` is unset. Expire-vs-accept and cancel-vs-lock still need the owning consumers.
- [ ] Add owner-flow contract fixtures TWO_WAY/ONE_WAY: TWO_WAY thiếu một plan/learner confirmation, tự tạo/xác nhận thay hoặc stale plan/agreement confirmation không lock và Request không MATCHED; ONE_WAY teacher tạo/learner confirm, đủ A/B agreement+schedule confirms mới lock. Giữ Request, plan, agreement versions riêng.
- [ ] In real Path/Wallet integration verify ONE_WAY teacher balance 0 không tự ngăn lock khi learner đủ negotiatedCredit; chỉ learner Hold. TWO_WAY Hold cả hai theo policy. Accept Proposal cho cả hai loại chỉ NEGOTIATING/Chat, không Hold/Session. LR không tự validate hoặc tính số dư/Credit.
- [ ] Add completion protocol cases: một plan TWO_WAY xong nhưng plan còn lại chưa xong, dispute giữ Credit hoặc ledger rollback -> Request còn MATCHED; toàn bộ Session/settlement thành công theo exchangeType mới CLOSED cùng owner completion tx. ONE_WAY không dùng hoàn 96% cho learner. Fake owner-flow tests không chứng minh downstream financial correctness.
- [x] Implement atomic edits/state changes and bounded sweep scheduler/idempotent worker. Unit tests cover exact deadlines, stale state and recovery triggers; consumers follow sorted Users->Request->downstream lock order without nested transactions.
- [x] Run Task 5 unit suites as part of the Learning Request suite: edit, lifecycle, expiry and recovery cases pass.
- [ ] Run PostgreSQL race/rollback checks and Redis-backed restart/recovery. Until SH-042/051/055 and real Path/Session/Wallet adapters plus approved OP-13 policy exist, full V1.5 consumer integration remains Pending; record each exchangeType separately.

## Task 6: Scoped lists/search and recommendations

**Files:** Create List/Get use cases; query/projection helpers in LR repository/responses; update controllers/DTOs. Test query.test.mjs, projection-http.test.mjs, query-persistence.test.mjs under test/learning-requests.

**Interfaces:** Consumes RequestQuery/Page, live access, Catalog readSelections, Users-owned RequestOwnerReader và G4 SharingSkillReader; produces scoped contracts in http.md, stable seek cursor/parameterized queries, no raw entity serialization.

- [x] Add mixed owner/status scope tests for OPEN/unexpired feed, own mine, permitted pending queue, detail privacy, status restrictions and guest guard behavior.
- [x] Test stable seek pagination, scope/filter/actor cursor binding, literal wildcard handling, ANY-tag semantics and combined filters. Historical projection uses catalog read-only ports; selection validation remains separate.
- [x] Test skill/tag ranking, own-request exclusion, no VERIFIED preference, Sharing Skill version mismatch and unavailable adapter -> 503.
- [x] Implement List/Get use cases, scoped allowlist projections, query DTO/routes, parameterized repository queries and pagination envelopes.
- [x] Run query/projection tests, including route metadata, DTO validation, guard, response envelope and OpenAPI metadata for all three scoped detail schemas.
- [ ] Run PostgreSQL query/pagination integration and EXPLAIN/P95 checks on an agreed workload; hardware/data/concurrency are not yet agreed. Verify the generated Swagger document in an application boot environment.

## Task 7: Integrated verification and review evidence

**Files:** Modify API package.json/README and this feature validation.md; add explicit unit/integration runners and opt-in PostgreSQL tests. No frontend or new behavior beyond verification wiring.

**Interfaces:** Consumes all registered endpoints/modules/ports; produces runnable scripts and validation evidence.

- [x] Add `test:learning-request` for explicit non-DB suites and `test:learning-request:integration` for isolated PostgreSQL tests with `--test-concurrency=1`; unit runs without `TEST_DATABASE_URL`, integration preflight rejects its absence.
- [x] Run focused ESLint, TypeScript check, Nest build and all Learning Request unit suites; exact evidence is in validation.md. Re-run the offline Identity/RBAC/audit/configuration/consistency set; socket-dependent provider tests remain blocked by the sandbox.
- [x] Author isolated DB checks for scoped search/ranking, rollback, cancel/negotiation race and notification dedupe/retry. Execution and schema-diff verification remain pending because no isolated migrated database is configured.
- [ ] Reconcile SRS V1.5 AC-05/06/10/20 với real owner flows: reciprocal plans/versioned confirmations, lock/Hold theo loại trao đổi, completion tất cả Session/settlement và LR state. Regression BR-12 no early Hold và BR-41 OTP cooldown không đổi account lock. OP-13 hoặc consumer thiếu -> ghi Pending, không mark fake protocol checks là end-to-end pass.
- [x] Review core source/behavior coverage for SH-030–034, FR-LR-01–08 and BR-07–10/39/40. Distinguish implemented core from G1/G3/G4 or OP-05 dependencies; save unrun checks in validation.md.
- [ ] Re-run S3/ClamAV/SMTP provider adapter checks in an environment that permits loopback sockets; current sandbox returns `EACCES`.
- [x] Review final source/plan conformity. No commit/PR/push was made; those actions require separate authorization.

## Sheet traceability

| Sheet row/task                               | Plan tasks | Release evidence                                                                       |
| -------------------------------------------- | ---------- | -------------------------------------------------------------------------------------- |
| 23 / SH-030, FR-LR-01, BR-07                 | 1–3,7      | ACTIVE owner/Catalog/validation/draft+publish states in HTTP/DB.                       |
| 24 / SH-031, FR-LR-02/03, BR-08              | 3,7        | Versioned clear/flagged filter; failure never auto-publishes.                          |
| 25 / SH-032, FR-LR-04/STF-05/06, BR-09/39/40 | 2,4,7      | Action/state/version/reason, atomic audit/outbox, owner-readable deduped notification. |
| 26 / SH-033, FR-LR-05/06, BR-10              | 5,7        | Re-moderation/pre-lock cancel/expiry and real consumer races after decisions.          |
| 27 / SH-034, FR-LR-07/08, BR-02/07           | 6,7        | Scoped filter/pagination, real SH-023 matching adapter and workload evidence.          |

## Complexity Tracking

Không có constitution exception. Notification slice, permission additions, API sanitization dependencies/lockfile và scoped snapshot generator là thay đổi cần thiết cho DoD. Nếu upstream có implementation trước thì consume contract, không tạo source thứ hai. SH-101/105/114 ngoài scope.

## Handoff

Implement this approved plan inline in task order. Exact initial moderation rule content remains a pre-production owner input; publish stays closed without it. Catalog/Sharing Skill and Path/Schedule/Wallet are upstream owners; fakes prove only the LR protocol. No commit, push, sheet update, or deployment is authorized.
