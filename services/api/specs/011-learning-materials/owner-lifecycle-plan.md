# Material Owner Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task by task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tách ngừng chia sẻ, xóa mềm và rút duyệt; cho chủ tài liệu quản lý và đăng lại tài liệu đã ngừng mà vẫn giữ đúng quyền của người đã mua.

**Architecture:** Giữ `Material.status`, thêm dấu xóa và dấu riêng cho `ARCHIVED` cũ chưa xác minh. Owner và Staff dùng khóa hàng Material cùng `listingVersion`; các luồng mua, tải và hoàn tiền tiếp tục dựa trên quyền mua và snapshot hiện có.

**Tech Stack:** NestJS 11, TypeScript, Prisma/PostgreSQL, Node test runner, BullMQ thumbnail worker.

**Spec:** [SRS V1.6, mục 18.41 và FR-MAT-04–06](../../../../docs/SRS_SkillHub_V1.6_VietLai_DongBoNghiepVu.docx); [Spec 011, D3/D4/D5/D9](spec.md); [Spec 016, contract DELETE hiện tại](../016-material-reviews-thumbnails/contracts.md). Tám mục FE báo trong ảnh là đầu vào cho amendment này. Các quyết định API và migration bên dưới là đề xuất để review.

## Vì sao cần tách pha

- `materials.service.ts`: `archive` và `removeDraft` cùng ghi `ARCHIVED`. `listMine` loại toàn bộ `ARCHIVED`; `removeDraft` trả `replayed: true` cho mọi bản ghi `ARCHIVED` trước khi so version. Controller chưa có owner detail hay rút duyệt.
- `material.policy.ts`: hiện cho archive `DRAFT`, `PENDING_REVIEW`, `PUBLISHED`, `REJECTED` và cấm sửa `ARCHIVED`. `material-thumbnail.processor.ts` còn loại mọi `ARCHIVED` ở cả lúc bắt đầu và lúc ghi kết quả.
- `material-moderation.service.ts` đã dùng khóa Material và phiên bản. Hiện `submit` không tăng version, nên chỉ thêm `PENDING_REVIEW → DRAFT` mà không đổi version sẽ để lọt quyết định cũ sau khi owner gửi lại cùng nội dung.
- `material-catalog.service.ts` đã ưu tiên entitlement `ACTIVE` và object key trong order snapshot cho người mua; `HIDDEN` vẫn chặn. Test lifecycle hiện chỉ kiểm tra order còn tồn tại sau xóa bản nháp đã từng bán, chưa chứng minh tải đúng snapshot.
- SRS §18.41 phân biệt `ARCHIVED` với `HIDDEN` và yêu cầu giữ snapshot đã bán, nhưng không quy định xóa mềm, rút duyệt hay backfill. Spec 011 dùng `purchasedFileSnapshot` cho runtime hiện tại; không mở rộng scope sang `MaterialVersion` hay thay chính sách refund/retention.

## Global Constraints

- Scope triển khai: `services/api`. Web, Expo và Flutter là bên tiêu thụ contract; không sửa các app trong plan này. Không áp dụng dữ liệu hoặc triển khai môi trường từ plan.
- Không xóa Material vật lý, order, review/rating, entitlement, grant, ledger hay object gốc/snapshot. Không dùng `DRAFT`, loại FREE hiện tại hoặc số đơn để suy ra lịch sử mua.
- Không cho mở lại `HIDDEN`, đã xóa hoặc legacy chưa phân loại qua API owner. Không đưa các ca chưa xác minh vào danh sách owner, dù từng bán.
- Tất cả owner lookup/mutation phải kiểm tra quyền sở hữu trước khi trả trạng thái hoặc version. Lỗi cho người khác như tài liệu không tồn tại. Public search/detail/preview, mua mới và tải FREE vẫn yêu cầu trạng thái phù hợp; `HIDDEN`/quyền bị thu hồi vẫn áp dụng theo chính sách hiện tại.

## Phương án và contract đề xuất

