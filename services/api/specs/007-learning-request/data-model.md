# Learning Request data model

Updated 2026-10-07 for ERD v3 and the SRS V1.6 Tag requirement. Schema and a scoped migration have been added; the migration has not been applied to a database. Approved decisions are in the [spec](spec.md); exact initial moderation terms still need Product Owner review.

## Ownership and fields

Learning Requests sở hữu `LearningRequest` với preferred slots JSON và quan hệ Request–Tag. [ERD v3 alignment](erd-v3-alignment.md) supersedes the earlier child-table representation; SRS V1.6 includes optional tags and requires support for Tag search/filter. Catalog sở hữu Skill/Tag; Notifications sở hữu Notification; Audit/Outbox sở hữu persistence nền tảng. Mọi FK cần table đã được migrate thật.

Baseline SRS V1.5 giữ nguyên fields LR mục 18.10. exchangeType/teacherId/learnerId/negotiatedCredit và LearningPlan thuộc thỏa thuận downstream, không thêm column/enum/table vào migration LR. Request skill/goal không đồng nhất với mọi plan: TWO_WAY có thể có hai kỹ năng khác nhau. [Change report](srs-v1.5-changes.md) ghi phần điều chỉnh tích hợp.

| LearningRequest field đề xuất                         | Storage / invariant                                                                                                                                                              |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| id / ownerId / skillId                                | UUID; owner là User lấy từ Principal; FK RESTRICT tới User/Skill.                                                                                                                |
| title                                                 | VARCHAR(120), sanitized/trimmed, 10–120 Unicode code points.                                                                                                                     |
| description                                           | VARCHAR(3000), sanitized/trimmed, 20–3000 code points.                                                                                                                           |
| learningGoal                                          | VARCHAR(1000), sanitized/trimmed, 10–1000 code points.                                                                                                                           |
| currentLevel                                          | LearningLevel nullable; NONE/BEGINNER/INTERMEDIATE/ADVANCED; null nghĩa là không khai báo.                                                                                       |
| status                                                | DRAFT/PENDING_MODERATION/OPEN/REJECTED/NEGOTIATING/MATCHED/CLOSED/CANCELLED/EXPIRED.                                                                                             |
| moderationStatus                                      | New enum NOT_REQUIRED/PENDING/APPROVED/REJECTED, tách khỏi status nghiệp vụ.                                                                                                     |
| moderationRejectReason                                | Maps to reject_reason, nullable VARCHAR(500); bắt buộc 10–500 ở REJECTED; owner/reviewer được xem.                                                                               |
| flaggedCategories                                     | Maps to flagged_rules, nullable JSONB array of internal category IDs; không lưu full rule list/matched private text; không đưa vào owner/feed.                                   |
| moderationRuleSetVersion                              | Nullable positive integer của config snapshot; record sau filter.                                                                                                                |
| moderationReviewedVersion / moderatedBy / moderatedAt | Reviewed request version; reviewer/time map to reviewed_by_user_id/reviewed_at, nullable User FK/UTC time; set khi Staff quyết định.                                             |
| requestedExpiresAt                                    | Owner-selected deadline kept on a draft; null for DEFAULT. A custom deadline must remain future and at most 90 days from publish.                                                |
| expiresAt                                             | Effective deadline computed at publish: DEFAULT = publish + 30 days; CUSTOM = requestedExpiresAt. Edits and approval do not extend it.                                           |
| expiryMode / publishedAt                              | Internal DEFAULT/CUSTOM marker and current publish timestamp. A default deadline resets when a REJECTED request is republished; `publishedAt` locks skillId after first publish. |
| version                                               | Maps to content_version; positive integer, bắt đầu 1, increment mọi mutation; so sánh expectedVersion trước commit.                                                              |
| createdAt / updatedAt                                 | UTC TIMESTAMPTZ(3); clock backend/DB.                                                                                                                                            |

`preferredSlots` maps to required JSONB preferred_slots, default []. SQL checks JSON array type and at most five ranges; the application validates future ISO dates/end > start at mutation and restores Date values from stored UTC strings. There is no RequestPreferredSlot model/table in the v3 representation. No slot-overlap rule or Schedule/Session creation is inferred.

`verifiedTeacherOnly` maps to required BOOLEAN verified_teacher_only, default false. Create/edit accepts only booleans; the preference appears in scoped responses and the Proposal owner contract. Its real verification enforcement is owned by Proposal/Verification consumers, which remain unavailable.

