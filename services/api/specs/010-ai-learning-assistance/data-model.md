# Data model dự kiến

Ngày: 2026-10-23. Chỉ thiết kế; chưa sửa Prisma/generator/migration.
PostgreSQL là authoritative store cho runs/cases; chat gốc vẫn ở MongoDB.

## AiAssistanceRun

Owner: AiAssistanceCore. UUID ID, timestamps UTC.

| Field                                                           | Nội dung                                                                                                                                                            |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| id, kind                                                        | REQUEST_DRAFT / PLAN_DRAFT / CONTENT_MODERATION                                                                                                                     |
| requesterId, requestSessionRef?                                 | Người yêu cầu/grant và session tham chiếu tối thiểu để recheck; automatic runs có system trigger, không giả Staff request.                                          |
| pathId?, planId?, moderationCaseId?                             | Typed optional FKs; CHECK theo kind. Plan bắt buộc pathId, REVISE bắt buộc planId; content moderation bắt buộc caseId. Request draft không gắn entity chưa tồn tại. |
| operation?                                                      | CREATE / REVISE cho Plan; direction/expected versions trong context.                                                                                                |
| contextSnapshot, inputHash                                      | JSON schema theo kind, immutable, size cap; chứa chỉ nội dung cần thiết và source/catalog refs.                                                                     |
| policyVersion?, policyHash?, promptVersion, resultSchemaVersion | Snapshot policy của moderation; prompt/result schema cho mọi run.                                                                                                   |
| provider, model                                                 | Model explicit của lần chạy, không đổi khi retry; config đổi tạo run mới khi được yêu cầu.                                                                          |
| status                                                          | QUEUED / RUNNING / SUCCEEDED / FAILED / STALE / CANCELLED                                                                                                           |
| result?, failureCode?, staleReason?                             | JSON validated hoặc lỗi allowlist; không raw provider body/stack/key.                                                                                               |
| attemptCount, leaseToken, leaseUntil?, nextAttemptAt?           | Bounded retries, fencing lease, recovery.                                                                                                                           |
| reservedTokens, inputTokens?, outputTokens?, usageKnown         | Upper-bound reservation đủ retry; usage chưa rõ không tự coi bằng 0.                                                                                                |
| createdAt, startedAt?, completedAt?, expiresAt                  | Retention TTL theo kind bắt buộc cấu hình trước enable.                                                                                                             |
| idempotencyRecordRef, ordinal                                   | Dedupe HTTP command; ordinal cho reanalysis explicit của cùng case.                                                                                                 |

Không dùng một targetId polymorphic không kiểm chứng để thay FK với các bảng PG.
Migration CHECK quy định tổ hợp references hợp lệ, JSON limits và enum transitions;
FK RESTRICT cho nguồn có thể được giữ để audit. Nếu nghiệp vụ xóa nguồn cần owner
retention/deletion contract để cancel/scrub evidence trước, không cascade mất audit.

State machine:

- QUEUED → RUNNING qua atomic claim/lease; retry RUNNING → QUEUED nếu retryable,
  còn attempts/budget và nguồn hợp lệ.
- RUNNING → SUCCEEDED / FAILED / STALE / CANCELLED bằng CAS leaseToken.
- QUEUED → STALE/CANCELLED khi source/quyền/flag/retention không còn hợp lệ.
- SUCCEEDED → STALE/CANCELLED khi freshness/quyền bị thu hồi; GET cũng tính lại
  freshness để không phụ thuộc job đánh dấu chậm. Public result null nếu mất quyền.
- FAILED/STALE/CANCELLED là terminal; reanalysis explicit tạo run ordinal mới.
- NEEDS_INPUT là kết quả thành công của draft, không phải lỗi queue.

Indexes: status/nextAttemptAt, status/leaseUntil, requesterId/createdAt/id,
moderationCaseId/ordinal unique, expiresAt. Idempotency unique theo actor + operation

- key và payload digest; key giống payload khác trả conflict. Content reuse/dedupe
  là điều kiện độc lập, không thay live authorization.

## ContentModerationCase

Owner: Content Moderation; cùng model cho bốn nguồn, không ghi đè state nguồn.

| Field                                                          | Nội dung                                                                                                         |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| id, sourceType                                                 | LEARNING_REQUEST / SHARING_SKILL / REVIEW / CHAT_EXCERPT                                                         |
| requestId?, sharingSkillId?, reviewId?, conversationId?        | Typed PG FKs; CHECK đúng một loại nguồn. Chat có conversation FK.                                                |
| targetMessageId?                                               | Message ID gốc Mongo cho chat; chỉ owner-validated, không có Mongo FK giả.                                       |
| capturedEntityVersion?, sourceHash, contextHash                | Version dùng audit; hash normalized moderated fields/context; không coi badge-only version change là text stale. |
| sourceSnapshot, evidenceRefs                                   | Immutable minimal text segments, source field/message mapping, sequence/receipt/digest refs; JSON size caps.     |
| policyVersion, policyHash                                      | Cố định policy snapshot cho case. Thay policy tạo analysis/case mới rõ version.                                  |
| trigger                                                        | CONTENT_PUBLISHED / CONTENT_EDITED / HUMAN_REPORT                                                                |
| caseVersion, status                                            | Versioned OPEN / IN_REVIEW / CLOSED. AI không đóng case.                                                         |
| assignedStaffId?, closedBy?, closedAt?, closeReason?, outcome? | Human triage: NO_ACTION / POLICY_CONCERN / INSUFFICIENT_EVIDENCE. Không phải domain sanction.                    |
| latestAnalysisRunId?                                           | Typed relation; gắn analysis mới tăng caseVersion.                                                               |
| sourceAvailability                                             | AVAILABLE / NOT_ACTIONABLE / UNAVAILABLE; computed/reconciled qua owner.                                         |
| createdAt, updatedAt, evidenceExpiresAt                        | UTC, independent retention được chốt trước release.                                                              |