Giữ `ARCHIVED` và thêm `deletedAt` + `legacyArchiveUnclassified` là phương án đề xuất: dùng lại enum và đường dẫn `/archive`, đồng thời cho phép khóa riêng dữ liệu không đủ bằng chứng. Thêm enum `DELETED` cũng tách được hai hành động mới nhưng kéo theo thay đổi các client parse trạng thái và vẫn không giải quyết được dữ liệu `ARCHIVED` cũ. Chỉ sửa filter list hoặc replay trước migration sẽ có nguy cơ hiện lại bản nháp đã xóa.

Các đường dẫn dưới đây dùng prefix `/api/v1/me/materials`.

| Thao tác                                                    | Điều kiện và kết quả đề xuất                                                                                                                                                                                                                                                                                                                                                 |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /?status=ARCHIVED&limit=&cursor=`                      | Trả `ARCHIVED` của owner với `deletedAt = null`, đã phân loại. Mở rộng `status` cho các trạng thái owner khác; mặc định giữ danh sách cũ (không gồm `ARCHIVED`). Giữ thứ tự `updatedAt DESC, id DESC`; phân scope cursor theo owner và filter, giữ scope cũ khi bỏ filter.                                                                                                   |
| `GET /:materialId`                                          | Trả cùng owner projection như list/create. Trả 404 nếu khác owner, thiếu bản ghi, đã xóa hoặc legacy chưa xác minh. Owner vẫn đọc được metadata của tài liệu `HIDDEN` để biết trạng thái.                                                                                                                                                                                    |
| `POST /:materialId/archive`                                 | Chỉ `PUBLISHED → ARCHIVED`, không đặt `deletedAt`. Giữ request không body để client cũ vẫn gọi được từ trạng thái hợp lệ. Trạng thái còn lại trả 409, hoặc 404 nếu row không còn trong phạm vi quản lý.                                                                                                                                                                      |
| `DELETE /:materialId?expectedListingVersion=n`              | Cho `DRAFT` và `ARCHIVED` đã xác minh; trong một transaction đặt `status=ARCHIVED`, `deletedAt=now`, tăng version và trả `{id, deleted:true, replayed:false}`. Retry đúng owner khi có `deletedAt` trả `replayed:true` dù version đã đổi; row hợp lệ nhưng version cũ trả 409. Đề xuất row không tồn tại trả 404; đây là thay đổi so với replay cũ và cần báo FE.            |
| `PATCH /:materialId`, rồi `POST /:materialId/submit`        | `PATCH` trên `ARCHIVED` còn quản lý được giữ nguyên `ARCHIVED`; có thể gửi lại trực tiếp nếu không cần sửa. `submit` nhận `DRAFT` hoặc `ARCHIVED` đã xác minh, kiểm tra file CLEAN và xác nhận quyền phân phối, chuyển `PENDING_REVIEW`; chỉ Staff duyệt mới về `PUBLISHED`. Giữ nguyên `materialId`, order và review/rating. Luồng sửa `REJECTED → DRAFT` giữ như hiện tại. |
| `POST /:materialId/withdraw` với `{expectedListingVersion}` | Owner rút `PENDING_REVIEW → DRAFT`, xóa dữ liệu quyết định trên bản ghi hiện tại (`moderationStatus=NONE`, `rejectReason`, `reviewedAt`, `reviewedByUserId`), giữ audit lịch sử. Nếu Staff thắng khóa trước hoặc FE gửi version cũ, trả 409 với `details: {currentStatus, currentListingVersion}` cho đúng owner; không ghi đè kết quả Staff.                                |

Giữ `MATERIAL_VERSION_CONFLICT` và `MATERIAL_TRANSITION_INVALID` theo nguyên nhân. Cho DELETE trạng thái sai dùng mã đề xuất `MATERIAL_DELETE_NOT_ALLOWED` thay `MATERIAL_DELETE_REQUIRES_DRAFT`, ghi rõ trong contract. `archive`, `submit`, `withdraw` và lần xóa đầu tăng `listingVersion`; `PATCH` tiếp tục tăng như hiện tại. Điều này ngăn quyết định Staff cũ sau vòng rút/gửi lại và yêu cầu FE đọc version từ response mới. Chưa cần thay chữ ký `archive`/`submit` hoặc quy tắc edit `PENDING_REVIEW` hiện tại của API cho lần triển khai này.

## Review Focus

- Không có bằng chứng cho legacy, kể cả có order hoặc thumbnail `SUPERSEDED`: không hiện lại, không báo xóa thành công (Task 1–2).
- Rút duyệt rồi gửi lại không sửa gì: Staff dùng version cũ vẫn bị từ chối; cả hai thứ tự thắng khóa đều kiểm thử (Task 3).
- Archived hợp lệ đi qua nhiều trang: cursor không dùng lại cho filter/owner khác; tài liệu xóa giữa các trang vẫn loại (Task 2).
- Buyer cũ gặp file/giá/loại truy cập mới hoặc owner đã xóa: cấp đúng snapshot và giữ nguyên ref của order; người chưa mua không thể lấy file (Task 4).
- Cover job đang chạy khi owner ngừng chia sẻ/xóa: archive còn quản lý không hủy thumbnail; tombstone không được chuyển thumbnail về READY (Task 4).

### Task 1: Schema và dữ liệu `ARCHIVED` cũ — mục 1, 8

**Files:** `services/api/scripts/generate-runtime-schema.mjs`, `services/api/prisma/schema.prisma` (regenerate), migration `services/api/prisma/migrations/20261117000000_material_owner_lifecycle/migration.sql` (kiểm tra thứ tự khi triển khai), `services/api/test/materials/schema.test.mjs`. Tạo `services/api/scripts/reconcile-material-archives.mjs` nếu có nguồn bằng chứng để nhập; mặc định chạy dry run.

**Produces:** Prisma `Material.deletedAt: Date | null`, `Material.legacyArchiveUnclassified: boolean`. Check SQL: có `deleted_at` hoặc `legacy_archive_unclassified=true` chỉ khi `status='ARCHIVED'`; không cho hai dấu cùng tồn tại.

- [x] Tạo fixture nâng cấp từ schema trước migration với bản nháp đã xóa, tài liệu đã ngừng chia sẻ, tài liệu `ARCHIVED` có đơn mua và tài liệu `PUBLISHED`. Các dòng `ARCHIVED` thiếu bằng chứng bắt đầu ở `legacyArchiveUnclassified=true`, `deletedAt=null`. Fixture cũng kiểm tra các tổ hợp marker mà constraint từ chối.
- [x] Thêm migration và runtime generator. Migration gắn marker cho `ARCHIVED` cũ, giữ nguyên `updatedAt` và để marker mặc định `false` cho bản ghi mới.
- [x] Xác thực Prisma schema đã sinh và chạy fixture nâng cấp trên PostgreSQL 18 test. Fixture kiểm tra bản ghi Material và order snapshot trước/sau. Bộ Materials qua 17 unit test và 71 integration test.

Kiểm kê trước migration bằng tài khoản chỉ đọc. Sau khi dừng writer cũ, lưu số đếm để đối chiếu với `unclassified` ngay sau migration. Giá trị này cần khớp trước khi áp mapping đã duyệt.

```sql
-- Trước migration
SELECT count(*) AS legacy_archived FROM materials WHERE status = 'ARCHIVED';

