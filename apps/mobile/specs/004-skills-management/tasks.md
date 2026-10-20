# Tasks — Spec 004

Cập nhật: 2026-10-15. Implementation có ở `features/skills` và thin routes.
`[x]` trong nhóm implementation ghi nhận source/checks, không thay nghiệm thu
API thật hay thiết bị;
nghiệm thu theo [checklist](checklist.md), bằng chứng ở [validation](validation.md).

## Chuẩn bị

- [x] Đọc README/docs mobile, SRS 1.6 và source skills/profile hiện có.
- [x] Soạn spec/plan/checklist, tách scope skills khỏi discovery/request.
- [x] Ghi gap transport, detail endpoint, cap config, public catalog và verification.
- [x] Khi bắt đầu implementation, kiểm tra lại source/contract và chọn nhánh đúng scope.

## Luồng hiện tại và kiểm tra trước commit — 2026-10-15

- [x] Pipeline tối đa hai file; đợi upload đang chạy kết thúc và giữ IDs trước retry.
- [x] Tiến độ chuẩn bị/tải lên/kiểm tra/gửi request trên card; scan lâu có trạng thái riêng.
- [x] Poll bounded 48 reads; WAITING_SCAN có Kiểm tra lại, giữ IDs và chỉ submit READY.
- [x] Regression concurrency, pipeline, partial failure, scan sau 65 giây, chờ kiểm tra và HTTP 503.
- [x] Rerun 296 tests, lint/typecheck/structure, 6 tests commit scope, formatting và diff checks.
- [x] Export Web/Android/iOS; browser 5 nhóm CRUD/level và 5 kịch bản evidence đều đạt.
- [x] Xác minh root lockfile bằng pnpm 10.24.0; tài liệu active theo pnpm-only và npm lockfile được bỏ/ignore.
- [ ] Kiểm chứng luồng mới trên Android/iOS và API/scanner thật đang hoạt động.

## Transport và types

- [x] Hỗ trợ Idempotency-Key cho JSON mutation, giữ key/body qua renewal cùng phiên.
- [x] Thêm paginated result với meta mà không đổi shape caller Auth/account/avatar.
- [x] Parsers catalog/own/public skills, pagination, verification, evidence/download.
- [x] Error mappings 400/403/404/409/413/415/429/503 và unknown outcome.
- [x] Regression tests transport/session/key/meta, account và avatar.

## My Skills và forms

- [x] Feature public API và thin authenticated routes theo spec.
- [x] Own list loading/empty/error/retry/refresh/load-more; bỏ toggle archive theo quyết định 2026-10-11.
- [x] Catalog search validation, reset cursor và search race guards.
- [x] Detail lookup theo owner list chưa xóa cho cold start/ID lạ; không xem lại bản archive.
- [x] Form create/edit, Unicode length, decimal string/null và baseline draft.
- [x] UI Quản lý dạng link, nút thêm gọn, form chia nhóm và evidence chọn trước create.
- [x] Danh mục chọn/nút chi tiết hiện đại; form tạo gửi evidence cùng Lưu rồi về danh sách; partial failure giữ draft theo skillId/phiên.
- [x] Thẻ lọc Tất cả/Đã xác minh/Đang chờ xác minh/Chưa xác minh qua pagination; badge kỹ năng trên own/public self profile.
- [x] Synchronous pending lock, Hủy/Back/no-change và stale version recovery.
- [x] Idempotent create/edit/visibility/xóa qua archive, confirm/Hủy và pending conflict.

## Evidence và verification

- [x] Chọn picker/opener tương thích SDK/platform và policy evidence.
- [x] Draft 1–5 file, MIME/extension/byte checks, cancel/remove/retry.
- [x] Multipart field file, upload/status riêng, không auto replay bytes.
- [x] Poll bounded qua đổi màn hình; AppState/session cleanup và READY-only submit.
- [x] Submit batch Idempotency-Key, pending conflict và unknown outcome recovery.
- [x] History/detail phân trang, reject/revoke reasons, badge/batch/file riêng biệt.
- [x] Owner download link ngắn hạn, quyền và trạng thái file đúng.
- [x] Lưu snapshot response submit, cập nhật history/list ngay, khóa gửi khi PENDING và đọc lại khi trở về/foreground.
- [x] Preview ảnh đã gửi ở history/detail qua URL riêng tư ngắn hạn, xử lý expiry/quyền/tải lại.

## Profile và session integration

- [x] Quản lý mở My Skills; bỏ shortcut Xác minh kỹ năng riêng. Menu có Đánh giá về tôi (chưa kết nối) và Hành trình của tôi theo cập nhật spec profile.
- [x] Own profile list thật với state explicit; self-preview public list thật.
- [x] Refresh own account/counter và query liên quan sau mutation/decision refresh.
- [x] Đảm bảo public allowlist, giữ fixture boundary cho target/demo proposal.
- [x] Clear private cache/draft/poll và ignore callbacks khi logout/đổi account.

## Kiểm chứng

