# Learning Request Discovery và Tag

## Nguồn đối chiếu

Working tree HEAD ed5a17dd9f1a6d5e45e1b6af33b17dd4518b46fd: [backend HTTP](../../../../services/api/specs/007-learning-request/contracts/http.md), [controller](../../../../services/api/src/modules/learning-requests/presentation/http/learning-requests.controller.ts), [DTO](../../../../services/api/src/modules/learning-requests/presentation/http/learning-requests.dto.ts), [module wiring](../../../../services/api/src/modules/learning-requests/learning-requests.module.ts), [backend Tag](../../../../services/api/specs/009-tags/spec.md); mobile [requests-api](../../src/features/learning-requests/api/requests-api.ts), [types](../../src/features/learning-requests/types.ts), [preferences](../../src/features/learning-requests/schemas/request-preferences.ts), [form](../../src/features/learning-requests/schemas/request-form.ts).

[Checkpoint2026-10-13](../../specs/005-learning-request/contracts.md) từng đọc origin/dev f4dd314, FE commit8853244/fix616bdee. Checkout hiện đã có Tag/weekly/overview/offerings/budget và backend wiring Catalog/public owner/SharingSkill thật. REQUEST_LOCK_READER vẫn UnavailableLearningRequestDependencies cho NEGOTIATING. Không dùng checkpoint2026-10-11 để nói mọi LR adapter đều503. Backend source và mobile API đã có; deployment/migration/config/real API/native acceptance chưa xác minh trong lần này.

## Routes base /api/v1, đều qua shared Bearer client của mobile

| Method/path                         | Input                                                          | Output                                              |
| ----------------------------------- | -------------------------------------------------------------- | --------------------------------------------------- |
| POST /learning-requests             | title,skillId,description,learningGoal và optional preferences | 201 owner DRAFT                                     |
| GET /learning-requests/mine         | status/keyword/skillId/tagIds/limit/cursor                     | Owner page + effectiveStatus                        |
| GET /learning-requests              | keyword/skillId/tagIds, OPEN nếu gửi,limit/cursor              | Public OPEN còn hạn                                 |
| GET /learning-requests/recommended  | Các filter/cursor theo LR                                      | Public page + matchScore;503 không fallback feed    |
| GET /learning-requests/:id          | UUID                                                           | Scoped owner/public detail                          |
| PATCH /learning-requests/:id        | expectedVersion + chỉ fields đổi                               | 200 owner detail                                    |
| POST /learning-requests/:id/publish | expectedVersion                                                | 200 OPEN/PENDING_MODERATION                         |
| POST /learning-requests/:id/cancel  | expectedVersion                                                | 200 CANCELLED; kiểm lock theo state                 |
| GET /skills, /skills/:id            | q/catalog paging, UUID                                         | Catalog selection, không thay LR internal readiness |
| GET /tags                           | q?,limit,cursor                                                | ACTIVE {id,label}, meta.pagination                  |
| GET /me/skills                      | limit,cursor                                                   | Own offering options visible/nonarchived/ACTIVE     |

Không DELETE, client ownerId/status/moderation/version tự đặt, hoặc endpoint Proposal tưởng tượng. LR mutations chưa có contract Idempotency-Key/exactly-once; HTTP401 renewal có replay cùng phiên trong client chung, không được suy đây là bảo đảm business replay. Timeout/unknown create hướng dẫn Mine, không tìm record bằng title hoặc tự POST lại.

## Fields và projection

