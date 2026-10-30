# Implementation Plan: AI hỗ trợ nội dung học và kiểm duyệt

Ngày: 2026-10-23. Spec: [spec.md](spec.md). Scope: backend API.
Trạng thái: design draft; chưa viết implementation/migration hoặc gọi provider.
Git branch lúc lập plan: fix/backend-limits-inbox; không đổi branch/di chuyển thay
đổi đang có. Branch code đề xuất: feat/ai-learning-assistance. Spec Kit pin:
specs/010-ai-learning-assistance, độc lập với Git branch.

## Summary

Ba capability: soạn Learning Request, soạn một LearningPlan teacher→learner và
kiểm duyệt tư vấn cho Staff. Moderation bao gồm Request, mô tả Sharing Skill đang
visible, review comment và đoạn chat participant report. Giữ word-filter và
Staff decision của Request; AI/case không đổi nội dung/rating/reputation/state.

Async flow: quyền → snapshot/run/outbox → worker gọi provider ngoài transaction
→ validate và recheck authority/freshness → lưu kết quả riêng tư. User chỉnh
draft rồi gửi qua command nghiệp vụ hiện có. Chưa có endpoint auto-apply.

## Technical Context

| Concern     | Quyết định                                                                                                                                  |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Runtime     | NestJS 11, TypeScript 6, Node/pnpm theo package hiện có; node:test import dist.                                                             |
| Provider    | Gemini JSON, model explicit từng capability, không fallback ngầm. 3.8 Flash là ứng viên benchmark; xem [research](research.md).             |
| Storage     | PostgreSQL/Prisma: run/case/evidence. MongoDB: chat gốc. Redis/BullMQ: queue/throttle.                                                      |
| Execution   | HTTP 202/poll, ID-only outbox, fencing lease/CAS, tối đa 3 attempts và bounded deadline/token.                                              |
| Validation  | DTO + strict Zod + owner validators; schema provider đơn giản không thay semantic validation.                                               |
| Scope       | API/docs/migration/seed/tests khi implement; không frontend/shared tooling/microservice AI.                                                 |
| Performance | Publish/send/review không chờ provider. Target đề xuất: enqueue/read p95 ≤2s khi hạ tầng khỏe; provider deadline ≤60s/attempt. Chưa đo.     |
| Limits      | Brief Request ≤3000 ký tự; context Plan ≤3000, 1–20 buổi/lần; chat ≤10 tin và ≤12.000 ký tự. Không tự truncate.                             |
| Sizing      | Quota/User, global token budget, concurrency, queue-age alert, retention phải cấu hình rõ trước enable; chưa có workload/chi phí được chốt. |

20 buổi/lần chỉ giới hạn công cụ AI; API plan thủ công giữ 1–100. Không tự chia
plan dài thành nhiều lần provider call trong bản đầu.

## Constitution Check

Constitution v1.2.0, đối chiếu trước research và sau design ngày 2026-10-23.
Pass là phù hợp thiết kế; implementation/runtime Pending.

| Principle                | Design  | Evidence/gate                                                             |
| ------------------------ | ------- | ------------------------------------------------------------------------- |
| 1 Scope/modular monolith | Pass    | API-only, owner rules, transport infrastructure dùng chung.               |
| 2 Storage authority      | Pass    | Mongo chat gốc; PG derived excerpt có nguồn/hash/retention.               |
| 3 Atomicity              | Pass    | Snapshot/run/audit/outbox cùng PG tx, không đổi financial state.          |
| 4 Security               | Pass    | Live grants + owner/teacher/participant; Staff excerpt grant/audit riêng. |
| 5 API/config/UTC         | Pass    | DTO/Swagger, UTC, explicit async states/caps/errors.                      |
| 6 Verification           | Pending | Lượt này chỉ kiểm tra docs; tests ở [quickstart](quickstart.md).          |
| 7 Ownership              | Pass    | Source/freshness qua owner ports; job/case không ghi domain bảng khác.    |
| 8 Delivery               | Pass    | Outbox/dedupe/fencing/recovery, provider ngoài tx.                        |
| Git                      | Pass    | Giữ workspace; không commit/push/deploy.                                  |
| Product policy           | Pending | G1–G4 explicit, chưa biến policy chưa chốt thành runtime defaults.        |

## Decisions

### D1 Draft và lifecycle

AiAssistanceRun giữ input/result, không tạo Request/Plan. Client map kết quả vào
form rồi gọi create/edit Request hoặc create/revise Plan hiện có. Payload AI
không được bypass validation, moderation hoặc confirmations.

