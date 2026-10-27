# Learning Request Discovery và Tag

## Public owner avatar — đồng bộ BE 232cb6ba

Mobile đã đối chiếu `origin/dev` 79d4bb1f ngày 2026-10-27; BE mới nhất thêm `owner.avatarUrl: string | null` trong feed, recommended và public detail. Field bắt buộc, nullable; không đổi projection owner/moderation, endpoint, permission hoặc migration. Nguồn: [BE HTTP contract](../../../../services/api/specs/007-learning-request/contracts/http.md), `SkillActorService.readPublicOwners` và `AvatarStorage.url` (URL avatar CLEAN có hạn 60 giây).

- `publicSchema` giữ avatar URL HTTP(S), từ chối field thiếu hoặc URL không hợp lệ; không lấy storage key/private metadata vào model. Fixture public phản ánh field nullable mới, không thêm field vào owner projection.
- RequestCard và RequestRequesterDetails dùng URL từ response; `null` hiển thị initials và không gọi profile, kể cả cache profile còn avatar cũ. Card không hiển thị không tải ảnh hoặc kích hoạt profile read.
- `useRequestOwnerAvatar` nhận biết hạn URL S3 từ `X-Amz-Date`/`X-Amz-Expires` trước khi đưa ảnh hết hạn vào Image. Chỉ khi URL hết hạn hoặc tải ảnh lỗi mới bật `useParticipantProfile` hiện có để nhận URL mới/cache còn hạn. URL không có thông tin hạn vẫn được xử lý qua callback lỗi ảnh; URL profile cache đã hết hạn không đưa trở lại Image.
- Fallback giữ query owner/session, ReadAccess/denial, cancel-on-disable, dedup và freshness 30 giây hiện có. Không refresh cả feed chỉ để ký lại ảnh, không polling/timer hoặc replay mutation. URL thay đổi loại trạng thái lỗi của URL cũ. `Avatar` chung chỉ thêm callback `onImageError` tùy chọn, các consumer khác giữ fallback initials hiện hành.

Đây là đồng bộ source với contract mới, chưa xác minh deployment BE hoặc nghiệm thu ảnh trên thiết bị/API thật.

## Nguồn đối chiếu

Baseline migration HEAD ed5a17dd9f1a6d5e45e1b6af33b17dd4518b46fd: [backend HTTP](../../../../services/api/specs/007-learning-request/contracts/http.md), [controller](../../../../services/api/src/modules/learning-requests/presentation/http/learning-requests.controller.ts), [DTO](../../../../services/api/src/modules/learning-requests/presentation/http/learning-requests.dto.ts), [module wiring](../../../../services/api/src/modules/learning-requests/learning-requests.module.ts), [backend Tag](../../../../services/api/specs/009-tags/spec.md); mobile [requests-api](../../src/features/learning-requests/api/requests-api.ts), [types](../../src/features/learning-requests/types.ts), [preferences](../../src/features/learning-requests/schemas/request-preferences.ts), [form](../../src/features/learning-requests/schemas/request-form.ts).

Bổ sung2026-10-24: proposedTags theo BE commit9d356167 đã merge vào dev0318bf7e, đối chiếu [amendment](../../../../services/api/specs/007-learning-request/proposed-tags.md), DTO, request-text/tag policy và use cases; mobile tích hợp trên nhánh fix/mobile-learning-request-proposed-tags. Đây là contract/source, không xác nhận server deployment hoặc migration đã apply.

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