-- Sau migration
SELECT
  count(*) FILTER (WHERE legacy_archive_unclassified) AS unclassified,
  count(*) FILTER (WHERE deleted_at IS NOT NULL) AS deleted,
  count(*) FILTER (
    WHERE deleted_at IS NULL AND NOT legacy_archive_unclassified
  ) AS unshared
FROM materials
WHERE status = 'ARCHIVED';
```

Gộp migration vào đợt rollout cùng API và worker đã cập nhật ở Task 4. Writer cũ ghi `ARCHIVED` mà không ghi dấu xóa, nên cần dừng writer cũ trước khi áp migration.

Hai đường owner cũ không ghi audit phân loại ở service. Mapping cần bằng chứng cấp thao tác được đối chiếu với material ID và kết quả. `moderationStatus`, review, cover, đơn mua và việc thiếu log đều không đủ làm bằng chứng. Giữ marker cho các ca chưa xác minh.

Khi có mapping đã duyệt, dùng điều kiện `status='ARCHIVED' AND legacy_archive_unclassified AND deleted_at IS NULL` để việc chạy lại bỏ qua các bản ghi đã xử lý. Với `UNSHARED`, bỏ marker. Với `DELETED`, bỏ marker và đặt thời điểm theo bằng chứng, hoặc ghi rõ thời điểm đối soát nếu không có thời điểm lịch sử. Ghi nhận nguồn và tổng số ca xác minh, chưa rõ, bỏ qua và xung đột.

### Task 2: Owner API, archive và xóa mềm — mục 1, 2, 3, 6

**Files:** `services/api/src/modules/materials/{domain/material.policy.ts,application/services/materials.service.ts,presentation/http/my-materials.controller.ts,presentation/http/materials.dto.ts}`; `services/api/test/materials/{policy,lifecycle}.test.mjs`; thêm `services/api/test/materials/owner-lifecycle-http.test.mjs` vào `test:materials` trong `services/api/package.json`.

**Produces:** `OwnerMaterialListQueryDto extends ListPageQuery`, `MaterialsService.getMine(principal,id)`, `MaterialsService.remove(principal,id,expectedListingVersion)`, predicate dùng cho owner list/detail/mutation: `deletedAt === null && !legacyArchiveUnclassified`. DELETE dùng DTO hiện có; `assertArchivable` chỉ chấp nhận `PUBLISHED`.

- [x] Kiểm tra archive chỉ nhận `PUBLISHED`, list theo `ARCHIVED`, thứ tự theo ID khi trùng `updatedAt`, kiểm tra cursor theo filter và owner, và validation của API HTTP.
- [x] Kiểm tra DELETE cho `DRAFT` và `ARCHIVED`, gồm version sai, hai lần xóa đồng thời, khác owner, UUID thiếu và dữ liệu cũ chưa phân loại. Kiểm tra timestamp xóa, version, list và detail.
- [x] Dùng `ownerId` trong truy vấn list và detail. Mutation dùng chung row lock, kiểm quyền trước khi trả replay hoặc version, và chuyển thumbnail sang `SUPERSEDED` cùng transaction xóa. Cập nhật Swagger.
- [x] Build, lint, typecheck, 19 unit/HTTP test và 72 integration test PostgreSQL 18 đã qua. Cập nhật [spec 011](spec.md), [contract 016](../016-material-reviews-thumbnails/contracts.md) và `services/api/README.md` cho FE.

### Task 3: Đăng lại, rút duyệt và chống quyết định Staff cũ — mục 4, 5

**Files:** `services/api/src/modules/materials/{domain/material.policy.ts,application/services/materials.service.ts,application/services/material-moderation.service.ts,presentation/http/materials.dto.ts,presentation/http/my-materials.controller.ts}`, `services/api/src/shared/http/http-exception.filter.ts`; `services/api/test/materials/{lifecycle,owner-lifecycle-http}.test.mjs`.

**Consumes/produces:** Dùng owner guard từ Task 2; thêm `WithdrawMaterialDto` và `MaterialsService.withdraw(principal,id,expectedListingVersion)`; `statusAfterEdit('ARCHIVED')` trả `ARCHIVED`, riêng `submit` đổi sang `PENDING_REVIEW`. Chỉ thêm hai field lỗi đã nêu qua allowlist `publicErrorDetails` cho các xung đột lifecycle owner, sau xác thực ownership.

- [x] Kiểm thử sửa và gửi duyệt lại cùng ID, gửi lại khi không cần sửa, quyền chủ sở hữu, trạng thái bị ẩn, dữ liệu cũ chưa phân loại và bản ghi đã xóa. Staff phải duyệt version mới trước khi mở public và mua.
- [x] Kiểm thử tranh khóa PostgreSQL khi Staff duyệt hoặc từ chối trước và khi owner rút trước. Kiểm tra quyết định Staff cũ sau khi gửi lại, audit/outbox và chi tiết lỗi HTTP theo quyền chủ sở hữu.
- [x] Dùng row lock để kiểm tra version và trạng thái trong transaction. Submit và withdraw tăng version, cập nhật moderation summary và đọc projection trước khi nhả khóa. Submit/approve/unhide kiểm tra cả `StoredFile` hiện tại.
- [x] Build, lint, typecheck, 20 unit/HTTP test Materials, 74 integration test PostgreSQL 18 và 10 test hồi quy bộ lọc lỗi HTTP đã qua. Spec có ví dụ thành công và xung đột cho FE.

### Task 4: Hồi quy người mua, thumbnail và rollout — mục 4, 7, 8

**Files:** `services/api/test/materials/{access,lifecycle,purchase,favorites-orders,cover-lifecycle,thumbnails}.test.mjs`, `services/api/src/modules/materials/infrastructure/jobs/material-thumbnail.processor.ts`; đối chiếu `material-catalog.service.ts`, `material-purchase.service.ts`, moderator queue và view trước khi sửa.

- [x] Kiểm thử qua PostgreSQL với mua tệp A, ngừng chia sẻ, thay tệp B, gửi duyệt, rút duyệt và xóa từ `DRAFT`. Thêm ca Staff duyệt đăng lại với B và xóa từ `ARCHIVED`. Kiểm tra URL tải, entitlement, order, review, rating và ledger. Chụp mốc lịch sử sau lần tải đầu vì lần đó ghi `consumedAt` theo chính sách hoàn tiền.
- [x] Chủ tài liệu thông thường nhận 404 nếu tải tệp của tài liệu đã xóa hoặc tài liệu cũ chưa phân loại. Buyer và Staff tiếp tục đi qua các nhánh quyền riêng. Kiểm thử lại `HIDDEN`, thu hồi entitlement, refund và retry mua.
- [x] Worker xử lý thumbnail của `ARCHIVED` còn quản lý được. Kiểm thử xóa trước lúc nhận việc và xóa trong lúc tạo ảnh. Khi xác minh một tài liệu `ARCHIVED` cũ có thumbnail `SUPERSEDED`, owner thấy placeholder và có thể tải cover mới để tạo thumbnail mới.
- [x] Prisma validate, Nest build, lint, typecheck, 20 test unit/HTTP Materials, 77 integration test PostgreSQL 18 và 10 test hồi quy HTTP dùng chung đã qua. Swagger và smoke `POST /archive` body rỗng được kiểm tra trong bộ HTTP. Review độc lập đã rà đủ bốn task và ca test được sửa theo phát hiện của reviewer.
- [ ] Rollout dự kiến: dry run kiểm kê → thống nhất FE về hành động theo trạng thái, lỗi DELETE và version mới → dừng writer/API/worker đời cũ → áp migration → bật API/worker mới và smoke archived/withdraw/buyer → áp mapping legacy đã xác minh sau review. Không chạy writer đời cũ với lifecycle mới. Khi có lỗi, ngừng mutation và sửa tiến; không rollback bằng cách xóa marker hay cấp lại quyền mua. Đối soát số row legacy còn treo và mẫu tải A trước/sau.

## Quyết định cần chốt trước triển khai

1. Legacy: dùng phương án bảo thủ là giữ ngoài danh sách quản lý cho tới khi có bằng chứng và người đầu mối duyệt mapping. Nếu dữ liệu lịch sử không đủ, cần chốt quy trình đối soát các ca owner cần lấy lại tài liệu; không tự đoán.
2. Handoff FE: xác nhận đổi DELETE UUID không tồn tại sang 404 và mã `MATERIAL_DELETE_NOT_ALLOWED`; xác nhận màn hình mới đọc list `status=ARCHIVED`, gọi detail/withdraw và dùng version mới từ response. Web/Expo/Flutter hiện có nơi gọi archive từ nhiều trạng thái hoặc chặn edit `ARCHIVED`, nên cần phối hợp thời điểm đổi contract.

**Coverage:** 1–3 ở Task 1–2, 4 ở Task 3–4, 5 ở Task 3, 6 ở Task 2, 7 ở Task 4 và 8 ở Task 1 cùng rollout Task 4.
