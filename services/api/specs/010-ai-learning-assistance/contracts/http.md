# HTTP contract dự kiến

Ngày: 2026-10-23. Chưa có endpoint nào bên dưới được triển khai.
Prefix /api/v1, Bearer auth, response envelope và Swagger theo repo.
POST tạo run/report/reanalysis cần Idempotency-Key. Không nhận ownerId/teacherId/
learnerId/status/role/model/systemPrompt từ client. Reject unknown fields.

## Quyền

Tên grant đề xuất, phải bổ sung catalog/seed khi implement; không xem là đã tồn tại.

| Action                   | Điều kiện                                                                                                              |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Draft Request            | USER ACTIVE/live session, existing learning-request:create/new-activity eligibility + ai:learning-request:draft:self.  |
| Draft Plan               | USER ACTIVE/live, ai:learning-plan:draft:self và owner CREATE/REVISE direction/path/version checks.                    |
| Read draft run           | Requester của run + live grant/source access; Staff không mặc nhiên được xem.                                          |
| Report chat              | content-report:create:participant + conversation read membership, published receipt consistency.                       |
| Case queue/detail        | STAFF/ADMIN với content-moderation:read; detail CHAT_EXCERPT/REVIEW cần thêm content-moderation:private-evidence:read. |
| Claim/close              | STAFF/ADMIN + content-moderation:triage; private cases thêm private-evidence grant.                                    |
| Reanalysis/read analysis | STAFF/ADMIN + content-moderation:analyze + case read/private grants tương ứng.                                         |

Tất cả đọc/mutation/replay kiểm tra quyền hiện tại. Các grants AI không cấp quyền
write domain mới hoặc thay quyền Staff approve/reject hiện có. Mất source access
trả 404 hoặc 403 theo owner convention, không trả text từ cache/idempotency.

## 1 POST /learning-requests/ai-drafts

Body:

```json
{
  "skillId": "00000000-0000-4000-8000-000000000001",
  "brief": "Mình muốn luyện phỏng vấn tiếng Anh cho vị trí lập trình viên.",
  "currentLevel": "INTERMEDIATE"
}
```

skillId ACTIVE bắt buộc; brief 10–3000 ký tự plain text; currentLevel optional,
enum NONE/BEGINNER/INTERMEDIATE/ADVANCED, chỉ tự khai. Backend lấy bounded ACTIVE
tag candidates, không chấp nhận model bịa IDs. Thiếu chi tiết goal có thể trả
NEEDS_INPUT. Không tự chọn offered skills/lịch/giá/expiry/teacher VERIFIED.

202 fresh, 200 idempotent replay: data {runId, status, statusUrl, expiresAt}.
Result khi poll gồm readiness, draft {skillId, title, description, learningGoal}
hoặc null, suggestedTagIds, questions, assumptions/warnings. Metadata prompt/schema
version và usage không chứa raw prompt/provider body. title/description/goal dùng
bounds policy hiện tại. Suggested tags chưa phải lựa chọn đã submit.

Không create LearningRequest. Client sửa rồi POST /learning-requests; publish
vẫn riêng và luôn đi qua word-filter/eligibility như trước.

## 2 POST /learning-paths/:pathId/ai-plan-drafts

Body CREATE:

```json
{
  "operation": "CREATE",
  "expectedPathVersion": 1,
  "skillId": "00000000-0000-4000-8000-000000000001",
  "learningGoal": "Luyện trả lời phỏng vấn bằng tiếng Anh về dự án phần mềm.",
  "totalSessions": 6,
  "selfReportedLevel": "Có thể giao tiếp cơ bản, ít kinh nghiệm phỏng vấn.",
  "context": "Ưu tiên giới thiệu bản thân và giải thích quyết định kỹ thuật."
}
```

