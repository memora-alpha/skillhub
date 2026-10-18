# Tasks: Credit & Payment

**Input**: spec/plan/research/data-model/contracts tại `specs/009-credit-payment/`.
**Branch**: `feat/credit-payment`. Spec baseline commit `e5dd088`.
**Authorization**: User yêu cầu commit spec và bắt đầu implement ngày 2026-10-15. Checklist runtime/policy còn mở đã được công khai trước yêu cầu; tiếp tục các phần không phụ thuộc gate, không xin lại quyền implement. Không mở policy hoặc đánh dấu runtime pass từ việc này.

Paths relative to services/api. Tests là yêu cầu của spec/constitution cho tài chính. Không triển khai/deploy hoặc push tự động.

## Phase 1: Setup

- [x] T001 Review source/policy/checklists và commit bộ spec trong specs/009-credit-payment/ với hooks.
- [x] T002 Verify existing ignore/tooling, Spec Kit pointer và dependencies; ghi implementation tranche vào specs/009-credit-payment/tasks.md.

## Phase 2: Foundation

- [x] T003 Viết exact money/fee boundary tests trong test/credit/money.test.mjs và implementation src/modules/credit/domain/money.ts.
- [x] T004 Thêm additive migration preflight/sequence/nonnegative/append-only guards trong prisma/migrations/20261015000000_credit_wallet_foundation/migration.sql; mở rộng scripts/generate-runtime-schema.mjs.
- [x] T005 Kiểm real PostgreSQL migration/reconciliation/ledger sequence/rollback trong test/credit/persistence.test.mjs.

## Phase 3: US1 — Wallet/history (P1, initial tranche)

Goal: self-only wallet/history exact strings, no implicit bonus. Independent test: real HTTP zero/balance/history/cursor/IDOR/revocation.

- [x] T006 [US1] Viết journey/HTTP tests trong test/credit/fixture.mjs và test/credit/http.test.mjs.
- [x] T007 [US1] Implement zero wallet lifecycle và owner-only ledger reads trong src/modules/credit/application/use-cases/, qua ports/WalletRepository và infrastructure/persistence/PrismaWalletRepository.
- [x] T008 [US1] Implement bound stable sequence cursor trong src/modules/credit/domain/ledger-cursor.ts.
- [x] T009 [US1] Thêm DTO/OpenAPI/controller trong src/modules/credit/presentation/http/ và wire src/modules/credit/credit.module.ts.
- [x] T010 [US1] Dùng shared exact formatter/parser cho settlement HTTP và LearningPath parser trong src/modules/learning-sessions/learning-sessions.controller.ts và src/modules/learning-paths/learning-paths.service.ts; kiểm HTTP thật.

## Phase 4: US2 — payOS payments (P1)

Goal: chuẩn bị signed checkout và verified receipts; one verified payment→one TOP_UP. Provider config/policy gates giữ disabled.

- [x] T011 [P] [US2] Viết signature/auth/normalization/replay tests trong test/payments/payos.test.mjs.
- [x] T012 [US2] Implement typed payOS disabled-by-default config trong src/modules/payments/domain/payment-config.ts và .env.example.
- [x] T013 [US2] Implement server-only signed REST create request, verify signed checkout response/quote/QR, chỉ trả QR projection không chứa hosted URL và constant-time webhook HMAC + canonical event trong src/modules/payments/infrastructure/payos-gateway.ts; giữ bigint domain/safe integers ở provider boundary.
- [ ] T014 [US2] Thêm Payment quote/posting links, checkout intents/receipts/findings và provenance lots/hold-spend-refund allocations (BONUS-first rồi FIFO) trong scripts/generate-runtime-schema.mjs, prisma/runtime-support.prisma và additive migration riêng; giữ legacy preflight.
- T014 progress 2026-10-17: migration checkout/receipt/finding/quote policy snapshot, lots/hold allocation và source-aware settlement đã implement/test trên PG; legacy funded-wallet backfill và refund/release-origin writer vẫn giữ Pending, không tick toàn task.
- [x] T015 [US2] Implement Credit TOP_UP application contract với permanent digest/purchased lot; Payment orchestration ghi audit/events/outbox cùng transaction. Real PG rollback/audit/event-failure và duplicate tests pass; không coi đây là merchant activation.
- [x] T016 [US2] Implement self create/list/detail + Swagger, durable verified receipts/posting và bounded create/lookup transport ngoài PG transaction trong payments.module.ts. Persist sequence orderCode/channel/quote; sample/partial/late vào REVIEW, unknown provenance fail closed; fenced-lease recovery. HTTP/PG/SSE local pass.
- [x] T017 [US2] Kiểm duplicate/concurrent khác đơn, webhook trước create response, rollback, expired lease/restart và signed lookup trên real PG trong test/payments/persistence.test.mjs; payOS HTTP giả lập, không phải channel proof.
- [ ] T018 [US2] Hoàn tất channel signing/lookup/re-submit proof theo contracts/gateway.md và ghi specs/009-credit-payment/validation.md; chưa credentials thì Pending.

