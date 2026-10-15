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
- [x] T013 [US2] Implement server-only signed REST create request, verify signed checkout response/quote/origin và constant-time webhook HMAC + canonical event trong src/modules/payments/infrastructure/payos-gateway.ts; giữ bigint domain/safe integers ở provider boundary.
- [ ] T014 [US2] Thêm Payment quote/posting links, checkout intents/receipts/findings và provenance lots/hold-spend-refund allocations (BONUS-first rồi FIFO) trong scripts/generate-runtime-schema.mjs, prisma/runtime-support.prisma và additive migration riêng; giữ legacy preflight.
- [ ] T015 [US2] Implement Credit TOP_UP port với immutable business digest, purchased-source lot, audit/outbox trong src/modules/credit/application/services/credit-operations.service.ts; provenance user đã chốt, cần code + tests trước activation.
- [ ] T016 [US2] Implement self create/query + durable webhook ingestion/posting/recovery và bounded REST transport create/lookup (x-client-id/x-api-key) ngoài PG transaction trong src/modules/payments/application/, src/modules/payments/infrastructure/, src/modules/payments/presentation/http/ và payments.module.ts. Unique persisted orderCode theo channel; verify before projection, sample/partial/late REVIEW; thiếu provenance/channel readiness vẫn fail closed.
- [ ] T017 [US2] Kiểm duplicate/out-of-order/crash/lookup trên real PG trong test/payments/persistence.test.mjs; fake gateway chỉ test.
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

## Dependencies và execution

T001→T002→T003; T004→T005; US1 T006–T010 sau foundation. US2 T011–T013 độc lập với DB migrations, T014→T015→T016→T017, T018 cần merchant/G02/G03. US3 sau foundation và giữ G05/G08/G09. US4 sau financial primitives. T025/T026 chạy cho mỗi tranche, chỉ tick khi đủ cả phạm vi task; T027 là full release.

Parallel examples (không yêu cầu spawn agents): US1 cursor tests và HTTP DTO có thể chuẩn bị độc lập sau contract; US2 signer tests khác file với wallet implementation; US3 fixture preparation khác owner refactor; US4 reconciliation fixture khác controller DTO. Không chạy Prisma generate/build song song khi cùng output.

## Implementation strategy

Initial tranche: T003–T010 và T011–T013, kiểm đầy đủ phần source thực hiện; không cần chốt buckets hoặc chuyển tiền. Sau đó tiếp tục payment persistence/posting khi policy cho phép. Đây là khởi đầu implementation theo yêu cầu, không tuyên bố cả spec009 hoàn tất; gates giữ rõ và các task chưa làm không được tick.