Plan operation CREATE kiểm tra direction chưa tồn tại/count còn chỗ. REVISE cần
planId, teacher đồng thời creator và expectedPlanVersion. Snapshot gồm path
version/status/direction và plan version; completion/GET recheck. Không tự tạo
chiều của đối phương, lịch, Session, Hold hoặc confirmation.

### D2 Moderation bốn nguồn

- Request: publish/republish và edit nội dung khi OPEN/PENDING_MODERATION tạo
  snapshot. Live edit đã chạy filter trong source; chỉ hook publish là thiếu.
- Sharing Skill: create/update description đang visible, bật visible và restore
  trở lại visible. Reuse cùng hash/policy nếu hợp lệ; archive/hide làm source
  không còn actionable, không gọi model mới.
- Review: comment không rỗng sinh snapshot sau khi có review ID, cùng transaction
  tạo review/reputation/achievement. Reanalysis không replay create.
- Chat: report explicit, owner xác thực excerpt PUBLISHED/receipt/membership.
  Không hook send hoặc scan toàn history.
- Queue mặc định: human reports, NEEDS_REVIEW/INCONCLUSIVE và lỗi cần review.
  NO_CONCERN là output AI, không phải Staff đã duyệt.
- Staff claim/close chỉ ghi triage. Request approve/reject vẫn chỉ nhận PENDING.
  Bài OPEN có AI concern không tự đổi state; hide/chế tài cần owner command/policy
  về sau, ngoài scope.

### D3 Quyền và freshness

Requester xem draft của mình; Plan còn cần teacher direction/path editable.
Staff không đọc draft qua moderation grant. Không fetch learner profile/chat để
dựng nội dung. Trình độ input là tự khai.

Staff grants riêng: queue/detail/triage/reanalysis. Case chat/review thêm quyền
đọc excerpt, audit đọc; không mở membership/history/download. Public/feed/history
không lộ analysis/policy/report/chat. Queue chỉ metadata, detail mới trả text.

Lưu capturedEntityVersion cho audit. Moderation freshness dùng content hash +
visibility/lifecycle + policy/prompt/catalog revisions. SharingSkill setVerification
tăng entity version dù text không đổi: không gọi lại model chỉ vì badge thay đổi.
Plan draft vẫn dùng expected path/plan version/operation, không bỏ qua agreement
revision bằng content hash. Completion và mỗi GET recheck current authority.

### D4 Hạ tầng và module boundaries

AiAssistanceCoreModule sở hữu run persistence/scheduling/provider port; worker/
composition module bind source-reader ports do owner export. Core không import
owner module, tránh circular Nest imports khi owner enqueue cùng tx.
ContentModerationModule sở hữu case/report/triage, không sở hữu domain content.

Transport HTTP Gemini dùng chung chỉ lo fixed endpoint/no redirects/tools,
countTokens/timeout/caps/usage/lỗi sạch. Prompt/schema/ACL thuộc capability.
Đánh giá helper Verification AI trước extract; không chuyển bảng/queue hoặc đổi
model/prompt verification. Chạm code verification phải chạy regression tương ứng.

### D5 Retry, quota và outage

1. Live access/limits trước quota reserve. Replay Idempotency-Key cùng payload
   trả cùng run sau reauthorization, không reserve hai lần.
2. PG tx ghi immutable context/run/case, audit metadata và outbox. Event/queue chỉ
   runId; không text/key/private payload.
3. Worker claim lease/fencing token, recheck flags/source/policy, commit rồi call.
4. Retry network/timeout/429/5xx phù hợp, tối đa 3 attempts; safety block/invalid
   schema/missing policy/stale không retry mù.
5. Validate JSON/bounds/catalog/count hoặc quote/IDs; complete CAS lease và
   recheck context. Worker cũ không ghi đè. Analysis mới gắn case tăng caseVersion.
6. Staff close cần expectedVersion và expectedAnalysisRunId để tránh review cũ.
7. Recovery QUEUED chưa dispatch/RUNNING lease hết. Provider calls không exactly-once:
   timeout có thể tốn token lặp; reserve đủ retry, unknown usage giữ upper bound.
8. Shared Redis throttle + PG global budget reservation; capability concurrency,
   kill switch, metrics queue-age/error/token; không log text.

AI off/outage không chặn publish/send/review hoặc bỏ filter. Nếu ghi PG run/outbox
cùng domain tx lỗi thì rollback rõ và client retry, không âm thầm mất event.
API draft/report AI đang off từ chối trước nhận job. Xem [HTTP](contracts/http.md).

### D6 Prompt và policy