## Phase 5: US3 — Hold/release/settlement (P1)

Independent test: existing owner finalize rollback, 20/20 TWO_WAY, 100 ONE_WAY và concurrent dispute gate.

- [ ] T019 [US3] Kiểm owner-level Hold/settlement/replay/rounding race trong test/credit/path-integration.test.mjs; không bypass owner guards.
- [ ] T020 [US3] Tách Path completion/snapshot/event khỏi Credit writer sang learning-path owner contract, cùng transaction, trong src/modules/learning-paths/ và src/modules/credit/application/services/credit-ledger.service.ts.
- [ ] T021 [US3] Implement approved release instruction và immutable compensation trong src/modules/credit/application/services/credit-operations.service.ts; G05/G08/G09 trước activation.

## Phase 6: US4 — Administration/reconciliation (P2)

Independent test: explicit live permission/reason/ref, atomic ledger/audit, no automatic repair.

- [ ] T022 [US4] Implement Admin read grants và audited Available adjustment trong src/shared/authorization/permission.catalog.ts, src/modules/users/infrastructure/persistence/prisma-users-repository.ts và src/modules/credit/presentation/http/.
- [ ] T023 [US4] Implement bounded consistent-snapshot reconciliation trong src/modules/credit/application/services/reconciliation.service.ts và operator report script; không auto-repair.
- [ ] T024 [US4] Kiểm admin/replay/revoke/audit rollback/reconciliation tại test/credit/admin.test.mjs.

## Phase 7: Verification/documentation

- [x] T025 Thêm focused unit/integration scripts trong package.json và ghi phạm vi thực sự đã implement tại README.md/specs/009-credit-payment/validation.md.
- [x] T026 Chạy API lint/typecheck/build, real PG và affected regression suites cho initial tranche; cập nhật specs/009-credit-payment/tasks.md và validation.md theo bằng chứng.
- [ ] T027 Kiểm notification/SSE/recovery/privacy/load và production activation gates trong specs/009-credit-payment/validation.md; không thay Pending bằng mock proof.
- T027 progress 2026-10-17: payment.updated/wallet.updated commit atomic, owner/live-auth visibility và SSE HTTP frames pass; Redis thật/multi-instance/load/production còn Pending.

## Dependencies và execution

T001→T002→T003; T004→T005; US1 T006–T010 sau foundation. US2 T011–T013 độc lập với DB migrations, T014→T015→T016→T017, T018 cần merchant/G02/G03. US3 sau foundation và giữ G05/G08/G09. US4 sau financial primitives. T025/T026 chạy cho mỗi tranche, chỉ tick khi đủ cả phạm vi task; T027 là full release.

Parallel examples (không yêu cầu spawn agents): US1 cursor tests và HTTP DTO có thể chuẩn bị độc lập sau contract; US2 signer tests khác file với wallet implementation; US3 fixture preparation khác owner refactor; US4 reconciliation fixture khác controller DTO. Không chạy Prisma generate/build song song khi cùng output.

## Implementation strategy

### Recovery hardening — 2026-10-18

- [x] R001 Retain owner/key/fingerprint identity on Payment, additive/backfill migration and immutable identity guards; repair missing HTTP mapping from domain identity.
- [x] R002 Serialize fresh creates under live owner lock; block unresolved and legacy unanchored payments; replay the original intent.
- [x] R003 Separate infrastructure creation pause, authenticated creation-policy, safe recovery reasons/errors and old-channel QR suppression/global fresh-create gate.
- [x] R004 Add bounded operator payment report with READ ONLY snapshot and optional signed lookup, without repair or receipt reassignment.
- [x] R005 Update HTTP/data-model/README and restore/channel/support runbook; retain unsupported financial recovery/REVIEW approval explicitly.
- [x] R006 Complete focused lint/types/build, payment protocol/HTTP/PG/concurrency/migration/report regressions; record evidence in validation.
- [ ] R007 Apply migration/config to a deployment and verify real merchant/restore/channel incident procedures; separate release work.

R004 does not complete full wallet/financial reconciliation T023.

Initial tranche: T003–T010 và T011–T013, kiểm đầy đủ phần source thực hiện; không cần chốt buckets hoặc chuyển tiền. Sau đó tiếp tục payment persistence/posting khi policy cho phép. Đây là khởi đầu implementation theo yêu cầu, không tuyên bố cả spec009 hoàn tất; gates giữ rõ và các task chưa làm không được tick.