- currentLevel là learning progress enum riêng (theo types), optional/null; verifiedTeacherOnly strict boolean, create default false. tagIds max10 distinct canonical ACTIVE UUID; PATCH omission giữ, [] clear. Không có GET Tag by ID: giữ selected ID chưa resolve label. Tag filter ANY AND Skill/keyword; repeated tagIds query, không text taxonomy fallback.
- preferredAvailability nullable {timeZone,weeklySlots:[{weekday,startTime,endTime}]}; IANA, MON–SUN,HH:mm, tối đa5,end>start cùng ngày, không overlap (adjacent được), sort weekday/time. Weekly wall-clock không convert ngày giả/UTC. PATCH omission giữ,null clear weekly; preferredSlots[] clear absolute, tối đa5 range timestamp RFC3339 tương lai. Hai loại nonempty cùng lúc bị400; nonempty loại mới thay loại cũ.
- teachingOverview nullable20–3000 code points, server sanitize/moderate. offeredSharingSkillIds max10 distinct UUID own active/public; [] clear; server recheck ownership. Public offeredSharingSkills chỉ id/skill{id,name}/level/verificationStatus và metadata level đã allowlist nếu có; owner giữ selected IDs cũ để sửa.
- desiredCreditPerHour nullable exact decimal string >0, tối đa10 integer/2 decimal digits, output2 decimals; là ngân sách mong muốn, không Hold/quote/thỏa thuận.
- expectedVersion safe positive integer từ server; không tự tăng. skillId bất biến sau publishedAt; PATCH field unchanged omission. Requested expiry nullable; output expiresAt là effective deadline. Policy backend default30 ngày/custom<=90 là source policy, không quy tắc mặc định của SRS.
- Public summary/detail dùng id,title,skill{id,name},tags{id,label},learningGoal,currentLevel,verifiedTeacherOnly,status,owner{id,displayName},createdAt,expiresAt, description/preferredSlots/preferences theo projection mới; detail có version. Owner dùng skillId/tagIds,moderationStatus/moderationRejectReason,requestedExpiresAt,publishedAt,updatedAt/version và preferences, không parse như public. GET/mine thêm effectiveStatus; mutation không nhất thiết có nên refetch khi cần.

List data[] + meta.pagination; LR limit1–100/default20, Skill max50, Tag max100/default20. Skill q NFC/trim2–100; Tag q NFC/trim0–120, literal case-insensitive; LR keyword sanitize/NFKC max120 code points. Feed/mine createdAt DESC/id DESC, recommended matchScore DESC rồi createdAt/id. Cursor opaque bind owner/filter/snapshot. Không sort query hay filter ngân sách/số buổi/verifiedTeacherOnly tự thêm. Snapshot invalid cursor cần explicit recovery chain mới, không mọi400 đều reset.

## Lỗi freshness và lifecycle

400 validation/query/cursor phân biệt qua AppError mapping;401 Auth;403 denied;404 unavailable;409 conflict/version/state;429 policy/rate;503 unavailable. Không render raw details. GET403/404 loại content/reason cache và khóa action đến read thành công; transport503 sau denial không hồi sinh snapshot. GET network/503 thông thường giữ last-read có notice; riêng expiry preflight lỗi khóa mutation. Mutation403/429 giữ input cùng phiên, không suy detail cũng bị cấm.

Cached OPEN/PENDING qua deadline cần GET trước action, editor deep link và trước PATCH dù form mở qua deadline. Version đổi yêu cầu comparison/explicit choice, không auto rebase/PATCH; terminal giữ draft nhưng khóa save. Không local-expire NEGOTIATING/MATCHED/CLOSED vì expiresAt cũ, không GET loop do clock lệch. Draft chỉ trong mounted form/session, không offline persistence. Target ID response phải đúng resource, callbacks/cache/session theo generation.

## Boundary và việc tiếp tục

Xem hồ sơ mở owner UUID qua [profile contract](profile.md). User đã cho phép mock-request Proposal context: /send-proposal?mode=mock-request dùng preview-prefixed local IDs, có nhãn preview; real ID chỉ dùng Back. Không HTTP Proposal/chat, không Hold/Path/Session. Notification inbox/mark-read/deep link không thuộc scope005; DEP-01 giữ rejection-notification requirement FR-LR-04, own reason không chứng minh đã gửi notification.

[Plan chuyển tiếp](../work/phase-04-learning-request-discovery/plan.md) sở hữu T025..T032 và FR-35 nghiệm thu còn mở; [status](../work/phase-04-learning-request-discovery/status.md) sở hữu evidence/gates mới nhất. SRS nguồn: [domain rules](../domain-rules.md), FR-LR-01..08/LR-001..009. Migration backend20261012000000_learning_request_fe_preferences cần API owner apply/verify; mobile không sửa DB/grants/moderation config. Chưa có realtime subscription LR trong source được xác minh; không tự mở rộng notification.
