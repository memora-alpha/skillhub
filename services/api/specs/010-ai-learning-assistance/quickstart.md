# Kế hoạch triển khai và kiểm chứng

Tài liệu hướng dẫn bước implementation tiếp theo; chưa có migration, scripts
hoặc endpoints mới để chạy ở thời điểm lập plan 2026-10-23.

## 1 Chuẩn bị

Giữ branch/worktree hiện tại khi chỉ review docs. Khi bắt đầu code, kiểm tra git
status, xác định ownership của các thay đổi đang có và tạo/reuse branch đúng scope;
không reset/stash/move hoặc commit hộ phần chưa được yêu cầu.

Tham khảo [spec](spec.md), [plan](plan.md), [HTTP](contracts/http.md) và
[module ports](contracts/module-ports.md). Tách tasks.md theo P0–P6 trước code.
Gate chưa chốt không cản viết core/test bằng synthetic fixtures; giữ flag off
trước khi chạy dữ liệu thật hoặc rollout.

## 2 Configuration dự kiến

Các tên mới là đề xuất; chưa thêm vào environment validator hoặc .env.example:

- AI_REQUEST_DRAFT_ENABLED=false, AI_PLAN_DRAFT_ENABLED=false.
- AI_CONTENT_MODERATION_ENABLED=false và các flags nguồn
  AI_MODERATION_LR_ENABLED, AI_MODERATION_SHARING_ENABLED,
  AI_MODERATION_REVIEW_ENABLED, AI_MODERATION_CHAT_REPORT_ENABLED, mặc định false.
- GEMINI_API_KEY từ ignored env/secret store, không đưa key từ chat vào docs/source.
- AI_REQUEST_DRAFT_MODEL, AI_PLAN_DRAFT_MODEL, AI_CONTENT_MODERATION_MODEL explicit
  khi tương ứng enabled; không tự đổi GEMINI_MODEL của Verification AI.
- Bounded timeout/input/output tokens/concurrency từng capability. Đề xuất tối
  đa 3 attempts, 60s deadline/attempt; Plan 20 buổi/lần và output bound phải được
  kiểm trên corpus, vượt output cap là failed không truncate thành plan thiếu.
- Quota/User/time window, global reserved-token budget, max reanalysis/source,
  TTL draft/result/chat/review evidence và alerts bắt buộc explicit trước enable.
- Approved content policy version từ System Configuration: categories/định nghĩa/
  ngoại lệ/examples/source scope, không nhét policy fixture vào production seed.

Khi tất cả flags off, startup không đòi AI key/model/budget/retention. Không truyền
key/model vào client API. Model refresh phải re-evaluate corpus và version provenance.

## 3 Migrations và seed khi implement

Thêm typed run/case/report models vào runtime support/generator đúng convention;
kiểm schema generated và additive migration trước test DB deploy. Permission/audit
catalogs/seed có explicit grants, Staff excerpt quyền hẹp, không role inheritance.
Đây là migration dự kiến, chưa deploy hoặc seed trong lượt plan.

## 4 Bộ kiểm thử bắt buộc

