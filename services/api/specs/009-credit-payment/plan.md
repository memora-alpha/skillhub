# Implementation Plan: Credit & Payment

**Branch**: `feat/credit-payment` | **Date**: 2026-10-15 | **Spec**: [spec.md](spec.md)

**Input**: `specs/009-credit-payment/spec.md`. **Status**: Initial implementation in progress. Spec baseline committed `e5dd088`; wallet/history/monetary DTO/pure payOS adapter có source và focused tests. Migration chỉ chạy trong schema test; chưa deploy, chưa push. Xem tasks/validation cho phần còn lại.

## Summary

User amendment 2026-10-16: chỉ render QR payOS trực tiếp trong SkillHub; không mở hosted checkout. Owner projection không có checkout URL/method. Return/cancel HTTPS vẫn là fields bắt buộc của provider request/signature, chỉ giữ server-side; không cần trang redirect trong QR flow. Transport/posting/provenance và frontend integration vẫn chưa triển khai ở tranche này.

Hoàn thiện Credit owner hiện có: lifecycle ví, wallet/history API, exact monetary DTO, invariants/immutable ledger, TOP_UP/Release/Adjustment contracts và đối soát. Bổ sung payments owner: quote/checkout intent, payOS adapter, verified durable receipts và atomic Payment PAID + TOP_UP. Kiểm chứng Hold/settlement đã có source trên PostgreSQL thật; giữ BigInt hundredths và fee floor đã được User xác nhận ngày 2026-10-15.

User đổi sang payOS ngày 2026-10-15. Thiết kế dùng REST payment-link create, signed response và signed payment webhook; giữ nguyên hạn mức/TTL/provenance đã chốt, các policy bonus/refund khác chưa tự bật. Baseline `2f73c3c`, nhánh tạo từ local `dev`, không fetch/pull. `setup-plan.ps1 -Json` từ `services/api` trả `HAS_GIT=false`, `BRANCH=009-credit-payment` do project root không có nested Git; Git branch thực là `feat/credit-payment`.

## Technical Context

**Language/Version**: TypeScript 6.0.3; Node 22.12+ trên 22.x hoặc 24+ theo README.

**Primary Dependencies**: NestJS 11/Express, Prisma 7.8 + pg, Zod/class-validator/Swagger; existing identity/permissions, TransactionRunner/IdempotencyService/AuditWriter/Outbox, Redis/BullMQ và SSE application-events. payOS adapter dùng Node crypto; domain bigint chuyển sang safe JSON integer chỉ sau bounds check. REST transport/recovery chưa tích hợp; chưa thêm SDK.

**Storage**: PostgreSQL authority cho tài chính/Payment/receipts/audit/outbox; Redis chỉ delivery/rate limits. Không lưu financial authority ở MongoDB/client.

**Testing**: Node test runner, HTTP, real disposable PG migration/concurrency/recovery; provider channel, Redis/SSE là release gates riêng.

**Target Platform**: API/worker nhiều instance; duplicated/out-of-order webhooks.

**Project Type**: Backend modular monolith trong pnpm/Turborepo; không frontend/mobile/root tooling/shared package changes.

**Performance Goals**: NFR-PERF-01 P95 <=2s cho read thông thường. Fixture đề xuất 10k wallets/1m ledger rows/100 concurrent readers, là benchmark kỹ thuật chứ không capacity cam kết. Đo callback posting latency/backlog/lock waits riêng; SLA provider chưa chốt.

**Constraints**: Credit integer hundredths, VND integer, JSON decimal strings; UTC/cursor/live auth; nonnegative Available/Held, permanent dedupe, immutable ledger, no provider I/O trong PG tx. Min/max/TTL/limits theo G02, không tự gán số.

**Scale/Scope**: Wallet/history; payment port/orchestration; Hold/settle integration và Release primitive chỉ nhận approved instruction; Admin read/Available adjustment/reconciliation. Bonus/material/cash refund/full dispute/cancel policy ngoài baseline.

## Constitution Check

Constitution v1.2.0. Trước research/sau design: **Pass for baseline design**. Runtime còn **Pending**; không exception/thay constitution.

