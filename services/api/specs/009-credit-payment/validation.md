# Validation — Credit & Payment

Date: 2026-10-15. **Planning only**. Baseline source audit không chứng minh runtime; mọi check implementation dưới đây **Pending**.

## Planning evidence

- [x] Đọc root/API guidance, README, constitution v1.2.0 và local speckit-specify/plan skills/templates/hooks.
- [x] Đối chiếu SRS V1.6 XML paragraphs/tables, source/model/migrations/tests; read-only research agent hoàn tất.
- [x] Spec/quality checklist, research, plan, data-model, HTTP/internal/gateway contracts, policies và quickstart tạo trong spec009.
- [x] `setup-plan.ps1 -Json` resolve spec009; monorepo branch `feat/credit-payment` từ local dev `2f73c3c`.
- [x] 11 feature files được kiểm tra relative links; Spec Kit pointer và AGENTS managed block trỏ spec009. Agent-context script đã được gọi nhưng block chưa đổi, sau đó cập nhật trực tiếp đúng markers và verify lại.
- [x] Prettier format/check và whitespace checks cho tài liệu mới; `git diff --check` cho tracked changes. Không thay application source.
- [x] User trả lời clarifications: SePay và floor phí 4%, net lấy phần còn lại (2026-10-15); spec/policies/plan/contracts/research/model/quickstart cập nhật.
- [x] Đọc official SePay one-time checkout/signature, IPN SECRET_KEY, REST detail/auth và sandbox; URLs/khác biệt docs ghi trong contracts/gateway.md. Chưa dùng credentials hoặc gọi gateway API.

## Implementation verification matrix

| Scope / criteria               | Required evidence                                                                                                                                                                                                                                                        | Status  |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- |
| US1, FR001..003, SC003/005/006 | Wallet zero/init race, HTTP decimal strings including existing settlement, stable pagination under concurrent append, IDOR/live revoke; bounded read benchmark                                                                                                           | Pending |
| Schema invariants              | Additive migration clean/legacy/invalid fixture, sequence backfill/preflight, nonnegative/allocation checks, append-only guards, generator no-loss compare                                                                                                               | Pending |
| US2, FR004..008, SC001/002     | Exact100k→100; one gateway txn across two Payment rows; same event altered business digest; same business payload with different delivery timestamp; callback same/different key, retry and out of order; invalid proof/ref/merchant/currency/amount; redirect no-credit | Pending |
| Payment crash recovery         | Checkout preparation crash/repeated submit/lookup, IPN before checkout preparation acknowledgment, crash before/after receipt/post/ACK/outbox; DB unavailable/retry; worker lease exhaustion/manual replay                                                               | Pending |
| Atomicity/finance concurrency  | Real PG same/different wallet spends/topups/adjustments, deterministic lock order/retry; inject failure after each state/entry/wallet/audit/outbox write; no partial success                                                                                             | Pending |
| US3, FR009..011, SC004         | Owner-level finalize TWO_WAY/ONE_WAY, all required plans/schedules/sessions, insufficient balance rollback, no per-session settle, dispute-vs-settle, replay snapshot; no Proposal accept Hold                                                                           | Pending |
| Rounding                       | Gross0,01/10,01/20,00/100,00; one and two holder fee computation, fee0 without invalid entry, exact net+fee=gross, large input/overflow                                                                                                                                  | Pending |
| Release/relock                 | Approved instruction, partial remainder, stale allocation/version, already settled, over-release/retry; G05/G08 before activation                                                                                                                                        | Pending |
| US4, FR012..013, SC002/003/005 | Admin current permission/reason/ref/version; duplicate/different body; negative Available reject; audit/outbox rollback; immutable compensation; Staff denied                                                                                                            | Pending |
| Reconciliation                 | Consistent snapshot wallet/deltas, Held/allocation, Payment/TOP_UP, settlement/fee; injected missing/duplicate/mismatch findings, no auto-repair                                                                                                                         | Pending |
| Delivery, FR014                | Outbox/inbox/SSE exactly-once visible identity, duplicate/stale delivery/reconnect/privacy, Redis/worker restart; unknown event retention                                                                                                                                | Pending |
| Gated policies, FR015/016      | Disabled SePay/bonus/cancel/refund fail safely; no withdrawal/arbitrary transfer/material-fee assumption; G01–G10 documented                                                                                                                                             | Pending |
| Static/regressions             | API lint/types/build/Prisma generation; affected auth/config/audit/idempotency/connections/owner regression suites                                                                                                                                                       | Pending |
| Real provider                  | SePay contract researched; còn sandbox checkout canonical signature/ordered form, IPN secret auth, invoice/order_id lookup, transaction identity mapping, repeated submission/retry/retention proof; authenticated end-to-end one posting                                | Pending |
| Deployment                     | Intended SHA, applied migration/grants/config, readiness/logs/receipt backlog/reconciliation and actual provider callback                                                                                                                                                | Pending |

## Limitations

Không chạy lint/types/build/tests, không kết nối DB/provider, không apply migration/seed hoặc thực hiện giao dịch tiền trong lần planning. Không có endpoint/model mới nào được tạo bởi tài liệu. Không thể đánh dấu production ready từ source/mocks hoặc bằng chứng cũ của feature khác. Checklist policy-dependent vẫn mở cho đến có quyết định và evidence phù hợp.
