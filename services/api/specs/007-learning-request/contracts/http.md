# Learning Request HTTP contract

## Public owner avatar — 2026-10-26

Feed (`GET /api/v1/learning-requests`), recommended and the public projection of
`GET /api/v1/learning-requests/:id` return `owner: {id,displayName,avatarUrl}`.
`avatarUrl` is required but nullable: a signed URL valid for 60 seconds for the
currently selected CLEAN avatar, otherwise `null`. It uses the same avatar
storage policy as public profiles. No profile lookup is needed just to obtain
the avatar. Image downloads still use the URL; consumers caching responses must
handle its expiry before loading uncached images. No raw asset/storage metadata
is exposed. Owner and moderation projections, authorization and pagination stay
unchanged. No migration, new permission or environment setting is required.
See [the implementation plan](../owner-avatar-plan.md).

## Inline tag proposals — 2026-10-24

Create/PATCH accept optional `proposedTags: string[]`; owner/moderation responses
include this field. Proposed labels force Staff/Admin review on publish. Approval
promotes/reuses ACTIVE canonical Tags and attaches them to the post atomically.
See [validation, permissions, examples and rollout](../proposed-tags.md).

## FE extension — 2026-10-12

User approved [the extension design](../fe-extension-design.md). Create and PATCH accept optional `teachingOverview`, `offeredSharingSkillIds`, `preferredAvailability`, and `desiredCreditPerHour`. Omission on PATCH keeps values; null clears nullable text/availability/credit; [] clears selected offerings. The existing expectedVersion/status/auth requirements still apply.

- Overview: 20–3000 code points after sanitize/trim; scanned on publish and published-content edits.
- Offered IDs: up to 10 distinct active/public Sharing Skills of the authenticated owner, selected with `GET /api/v1/me/skills`; validation repeats at mutation/publish. Response `offeredSharingSkills` supplies current skill name/id, level and actual verificationStatus, with hidden/archived/inactive selections omitted. Owner/reviewer responses also retain `offeredSharingSkillIds` for repair/history.
- Availability: `{timeZone,weeklySlots:[{weekday,startTime,endTime}]}`; IANA zone, MON–SUN, HH:mm, at most five same-day non-overlapping intervals. Weekly wall-clock times remain local, preserving timezone/DST intent. A supplied nonempty weekly schedule clears legacy absolute slots; a supplied nonempty absolute schedule clears weekly availability. Supplying both nonempty is 400. Null or [] explicitly clears the relevant preference.
- Hourly budget: Credit decimal string greater than zero, at most two fractional digits and ten whole digits; response normalized to two decimals. `"50.00"` is 50 CR/hour, stored as 5000 integer units. No wallet Hold, final price or schedule creation.
- Feed/recommended now include description, preferredSlots, overview, weekly availability, hourly budget and selected public skill metadata for the card. Detail/mine/moderation/mutation responses include the corresponding fields; existing private-field rules remain.
- New public catalog lookup: `GET /api/v1/tags?q=&limit=&cursor=` returns ACTIVE `{id,label}` in the standard pagination envelope. Search is case-insensitive and treats wildcard characters literally; q max120, limit default20/range1–100, cursor tied to the filter. No tag mutation endpoints. Requests continue using `tagIds`.

Additive migration: `20261012000000_learning_request_fe_preferences`. Existing requests receive nullable preferences/empty offered associations. Apply deployment migrations before running the new source against an existing database.

Contracts đã implement ở backend `/api/v1`, JSON/Swagger/class-validator theo foundation. Toàn bộ routes có IdentityGuard và action/scope check; Guest -> 401. TTL/edit/cancel/tags/grants/channel đã được user chọn; initial moderation terms vẫn là pre-production gate ([spec](../spec.md)).

ERD v3 alignment adds optional verifiedTeacherOnly (default false), preferred_slots JSONB and database column mappings; HTTP routes and existing aliases stay compatible. [SRS V1.6 evidence](../erd-v3-alignment.md) confirms the Tag requirement. The earlier V1.5 comparison remains historical evidence. exchangeType, teacherId, learnerId, negotiatedCredit, LearningPlan và các lỗi confirmation/fee mới thuộc Chat/Path/Wallet contracts; không tự thêm route, field hoặc lỗi OTP_EMAIL_COOLDOWN vào LR. MATCHED/CLOSED do internal owner flow theo [module ports](module-ports.md), không phải lệnh HTTP client. [Chi tiết thay đổi](../srs-v1.5-changes.md).