| Principle              | Before / after | Evidence / runtime gate                                               |
| ---------------------- | -------------- | --------------------------------------------------------------------- |
| 1 architecture/scope   | Pass / Pass    | API-only owner layers, không empty scaffolding/UI                     |
| 2 authoritative stores | Pass / Pass    | PG tài chính, Redis hỗ trợ; recovery từ PG receipt/outbox             |
| 3 atomicity            | Pass / Pass    | Shared tx/units/deltas; PG races/rollback Pending                     |
| 4 security             | Pass / Pass    | Live self/admin permission, verified webhook; IDOR/revocation Pending |
| 5 validation/contracts | Pass / Pass    | Decimal strings/UTC/cursors/Swagger; HTTP money serialization Pending |
| 6 evidence             | Pass / Pass    | Validation phân static/DB/channel/deployment; chưa claim runtime      |
| 7 ownership            | Pass / Pass    | payments gọi Credit port cùng tx; path/report giữ decisions           |
| 8 reliability          | Pass / Pass    | Intent/receipt/outbox/dedupe/bounded retries; crash/provider Pending  |
| Git workflow           | Pass / Pass    | `feat/credit-payment`, spec 009 độc lập, no commit/push               |

G01–G10 là activation gates, không constitutional exceptions. Production top-up cần G01/G02/G03/G10; mock pass không đóng các gate.

## Project Structure

### Documentation (this feature)

```text
specs/009-credit-payment/
  spec.md, plan.md, research.md, data-model.md, policies.md
  contracts/http.md, contracts/internal.md, contracts/gateway.md
  quickstart.md, checklists/requirements.md, validation.md
```

`tasks.md` thuộc bước `speckit-tasks` sau review plan, không sinh trong lần plan này.

### Source Code (relative to services/api)

```text
src/modules/credit/
  credit.module.ts
  application/
    contracts/ (wallet/ledger projections, path-credit inputs)
    ports/ (WalletRepository)
    services/ (CreditLedgerService, CreditWalletReader, ledger mapping)
    use-cases/ (GetWallet, ListCreditTransactions, GetCreditTransaction)
    seed-fee-policies.ts (explicit configuration seed)
  domain/ (money/invariants/replay)
  presentation/http/ (wallet/history/admin DTO/controllers)
  infrastructure/persistence/ (PrismaWalletRepository)
src/modules/payments/
  payments.module.ts
  application/contracts/ (checkout and normalized gateway events)
  application/ports/ (PaymentGateway; payOS implements this port)
  application/use-cases/ (planned: create/query, order/receipt recovery)
  domain/ (quote/state/authenticated outcomes)
  presentation/http/ (self payments/provider callback)
  infrastructure/ (PG intents/receipts, workers, future gateway adapter)
test/credit/; test/payments/
```

WalletController gọi use cases; CreditModule bind repository port với Prisma adapter như auth/users. Các caller LearningPath/LearningSession dùng ledger/reader từ application/services. Các flow top-up/release/adjust/reconciliation và Payment module/use cases chưa triển khai vẫn theo tasks.md.

**Structure Decision**: Reuse owner services, tách lớp khi có trách nhiệm riêng. Affected existing files: generator/runtime-support schema/additive SQL migration, app.module, config/env examples, permission/seed/audit catalogs, notification/event registration và monetary callers trong learning-paths/sessions. Caller changes chỉ phục vụ monetary/tx contract; không mở rộng lịch học/tranh chấp. Không rewrite historical catalog/diagrams.

## Phase 0 — Research

Implementation amendment 2026-10-15 (User): top-up 1.000–2.000.000 VND, step1.000, TTL60 phút. Source balances cần lot provenance: BONUS trước rồi FIFO các nguồn khác, hoàn đúng nguồn gốc. G02/G03 business decisions đã đóng; code/migration/runtime verification vẫn Pending. Initial tranche hoàn thiện read/serialization/adapter trước; các writers sẽ tích hợp lots trong tranche sau và không được đánh dấu source-aware khi chưa có allocation tests.

[Research](research.md) ghi inventory/decisions/rationale/alternatives: ví chưa có create/upsert; Payment chỉ schema; thiếu posting link, DB invariants, HTTP money DTO, financial real-store tests. Kỹ thuật baseline đã chốt: integer hundredths, PG owner tx, immutable ledger/durable dedupe, provider port và read-only reconciliation. payOS provider/rounding đã chốt; official REST create/lookup/signed response/webhook đã được đối chiếu trong gateway contract. Merchant setup và runtime contract details chưa được kiểm chứng.

## Phase 1 — Design

[Data model](data-model.md), [HTTP](contracts/http.md), [internal](contracts/internal.md), [gateway](contracts/gateway.md), [quickstart](quickstart.md); [policies](policies.md) giữ các nhánh thiếu business decisions chưa bật.

Transaction boundaries:

