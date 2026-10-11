# Tasks — Spec 004

Cập nhật: 2026-10-11. Implementation có ở `features/skills` và thin routes.
`[x]` trong nhóm implementation ghi nhận source/checks, không thay nghiệm thu
API thật hay thiết bị;
nghiệm thu theo [checklist](checklist.md), bằng chứng ở [validation](validation.md).

## Chuẩn bị

- [x] Đọc README/docs mobile, SRS 1.6 và source skills/profile hiện có.
- [x] Soạn spec/plan/checklist, tách scope skills khỏi discovery/request.
- [x] Ghi gap transport, detail endpoint, cap config, public catalog và verification.
- [x] Khi bắt đầu implementation, kiểm tra lại source/contract và chọn nhánh đúng scope.

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
- [x] Danh mục chọn/nút chi tiết hiện đại; lưu thành công quay về danh sách và giữ draft evidence theo skillId/phiên.
- [x] Thẻ lọc Tất cả/Đã xác minh/Đang chờ xác minh/Chưa xác minh qua pagination; badge kỹ năng trên own/public self profile.
- [x] Synchronous pending lock, Hủy/Back/no-change và stale version recovery.
- [x] Idempotent create/edit/visibility/xóa qua archive, confirm/Hủy và pending conflict.

## Evidence và verification

- [x] Chọn picker/opener tương thích SDK/platform và policy evidence.
- [x] Draft 1–5 file, MIME/extension/byte checks, cancel/remove/retry.
- [x] Multipart field file, upload/status riêng, không auto replay bytes.
- [x] Poll bounded/focus/AppState/session cleanup, READY-only submit.
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

- [x] Checks mobile và regression profile/Auth/account/avatar đạt.
- [x] Tests pagination/race/409/idempotency/scan/status/privacy/session.
- [ ] API thật add/edit/ẩn/hiện/archive/reopen và pagination >20.
- [ ] API thật upload → READY → submit → approve/reject/revoke → refresh/download.
- [ ] Android/iOS/web, keyboard/Back/picker/chữ lớn; ghi thiết bị/evidence riêng.
- [x] Review diff đúng scope, cập nhật docs/checklist/validation theo source cuối.