- [x] Đối chiếu source BE ngày 2026-10-12; cập nhật gap restore/detail và giữ phạm vi mobile.
- [x] Chuẩn hóa MIME multipart web, giữ byte và chặn tên file theo policy BE.
- [x] Lưu response create/edit/visibility vào cache trước refresh, không ghi đè version mới hoặc lộ owner metadata ra public.
- [x] History/detail gỡ snapshot PENDING khi nhận quyết định cùng batch/version mới; đọc lại badge/version/counter từ BE.
- [x] Form tạo Lưu xác nhận skill rồi về My Skills; nếu có file thì queue upload/scan READY/submit trong phiên.
- [x] Evidence failure sau save hiện trên card và toast; draft/fileIds/submit key giữ theo skillId/phiên để retry, không create trùng.
- [x] Save chưa xác nhận thành công giữ form; không dùng lỗi evidence để che lỗi create/update.
- [x] Gợi ý level: ban đầu dùng ví dụ tĩnh; amendment 2026-10-14 thay bằng description từ danh mục cấp độ của kỹ năng.
- [x] Public profile mở chi tiết kỹ năng với tên/level/mô tả/kinh nghiệm/badge, query public đúng owner và phân trang; không gọi history/evidence hoặc mount owner actions.
- [x] Hidden/archive clears public-detail cache; public lỗi/không khả dụng không fallback owner data. Hồ sơ mẫu mở chi tiết từ field public đã có.
- [x] My Skills ưu tiên lượt tạo mới nhất trong phiên qua refresh/filter/pagination; edit không đổi thứ tự tạo.
- [ ] Xếp toàn bộ dữ liệu cũ theo createdAt mới nhất, gồm sau restart: cần BE bổ sung timestamp và sort pagination (GAP-09).

- [x] Checks mobile và regression profile/Auth/account/avatar đạt.
- [x] Tests pagination/race/409/idempotency/scan/status/privacy/session.
- [ ] API thật add/edit/ẩn/hiện/archive/reopen và pagination >20.
- [ ] API thật upload → READY → submit → approve/reject/revoke → refresh/download.
- [x] Web fixtures: layout 320/375/430, form/Back, level và CRUD/evidence; native JS/Hermes export đạt.
- [ ] Android/iOS trên thiết bị: keyboard/Back/picker/chữ lớn; ghi thiết bị/evidence riêng.
- [x] Review diff đúng scope, cập nhật docs/checklist/validation theo source cuối.

## Đồng bộ Skill Level catalog — 2026-10-14

- [x] Đối chiếu read-only source/controller/DTO và amendment BE 007.
- [x] Thêm lookup nonpaginated ACTIVE levels, validate parent/ID, query theo skill/phiên.
- [x] Form chọn levelId, xóa lựa chọn khi đổi skill, loading/error/retry/empty và giữ draft.
- [x] Create/level PATCH chỉ gửi levelId; không gửi lại level khi chỉ sửa field khác, giữ lịch sử INACTIVE.
- [x] Own/public/detail hiển thị skillLevel.name; null legacy dùng nhãn cũ, không lộ nested fields ngoài allowlist.
- [x] Learning Request offered-skill/options nhận custom code/name; currentLevel không đổi.
- [x] Thêm regression catalog/custom/legacy/inactive/mutation/session và checks mobile.
- [x] Admin API thật tạo/cập nhật catalog skill/level và đọc lại level ACTIVE theo skill trên server ngày 2026-10-15.
- [ ] Nghiệm thu form User bằng API thật và trên Android/iOS với level catalog đã có.

## Tốc độ lưu kèm ảnh bằng chứng — 2026-10-14

Nhóm này ghi amendment đã hoàn thành ngày 2026-10-14. Poll một phút và khóa
theo màn hình bên dưới đã được luồng session ngày 2026-10-14 và mục hiện tại
2026-10-15 thay thế; giữ dấu hoàn thành để bảo toàn lịch sử.

- [x] Bỏ chờ scan từng file trước khi upload file tiếp theo; kiểm tra tối đa 5 file cùng lúc.
- [x] Poll khi gửi với khoảng chờ tối đa 3 giây, giữ ngân sách chờ khoảng một phút/file; scan lỗi dừng sibling waits và giữ IDs.
- [x] Create/save và Send hoàn tất sau response xác nhận, refresh reads chạy nền; không replay mutation khi tải lại lỗi.
- [x] Nút Lưu hiển thị bước tải/kiểm tra/gửi với số file hoàn tất; picker/delete/Back tiếp tục khóa trong pipeline.
- [x] Regression concurrent scans, partial failure/cancellation/READY, delayed/failed refresh và browser 1–2 ảnh/retry.
- [ ] Đo upload/scan/network thật trên Android/iOS; thời gian server scan nằm ngoài thay đổi mobile này.

## Gửi nền, trạng thái card và nén ảnh — 2026-10-14

- [x] Skill save xác nhận rồi về list; phiên sở hữu tác vụ upload/scan/submit, không dừng khi đổi màn.
- [x] Card có spinner Đang gửi bằng chứng…, Chờ duyệt sau PENDING và Gửi chưa hoàn tất + Thử lại; badge VERIFIED riêng, mở chi tiết bình thường.
- [x] Khóa theo skill ID, retry dùng IDs/key/body cũ; pause/logout/archive hủy đúng phạm vi, không callback/bytes sang phiên khác.
- [x] Ảnh >2 MB thử JPEG quality 0,9, giữ dimensions, chỉ dùng bản nhỏ hơn; fallback/Keep original, PDF/Word/small/uploaded giữ bytes.
- [x] Cài ImageManipulator/FileSystem SDK 57; root pnpm lockfile đồng bộ. Theo chuẩn tooling hiện tại, npm lockfile được bỏ và ignore.
- [ ] Nghiệm thu nén/độ rõ/EXIF trên Android/iOS và app background; API/storage/scan thật vẫn pending.