`LearningRequestTag(requestId, tagId)` uses canonical Tag IDs from Catalog/SH-022, a composite unique key, RESTRICT foreign key and tagId/requestId index. **LR does not own a Tag taxonomy.** Catalog validates canonical IDs and active state; no additional skill/tag association rule applies without a Catalog owner contract. Max 10 distinct IDs; never accept free-form tag labels.
The current scoped migration includes minimum Catalog table definitions because this checkout has no SH-022 Catalog migration. Reconcile them with the Catalog owner's migration before applying or releasing this feature.

Schema LR cũ chứa required expectedDurationMinutes và budgetCredit, không có trong V1.5/V1.6 18.10/sheet. Không nhận hai field này trong API mới. The later user-supplied v3 ERD explicitly includes verified_teacher_only; verifiedTeacherOnly is restored as an optional boolean input with default false. Legacy LR fields đã được gỡ khỏi catalog schema; không có database rollout. Nếu đã có dữ liệu/consumer thì cần data migration tương thích riêng, không âm thầm drop column. Proposal/Conversation chỉ đổi optionality của Request FK theo ERD; không implement consumer flow hoặc sửa Schedule legacy trong feature này.

## State transitions

Các hàng có “chờ decision” là đề xuất phải được chốt, không phải policy đã phê duyệt.

| Action                 | From                                               | To / moderation                                       | Preconditions                                                                                                                                                          |
| ---------------------- | -------------------------------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| create draft           | —                                                  | DRAFT / NOT_REQUIRED                                  | ACTIVE USER + create permission, active Skill/tags; skill can change until first publish. NOT_REQUIRED draft is not scanned.                                           |
| edit draft             | DRAFT                                              | DRAFT / NOT_REQUIRED                                  | Owner + update:self + expectedVersion.                                                                                                                                 |
| publish                | DRAFT                                              | OPEN / NOT_REQUIRED hoặc PENDING_MODERATION / PENDING | Validate fields/slots/Catalog and deadline ≤90d; null expiry -> 30d. Filter and config versions stay current.                                                          |
| edit published content | OPEN/PENDING_MODERATION                            | OPEN / NOT_REQUIRED hoặc PENDING_MODERATION / PENDING | Owner + update:self before NEGOTIATING; skillId immutable; re-filter, clear old review fields, version++.                                                              |
| edit rejected          | REJECTED                                           | DRAFT / NOT_REQUIRED                                  | Owner + update:self before NEGOTIATING; DEFAULT expiry resets on republish; CUSTOM date must remain valid or be replaced. Preserve prior audit/notification.           |
| approve                | PENDING_MODERATION / PENDING                       | OPEN / APPROVED                                       | approve permission, chưa tới hạn, current expectedVersion, reason/audit.                                                                                               |
| reject                 | PENDING_MODERATION / PENDING                       | REJECTED / REJECTED                                   | reject permission, chưa tới hạn, current version, reason 10–500, audit + outbox.                                                                                       |
| accept Proposal        | OPEN                                               | NEGOTIATING / giữ moderation                          | Proposal module gọi LR owner contract cùng tx; không self-proposal, chưa tới hạn.                                                                                      |
| lock Path/Schedule     | NEGOTIATING                                        | MATCHED / giữ moderation                              | Path/Schedule owner final-validates confirmations and locks/Holds/creates Session and Request in the same tx.                                                          |
| finish agreement       | MATCHED                                            | CLOSED / giữ moderation                               | Completion owner xác nhận mọi Session của mọi plan hoàn tất, không dispute giữ Credit và settlement theo exchangeType commit thành công cùng tx; không HTTP client LR. |
| owner cancel           | DRAFT/OPEN/PENDING_MODERATION/REJECTED/NEGOTIATING | CANCELLED / giữ moderation                            | Owner + live permission; row lock; Path/Schedule confirms not LOCKED. Preserve Proposal/Conversation history.                                                          |
| expire                 | OPEN/PENDING_MODERATION                            | EXPIRED / giữ moderation                              | expiresAt <= backend now and current row lock/version. Never expire drafts/rejected/negotiating/matched/terminal states.                                               |

MATCHED/CLOSED/CANCELLED/EXPIRED cannot be edited/published/reopened over HTTP. No DELETE or hide/restore. Edit ends at NEGOTIATING; owner cancellation remains allowed until Schedule LOCKED. Request row locking serializes cancel with the lock flow.

