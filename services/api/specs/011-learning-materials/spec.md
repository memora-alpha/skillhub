# 011 — Learning Materials (SH-115 → SH-119)

Nguồn: task sheet SH-115..SH-119, SRS 1.6 (FR-MAT-01..06, BR-42..44, AC-21/22, §18.41),
logical ERD v3 (`docs/SkillHub_Logical_Data_Model_v3.md`) và schema runtime
`prisma/schema.prisma` (Material, MaterialOrder, MaterialEntitlement đã có).

## Quyết định đã chốt

| #   | Nội dung                                                                                                                                                                                                                                                                           | Nguồn                   |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| D1  | Mọi tài liệu submit vào `PENDING_REVIEW`; Staff/Admin duyệt tay → `PUBLISHED` hoặc `REJECTED` (bắt buộc reason).                                                                                                                                                                   | User 2026-10-21         |
| D2  | Phí bán PAID = **5%** (`feeBps: 500`), seller nhận gross − fee, fee làm tròn xuống 0.01 Credit. Seed `FeePolicyVersion` MATERIAL_PAID v1 APPROVED; code đọc policy động.                                                                                                           | User 2026-10-21 (OP-14) |
| D3  | Owner sửa tài liệu `PUBLISHED` (file/giá/nội dung) → tăng `listingVersion` và về `PENDING_REVIEW`. `REJECTED` sửa → `DRAFT`.                                                                                                                                                       | User 2026-10-21         |
| D4  | `HIDDEN` chặn mua mới và chặn tải với mọi người trừ owner/moderator. Buyer được refund gross trong 24 giờ sau purchase nếu chưa được cấp signed download URL; refund chỉ chạy tự động khi seller còn đủ net trong Available, thiếu thì cần Admin xử lý. Refund revoke entitlement. | User 2026-10-21         |
| D5  | Không có MaterialVersion. Material giữ file hiện tại; MaterialOrder lưu `purchasedFileSnapshot`. Buyer tải đúng file đã mua; object cũ không bị xóa.                                                                                                                               | ERD v3                  |
| D6  | Phân loại chỉ bằng `skillId`; không có tag cho material.                                                                                                                                                                                                                           | ERD v3 (bỏ MaterialTag) |
| D7  | FREE không tạo entitlement/ledger; tải FREE chỉ cần đăng nhập + `PUBLISHED`.                                                                                                                                                                                                       | ERD v3, ponytail        |
| D8  | Preview = metadata (title, description, skill, giá, MIME, size). Không sinh file preview.                                                                                                                                                                                          | FR-MAT-03 tối thiểu     |
| D9  | `ARCHIVED` (owner ngừng phân phối) chặn mua mới và tải FREE; buyer đã mua (entitlement ACTIVE) vẫn tải file đã mua kể cả khi listing sau đó đổi sang FREE hoặc quay lại `PENDING_REVIEW`; chỉ `HIDDEN` chặn họ (D4).                                                               | Suy ra từ BR-43         |

## State machine

```
DRAFT --submit--> PENDING_REVIEW --approve--> PUBLISHED
                       |  \--reject(reason)--> REJECTED --edit--> DRAFT
PUBLISHED --edit--> PENDING_REVIEW
PUBLISHED|PENDING_REVIEW --hide(reason)--> HIDDEN --unhide(reason)--> PUBLISHED
DRAFT|PENDING_REVIEW|PUBLISHED|REJECTED --archive--> ARCHIVED
```

Submit/approve/unhide yêu cầu file đã gắn, `scanStatus=CLEAN`, `distributionRightsConfirmedAt` có giá trị.

## HTTP API (`/api/v1`)

