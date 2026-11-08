# Implementation — backend worktrees

Ngày bắt đầu: 2026-11-08. Base: dev tại 30d9221d (PR #84).
Không thay đổi cơ chế uy tín do thành viên khác phụ trách. Đã commit/push và mở PR #85–#89,
chưa áp migration vào database và chưa triển khai frontend.

Worktree root: thư mục cục bộ riêng của developer.

| Branch                  | Thư mục                     | Phạm vi backend                                                                              |
| ----------------------- | --------------------------- | -------------------------------------------------------------------------------------------- |
| feat/staff-access       | skillhub-staff-access       | Staff kế thừa quyền tham gia; override quyền vận hành; Admin duyệt kỹ năng Staff.            |
| feat/report-support     | skillhub-report-support     | Nhóm report, severity, quyết định nhóm, luồng nhắn tin/evidence riêng từng bên.              |
| feat/path-overview      | skillhub-path-overview      | Projection theo viewer, card/detail/settlement và summary case participant.                  |
| feat/public-reviews     | skillhub-public-reviews     | Review công khai cũ/mới, summary profile, danh sách sent/received.                           |
| feat/admin-transactions | skillhub-admin-transactions | Admin đọc ledger/operation/wallet/Payment và đối soát database; không có command thay số dư. |

Các branch đã push và mở PR vào dev. Merge #85 → #86 → #87 → #88 → #89
bằng Create a merge commit; chưa merge hoặc deploy. Khi ghép cần
giữ cả các phần bổ sung trong identity.module, reports.module, permission.catalog,
seedRoles, runtime schema generator và schema; không dùng một bản ghi đè bản khác.
Migration mới có thứ tự:

1. 20261108000000_staff_permissions.
2. 20261108010000_admin_finance_reads.
3. 20261108020000_report_support.

Chưa chạy migration; cần PostgreSQL test riêng và bản ghép các branch để kiểm
tra SQL/concurrency/rollback trước rollout. Docker daemon hiện chưa chạy;
không dùng database ứng dụng thay cho database integration test.

Các quyết định đã chốt trong lượt implementation:

- Cả review cũ và mới được đọc công khai trong phạm vi thành viên đăng nhập.
- Trao đổi case riêng theo party; không có phòng chung giữa các bên.
- Quản trị giao dịch chỉ tra cứu/đối soát trước, chưa adjustment/reversal độc lập.
- Các quyền report mới chỉ seed cho Admin; Admin cấp riêng cho Staff qua override.
  Catalog override chỉ trả mã đã cài đặt. Khi ghép cần áp migration report trước
  khi thử cấp các quyền group/classify/communicate.

Trạng thái: bản đầu backend đang kiểm chứng. Không coi tài liệu này là xác nhận
toàn bộ plan đã hoàn tất. FE, kiểm thử database/Mongo thật, kiểm tra ghép branch,
recovery/cleanup message draft và review policy chi tiết còn phải theo dõi.

Kết quả trên từng worktree riêng:

| Nhóm               | TypeScript / build / ESLint | Test đã chạy                                         |
| ------------------ | --------------------------- | ---------------------------------------------------- |
| Staff access       | Đạt                         | 22/22, gồm unit và HTTP đăng ký/role.                |
| Report support     | Đạt                         | 22/22, gồm group/thread và regression phase3.        |
| Path overview      | Đạt                         | 11/11, gồm projection và HTTP/Swagger hiện hữu.      |
| Public reviews     | Đạt                         | 4/4 về thống kê, cursor, quyền và allowlist.         |
| Admin transactions | Đạt                         | 5/5 về quyền, cursor, serialization và đọc/đối soát. |

Prisma schema của ba nhánh có migration đã generate/validate; generator giữ
các model/index mới qua fragment tương ứng. Các kết quả trên không thay thế
kiểm thử PostgreSQL/Mongo thật, migration SQL hoặc xác minh bản ghép.