V1.5 phân biệt plan CONFIRMED, agreement CONFIRMED và Schedule LOCKED. LR version không thay thế các version đó; confirmation chưa lock không tự đổi Request MATCHED. Plan amendment sau LOCK/reset confirmations thuộc downstream owner, không tự mở lại LR. Owner protocols chi tiết ở [module ports](contracts/module-ports.md).

## Persistence constraints and indexes

- SQL CHECK title/description/goal/reject bounds, version > 0, preferred_slots array/max-five shape, flagged_rules array shape, requested expiry/mode consistency and published expiry consistency; status/moderation pairs must be valid.
- Không CHECK `expiresAt > now()` hoặc slot “future” trong SQL: thời gian trôi sẽ làm dữ liệu hợp lệ cũ thành bất hợp lệ. Kiểm tra tại mutation bằng clock backend.
- Aggregate slot/tag limits thực hiện trong transaction sau lock Request; replacement rollback toàn bộ nếu validation fail.
- Index `(status, createdAt DESC, id DESC)`, `(skillId, status, createdAt DESC, id DESC)`, `(ownerId, createdAt DESC, id DESC)`; partial index expiresAt cho eligible states sau LR-D01, exclude null.
- Keyword search dùng parameterized query; `%`/`_` là ký tự literal khi tìm substring. Ban đầu không thêm search service/cache; dùng EXPLAIN trên workload thống nhất trước khi cần trigram/FTS.
- Notification giữ fields hiện có; id dùng UUID eventId, type LEARNING_REQUEST_REJECTED, channel IN_APP, recipient FK User. Thêm index `(userId, createdAt DESC, id DESC)`; unique PK và outbox receipt chống duplicate.

## Atomic boundaries and recovery

1. Create/edit/publish: lock owner/account theo giao thức identity, kiểm tra live principal/grants, lock Request nếu đã có, validate Catalog qua owner port, persist Request/slots/tags/version trong một tx. Filter/sanitize làm trước tx; commit kiểm tra versions, không chạy external provider trong tx.
2. Moderation: lock actor/owner khi cần, lock Request, assert pending/version/expiry; cập nhật trạng thái, AuditWriter và outbox rejection trong cùng tx. Audit/outbox failure rollback hết. Audit snapshot dùng moderation status, thêm requestVersion; không đưa raw content vào audit projection.
3. Notifications: publisher dùng processOnce với consumer `learning-request-rejection-in-app-v1`; insert Notification và receipt cùng tx. Event giữ snapshot rejectReason, nên event cũ vẫn nói về phiên bản cũ. Replays terminal outbox dùng cơ chế foundation; không reset receipt đã thành công.
4. Cancel/expiry/accept/lock/completion: mọi module dùng cùng thứ tự sorted User locks -> Request row -> Proposal/agreement/LearningPlan/Schedule rows -> các lock còn lại theo plan của flow. LR owner contract không mở nested transaction; downstream owner kiểm tra plan/confirmation/ledger, LR không đọc/ghi trực tiếp chúng. Missing lock-boundary adapter cho NEGOTIATING -> 503, không suy ra unlocked; states trước negotiation chỉ được coi chưa lock theo invariant bắt buộc tất cả consumers tuân thủ. Completion lỗi settlement không được commit CLOSED riêng.
5. `isExpired` kiểm tra từ expiresAt và now tại read/action kể cả worker chậm. Worker chỉ transition eligible states bằng current predicate, batch giới hạn, idempotent retry; không quay lại OPEN/MATCHED từ stale payload. Read projection báo effective EXPIRED khi policy cho phép dù chưa persist; không chỉnh matched/path schedule bằng worker này.

## Configuration proposal

Config LR là cấu hình nghiệp vụ typed có version, không phải secret env:

- `learningRequest.expiryPolicy`: `{defaultTtlDays:30,maxTtlDays:90,eligibleStatuses:[OPEN,PENDING_MODERATION]}`. Explicit custom expiry overrides default; edit/approval never extends an active deadline.
- `learningRequest.moderationRuleSet`: versioned literal/bounded-wildcard rules; NFKC/case/whitespace normalization preserves Vietnamese accents. Initial keywords/categories need PO review; absent, malformed or empty rules -> unavailable, never auto-clean. No arbitrary RegExp.

Không seed TTL/từ khóa tùy đoán. Unknown/malformed policy không được coi là clean/unlimited. Config updates tái sử dụng SH-006 validation/audit; không làm dashboard/config admin UI ở đây.