REVISE còn cần planId và expectedPlanVersion; CREATE không nhận hai trường đó.
expectedPathVersion/expectedPlanVersion integer ≥1, skill ACTIVE, goal 1–1500,
totalSessions 1–20, selfReportedLevel optional ≤300, context optional ≤3000.
Path owner quyết định teacher/learner. CREATE check chưa có direction/count;
REVISE check plan thuộc path và actor là teacher đồng thời creator. Lock/complete/
cancel hoặc wrong version trả conflict trước enqueue.

202/200 replay cùng acknowledgement như mục 1. Poll result READY:

```json
{
  "readiness": "READY",
  "draft": {
    "skillId": "00000000-0000-4000-8000-000000000001",
    "learningGoal": "Mục tiêu học do teacher xem và chốt",
    "totalSessions": 6,
    "sessionOutline": [
      { "content": "Mục tiêu, nội dung và bài luyện buổi 1" },
      { "content": "Mục tiêu, nội dung và bài luyện buổi 2" },
      { "content": "Mục tiêu, nội dung và bài luyện buổi 3" },
      { "content": "Mục tiêu, nội dung và bài luyện buổi 4" },
      { "content": "Mục tiêu, nội dung và bài luyện buổi 5" },
      { "content": "Mục tiêu, nội dung và bài luyện buổi 6" }
    ]
  },
  "questions": [],
  "warnings": []
}
```

Backend validates exact count/IDs/bounds. Không schedule, Hold, confirmation hay
grade trình độ. Teacher chỉnh rồi POST /learning-paths/:pathId/plans hoặc PATCH
/learning-paths/plans/:planId, giữ expectedVersion cũ của command sửa plan.

## 3 GET /me/ai-assistance/runs/:runId

Chỉ REQUEST_DRAFT/PLAN_DRAFT own; không dùng để đọc moderation run.
200 data {id, kind, status, result, failureCode, freshness, createdAt, completedAt,
expiresAt}. QUEUED/RUNNING result null; SUCCEEDED mới có result. NEEDS_INPUT vẫn
SUCCEEDED. STALE/CANCELLED không trả draft như READY; missing permission không trả
result. Poll interval đề xuất 2s và Retry-After khi cần; không stream raw tokens.

## 4 POST /conversations/:conversationId/messages/:messageId/content-reports

Body: {contextMessageIds?: UUID[], reasonCode: string, note?: string}.
contextMessageIds tối đa 9 unique, không gồm target, cùng conversation; note ≤1000.
reasonCode thuộc policy allowlist. Backend tự đọc text/author/time và kiểm chứng
PUBLISHED/receipts/digests; không nhận text thay thế từ client. Tổng ≤10 tin,
≤12.000 ký tự canonical text. Không gửi FILE bytes/filename/download URL; SYSTEM,
DRAFT, không có text hoặc context khác conversation bị reject.

202 fresh/200 replay: data {reportId, status: "RECEIVED", statusUrl}. Chỉ nhận
metadata receipt, không lộ case findings. Note tố cáo không được coi là source
evidence và không gửi model trong bản đầu. Sender được alias trong model context.
Mongo I/O ngoài critical PG tx; reauthorize trước commit snapshot/report/run/outbox.

## 5 GET /me/content-reports/:reportId

Own receipt/status: RECEIVED / IN_REVIEW / CLOSED, timestamps. Không trả case
policy, raw findings, reporter khác hoặc staff note. Đây không phải quyết định
phạt người bị report; status chỉ phản ánh tiếp nhận/triage.

## 6 GET /staff/content-moderation/cases

Query sourceType?, status?, assignedToMe?, limit=20/max100, cursor? opaque/filter-bound.
Default queue tập trung human reports/NEEDS_REVIEW/INCONCLUSIVE/analysis failure;
filter riêng có thể xem NO_CONCERN, không mặc định tất cả case đã được duyệt.
Data metadata {id, sourceType, status, caseVersion, analysisStatus, assessment?,
severity?, freshness, sourceAvailability, createdAt, assignedStaffId?}.
Không text/snippet/reporter IDs, không raw policy hoặc chat participant IDs.
Pagination theo repo envelope meta.pagination, stable createdAt/id cursor.

