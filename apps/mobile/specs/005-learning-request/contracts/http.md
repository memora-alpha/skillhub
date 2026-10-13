# HTTP integration contract — Spec 005

## Refresh2026-10-13

[Contract checkpoint](../contracts.md#contract-refresh--2026-10-13) ghi source BE
PR #20. Mobile thêm GET /tags?q=&limit=&cursor= và GET /me/skills?limit=&cursor=,
standard meta.pagination; own client vẫn authenticated/session scoped.
Create/PATCH/projections nhận overview/offered IDs/weekly/hourly-credit.
Các ghi chú Tag/Catalog/owner/matching unavailable phía dưới là lịch sử;
lock NEGOTIATING và runtime acceptance vẫn pending.

Design checkpoint 2026-10-12. [contracts.md](../contracts.md) là checkpoint
payload/projection/order đã có; file này bổ sung recovery/readiness cho plan,
không thay backend API hoặc tạo endpoint mới.

## Requests mobile sử dụng

Base `/api/v1`, Auth/session transport hiện có. Tất cả LR routes cần session;
mobile cũng dùng shared authenticated client cho Skill lookup.

| Method/path                         | Input chính                                      | Success / owner dependency                                                 |
| ----------------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------- |
| POST /learning-requests             | Create input trong data model                    | 201 OwnerRequest DRAFT; Catalog assertion                                  |
| GET /learning-requests/mine         | status/keyword/skillId/tagIds/limit/cursor       | 200 owner page + effectiveStatus; auth/grant/DB                            |
| GET /learning-requests              | keyword/skillId/tagIds, OPEN scope, limit/cursor | 200 public page; Catalog/owner khi có item                                 |
| GET /learning-requests/recommended  | Filter + cursor                                  | 200 public page + matchScore; Sharing Skill snapshot và public projections |
| GET /learning-requests/:id          | UUID                                             | 200 own hoặc public detail theo quyền/state; public cần Catalog/owner      |
| PATCH /learning-requests/:id        | Changed fields + expectedVersion                 | 200 OwnerRequest; Catalog, moderation nếu áp dụng                          |
| POST /learning-requests/:id/publish | expectedVersion                                  | 200 OPEN/PENDING owner response; Catalog + moderation config               |
| POST /learning-requests/:id/cancel  | expectedVersion                                  | 200 CANCELLED; lock reader chỉ khi NEGOTIATING                             |
| GET /skills; GET /skills/:id        | q/cursor/limit; UUID detail                      | Skill list/detail cho picker, độc lập LR internal adapter                  |

Static mine/recommended không phải UUID; detail thiếu/array/demo/non-UUID không
gọi API. GET private outsider phải unavailable; không dò owner bằng fixture.
Owner/public distinctions và field rules xem [data model](../data-model.md).

## Envelope và paging

Success `{success:true,message,data,meta?}`; list meta.pagination chứa limit,
nextCursor và hasMore. Error `{success:false,message,statusCode,details?}`;
không giả định top-level code hoặc render arbitrary backend text/details.

LR limit default20/max100; Skill limit max50, current mobile dùng20. LR keyword
sanitize/NFKC tối đa120 code points; Skill q trim/NFC 2..100. Query Tag IDs distinct
max10; current UI Tag deferred. Không có sort, Credit/session count hoặc
verifiedTeacherOnly query được mobile dùng.

Cursor gửi nguyên, không decode/modify. Đổi filter/scope/account bỏ page chain cũ;
giữ server order, dedupe ID. INVALID_REQUEST_CURSOR HTTP400 trong backend được
shared parser chuyển thành AppError.code từ message dạng mã an toàn. Không
nhầm với INVALID_REQUEST_QUERY hoặc DTO-validation400.

M03 cần test refetch hiện có: TanStack refetch infinite pages từ đầu, tính cursor
tiếp theo từ response mới. Nếu UX/recovery vẫn thiếu, thêm explicit restart đầu
đúng query key; không reset mọi400, không auto retry vòng lặp. Transient page
failure giữ items đã tải và retry đọc; khóa load-more khi đang fetching/refetching.

## Mutation/version safety

Create không gửi ownerId/status/moderation/version. PATCH chỉ field đổi;
expectedVersion từ snapshot gốc, arrays omitted giữ nguyên/[] clear và null theo
allowlist. Current Tag IDs giữ bằng omission, chưa có clear UI. No-change không
PATCH. Skill bất biến sau publishedAt; rule cuối do server kiểm tra.
Client chỉ NFKC/trim/đếm code points, không strip HTML/decode entities để mô phỏng
sanitizer hoặc moderation server. Raw PATCH/markup acceptance kiểm riêng ở B06.

Cached OPEN/PENDING quá deadline cần GET trước action, editor deep link và trước
PATCH có thay đổi kể cả form mở qua deadline. GET failure chặn mutation;403/404
áp resource read denial bên dưới, network/503 giữ last-read và draft cùng phiên.
GET success xét effectiveStatus/version; không editable thì khóa, version đổi
phải đối chiếu/explicit choice M01, không tự thay expectedVersion rồi PATCH.
Không áp deadline cho NEGOTIATING/MATCHED/CLOSED hoặc lặp GET do clock lệch.

Targeted PATCH/publish/cancel result phải parse owner schema và có id bằng target
ID trước sync/toast/navigation (M04 đã implement và regression wrong-ID qua). GET/detail/Skill đã có check
ID. Create nhận ID mới từ201; không suy ra ID từ nội dung, không gắn Idempotency-Key
do contract LR chưa có replay guarantee.

| Failure                            | Hành vi mobile / việc còn thiếu                                                                                                                                                                                          |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 400                                | Giữ draft; validation input không bị biến thành success. Cursor recovery chỉ cho mã đúng.                                                                                                                                |
| 401                                | Shared Auth renew trong cùng generation; không replay bằng account mới.                                                                                                                                                  |
| 403                                | GET detail: không được phép, ẩn cached server content/reason, khóa action đến GET success đúng phiên. Mutation: giữ input cùng phiên, không success/auto resend; không suy detail mất quyền đọc hoặc tự tính permission. |
| 404                                | GET detail: unavailable, ẩn cached server content/reason/action kể cả đã có cache; không phân biệt private resource của người khác. Draft editor giữ trong bộ nhớ phiên, không render baseline bị từ chối đọc.           |
| 409                                | Khóa resend, giữ draft; M01 đọc latest snapshot và đối chiếu trong editor.                                                                                                                                               |
| 429                                | Giữ input cùng phiên, thông báo đợi/thử lại thủ công; không auto resend mutation hoặc retry storm.                                                                                                                       |
| 503                                | Dependency unavailable; giữ form, không fallback mock. Retry đọc/thao tác thủ công theo contract hiện tại.                                                                                                               |
| Network/protocol/other5xx mutation | Outcome chưa xác nhận; khóa resend, known ID refetch, unknown create kiểm Mine.                                                                                                                                          |

GET network/503 giữ snapshot last-read với notice, không áp chính sách stale này
cho resource404/403. Draft không được giữ qua logout/account switch. Negative
acceptance T025/T026 gồm account không ACTIVE, thiếu grant, policy hạn chế hoạt
động mới và429; ghi response/Auth behavior thực tế, không tự cấu hình grant/rule.

Backend filter che5xx thành Internal server error nên UI không dựa raw message
để phân loại Catalog/lock/matching. Readiness phải kiểm qua wiring/source và
môi trường do API owner cung cấp; chỉ response503 không cho biết adapter nào.

## Readiness và acceptance bên ngoài mobile

- B01: Catalog real assertion/read, ACTIVE Skill/Tag UUIDs đúng, không stub.
- B02: Public owner `{id,displayName}`; feed có item account khác/public detail
  và private-field allowlist. Empty200 hoặc Skills200 không đủ chứng minh.
- B03: Sharing Skill snapshot/version, ranking và cursor invalidation thật.
- B04: NEGOTIATING unlocked vs locked/race với Path/Schedule authority.
- B05: Tag lookup endpoint/query/paging/ACTIVE policy cần API owner chốt.
- B06: Migrations/permissions, moderation config/rules và expiry worker/config.
  Cần raw PATCH/markup/Unicode HTTP acceptance vì DTO kiểm trước sanitizer.

Không sửa services/api trong spec005. Notification delivery, Proposal/profile
và các luồng Path/Chat/Credit tiếp tục thuộc spec khác; boundary hiện tại giữ nguyên.