- proposedTags là mảng tên tag mới, optional khi create/PATCH. NFC, trim/collapse whitespace,1–80 Unicode code points, không control characters hoặc key trùng không phân biệt hoa/thường; giữ dấu. Tổng tagIds+proposedTags tối đa10. Omit create mặc định[], omit PATCH giữ nguyên,[] clear; null không hợp lệ. Mobile giữ trường trong owner create/detail/mine và form/recovery, không đưa vào public schema/filter/tag catalog. Response cũ thiếu trường được đọc thành[] để giữ compatibility.
- Publish có proposedTags luôn chờ duyệt cùng bài; Staff/Admin approve sẽ tạo/reuse ACTIVE canonical tags, cập nhật tagIds và xóa proposedTags. Rejected giữ tên để sửa; không tự tạo TagCreationRequest từ mobile. Owner thấy tag đề xuất/chưa duyệt; khi response mới sau approval có[] thì section tự ẩn. Cần migration20261024000000_learning_request_proposed_tags và API mới trước real API acceptance; mobile không apply DB.
- Form mobile gộp tìm/chọn/thêm tag vào một ô; tên trùng canonical đã tải được chọn bằng ID, không đề xuất lại. `tagSearch` chỉ là draft UI, không thuộc HTTP contract: chữ chưa xác nhận chặn Save với lỗi tại ô, vẫn giữ khi thu gọn hoặc rebase conflict; người dùng chọn kết quả, thêm tag mới hoặc xóa tìm kiếm để tiếp tục. Giới hạn/normalization/duyệt của BE không đổi.
- Tìm tag dùng chung NFC/trim/collapse whitespace với so khớp tên. Query catalog được giới hạn120 UTF-16 units theo BE hiện hành, giữ nguyên code point khi cắt prefix; tên đề xuất vẫn validate đầy đủ1–80 code points trên input gốc. Kết quả exact đã cache vẫn có nút chọn khi không nằm trong trang hiện tại; giới hạn10 được tính sau khi thay proposal tương đương bằng canonical. Khóa UI của từng row lịch chỉ dùng trong phiên form, không serialize vào weeklySlots hoặc HTTP payload.
- currentLevel là learning progress enum riêng (theo types), optional/null; verifiedTeacherOnly strict boolean, create default false. tagIds max10 distinct canonical ACTIVE UUID; PATCH omission giữ, [] clear. Không có GET Tag by ID: giữ selected ID chưa resolve label. Tag filter ANY AND Skill/keyword; repeated tagIds query, không text taxonomy fallback.
- preferredAvailability nullable {timeZone,weeklySlots:[{weekday,startTime,endTime}]}; IANA, MON–SUN,HH:mm, tối đa5,end>start cùng ngày, không overlap (adjacent được), sort weekday/time. Weekly wall-clock không convert ngày giả/UTC. PATCH omission giữ,null clear weekly; preferredSlots[] clear absolute, tối đa5 range timestamp RFC3339 tương lai. Hai loại nonempty cùng lúc bị400; nonempty loại mới thay loại cũ.
- teachingOverview nullable20–3000 code points, server sanitize/moderate. offeredSharingSkillIds max10 distinct UUID own active/public; [] clear; server recheck ownership. Public offeredSharingSkills chỉ id/skill{id,name}/level/verificationStatus và metadata level đã allowlist nếu có; owner giữ selected IDs cũ để sửa.
- desiredCreditPerHour nullable exact decimal string >0, tối đa10 integer/2 decimal digits, output2 decimals; là ngân sách mong muốn, không Hold/quote/thỏa thuận.
- expectedVersion safe positive integer từ server; không tự tăng. skillId bất biến sau publishedAt; PATCH field unchanged omission. Requested expiry nullable; output expiresAt là effective deadline. Policy backend default30 ngày/custom<=90 là source policy, không quy tắc mặc định của SRS.
- Public summary/detail dùng id,title,skill{id,name},tags{id,label},learningGoal,currentLevel,verifiedTeacherOnly,status,owner{id,displayName,avatarUrl},createdAt,expiresAt, description/preferredSlots/preferences theo projection mới; detail có version. avatarUrl bắt buộc nullable theo BE232cb6ba. Owner dùng skillId/tagIds,moderationStatus/moderationRejectReason,requestedExpiresAt,publishedAt,updatedAt/version và preferences, không parse như public. GET/mine thêm effectiveStatus; mutation không nhất thiết có nên refetch khi cần.

List data[] + meta.pagination; LR limit1–100/default20, Skill max50, Tag max100/default20. Skill q NFC/trim2–100; Tag q NFC/trim0–120, literal case-insensitive; LR keyword sanitize/NFKC max120 code points. Feed/mine createdAt DESC/id DESC, recommended matchScore DESC rồi createdAt/id. Cursor opaque bind owner/filter/snapshot. Không sort query hay filter ngân sách/số buổi/verifiedTeacherOnly tự thêm. Snapshot invalid cursor cần explicit recovery chain mới, không mọi400 đều reset.