1. Order reserve: live identity/idempotency → CREATED + immutable quote/orderCode + checkout intent trong một tx. Server prepare signed REST create sau commit; transport ngoài transaction dùng channel credentials. Verify response signature/quote rồi persist GET checkout descriptor; CAS không ghi đè PAID khi webhook đến sớm. Timeout lookup cùng orderCode trước retry, không cấp mã mới.
2. Callback: verify payOS HMAC toàn bộ data bằng checksum key → durable receipt; processing khóa receipt/Payment → match channel/orderCode/link/reference/exact VND → ensure/lock wallet → Credit TOP_UP → audit/outbox → PAID/receipt PROCESSED trong một tx. Unknown/sample/partial/late vào REVIEW; queue chỉ wakeup, receipt pending không được gọi là đã nạp.
3. Hold/settlement: owner khóa Path và validate plans/schedules/sessions/dispute → sorted allocations/wallets → entries + owner state/audit/outbox cùng tx. Tách phần Credit hiện đang update LearningPath và emit learning-path.settled sang Path owner contract, giữ nguyên atomic snapshot/replay. Không nested runner hoặc provider I/O.
4. Release/adjustment: approved instruction hoặc live Admin permission → digest/expected version → allocation/wallet lock → ledger/audit/outbox. Release chưa public trước G05/G08; adjustment chỉ Available.

Lock graph phải kiểm tra thực tế ở implementation: existing user/eligibility locks trước Path; schedule/session/report locks theo owner; allocations trước sorted wallets; event-feed counters sau cùng. Payment-only receipt→Payment→Wallet, không lấy Path sau Wallet. Admin wallet-only không quay lại Path. Sorted wallets một mình chưa chứng minh toàn hệ thống không deadlock.

Domain key/digest tồn tại độc lập HTTP TTL. Ledger sequence cấp dưới wallet lock cho stable pagination/reconciliation. Migration historical sequence cần preflight, không bịa opening balance.

## Phase 2 — Implementation Sequence

1. **Policy/baseline**: review G01–G10; ghi precision/rate/rounding compatibility, affected owners và preflight. Tách nhánh độc lập khỏi gated work.
2. **Persistence**: generator inputs, posting/receipt/checkout-intent links, ledger sequence, SQL checks/uniques/append-only guards; migration dry-run trên fixture, invalid-data preflight, controlled write window; không sửa applied migration.
3. **Wallet slice (US1)**: zero lifecycle/backfill, money DTO, self history/detail/cursor/IDOR; sửa monetary serialization callers và kiểm HTTP thật.
4. **Credit primitives**: operation digest/replay, TOP_UP/Available adjustment, typed Release, critical audit/outbox, reconciliation. Release fixture không tự activate cancel policy.
5. **Payment orchestration (US2)**: disabled config, reserve intent, self query, test-only fake adapter, durable receipt/recovery. Fake adapter không là production provider.
6. **payOS adapter**: prepare server-only signed REST create request, verify signed checkout response và webhook theo contracts/gateway.md. Future transport dùng x-client-id/x-api-key ngoài PG transaction; lookup cùng orderCode/paymentLinkId khi uncertain. Kiểm channel signing, duplicate/partial/late/sample/mismatch trước enable; không invent sandbox host.
7. **Owner integration (US3)**: real PG hold/settlement, fee fractional boundaries, đúng learner/teacher, report race, release remainder, immutable history; Proposal accept không Hold. G05/G08/G09 trước các nhánh liên quan.
8. **Admin/operations (US4)**: explicit read grants/seed, adjustment có audit, reconciliation findings, worker/metrics và committed notification/SSE.
9. **Release checks**: lint/types/build, affected regressions, real PG concurrency/fault/migration, provider channel, Redis/SSE/load, docs/runbook/validation. Plan/test pass không tự authorize deploy.

## Verification & Release Gates

[Validation](validation.md): callback invalid/mismatch không đổi balance; một provider transaction không post hai Payment; rollback sau từng write; crash sau commit trước ACK trả result cũ; PAID không bị downgrade. Path tests gọi đúng owner guards thay vì bypass từ Ledger mock. Reconciliation consistent snapshot, có platform fee sink và held allocations; không auto-repair.

Provider/DB runtime, live deployment SHA/readiness và vận hành thật vẫn Pending. Chỉ tài liệu/pointer đổi trong lần plan nên không chạy lint/types/build; docs links/pointer/whitespace kiểm riêng.

## Complexity Tracking

Không exception. Durable checkout preparation/receipts cần để phục hồi trạng thái khi crash và reconcile provider I/O và dedupe lúc crash; queue-only không đủ. Không thêm accounting subsystem hoặc provenance lots trước business decision.