| Nhóm          | Case cần chứng minh                                                                                                                                                                    |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Draft Request | READY/NEEDS_INPUT, bounds/sanitizer, ACTIVE skill/tags, injection, không bịa giá/lịch/credential, không tạo Request; create/publish vẫn validate.                                      |
| Draft Plan    | CREATE/REVISE, ONE_WAY teacher-only, TWO_WAY own direction, learner không sửa, count chính xác, 21–100 buổi AI refuse nhưng manual API còn hợp lệ.                                     |
| Source races  | Path lock/version đổi, plan direction tạo bởi request khác, role/grant/session revoke, catalog deactivate trong provider call; stale output không READY.                               |
| LR moderation | Publish/republish/live edit, original filter hit không bị AI xóa; clear Request vẫn OPEN dù advisory concern; pending approve/reject/version còn nguyên.                               |
| Sharing Skill | Create hidden không scan; visible toggle/restore scan/reuse; hide/archive stale; badge-only version update không provider call mới.                                                    |
| Reviews       | Empty comment skip; negative rating/criticism hợp lệ không tự vi phạm; create/reputation/achievement atomic; reanalysis/close không đổi score/hiddenAt.                                |
| Chat          | Chỉ selected PUBLISHED, same conversation, valid participant/sender/receipts/digest/sequence, no SYSTEM/DRAFT/file bytes; oversize/cross-conversation refuse.                          |
| PG/Mongo      | Membership revoke sau Mongo read, publication receipt lệch, Mongo outage, PG rollback sau read, source retention/scrub, retry không double-report/case.                                |
| Staff ACL     | No grant, wrong case UUID, private-evidence thiếu, role-only access, read audit, metadata-only queue, không mở chat history/download/participant reviews.                              |
| Output        | Invalid JSON/schema/enum/category/quote/segment/count, truncated response, safety block; không thành NO_CONCERN hoặc partial READY.                                                    |
| Reliability   | Duplicate outbox/job, enqueue gap/restart, lease expiry/late worker, attempts hết, stale policy/model/source, kill switch queued/running.                                              |
| Budget        | Replay không tính hai lần; different key same source reuse; Redis shared quota; global reserve concurrency; retry/unknown usage không overspend ngầm.                                  |
| Triage        | Double claim, reason bắt buộc, close dựa run/version cũ; null chỉ khi chưa có run, failed run phải dùng đúng ID; report mới sau close có review cycle/audit; không mutate owner state. |
| Privacy       | No key/text/report/PII trong logs/events/metrics; scrub mọi copies/quotes/summary, TTL và closed-case excerpt access.                                                                  |

Unit/provider fakes cho bounded output/validation; HTTP integration cho DTO/RBAC;
real PostgreSQL cho rollback/FKs/locks/CAS/idempotency; real Redis/BullMQ cho
dedupe/recovery/throttle; Mongo cho excerpt consistency. Test fixtures synthetic
và DB schema/queues riêng, không gọi provider trong default test suites.

## 5 Evaluation

Corpus tiếng Việt có: nhu cầu học mơ hồ/rõ, nhiều kỹ năng, mục tiêu quá sức so với
số buổi, tag không tồn tại, prompt injection, quảng cáo/spam theo policy đã duyệt,
phản hồi tiêu cực hợp lệ, trích dẫn câu xúc phạm để báo cáo, thiếu context và đa
ngôn ngữ. Label người review và policy version phải đi cùng tập đánh giá.

Đo draft schema validity/factuality/count, tỷ lệ dùng/sửa draft; moderation
precision/recall/false-positive theo nguồn/category và reviewer disagreement.
Ngưỡng chấp nhận, sample size, workload p95 và token cost là G1/G3 trước rollout;
không lấy model confidence thay số đo. Thử model candidates bằng synthetic data
khi được cấu hình, lưu usage/error đã sanitize, không log provider raw payload.

## 6 Checks và rollout

Sau code: build trước các test import dist. Chạy focused API lint/typecheck/build,
Prisma/runtime generator/migration checks, suites mới và owner regressions:
learning-requests, skills/tags, learning-platform/paths, reviews/reputation,
connections, authorization/audit/outbox. Chạm transport verification chạy thêm
verification-ai suites. Dùng scripts package hiện có; không tuyên bố script mới
đã tồn tại trước khi implementation thêm nó.

Rollout additive migration → seed grants review → deploy flags off → synthetic
smoke → bật drafts theo cohort → moderation LR/sharing/review → chat report sau
G2. Theo dõi queue-age/failure/token/review load. Kill switch từng capability
ngừng calls mới, running completion recheck; không tự thay đổi domain data.
Rollback bằng flags/deploy compatible code, giữ audit/run history theo retention;
không drop evidence/migration tự động. Migration/production rollout cần yêu cầu
triển khai riêng; plan này chưa thực hiện chúng.
