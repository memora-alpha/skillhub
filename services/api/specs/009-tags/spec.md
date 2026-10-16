# Đặc tả API Tag và đề xuất tạo tag

Ngày lập: 2026-10-15. Plan/brief được duyệt trong chat; triển khai và kiểm chứng
local ngày 2026-10-16. [Bằng chứng và giới hạn rollout](validation.md).

## Mục tiêu và yêu cầu đã xác nhận

ADMIN tạo tag chính thức hoặc duyệt đề xuất của USER. USER chỉ được sử dụng tag
chính thức khi tag ACTIVE; việc được duyệt đề xuất không thay đổi role của USER.
“Quản trị viên” là role ADMIN toàn hệ thống, không phải một role riêng trên tag.
Người dùng đã xác nhận cách hiểu này trong chat ngày 2026-10-15.

SRS V1.6, FR-ADM-02 yêu cầu Admin thêm/sửa/ẩn skill/tag và không xóa cứng dữ liệu
đang tham chiếu. BR-02 và mục 18.10 yêu cầu dùng skill/tag hợp lệ cho tìm kiếm,
Learning Request; Learning Request tối đa 10 tag. Luồng USER đề xuất tag là yêu
cầu bổ sung trong chat, không phải một workflow đã được SRS mô tả đầy đủ.

## Hiện trạng source tại thời điểm lập plan

- `src/modules/skills/presentation/http/skills.controller.ts`: đã có public
  `GET /api/v1/tags`; chưa có API quản trị tag hoặc yêu cầu tạo tag.
- `src/modules/skills/infrastructure/skills.repository.ts`: lookup chỉ trả `{id,label}`, lọc
  ACTIVE, tìm literal không phân biệt hoa/thường, cursor theo `label,id`.
- `prisma/runtime-support.prisma`: Tag có `id`, `label` unique, `status` và
  RequestTag liên kết Learning Request. Chưa có người tạo hoặc lịch sử duyệt.
- `src/modules/skills/application/skills.service.ts`: là owner contract kiểm tra tag ACTIVE
  và đọc tag cho Learning Request; `assertActiveSelection` chưa khóa các tag.
- Có sẵn live session/permission checks, transaction, idempotency và audit.
  `SkillLevelsService` đã có mẫu kiểm tra đồng thời ADMIN và permission.
- Giả định “Skill/slug đóng vai tag” trong spec 007 là lịch sử. Runtime hiện đã
  có Tag độc lập; feature này mở rộng dữ liệu đang chạy, không thay Tag bằng Skill.

Các đường dẫn source ở trên tương đối với `services/api`.

## Phạm vi V1

Giữ ownership trong module `skills`. Bổ sung quản trị tag, hàng đợi đề xuất,
duyệt/từ chối, lịch sử của người gửi, phân quyền và audit. Giữ nguyên public
lookup và `tagIds` trong Learning Request. Chưa mở UI, alias/merge/category,
xóa cứng, duyệt hàng loạt, sửa/rút đề xuất hoặc restore tag ARCHIVED.

Hai lựa chọn đã cân nhắc: đặt PENDING trực tiếp trên Tag ít bảng hơn nhưng trộn
danh mục với yêu cầu và khó giữ nhiều lịch sử; tạo module/service triển khai
riêng sẽ đổi ownership đang có. Đề xuất dùng `TagCreationRequest` trong `skills`:
tag chính thức và yêu cầu duyệt có vòng đời riêng, tận dụng hạ tầng hiện tại.

## Luồng và quyền

1. ADMIN tạo trực tiếp → Tag ACTIVE; `createdByUserId` lấy từ phiên hiện tại.
2. USER gửi label → TagCreationRequest PENDING; chưa tạo Tag sử dụng được.
3. ADMIN approve → tạo Tag ACTIVE hoặc liên kết Tag ACTIVE cùng tên đã có;
   request chuyển APPROVED, lưu reviewer/time/resultTagId trong cùng transaction.
4. ADMIN reject kèm reason → request REJECTED; không tạo Tag.
5. USER xem danh sách/chi tiết của mình; ADMIN xem hàng đợi và lịch sử toàn bộ.

Quyền đề xuất: USER có `tag-request:create:self`, `tag-request:read:self`;
ADMIN có `tag:read`, `tag:create`, `tag:update`, `tag-request:read`,
`tag-request:approve`, `tag-request:reject`. STAFF không được cấp các quyền tag
mặc định. Mọi API quản trị kiểm tra **ADMIN và permission tương ứng**, kể cả
replay. Đọc request của người khác qua API `/me` trả 404. Server tự gán actor,
owner, reviewer và status; client không được truyền những field này.

