# Quickstart and acceptance — planned

Đây là hướng dẫn kiểm chứng sau implementation, endpoints/scripts mới chưa tồn tại. Không tự deploy DB ứng dụng để thử plan.

## Setup

Từ workspace root dùng `pnpm install`; config API theo `.env.example` và existing README. PostgreSQL test disposable, S3 private test bucket, Redis/BullMQ, ClamAV test phải riêng dữ liệu ứng dụng. Không commit credentials. Apply migrations vào schema test, seed role permissions/config idempotent; bootstrap test Admin theo identity guide.

Giới hạn evidence10.000.000 bytes/file; cấu hình thấp hơn được phép, không tăng EVIDENCE vượt ceiling. DownloadTTL mặc định120s theo current policy.

## Demonstration

1. Admin có permission tạo Skill ACTIVE; tên tương đương chuẩn hóa tạo lần nữa nhận409. Staff không có permission catalog bị403.
2. Hai User ACTIVE: owner thêm skill level INTERMEDIATE,description20–1500; duplicate409; người khác PATCH404. Ẩn thì biến khỏi search; profile không lộ evidence/email.
3. Owner upload PDF hợp lệ, poll QUARANTINED/SCANNING→READY. Upload max10.000.000 pass nếu format valid; thêm1 byte413; spoofed MIME415, infected không READY.
4. Submit1–5 fileId READY nhận PENDING; second pending409; other-owner/wrong-purpose files404/409. Staff queue/detail/download cần quyền current.
5. Approve ghi reviewer/time, VERIFIED, count tăng, audit/outbox/notification đúng một lần; dùng lại key cùng body không tạo duplicate.
6. Gửi batch mới: badge vẫn VERIFIED. Reject lý do10–500, owner thấy reason; bằng cũ vẫn APPROVED. Revoke bằng cuối ghi reason/audit, badge tính lại và count giảm.
7. Archive PENDING409; quyết định xong archive giữ history, search không hiện; User có thể tạo bản mới cùng skill nếu catalog ACTIVE.
8. Đồng thời approve/reject và create-vs-deactivate; chỉ một outcome hợp lệ, không partial writes. Audit/outbox lỗi rollback cả badge/count. Cleanup orphan đồng thời attach không xóa file đã bind.

## Verification commands

Existing focused checks: `pnpm --filter api lint`, `pnpm --filter api check-types`, `pnpm --filter api build`, `pnpm --filter api test:identity`, `pnpm --filter api test:runtime-v3`.

Sau implementation mới thêm/chạy `pnpm --filter api test:skills`, `test:skills:integration`, `test:skills:performance`; existing RBAC/files/audit/consistency suites bị ảnh hưởng phải pass. Integration test thiếu env fail rõ hoặc ghi Pending, không báo skip là pass.

## Evidence to record

`validation.md` sau implementation ghi versions/schema/environment, test counts, acceptance outcomes, migration fresh/upgrade, permission negatives, file bytes+MIME+real scan/S3, rollback/concurrency/replay, event recovery và search workload p95. Chưa có runtime evidence trong lượt plan; production TLS/storage/scan/migration deployment vẫn là release gates.