Case identity cho automatic source: source type/typed source reference + normalized
sourceHash/contextHash + policy revision. Duplicate events re-use cùng case/run;
provider/model/prompt revisions quyết định có reuse analysis hay tạo ordinal mới.
Human reports có context hash từ message IDs/text, không đưa lời tố cáo vào hash
nguồn gốc. Báo cáo lặp cùng reporter/context trả cùng receipt. Human report mới
trên case đã đóng có thể tạo review cycle mới được audit, không âm thầm bỏ báo cáo;
đây là human-triggered intake, không phải model tự mở/đóng case.

Staff queue cần index sourceType/status/createdAt/id và assignedStaffId/status.
Queue không chứa text snippets riêng tư; excerpt chỉ ở authorized detail, audit đọc.

## ContentReportReceipt

Lưu id, caseId, reporterId, conversationId/targetMessageId cho chat, contextHash,
reasonCode từ policy allowlist, optional note ≤1000 ký tự, status và createdAt.
Reason/note của reporter nằm ngoài các source segments gửi model trong bản đầu,
tránh để lời tố cáo trở thành bằng chứng nguồn. Staff thấy hai phần tách biệt.
Unique reporter + source/context fingerprint; có idempotency và shared throttle.
Participant chỉ đọc receipt/status của report mình, không đọc staff findings,
reporter khác, assignment hoặc private case disposition note.

## JSON contracts

### Request draft context/result

Context: selected ACTIVE skill (id/name/description), bounded ACTIVE tag candidates,
brief và currentLevel tự khai nếu có. Provider không cần user ID/email.

Result: readiness READY / NEEDS_INPUT; draft null nếu thiếu thông tin cần thiết.
READY draft chỉ title, description, learningGoal; suggestedTagIds là subset của
candidate IDs, không tự chọn preferences. questions tối đa 3, assumptions/warnings
tối đa 5 dòng có bounds. Backend echo skillId đã xác thực, không nhận skill do model
bịa. Không có kinh nghiệm/chứng chỉ/giá/lịch/teacher verification claim tự sinh.

### Plan draft context/result

Context: operation, current agreement/plan revisions, direction do owner xác định,
ACTIVE skill, learningGoal, totalSessions, selfReportedLevel/context do teacher
cung cấp. Provider chỉ nhận skill/goal/context/count và alias, không nhận Credit,
agreement IDs/chat. Output READY: learningGoal, totalSessions, sessionOutline
đúng N items có content; goal ≤1500, content ≤2000 theo existing DTO. Skill ID và
count là backend-selected, model trả khác bị invalid. NEEDS_INPUT có questions,
không partial plan được coi là có thể submit.

### Moderation context/result

Input: policy snapshot và segments [{segmentId, field, text}], aliases nếu chat.
Staff mapping đầy đủ giữ server-side; provider không nhận storage URL/file bytes.

Output: assessment NO_CONCERN / NEEDS_REVIEW / INCONCLUSIVE; severity
NONE / LOW / MEDIUM / HIGH là gợi ý; findings [{categoryId, segmentId, quote,
explanation}], missingContext/questions và summary. Bounds đề xuất: ≤10 findings,
quote ≤400 ký tự, explanation/summary ≤1000. Category/segment allowlist, quote
phải exact-match text canonical đã gửi. Không đúng → FAILED/AI_OUTPUT_INVALID,
không sửa quote để làm nó khớp. NO_CONCERN không có finding tố cáo vi phạm;
NEEDS_REVIEW phải có dẫn chứng hoặc trở thành invalid/inconclusive theo validator.
Không nhận hide/delete/ban/reputationDelta/action commands từ model.

## Privacy, retention và cleanup

Trước enable phải có TTL riêng cho drafts, analysis và excerpt/cases; không tự
chọn một retention nghiệp vụ. Worker không đọc text đã hết hạn. Cleanup scrub
context/result/report note/evidence text và các copies trong run/case; giữ audit
metadata IDs/hash/status/actor/time theo audit policy. Không lưu provider raw body,
prompt/private text trong logs/outbox/metrics; error messages chỉ code.

Evidence snapshot phục vụ triage có thể giữ đến evidenceExpiresAt kể cả source
đổi; phải hiển thị captured version/hash và nhãn cũ. Không coi bản cũ là current
analysis hoặc mở lại quyền xem chat gốc. Khi privacy/delete yêu cầu scrub, cancel
pending runs và gỡ cả quotes/summary có thể lặp PII, không chỉ xóa sourceSnapshot.
