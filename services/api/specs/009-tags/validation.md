# Tag API — implementation evidence

Plan/spec/brief được duyệt trong chat sau khi xác nhận ADMIN tạo/duyệt, USER gửi
đề xuất và giữ role hiện tại. Kiểm chứng local ngày **2026-10-16**, trên working
tree `feature/tag-api`, base HEAD `db231ce76dd5011d8ee4eb1521b67836d32b1e1c`.
Không commit/push hoặc migrate/deploy môi trường dùng chung.

## Kết quả kiểm chứng

| Check                                   | Kết quả                                                                                     |
| --------------------------------------- | ------------------------------------------------------------------------------------------- |
| Runtime schema validation               | Pass: Prisma 7.8 validate                                                                   |
| API lint                                | Pass: eslint, zero warnings                                                                 |
| API typecheck                           | Pass: Prisma generate + tsc --noEmit                                                        |
| API build                               | Pass: Nest build                                                                            |
| Tag policy + PostgreSQL/HTTP suites     | **19 passed, 0 failed, 0 skipped**                                                          |
| Skills integration regression           | **38 passed, 0 failed, 0 skipped**                                                          |
| Learning Request regression             | **102 passed, 0 failed, 0 skipped**                                                         |
| Learning Request PostgreSQL integration | **10 passed, 0 failed, 0 skipped**                                                          |
| RBAC regression                         | **13 passed, 0 failed, 0 skipped**                                                          |
| Audit regression                        | **10 passed, 0 failed, 0 skipped**                                                          |
| Migrate/seed local                      | Pass: 16 migrations applied to a fresh isolated PostgreSQL 17 database, then identity seed  |
| Preflight/verify operator commands      | Pass against isolated DB; fixture checks also prove invalid/collision/key mismatch failures |

Tag suites: `node --test --test-concurrency=1 test/tags/*.test.mjs` sau build.
Scripts tương ứng: `pnpm --filter api test:tags` và
`pnpm --filter api test:tags:integration`. Regression dùng đúng Node test
commands trong các scripts `test:skills:integration`, `test:learning-request`,
`test:learning-request:integration`, `test:rbac`, `test:audit`; tái dùng bản build
đã kiểm chứng thay vì build lại từng nhóm.

Lượt xác minh cuối sau mọi thay đổi: schema generator chạy hai lần và Prisma
format cho hash giống file runtime đã lưu; Prisma validate, API lint, typecheck,
build đều exit 0. Guard từ chối TEST_DATABASE_URL bị thiếu với exit 1 như mong
đợi. Bộ tag đầy đủ tiếp tục pass **19/19** sau khi bổ sung assertion CLI collision
và bảo toàn người tạo canonical Tag. Tổng các suite feature/regression nêu trên:
**192 passed, 0 failed, 0 skipped**.

Database tạm bind localhost, không dùng DATABASE_URL đang phục vụ. TEST_DATABASE_URL
được set rõ ràng; fixtures tạo schema riêng rồi xóa trong cleanup. Các suite
Learning Request dùng public schema có sẵn migrations/seed trong cùng DB tạm.

## Hành vi đã chứng minh

- Normalization NFC/Unicode/whitespace, giới hạn 1–80 code points, giữ dấu và
  phân biệt C/C++/C#; input giả actor/status và PATCH/version/reason sai bị chặn.
- USER/STAFF không tạo tag chính thức; STAFF có grant nhầm vẫn không qua ADMIN
  gate. ADMIN thiếu grant, đổi role, restrictions hoặc session bị thu hồi bị
  chặn; replay không bypass live authorization.
- USER chỉ đọc request của mình; cursor gắn với owner/filter. PENDING không tạo
  canonical Tag, pending trùng cùng owner bị chặn; request mới sau reject hợp lệ.
- Approve/reject cùng request chỉ một winner; hai approvals cùng request hoặc
  cùng label và Admin-create đua approve vẫn chỉ một canonical Tag. Reuse giữ
  creator của tag cũ; tag ẩn không tự bật lại. USER không đổi role.
- Audit lỗi rollback cả tag/quyết định/receipt; replay không tạo thêm audit/tag;
  expectedVersion và idempotency-key conflicts trả 409.
- Race **create/edit/publish Learning Request thực tế với hide** được kiểm tra
  cả hai thứ tự: hide trước làm command 409; selection trước giữ shared lock cho
  tới commit rồi hide mới hoàn tất. Publish xong, public detail vẫn render tag
  đã ẩn. Draft links và version cũng được kiểm tra sau race.
- Migration giữ id/label/status/RequestTag cũ, unknown creator/createdAt là null;
  invalid legacy control/duplicate normalized labels làm migration dừng. DB CHECK
  chặn quyết định thiếu metadata và partial unique chặn pending trùng.
- CLI preflight/verify được thực thi thật: báo normalized collisions, khác biệt
  casing locale giữa PostgreSQL/Node và persisted-key mismatch; không tự sửa dữ liệu.
- Public GET tags giữ shape/query/cursor cũ; Swagger có đủ 10 route mới.

## Review độc lập và điều chỉnh trong quá trình thực thi

Reviewer đọc source mới/untracked, migration, authorization, audit, DTO/controller
và Learning Request callers: **không có production-code finding cần sửa**.
Reviewer yêu cầu bằng chứng edit/publish race và historical public detail; đã bổ
sung `learning-request-races.test.mjs`, **9/9 tests/subtests pass**.

Regression ban đầu phát hiện assertion default grants chưa gồm hai quyền tag mới
và fixture Learning Request cũ thiếu field runtime v3/nameKey, cleanup chưa xóa
event-stream rows do trigger hiện tại tạo. Đã sửa đúng các test fixtures và chạy
lại các nhóm liên quan thành công; không đổi nghiệp vụ khác. Test revoke phiên
cũng được sửa để lưu revokedReason đúng constraint có sẵn.

Dependencies được khôi phục bằng pnpm **10.24.0** và frozen lockfile; không đổi
dependency/lockfile. Bộ Skills/Learning Request cũ còn phát pg-client concurrency
deprecation warning trong fixture; không có test fail hoặc skip vì warning này.

## Constitution recheck và giới hạn release

Constitution v1.2.0: scope/module ownership, authoritative PostgreSQL, transaction
atomicity, live authorization/privacy, validation/contracts và local verification
đều Pass theo source và checks trên. Delivery reliability không áp dụng vì V1
chưa tạo notification/event/provider call mới. Không có ngoại lệ constitution.

Production deployment readiness và độ sạch của legacy data thực tế chưa được
kiểm chứng. [Quickstart](quickstart.md) quy định chặn writers, preflight → migrate
→ verify → identity seed → smoke trước mở lại. Những bước đó mới chỉ chạy trên
database local tạm. Giữ gate riêng cho rollout môi trường dùng chung.

Notifications, quota/cooldown, merge/alias và restore ARCHIVED nằm ngoài V1 đã
thống nhất. Các hành vi cũ ngoài Tag integration không thuộc kết luận review.