## Endpoints and permissions

| Method / path                                    | Action / permission                                               | Response                                 |
| ------------------------------------------------ | ----------------------------------------------------------------- | ---------------------------------------- |
| POST /learning-requests                          | Draft; learning-request:create, ACTIVE USER + new-activity policy | 201 OwnerRequestDetail                   |
| GET /learning-requests                           | Feed; learning-request:read, OPEN còn hạn                         | 200 paginated RequestSummary[]           |
| GET /learning-requests/mine                      | Own list; learning-request:read, ownerId từ Principal             | 200 paginated OwnerRequestSummary[]      |
| GET /learning-requests/recommended               | Sharing Skill match; learning-request:read                        | 200 paginated RequestSummary[]           |
| GET /learning-requests/:requestId                | learning-request:read + resource scope                            | 200 scoped detail                        |
| PATCH /learning-requests/:requestId              | learning-request:update:self + owner/state/version                | 200 OwnerRequestDetail                   |
| POST /learning-requests/:requestId/publish       | learning-request:create + owner/live account/version              | 200 OwnerRequestDetail                   |
| POST /learning-requests/:requestId/cancel        | learning-request:cancel:self + owner/pre-lock/version             | 200 OwnerRequestDetail                   |
| GET /staff/learning-requests/moderation          | learning-request:moderation:read; pending scope                   | 200 paginated ModerationRequestSummary[] |
| POST /staff/learning-requests/:requestId/approve | learning-request:approve + pending/version                        | 200 ModerationRequestDetail              |
| POST /staff/learning-requests/:requestId/reject  | learning-request:reject + pending/version                         | 200 ModerationRequestDetail              |
| GET /notifications                               | IN_APP recipient; notification:read:self                          | 200 paginated NotificationSummary[]      |
| PATCH /notifications/:notificationId/read        | notification:update:self + recipient                              | 204, không body                          |
| GET /admin/learning-requests/moderation-rules    | learning-request:moderation:configure                             | 200 versioned rule snapshot              |
| PUT /admin/learning-requests/moderation-rules    | learning-request:moderation:configure + live grant                | 200 updated versioned rule snapshot      |

Static mine/recommended routes đứng trước dynamic :requestId. Không có DELETE, client set status, hide/restore hoặc Guest browse. Staff/Admin dùng cùng moderation endpoint với permission explicit, không dựa riêng vào tên role.

Admin moderation-rule PUT body `{expectedVersion,rules,reason}`. It updates only the allowlisted Learning Request rules key through System Configuration; current session/grant is rechecked in the same transaction as the versioned write and audit. Empty rule arrays cannot be activated. Missing, empty, or malformed rules make publish unavailable (503); the endpoint never converts an unavailable policy to a clean result.

## Input and concurrency

Create theo LearningRequestInput trong [module ports](module-ports.md). title 10–120, description 20–3000, learningGoal 10–1000 sau sanitize/trim và đếm Unicode code points; skillId UUID ACTIVE; currentLevel optional enum; verifiedTeacherOnly optional strict boolean, mặc định false khi create; tagIds tối đa 10 distinct canonical IDs ACTIVE trong shared Catalog; preferredSlots tối đa 5 `{startAt,endAt}`, absolute RFC3339 có offset, cả hai future/end > start. `expiresAt` null/absent -> default TTL 30 ngày tính khi publish; custom deadline phải tương lai và không quá 90 ngày từ publish. Hạn không reset do edit/approve.

PATCH partial body có `expectedVersion` safe positive integer. preferredSlots/tagIds nếu gửi replace toàn bộ trong tx; bỏ qua giữ hiện tại; empty array xóa preferences. Null chỉ dùng khi field contract cho phép. Body không có thay đổi field -> 400. SkillId chỉ cho đổi khi chưa publish lần nào. Edit REJECTED về DRAFT rồi publish tạo kỳ default expiry mới; content của OPEN/PENDING_MODERATION chạy filter lại. Không edit sau NEGOTIATING; PATCH không nhận client status.