Templates: learning-request-draft-v1, learning-plan-draft-v1,
content-moderation-v1. System rules tách untrusted text/catalog/chat. Không tools/
browsing hoặc thực thi chỉ thị trong source.

Policy snapshot được duyệt: category IDs/định nghĩa/ngoại lệ/ví dụ/phạm vi.
Category allowlist, quote exact-match snapshot. Severity chỉ gợi ý xếp queue,
không confidence score hay ngưỡng xử phạt. NO_CONCERN không xóa word-filter hit.
Safety block không thay policy; thiếu policy không call, lỗi rõ, luồng cũ vẫn chạy.

## Project Structure

Docs: spec.md, plan.md, research.md, data-model.md, contracts/http.md,
contracts/module-ports.md, quickstart.md, validation.md.
Chưa tạo tasks.md; tách task triển khai sau khi review plan.

Source layout dự kiến, chưa tạo các module mới:

- src/infrastructure/ai/: bounded Gemini JSON transport.
- src/modules/ai-assistance/: core/run/worker/provider ports.
- src/modules/content-moderation/: cases/reports/triage/policy.
- learning-requests: draft endpoint + publish/live-edit hook.
- learning-paths: teacher draft + source contract.
- sharing-skills/reviews: description/comment snapshots.
- conversations: selected excerpt report/source contract.
- test/ai-assistance và test/content-moderation: behavior/integration/eval.

Config, Prisma generator/migration, permission/audit catalogs và seed cập nhật khi
implement; không đổi app consumers/shared tooling.

## Implementation phases

| Phase | Nội dung                                                               | Done when                                                                              |
| ----- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| P0    | Contracts, policy fixtures, retention/budget config, owner readiness   | G0 qua, release policies còn mở được ghi rõ.                                           |
| P1    | Run storage/grants/outbox/queue/lease/recovery/transport/fake provider | ACL/rollback/dedupe/outage/stale tests; flags off giữ luồng cũ.                        |
| P2    | Draft Learning Request                                                 | Bounds/catalog đúng, không tạo Request/bịa preferences; regression create/publish qua. |
| P3    | Draft LearningPlan                                                     | CREATE/REVISE, ONE_WAY/TWO_WAY direction/count đúng; lock/revision races qua.          |
| P4    | LR/Sharing Skill/Review moderation + Staff case                        | Filter/reputation không đổi; freshness/Staff ACL có evidence.                          |
| P5    | Chat report excerpt                                                    | PG/Mongo consistency/recovery, narrow case ACL; không mở history/file.                 |
| P6    | Vietnamese eval, synthetic provider smoke, staged flags                | G1–G4 qua, metrics/kill switch/cleanup kiểm chứng.                                     |

P2/P3 không đợi release moderation policy. P4/P5 vẫn trong scope đã yêu cầu;
tách chặng để kiểm tra quyền và state độc lập.

## Gates and open policy

| Gate                  | Quyết định/bằng chứng còn thiếu                                                | Tác động                                                                      |
| --------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| G0 Owner readiness    | Live guards Path/Review, source ports/adapters; không permissive stub          | Trước code chạm owner.                                                        |
| G1 Content policy     | Categories/ngoại lệ/priority, người xử lý, eval thresholds                     | Có thể code/test fixtures; chưa enable moderation production.                 |
| G2 Private processing | Thông báo xử lý, retention/deletion, Staff excerpt grants                      | Chưa enable chat/review AI dữ liệu thật; report-triggered là đề xuất đợt đầu. |
| G3 Cost/capacity      | Model, quota/User, global budget, concurrency/alerts                           | Không enable nếu thiếu mandatory budget config.                               |
| G4 Release evidence   | Migration/seed, real PG/Mongo/Redis races, eval/provider availability/rollback | Không coi build/HTTP 200 là production proof.                                 |

Kiến trúc đủ hướng để chia task; policy/vận hành còn mở được giữ explicit,
không thành defaults. Planning-complete không phải release-ready. Không yêu cầu
duyệt lại advisory-only đã được người dùng chọn.

## Verification

Lượt này kiểm tra links/Spec Kit prerequisites và design consistency. Khi code:
lint/typecheck/build, Prisma/generator/migration, HTTP/RBAC, PG/Mongo/Redis races,
fixture eval và owner regression. Xem [quickstart](quickstart.md) và
[validation](validation.md).

## Complexity Tracking

Không có constitution exception. Chat cross-store dùng owner read/authorize/
recheck + retry; PG excerpt là derived evidence, không distributed transaction.
Không thêm microservice/vector DB/RAG hoặc auto-enforcement.
