# Tag API — cách dùng và rollout

Triển khai trong module `skills`. Các route dùng prefix `/api/v1`; Swagger ở
`/api/docs` trong development/test. [Spec](spec.md) · [Validation](validation.md).

## USER đề xuất tag

`POST /tag-requests`, Bearer USER và một `Idempotency-Key` mới:

```json
{ "label": "Rust" }
```

Response 201 nằm trong `data`, có `id`, `status: "PENDING"` và `version: 1`.
Chưa có tag chính thức để chọn. Xem lịch sử tại `GET /me/tag-requests` và chi tiết
tại `GET /me/tag-requests/{requestId}`; không đọc được request của người khác.

## ADMIN quản lý và duyệt

- `GET /admin/tag-requests?status=PENDING`: hàng đợi; bỏ status để xem mọi trạng thái.
- `POST /admin/tag-requests/{requestId}/approve`: body `{"expectedVersion":1}`.
- `POST /admin/tag-requests/{requestId}/reject`: body
  `{"expectedVersion":1,"reason":"Tên này chưa mô tả đúng chủ đề"}`.
- `GET /admin/tags`: danh mục, hỗ trợ q/status/cursor/limit.
- `POST /admin/tags`: body `{"label":"Rust"}`, tạo trực tiếp ACTIVE.
- `PATCH /admin/tags/{tagId}`: ví dụ
  `{"status":"INACTIVE","expectedVersion":1,"reason":"Ẩn tag trùng chủ đề"}`.

Các API trên yêu cầu ADMIN **và** permission tương ứng. Mutations cần
`Idempotency-Key`. Client không truyền owner/reviewer/creator/status của đề xuất.
Approve trả request APPROVED và `resultTagId`; có thể liên kết tag ACTIVE đã có.
USER giữ nguyên role. STAFF không có quyền tag mặc định.

Tên được trim/NFC/gộp khoảng trắng, dài 1–80 code points; giữ dấu và ký hiệu.
Control characters bị từ chối. Reason bắt buộc 1–2000 code points sau trim.
Version cũ, tag trùng, quyết định lặp hoặc tag không khả dụng trả 409. Replay cùng
key/payload không thêm tag/audit; quyền và phiên vẫn được kiểm tra lại.

`GET /tags` vẫn public, chỉ trả ACTIVE `{id,label}` với contract cũ.
Tag ẩn không dùng cho selection mới; liên kết và nội dung lịch sử vẫn đọc được.
Request đã bị từ chối được giữ nguyên; USER có thể gửi request mới cho tên đó.

## Kiểm thử từ root monorepo

```powershell
pnpm --filter api test:tags
# TEST_DATABASE_URL phải trỏ tới PostgreSQL biệt lập, không dùng database đang phục vụ.
pnpm --filter api test:tags:integration
```

Integration tạo schema riêng cho từng fixture, chạy migration, HTTP, phân quyền,
idempotency, rollback và các race create/edit/publish Learning Request với hide.
Script từ chối chạy khi thiếu TEST_DATABASE_URL.

## Rollout database hiện hữu

1. Build artifact mới bằng `pnpm --filter api build`. Dừng tag writers trong cửa
   sổ bảo trì; cấu hình DATABASE_URL của đúng môi trường cần nâng cấp.
2. `pnpm --filter api tags:preflight`: kiểm tra tên legacy, collision và khác biệt
   chuẩn hóa giữa Node/PostgreSQL. Có lỗi thì xử lý từng id được báo theo quyết
   định riêng; script chỉ đọc, không tự merge/xóa/sửa dữ liệu.
3. `pnpm --filter api db:deploy` áp dụng migration additive
   `20261015000000_tag_creation_requests`. Giữ nguyên id/label/status/RequestTag;
   tag legacy có creator/createdAt null vì chưa có dữ liệu nguồn.
4. `pnpm --filter api tags:preflight --verify`: so sánh key đã lưu với policy
   Node. Chỉ tiếp tục nếu pass. Timestamp `updatedAt` của legacy được khởi tạo
   bằng thời điểm migration, không phải bằng chứng về ngày tạo ban đầu.
5. `pnpm --filter api identity:seed` thêm quyền/default grants idempotent, rồi
   đưa API artifact mới vào phục vụ. Smoke USER submit → ADMIN approve/reject →
   lookup → Learning Request và kiểm tra audit trước khi mở lại writers.

Với database trống chưa có bảng tags, chạy migrations trước rồi verify và seed.
Không sửa migration đã áp dụng hoặc drop bảng/metadata để quay lui. Bản ghi đề
xuất, audit và liên kết cũ phải được giữ lại khi xử lý sự cố triển khai.

Các kiểm tra trong [validation](validation.md) chỉ chứng minh môi trường local
biệt lập. Migration/seed trên môi trường dùng chung và legacy data thực tế vẫn
là bước rollout riêng, chưa được chạy trong task này.