## Quy tắc V1

- Label mới: từ chối control characters (`\p{Cc}`) trong input gốc, rồi trim →
  NFC → gộp whitespace thành một dấu cách; dài 1–80 Unicode code points, không
  được rỗng. `labelKey` là label đã
  chuẩn hóa rồi lowercase; giữ dấu tiếng Việt, phân biệt `C`, `C++`, `C#`.
- Unique `labelKey` xuyên mọi trạng thái Tag. ADMIN tạo trùng trả 409
  `TAG_ALREADY_EXISTS`. Gửi đề xuất cho tag ACTIVE có sẵn cũng trả mã này;
  tag INACTIVE/ARCHIVED có sẵn trả 409 `TAG_UNAVAILABLE`.
- Một USER chỉ có một PENDING cho mỗi labelKey, enforced bằng partial unique
  index. USER khác có thể đề xuất cùng tên và có lịch sử độc lập.
- Khi duyệt, nếu cùng tên đã ACTIVE, dùng lại id; không đổi người tạo tag cũ.
  Nếu INACTIVE/ARCHIVED, trả `TAG_UNAVAILABLE`, giữ request PENDING để Admin
  xử lý danh mục hoặc từ chối. Không tự bật lại tag ẩn.
- Request đã quyết định không sửa/duyệt lại. Đề xuất cho phép gửi request mới
  sau REJECTED nếu chưa tồn tại tag tương ứng; giữ nguyên lịch sử cũ.
- ADMIN sửa label hoặc ACTIVE ↔ INACTIVE với `expectedVersion` và reason.
  Tag ARCHIVED chỉ được đọc trong V1. Tag ẩn không được chọn mới; liên kết bài
  cũ vẫn đọc được, không xóa hay viết lại hàng loạt Learning Request.
- Việc publish/edit Learning Request tiếp tục áp dụng kiểm tra ACTIVE hiện có;
  bổ sung khóa tag để kiểm tra và thay đổi trạng thái không chạy xuyên nhau.
- Reason quản trị bắt buộc 1–2000 code points sau trim, dùng giới hạn audit
  hiện có; không áp dụng riêng giới hạn 10–500 của từ chối skill evidence.

## Dữ liệu

| Entity             | Field bổ sung hoặc mới                                                                                                                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Tag                | `labelKey` unique; `createdByUserId` nullable cho legacy; `createdAt` nullable cho legacy; `updatedAt`; `version` mặc định 1                                                                                 |
| TagCreationRequest | UUID `id`; `label`; `labelKey`; `requestedByUserId`; `status` PENDING/APPROVED/REJECTED; `reviewedByUserId?`; `reviewedAt?`; `resultTagId?`; `rejectReason?`; `createdAt`; `updatedAt`; `version` mặc định 1 |

FK user/tag dùng RESTRICT. APPROVED bắt buộc reviewer/time/resultTagId và không
có rejectReason; REJECTED bắt buộc reviewer/time/reason và không có resultTagId;
PENDING không có metadata quyết định. DB CHECK giữ các invariant này, version
luôn dương. Index hàng đợi `(status,createdAt,id)`, lịch sử
`(requestedByUserId,createdAt,id)`, và partial unique pending theo owner/labelKey.

Migration kiểm tra label không hợp lệ và collision theo đúng thuật toán ứng dụng
trước khi đặt unique constraint. Có collision thì dừng, xuất danh sách id cần
xử lý; không tự merge/xóa tag hay đổi RequestTag. Backfill key/version nhưng giữ
nguyên id/label/status/liên kết. Tag legacy giữ người tạo/ngày tạo null vì chưa có
bằng chứng; `updatedAt` khởi tạo theo thời điểm migration, không giả ngày tạo cũ.
Sửa `runtime-support.prisma` và generator backrelations User, rồi regenerate
`schema.prisma`; không chỉ sửa file generated, không sửa lịch sử migration.

## API contract

Prefix `/api/v1`. Mutations cần Bearer và `Idempotency-Key`; cập nhật/quyết định
cần `expectedVersion` integer ≥ 1. Tên field input bên dưới là toàn bộ allowlist.