Publish/cancel body `{expectedVersion}`. Approve/reject `{expectedVersion,reason}`; reject trim/code points 10–500, approve non-empty 1–2000 theo generic audit hiện có. OwnerId/status/moderation/version từ client, unknown property/enum, invalid UUID -> 400. Version mismatch -> 409, không side effect. Response trả updated version.

## Query and pagination

- skillId, tagIds, keyword, status, limit, cursor. Tag filter ANY match, kết hợp AND với skillId/keyword; query bound parameters, không raw interpolation.
- Giới hạn kỹ thuật đề xuất: limit mặc định 20, 1–100; keyword tối đa 120 code points; tag filter tối đa 10 distinct IDs.
- Feed/recommended chỉ status OPEN; yêu cầu status private -> 400. Mine filter own states; queue chỉ PENDING_MODERATION. Cùng predicate cho list/count/detail.
- Feed/mine/queue sort createdAt DESC,id DESC. Cursor opaque gắn scope/filter hash/actor và last key; mismatch -> 400. Mỗi page lại kiểm tra live quyền. Không bắt buộc total; nếu có count phải dùng cùng scope.
- Recommended sort matchScore DESC,createdAt DESC,id DESC. Điểm đề xuất: 1 nếu skillId khớp, cộng số distinct tag khớp; không tự ưu tiên VERIFIED. Chỉ OPEN còn hạn, loại own request. Cursor gắn SharingSkill snapshot version; snapshot đổi -> 400/restart. Đây là đề xuất FR-LR-08, cần thống nhất với SH-023.
- SharingSkillReader unavailable -> 503 recommended, không trả feed và tuyên bố đã có gợi ý.

## Response projections

| Type                            | Fields được trả                                                                                                                                                     |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RequestSummary                  | id,title,skill{id,name},tags{id,label},learningGoal,currentLevel,verifiedTeacherOnly,status hiệu lực,owner{id,displayName,avatarUrl},createdAt,expiresAt.           |
| RequestDetail                   | Summary + description,preferredSlots,version khi ở feed scope.                                                                                                      |
| OwnerRequestSummary/Detail      | Own fields + persisted status,effectiveStatus,version,moderationStatus,moderationRejectReason của quyết định hiện tại,updatedAt; không flaggedCategories/rule list. |
| ModerationRequestSummary/Detail | Nội dung cần review,version,moderationStatus,category summary nội bộ tối thiểu,reason/reviewer metadata; không auth/email/payment/private profile.                  |
| NotificationSummary             | id,type,title,body snapshot,payload{requestId,reviewedVersion,decisionVersion},readAt,createdAt; chỉ recipient.                                                     |

Feed/detail dùng expiry policy ngay cả worker chậm. Owner detail trả persisted status và effectiveStatus riêng. MATCHED/terminal không thành EXPIRED chỉ vì expiresAt cũ. Không trả raw Prisma User, matched keyword text hoặc rule list.

Success dùng `{success:true,message,data}`; list thêm `meta.pagination` theo shared response helper:

```json
{
  "success": true,
  "message": "Learning requests retrieved.",
  "data": [],
  "meta": {
    "pagination": { "limit": 20, "nextCursor": null, "hasMore": false }
  }
}
```

## Errors

Giữ `{success:false,message,statusCode,details?}` hiện có. Labels sau là message đề xuất, không thêm top-level error.code:

| HTTP | Condition                                                                                      |
| ---- | ---------------------------------------------------------------------------------------------- |
| 400  | INVALID_REQUEST_INPUT; reason/slot/expiry/query/cursor/Catalog selection không hợp lệ.         |
| 401  | Thiếu/invalid/revoked/expired session.                                                         |
| 403  | Thiếu action permission, role/account/new-activity restriction không cho phép.                 |
| 404  | Resource không tồn tại hoặc ngoài private scope; outsider không biết draft/reject có tồn tại.  |
| 409  | REQUEST_VERSION_CONFLICT, INVALID_REQUEST_TRANSITION, REQUEST_EXPIRED, REQUEST_ALREADY_LOCKED. |
| 429  | Throttling hiện có.                                                                            |
| 503  | Required adapter hoặc valid expiry/filter configuration unavailable.                           |

Không echo raw DTO/SQL/rules trong lỗi/log. Rejection reason là dữ liệu owner được phép xem, không log request body. Approve/reject expired hoặc changed content trả conflict.