| Method | Path                           | Ai        | Mô tả                                                                                                                         |
| ------ | ------------------------------ | --------- | ----------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/materials`                   | public    | Search PUBLISHED: `q`, `skillId`, `accessType`, `page`, `limit≤50`                                                            |
| GET    | `/materials/:id`               | public    | Metadata/preview của PUBLISHED; không có storageKey                                                                           |
| POST   | `/me/materials/files`          | owner     | Upload multipart (purpose MATERIAL, ≤20MB, pdf/docx/pptx/xlsx) → QUARANTINED                                                  |
| GET    | `/me/materials/files/:fileId`  | owner     | Trạng thái scan                                                                                                               |
| GET    | `/me/materials`                | owner     | Tài liệu của tôi (mọi trạng thái)                                                                                             |
| POST   | `/me/materials`                | owner     | Tạo DRAFT (fileId tùy chọn, `distributionRightsConfirmed: true`)                                                              |
| PATCH  | `/me/materials/:id`            | owner     | Sửa, bắt buộc `expectedListingVersion`                                                                                        |
| POST   | `/me/materials/:id/submit`     | owner     | DRAFT → PENDING_REVIEW                                                                                                        |
| POST   | `/me/materials/:id/archive`    | owner     | → ARCHIVED                                                                                                                    |
| GET    | `/materials/:id/download`      | user      | Authorize rồi trả signed URL ngắn hạn                                                                                         |
| POST   | `/materials/:id/purchase`      | user      | Header `Idempotency-Key`; body `expectedListingVersion`; 201 mới / 200 replay                                                 |
| GET    | `/me/material-orders`          | user      | Đơn đã mua                                                                                                                    |
| POST   | `/materials/:id/reports`       | user      | Report MATERIAL (kèm relatedOrderId nếu đã mua)                                                                               |
| GET    | `/staff/materials`             | moderator | Queue theo `status` (mặc định PENDING_REVIEW; không nhận DRAFT)                                                               |
| POST   | `/staff/materials/:id/:action` | moderator | `approve` / `reject` / `hide` / `unhide`, body `expectedListingVersion` + `reason`; không tự approve/unhide tài liệu của mình |

Report material được xử lý tiếp bằng queue `/reports/staff/*` sẵn có.

## Quyền tải (mỗi lần tải đều authorize ở backend)

| Người gọi                                                | Điều kiện                                                                                                 | File                                                        |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Owner hoặc moderator (`material:moderate` + STAFF/ADMIN) | mọi trạng thái                                                                                            | file hiện tại                                               |
| User, FREE                                               | `PUBLISHED`                                                                                               | file hiện tại                                               |
| User, PAID                                               | entitlement ACTIVE và trạng thái khác `HIDDEN` (kể cả khi listing đã chuyển FREE hoặc đang chờ duyệt lại) | `purchasedFileSnapshot.storageKey`                          |
| Còn lại                                                  | —                                                                                                         | 403 `MATERIAL_ACCESS_DENIED` / 409 `MATERIAL_NOT_PUBLISHED` |

StoredFile tương ứng phải đang READY + CLEAN tại thời điểm tải; URL do `FileStorageService.issueDownload` cấp với TTL `storage.downloadTtlSeconds`.

## Mua PAID (một transaction SERIALIZABLE)

1. Replay theo `idempotencyKey` (scope theo buyer) → trả lại order cũ.
2. `SELECT … FOR UPDATE` material.
3. Đã có entitlement ACTIVE → trả order cũ, không trừ tiền (BR-43).
4. Chặn tự mua, FREE, chưa PUBLISHED/CLEAN; `listingVersion` ≠ `expectedListingVersion` → 409 `MATERIAL_PRICE_CHANGED`.
5. Policy MATERIAL_PAID APPROVED và đã hiệu lực, nếu không có → 409 `MATERIAL_FEE_POLICY_UNAVAILABLE`.
6. Credit: khóa ví buyer/seller theo thứ tự UUID; buyer thiếu Available → 409 `INSUFFICIENT_AVAILABLE_CREDIT`.
   Ledger trong một CreditOperation `MATERIAL_PURCHASE` / `MATERIAL_ORDER`:
   - buyer `MATERIAL_PURCHASE` −net, buyer `PLATFORM_FEE` −fee (bỏ nếu fee=0), seller `MATERIAL_SALE` +net.
   - Lot của buyer bị tiêu (BONUS trước, FIFO); seller nhận lot `EARNED`.
7. Tạo MaterialOrder `SUCCESS` (snapshot file/giá/fee policy), MaterialEntitlement `PURCHASE`/`ACTIVE`, audit `MATERIAL_PURCHASE`, outbox `material.purchased`.

Lỗi ở bất kỳ bước nào sẽ rollback toàn bộ: không trừ tiền, không cấp quyền.

## Quyền, audit, sự kiện

- Permissions: `material:create:self` (USER/STAFF/ADMIN), `material:access` (USER/STAFF/ADMIN), `material:moderate` (STAFF/ADMIN). Cần chạy lại `identity:seed` khi rollout.
- Audit: `MATERIAL_MODERATE` (before/after status + listingVersion, reason bắt buộc), `MATERIAL_PURCHASE`.
- Outbox: `material.moderated` (→ owner) và `material.purchased` (→ buyer và seller) được gửi thành notification IN_APP qua `MaterialNotificationHandler`. Report MATERIAL không ghi outbox (queue Staff đọc DB). Template thông báo chi tiết để sau (SH-110).

## Ràng buộc DB (migration `20261021000000_material_constraints`)

FREE ⇔ price=0, PAID ⇔ price>0; độ dài title/description; PUBLISHED phải có file CLEAN và đã xác nhận quyền phân phối;
order: buyer ≠ seller, gross = fee + net, status SUCCESS; entitlement: status ACTIVE/REVOKED, PURCHASE ⇔ có sourceOrderId.

## Lỗi

`MATERIAL_NOT_FOUND` 404, `MATERIAL_NOT_PUBLISHED` 409, `MATERIAL_ACCESS_DENIED` 403, `MATERIAL_PRICE_CHANGED` 409,
`MATERIAL_PRICE_INVALID` 400, `MATERIAL_TEXT_INVALID` 400, `MATERIAL_SKILL_INVALID` 400, `MATERIAL_FILE_REQUIRED` 409,
`MATERIAL_RIGHTS_CONFIRMATION_REQUIRED` 400, `MATERIAL_NOT_EDITABLE` 409, `MATERIAL_TRANSITION_INVALID` 409,
`MATERIAL_VERSION_CONFLICT` 409, `MATERIAL_SELF_PURCHASE` 409, `MATERIAL_NOT_PAID` 409,
`MATERIAL_FEE_POLICY_UNAVAILABLE` 409, `IDEMPOTENCY_KEY_REQUIRED` 400, `IDEMPOTENCY_KEY_REUSED` 409,
`MATERIAL_REASON_REQUIRED` 400, `ACTIVE_MATERIAL_REPORT_EXISTS` 409, `MATERIAL_PERMISSION_REQUIRED` 403,
`STAFF_ACCESS_REQUIRED` 403, `MATERIAL_SELF_REVIEW_FORBIDDEN` 403, `INVALID_MATERIAL_ACTION` 400,
`MATERIAL_FILE_NOT_FOUND` 404, `CREDIT_PROVENANCE_REVIEW_REQUIRED` 409 (ví buyer/seller còn số dư legacy chưa truy vết). Lỗi file dùng mã của storage (`FILE_TOO_LARGE` 413, `FILE_FORMAT_*` 415).

## Ngoài phạm vi / còn mở

- Admin xử lý refund khi seller không còn đủ net trong Available vẫn đi qua dispute/Credit adjustment flow; tự động hoàn tiền không được phép tạo số dư âm.
- Buyer có được nhận file mới khi owner thay file không (hiện tại: không).
- Retention object đã bán sau khi ARCHIVED.
- Tag cho material, file preview, giao diện cấu hình fee (SH-105), template notification (SH-110).