## 7 GET /staff/content-moderation/cases/:caseId

Private-evidence grant khi cần, audit đọc. Data: queue metadata + captured source
fields/excerpt được chọn, latest validated analysis, source/current hash/version,
word-filter hit tách riêng với AI assessment (LR), report reason/note tách nguồn.
Nếu source đổi, hiển thị snapshot cũ với freshness STALE; không coi là current.
Nếu evidence hết retention/scrub, evidence null và sourceAvailability UNAVAILABLE.
Không fetch thêm chat history/files hoặc trả signed URLs, không full profile/Credit.

## 8 POST /staff/content-moderation/cases/:caseId/claim

Body {expectedVersion, reason}; reason 10–2000 ký tự, được ghi audit.
STAFF/ADMIN + triage (+ private grant nếu case private).
200 case metadata, version tăng; double claim/version race trả 409. Identity/
account/restriction recheck như owner action. Không provider call.

## 9 POST /staff/content-moderation/cases/:caseId/close

Body {expectedVersion, expectedAnalysisRunId: UUID|null, outcome, reason}.
outcome NO_ACTION/POLICY_CONCERN/INSUFFICIENT_EVIDENCE; reason 10–2000 ký tự.
Chỉ assigned reviewer hoặc người có quyền override được định nghĩa rõ trong
triage policy mới close; bản đầu không có override ngầm từ ADMIN role.
expectedAnalysisRunId chỉ null khi case chưa từng có run; nếu latest run FAILED
do outage thì gửi ID của run FAILED đó. Có thể close INSUFFICIENT_EVIDENCE và
reason rõ. Khác latest run/version →409. 200 metadata; case/audit atomic,
không domain action.

## 10 POST /staff/content-moderation/cases/:caseId/ai-analyses

Body {expectedVersion, reason}; reason 10–2000, analyze/read/private grants.
Source/policy còn hợp lệ, cap reanalysis/quota và không active run tương đương.
202 fresh/200 replay {runId,status,statusUrl}. Reanalysis tạo ordinal mới, giữ
previous result và provenance; không tự mở/đóng case hoặc đổi domain status.
GET /staff/content-moderation/cases/:caseId/ai-analyses/:runId đọc run đúng case,
permission và evidence freshness. Không cho truy cập run bất kỳ bằng UUID.

## Failures và idempotency

| HTTP        | Ý nghĩa                                                                                               |
| ----------- | ----------------------------------------------------------------------------------------------------- |
| 400         | Input sai/unknown fields/invalid IDs/oversize context; AI_INPUT_TOO_LARGE.                            |
| 401/403/404 | Auth/live permission/owner/direction/participant access không hợp lệ; không leak source existence.    |
| 409         | Idempotency payload conflict, path/plan/case version đổi, direction đã có, source không actionable.   |
| 410         | Own draft run đã hết retention; không trả text cũ.                                                    |
| 429         | Shared user quota/concurrency/global admission budget hết; Retry-After, không nhận run mới.           |
| 503         | AI_DISABLED, AI_POLICY_UNAVAILABLE hoặc intake infrastructure chưa sẵn; không claim nội dung là sạch. |

Lỗi provider sau 202 nằm trong run FAILED: AI_PROVIDER_TIMEOUT/UNAVAILABLE,
AI_RATE_LIMITED, AI_OUTPUT_INVALID, AI_SAFETY_BLOCKED, AI_BUDGET_EXHAUSTED;
không trả raw response. Flags bật mà policy/budget thiếu phải bị validate config
hoặc intake refuse. Automatic moderation event gặp missing policy ghi failure
sạch, domain filter/write hiện có vẫn giữ quyết định của nó.

Idempotency record chỉ giữ acknowledgement metadata, không cache draft/private
evidence để bypass reauthorization. Ngay cả replay cũng check live access;
provider exactly-once không được cam kết. Không thêm flags từ client để bypass
word-filter/membership hoặc lấy private run của người khác.