## Lỗi freshness và lifecycle

Feed/mine giữ danh sách đã tải khi GET gặp429/network/5xx, hiện loading nhẹ và phục hồi theo backoff/Retry-After khi màn còn focus; chưa có dữ liệu thì hiện loading. Lỗi quyền/validation vẫn hiển thị để xử lý. Cuộn gần cuối tự tải trang kế tiếp, không chạy khi đang fetch/có lỗi/ngoài phiên hiện hành; giữ nút tải thêm/thử lại và recovery cursor400 hiện có. Cursor trả lặp sẽ dừng phân trang để tránh vòng request.

GET list403/404 ẩn và evict cached pages nhưng giữ lỗi để retry đầy đủ;503 sau denial không hiển thị snapshot cũ. Denial trang tiếp theo áp dụng cho cả list, không tiếp tục cursor. Cache list rỗng gặp transient error vẫn loading, không khẳng định empty. Offering selector chưa mở và chưa có selected IDs không gọi /me/skills; có selection vẫn resolve labels, không bỏ ID chỉ vì picker đang đóng.

Focus feed/mine/recommended dùng cache còn mới theo QueryProvider (30 giây); mutation invalidation và kéo làm mới vẫn đọc lại danh sách. Kéo làm mới feed chỉ refresh lịch sử đề xuất khi query đã stale, vẫn đọc đủ các trang khi cần. Tên kỹ năng dùng cache catalog cùng owner/session nếu chưa invalidated và cache tên5 phút; không thay contract Skill. Bộ lọc chỉ dùng canonical tagIds, giữ tên đã đọc qua các lần mở sheet và cho bỏ từng chip; nhãn chưa resolve không làm mất ID.

400 validation/query/cursor phân biệt qua AppError mapping;401 Auth;403 denied;404 unavailable;409 conflict/version/state;429 policy/rate;503 unavailable. Không render raw details. GET403/404 loại content/reason cache và khóa action đến read thành công; transport503 sau denial không hồi sinh snapshot. GET network/503 thông thường giữ last-read có notice; riêng expiry preflight lỗi khóa mutation. Mutation403/429 giữ input cùng phiên, không suy detail cũng bị cấm.

Cached OPEN/PENDING qua deadline cần GET trước action, editor deep link và trước PATCH dù form mở qua deadline. Version đổi yêu cầu comparison/explicit choice, không auto rebase/PATCH; terminal giữ draft nhưng khóa save. Không local-expire NEGOTIATING/MATCHED/CLOSED vì expiresAt cũ, không GET loop do clock lệch. Draft chỉ trong mounted form/session, không offline persistence. Target ID response phải đúng resource, callbacks/cache/session theo generation.

## Boundary và việc tiếp tục

Xem hồ sơ mở owner UUID qua [profile contract](profile.md). Proposal preview dùng mock-request context: /send-proposal?mode=mock-request dùng preview-prefixed local IDs, có nhãn preview; real ID chỉ dùng Back. Không HTTP Proposal/chat, không Hold/Path/Session. Notification inbox/mark-read/deep link không thuộc scope005; DEP-01 giữ rejection-notification requirement FR-LR-04, own reason không chứng minh đã gửi notification.

[Plan chuyển tiếp](../work/phase-04-learning-request-discovery/plan.md) sở hữu T025..T032 và FR-35 nghiệm thu còn mở; [status](../work/phase-04-learning-request-discovery/status.md) sở hữu evidence/gates mới nhất. SRS nguồn: [domain rules](../domain-rules.md), FR-LR-01..08/LR-001..009. Migration backend20261012000000_learning_request_fe_preferences cần API owner apply/verify; mobile không sửa DB/grants/moderation config. Chưa có realtime subscription LR trong source được xác minh; không tự mở rộng notification.

Cập nhật phạm vi Phase 05–06: mô tả Proposal preview ở trên ghi giới hạn của implementation005 tại thời điểm đó. Source hiện có gửi proposal từ Request/Sharing Skill thật và accept mở Chat qua API; xem [contract hiện hành](proposal-learning-agreement.md) và [work](../work/phase-05-proposal-learning-agreement/status.md). Không sửa lịch sử acceptance của spec005.
