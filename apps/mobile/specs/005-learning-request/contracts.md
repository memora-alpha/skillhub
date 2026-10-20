# Checkpoint contract — Mobile Learning Request

## Contract refresh — 2026-10-13

Source đã xác minh bằng `git show origin/dev:...`, remote tip `f4dd314`,
FE extension commit `8853244` và fix `616bdee` (PR #20). Checkout mobile chưa
merge dev; đọc contract từ ref không thay backend source hay migration.
Các ghi chú unavailable phía dưới là lịch sử checkpoint 2026-10-11.

- `preferredAvailability`: nullable `{timeZone,weeklySlots:[{weekday,startTime,endTime}]}`;
  IANA timezone, MON–SUN, HH:mm, tối đa5, end>start cùng ngày, không overlap,
  cho phép adjacent; BE sort thứ/giờ. Weekly wall-clock không chuyển thành UTC/ngày giả.
  Weekly nonempty thay absolute slots; absolute nonempty thay weekly; cả hai nonempty
  bị400. PATCH omission giữ, null clear weekly, [] clear absolute.
- `teachingOverview`: nullable20–3000 code points, sanitize/moderate bởi BE.
- `offeredSharingSkillIds`: tối đa10 distinct UUID, active/public Sharing Skills
  của owner, từ GET `/me/skills?limit=&cursor=`. Response lookup:
  `{id,skill:{id,name,status,...},level,verificationStatus,isVisible,archivedAt,...}`.
  Chỉ chọn visible/nonarchived/ACTIVE; BE recheck ownership khi mutate/publish.
  Public `offeredSharingSkills` chỉ có `{id,skill:{id,name},level,verificationStatus}`;
  owner giữ selected IDs kể cả mục đã hidden/archive để sửa. [] clear.
- `desiredCreditPerHour`: nullable decimal string >0, tối đa10 chữ số nguyên/2
  chữ số thập phân; output2 decimals. Chỉ ngân sách mong muốn, không Hold.
- Tag lookup đã có GET `/tags?q=&limit=&cursor=`: ACTIVE `{id,label}`, standard
  `meta.pagination`; q NFC/trim0–120, literal case-insensitive, limit1–100/default20,
  cursor theo filter. Không có GET tag by id; giữ ID đã chọn khi chưa resolve tên.
  Create/PATCH `tagIds` max10 distinct UUID; PATCH omission giữ, [] clear.
  Feed/recommended dùng repeated tagIds; ANY tags AND Skill/keyword, đổi filter
  bắt đầu cursor chain mới. Empty lookup/error không fallback Skill/text taxonomy.
- Owner/public detail và feed có overview/weekly/budget/offered metadata;
  feed thêm description/preferredSlots. Parser cho fields mới defaults trên legacy
  response nhưng reject giá trị sai khi field có mặt, strip private data.
- Catalog/public owner/Sharing Skill readers đã wired trong source BE mới.
  NEGOTIATING lock reader vẫn unavailable; runtime migration/config/test data
  và real API/native acceptance vẫn cần evidence riêng (T025..T032).

Migration cần ở môi trường BE: `20261012000000_learning_request_fe_preferences`.
Mobile không apply migration, seed hoặc thay configuration BE.

Ngày đọc: 2026-10-11. Baseline `dev`: `c52ec74`.
Tham chiếu [spec](spec.md),
[backend HTTP contract](../../../../services/api/specs/007-learning-request/contracts/http.md)
và source controller/DTO/use case. Mobile đã gọi các route dưới đây;
runtime LR thật còn phụ thuộc các adapter ghi trong tài liệu này.

Checkpoint implement2026-10-12: mobile recovery/expiry/paging/read-denial và
targeted mutation ID guard đã triển khai theo [HTTP](contracts/http.md) và
[UI](contracts/ui.md). Source/fixture/web evidence tại [validation](validation.md),
không thay wire contract hoặc xác nhận backend readiness. Tag lookup và
idempotency/replay guarantee chưa được chốt; không thêm endpoint/header giả.

## Routes được sử dụng

Base URL `/api/v1`; các route LR yêu cầu Bearer session hiện tại.
Static `/mine` và `/recommended` không được hiểu như requestId.

| Method / path                                | Payload/query                                                                                                            | Kết quả                                                                     |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| POST `/learning-requests`                    | title, skillId, description, learningGoal; optional currentLevel, verifiedTeacherOnly, tagIds, preferredSlots, expiresAt | 201 owner detail, DRAFT.                                                    |
| GET `/learning-requests`                     | skillId, tagIds, keyword, status=OPEN nếu gửi, limit, cursor                                                             | 200 public summaries, chỉ OPEN còn hạn.                                     |
| GET `/learning-requests/mine`                | Các filter trong scope own; bỏ status khi “Tất cả”                                                                       | 200 owner items có effectiveStatus.                                         |
| GET `/learning-requests/recommended`         | Filter/cursor theo contract LR                                                                                           | 200 summaries + matchScore; 503 nếu thiếu snapshot adapter.                 |
| GET `/learning-requests/:requestId`          | UUID                                                                                                                     | 200 scoped detail; owner có effectiveStatus, outsider chỉ OPEN còn hạn.     |
| PATCH `/learning-requests/:requestId`        | expectedVersion + các field thay đổi                                                                                     | 200 owner detail; không có lệnh set status.                                 |
| POST `/learning-requests/:requestId/publish` | `{expectedVersion}`                                                                                                      | 200 owner detail: OPEN hoặc PENDING_MODERATION.                             |
| POST `/learning-requests/:requestId/cancel`  | `{expectedVersion}`                                                                                                      | 200 owner detail: CANCELLED.                                                |
| GET `/skills`, `/skills/:skillId`            | Catalog list dùng `q`, categoryId, limit, cursor; detail dùng UUID                                                       | Skill lookup đã có source; không thay Tag catalog hoặc LR internal adapter. |

Không dùng DELETE LR, client ownerId/status/moderation/version, staff/admin API,
hay endpoint Proposal được tự giả định. LR mutations không có contract idempotency
key/replay; không suy hỗ trợ từ việc Skill mutations có Idempotency-Key.

Skill lookup dùng `q` đã trim/NFC, 2–100 ký tự; dưới 2 ký tự không gửi `q`.
Keyword LR tối đa 120 code points sau sanitize/NFKC. Không dùng keyword LR
để tìm theo tên Skill/Tag; filter Skill dùng `skillId`.

## Payload và field mapping

- Form `goal`/`level` mẫu phải map sang `learningGoal`/`currentLevel`.
- Skill dùng UUID thật; Tag là `tagIds` distinct, không gửi `tags` text.
- currentLevel null/omitted khi chưa khai khác NONE. verifiedTeacherOnly là strict
  boolean, default false khi create; không nhận chuỗi `"false"` hoặc null.
- Array omitted giữ nguyên khi PATCH; `[]` xóa. currentLevel/expiresAt cho phép
  null; title/description/learningGoal/skillId/tagIds/preferredSlots không gửi null.
- preferredSlots timestamp RFC3339 có offset; UTC `Z` được phép. Tối đa 5 range
  tương lai, end > start; không phải lịch đã confirm.
- Weekly availability theo yêu cầu UI mới chưa thuộc HTTP contract (B08/GAP-09).
  UI draft không gửi API; cần chốt preferredAvailability/timeZone/weeklySlots,
  migration, validation, owner/public projections và compatibility dữ liệu cũ.
- expiresAt input được lưu thành `requestedExpiresAt`; `expiresAt` output là hạn
  hiệu lực. DRAFT chưa publish có thể chưa có expiresAt. Publish default +30 ngày,
  custom không quá +90 ngày theo policy backend hiện tại, không theo clock mobile.
- expectedVersion là safe positive integer từ bản server đang được chỉnh sửa;
  không dùng Date.now(), không tự tăng để vượt conflict.

Text policy trong `domain/request-text.policy.ts`: server sanitize HTML, decode
entities, NFKC và trim rồi đếm Unicode code points. PATCH đi qua raw DTO
MinLength/MaxLength trước domain policy; cần kiểm chứng markup/chuỗi dài qua HTTP,
không chỉ unit test hàm sanitizer. Mobile không import source backend hoặc hứa
validator client mô phỏng chính xác sanitizer server. Client chỉ NFKC/trim/đếm
code points, không strip HTML/decode entities; moderation do backend quyết định.

## Response projection

| Scope          | Shape cần parse                                                                                                                                                                                                                        |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public summary | id, title, skill{id,name}, tags{id,label}, learningGoal, currentLevel, verifiedTeacherOnly, status, owner{id,displayName}, createdAt, expiresAt.                                                                                       |
| Public detail  | Summary + description, preferredSlots, version.                                                                                                                                                                                        |
| Owner detail   | id, skillId, title, description, learningGoal, currentLevel, verifiedTeacherOnly, tagIds, preferredSlots, status, moderationStatus, moderationRejectReason, version, requestedExpiresAt, expiresAt, publishedAt, createdAt, updatedAt. |
| Owner GET/mine | Owner detail + effectiveStatus; mutations trả owner detail không có field này.                                                                                                                                                         |
| Recommended    | Public summary + matchScore.                                                                                                                                                                                                           |

Own payload không có owner.id/skill.name/tags.label. Không parse own response như
public detail hoặc dựng public profile từ own DTO. Owner/read grants có thể cho
backend trả moderation projection cho reviewer; app người dùng vẫn chỉ dùng
allowlist UI, không render flaggedCategories/reviewer metadata.

GET scoped detail/owner summary có effectiveStatus để phản ánh expiry khi job
chậm; sau mutation cần refresh query khi dùng trạng thái hiệu lực. Không làm
NEGOTIATING/MATCHED/CLOSED thành EXPIRED chỉ vì expiresAt cũ. Cached OPEN/PENDING
quá deadline cần GET trước action, khi vào editor trực tiếp và trước PATCH có đổi
field; form mở qua deadline cũng áp dụng. GET lỗi chặn mutation và giữ draft cùng
phiên; effectiveStatus mới khóa edit thì không PATCH, version đổi phải đối chiếu/
explicit choice, không tự nâng baseline. Clock lệch không gây GET loop.

Success envelope `{success:true,message,data}`; list thêm
`meta.pagination: {limit,nextCursor,hasMore}`. Cursor opaque, gắn scope/filter/actor;
đổi filter hoặc account phải bỏ cursor. LR limit mặc định 20, 1–100; Skill catalog
limit tối đa 50 theo DTO riêng. Không suy có total/count nếu API không trả.

Feed/mine sort createdAt DESC,id DESC; recommended matchScore DESC rồi createdAt
DESC,id DESC. Tag filter ANY, kết hợp AND với skillId/keyword. Không có sort query,
filter Credit/session count hay verifiedTeacherOnly query trong LR DTO hiện tại;
verifiedTeacherOnly chỉ là field preference. Recommended snapshot đổi làm cursor
invalid thì bỏ cursor/tải page đầu, không phát lại cursor cũ vô hạn.

Error envelope `{success:false,message,statusCode,details?}`; không giả định
top-level `code`. Mapping UX theo HTTP 400/401/403/404/409/429/503 và lỗi transport,
giữ nguyên handling Auth/session generation chung. Không render raw details.
GET detail404 -> unavailable, GET detail403 -> không được phép; cả hai ẩn cached
server content/reason và khóa action đến khi GET thành công đúng phiên. Draft
editor giữ trong bộ nhớ cùng phiên, không render baseline bị từ chối quyền đọc.
Network/503 GET giữ last-read với notice, riêng expiry preflight lỗi luôn khóa
mutation. Mutation403/429 giữ input khi session hợp lệ, không success/auto resend;
không suy từ mutation403 rằng detail cũng bị cấm đọc. Kiểm account không ACTIVE,
thiếu grant và policy hạn chế hoạt động mới theo response backend;401 vẫn theo
Auth chung và không giữ draft qua logout.

## Runtime dependencies cần xác minh

Đọc `services/api/src/modules/learning-requests/learning-requests.module.ts`
và `infrastructure/unavailable-learning-request-dependencies.ts` thấy:

- Catalog `assertActiveSelection`/`readSelections`: 503.
- Public owner `readPublicOwners`: 503; public list có dữ liệu/detail cần adapter.
- Sharing Skill `getMatchingSnapshot`: 503; recommended cần adapter.
- Path/Schedule `assertNotLocked`: 503; cancel gọi reader khi NEGOTIATING.
- Eligibility `assertAllowed`: đã dùng DB clock và Reputation service.

Skill HTTP controller tồn tại không tự nối vào LR Catalog reader. Tag lookup HTTP
cho mobile chưa có contract xác minh. Không sửa wiring/backend tại nhánh mobile;
các dependency này phải được owner API hoàn thiện trên môi trường nghiệm thu.

## Ranh giới Notification

Notification là dependency nghiệp vụ theo FR-LR-04/LR-004, được triển khai trong
spec riêng (DEP-01 của spec 005). Spec 005 không gọi API inbox/mark-read hoặc parse
notification payload. Lý do từ chối hiện tại lấy từ `moderationRejectReason` của
own detail; việc gửi/nhận notification không được suy từ response Learning Request.
