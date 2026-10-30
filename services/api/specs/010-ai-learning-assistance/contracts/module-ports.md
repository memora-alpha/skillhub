# Application contracts và ownership

Thiết kế, chưa có code. Tên ports có thể đổi khi chia task nhưng boundaries phải giữ.

## AiAssistanceCore

- schedule(tx, typedContext, command): ghi run/audit/outbox qua module sở hữu,
  cùng PG transaction do caller truyền. Không provider I/O hoặc owner-table writes.
- readOwnRun(principal, runId): live identity + requester + owner-context access;
  whitelist projection và freshness. Không suy ra Staff đọc mọi run.
- complete(runId, leaseToken, validatedResult): CAS + authoritative source recheck;
  idempotent completion, worker cũ không ghi.
- AiJsonProvider.generate(task, schema, context, limits): shape/usage/error sạch,
  không trực tiếp map outcome thành business action.

Core chỉ import PG/queue/audit/outbox abstractions, không import domain owners.
Worker/composition module bind các source ports export từ owners; tránh circular
Nest imports. Transport không đọc DB hoặc biết Staff/User privileges.

## Learning Requests owner

- readRequestDraftContext(tx, principal, skillId): live grant/eligibility và
  Catalog owner active selection; minimal context, không lấy private profile.
- snapshotForModeration(tx, request): canonical title/description/learningGoal/
  teachingOverview/tag labels và content hash. Gọi scheduling port cùng tx ở
  publish/republish và live edit; vẫn giữ filter snapshot/version checks cũ.
- readModerationFreshness(tx, typedRef): content hash, lifecycle/actionability,
  captured/current versions và word-filter metadata qua allowlist.

LR giữ create/edit/publish/approve/reject/expiry. AI không gọi transition để xử
lý bài OPEN. Không nối AI service vào predicate word-filter hiện tại.

## Learning Paths owner

- readPlanDraftContext(tx, principal, pathId, operation, planId?, expectedVersions):
  live actor/grant, participant + direction/teacher/creator, path editable,
  CREATE uniqueness/count hoặc REVISE version; trả immutable minimal snapshot.
- validatePlanDraft(tx, context, candidate): active skill, exact session count,
  bounds, source revisions và permission; chỉ validate, không save/confirm.

Không đọc learner profile/chat hoặc wallet. Hai flow CREATE/REVISE có explicit
permission proposals, không dựa vào learner participant để cho sửa teacher plan.
Current create/revise/confirm/finalize vẫn authoritative.

## Sharing Skills owner

- snapshotDescription(tx, sharingSkill): ID/hash/captured version, skill label,
  description; chỉ visible/unarchived/active source.
- source lifecycle hooks: create/update description, visible toggle và restore.
  Verification-only version change không enqueue lại cùng hash/policy.
- readModerationFreshness: hash/visibility/archive/account/catalog state; không
  để AI/case module gọi repository update verificationStatus/isVisible.

## Reviews owner

- snapshotComment(tx, review): review ID/comment/hash; có comment mới schedule,
  cùng create tx sau khi rating/reputation/achievement được ghi theo rule cũ.
- readModerationFreshness: comment hash/hiddenAt/owner-context state. Không lấy
  rating/ledger/reputation làm input model, không replay create để reanalyze.
- grant reading a case excerpt không đồng nghĩa quyền listForPath(participant).

## Conversations owner và Mongo boundary

- readReportableExcerpt(principal, conversationId, targetMessageId, contextIds):
  validate IDs/limits và membership bằng PG; đọc selected Mongo docs; validate
  cùng conversation, PUBLISHED, sender participant, non-SYSTEM, sequence/digest
  khớp PG publication receipts; loại attachment bytes/metadata; bounded canonical
  text và ref/hash. Không dùng chat.get(id) không scope như một access check.
- authorizeExcerptCommit(tx, principal, excerpt): recheck live membership/grant,
  receipt/fingerprint references sau Mongo I/O trước commit snapshot/report.
- readExcerptFreshness: source publication/availability + bounded IDs; không tự
  fetch thêm context. Nếu hai stores lệch, typed SOURCE_UNAVAILABLE, retry có giới
  hạn hoặc FAILED; không gán nội dung client vào chỗ text còn thiếu.

Đọc Mongo ngoài critical PG tx, PG commit snapshot/run/report/audit/outbox atomic.
Source tin PUBLISHED immutable giúp recheck; không mở distributed transaction.
Source reader có receipt/digest regression thật trước release. Case Staff chỉ
đọc derived excerpt qua ContentModerationModule, không Conversation history port.

## Content Moderation owner

- enqueueSnapshot(tx, sourceSnapshot, policyRevision, trigger): case/run/outbox
  dedupe, không mutate source entity. Typed source refs được owner chứng thực.
- reportExcerpt(...): accept owner-validated selected messages, dedupe/throttle,
  report receipt, evidence/run creation và audit; không đọc Mongo trực tiếp.
- staffQueue/detail(principal, query): explicit grants; chat/review excerpt có
  additional grant + audit. Queue metadata-only, opaque filter-bound cursor.
- claim(principal, expectedCaseVersion, reason), close(principal,
  expectedCaseVersion, expectedAnalysisRunId, outcome, reason): optimistic
  concurrency, human audit; không sanctions hoặc notifications làm
  lộ reporter. Case close không thay LR/share/review/message state.

## Events

ai.assistance.requested v1 {runId}, content.moderation.requested v1 {runId} là
ID-only references. Chọn một event/run kind khi implement, không phát cả hai cho
cùng run. Dedupe key stable run ID; outbox dispatcher/job recovery at-least-once.
Không nhúng source text, report notes, chat author IDs hay provider key vào events.

Gắn analysis mới và triage audit là PG atomic. Module có thể xuất count/status
events cho Staff sau này qua allowlist; đợt đầu dùng polling, không mở SSE private
payload mới. Không dùng application-events public channel để phát case evidence.