| Method/path                                   | Actor                   | Input chính                                      | Kết quả                             |
| --------------------------------------------- | ----------------------- | ------------------------------------------------ | ----------------------------------- |
| GET `/tags`                                   | Public                  | Giữ query hiện tại                               | 200 `{id,label}[]`, chỉ ACTIVE      |
| GET `/admin/tags`                             | ADMIN + tag:read        | `q?`, `status?`, `limit`, `cursor?`              | 200 danh mục mọi trạng thái         |
| POST `/admin/tags`                            | ADMIN + tag:create      | `label`                                          | 201 Tag ACTIVE                      |
| PATCH `/admin/tags/:tagId`                    | ADMIN + tag:update      | `label?`, `status?`, `expectedVersion`, `reason` | 200 Tag; ít nhất một field thay đổi |
| POST `/tag-requests`                          | USER + create:self      | `label`                                          | 201 request PENDING                 |
| GET `/me/tag-requests`                        | USER + read:self        | `status?`, `limit`, `cursor?`                    | 200 lịch sử của mình                |
| GET `/me/tag-requests/:requestId`             | USER + read:self        | UUID path                                        | 200 chi tiết của mình               |
| GET `/admin/tag-requests`                     | ADMIN + request:read    | `status?`, `limit`, `cursor?`                    | 200 hàng đợi/lịch sử                |
| GET `/admin/tag-requests/:requestId`          | ADMIN + request:read    | UUID path                                        | 200 chi tiết                        |
| POST `/admin/tag-requests/:requestId/approve` | ADMIN + request:approve | `expectedVersion`                                | 200 request APPROVED + resultTagId  |
| POST `/admin/tag-requests/:requestId/reject`  | ADMIN + request:reject  | `expectedVersion`, `reason`                      | 200 request REJECTED                |

Tag admin response: `{id,label,status,createdByUserId,createdAt,updatedAt,version}`.
Request response gồm các field TagCreationRequest trừ `labelKey`; không kèm
email/hồ sơ riêng tư. Dùng envelope success/message/data và meta.pagination hiện
có. Cursor request theo `createdAt DESC,id DESC`; admin tags theo `label,id`;
bind loại list, owner và filters vào cursor. List mới mặc định limit 20, tối đa
100; thiếu status ở list request nghĩa là tất cả, admin truyền PENDING cho queue.
Public `/tags` giữ nguyên q/limit/cursor và shape, không lộ request/actor metadata.

400 cho input/key/cursor sai hoặc PATCH rỗng; 401 chưa xác thực; 403 thiếu
role/quyền hoặc bị hạn chế; 404 resource không tồn tại/không sở hữu; 409 cho
trùng, `STALE_VERSION`, `TAG_REQUEST_NOT_PENDING`, `TAG_UNAVAILABLE`,
`TAG_ARCHIVED`, hoặc tái dùng idempotency key với payload khác.

## Atomicity và nghiệm thu

Approve phải commit cùng lúc tag/link, request, audit và idempotency receipt;
audit thất bại phải rollback. Hai Admin approve/reject cùng request chỉ có một
quyết định. Hai request cùng label duyệt đồng thời chỉ có một Tag; dùng unique
constraint và insert-on-conflict an toàn, retry toàn transaction khi cần qua
TransactionRunner hiện có; không catch unique rồi tiếp tục một PostgreSQL
transaction đã bị abort. Replay cùng key/body không ghi thêm audit/tag;
session/quyền hiện tại vẫn phải hợp lệ.

Audit actions mới: `TAG_CREATE`, `TAG_UPDATE`, `TAG_REQUEST_CREATE`,
`TAG_REQUEST_APPROVE`, `TAG_REQUEST_REJECT`, kèm allowlisted snapshots. Khi tạo
tag từ approve, `createdByUserId` là Admin duyệt; người đề xuất được giữ riêng.

Nghiệm thu phải chứng minh: USER không tạo trực tiếp; STAFF không review dù được
gán nhầm permission; ADMIN thiếu permission bị từ chối; request PENDING/REJECTED
không xuất hiện ở lookup; approve làm tag có thể chọn cho Learning Request;
không đổi role của người gửi; duplicate/race/replay/rollback đúng; tag ẩn không
được chọn mới và dữ liệu bài cũ vẫn đọc được; migration không mất tham chiếu.

## Điểm còn mở

Các quy tắc trong bản plan/brief đã được người dùng chấp nhận khi yêu cầu triển
khai. V1 dùng lại tag ACTIVE trùng tên và cho gửi request mới sau REJECTED.
Thông báo in-app/SSE khi duyệt/từ chối và quota/cooldown riêng cho đề xuất chưa
được yêu cầu; chưa đưa vào V1. Nếu bổ sung, cần chốt chính sách và dùng hạ tầng
notifications/application-events/rate limit đang có, không dựng kênh riêng.
