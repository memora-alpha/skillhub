# Implementation Plan: Danh tính người dùng

**Branch**: `feat/user-identity` | **Date**: 2026-10-03 | **Spec**: [spec.md](spec.md)
**Input**: `specs/002-user-identity/spec.md`; project root `services/api`.
**Base**: local `dev` at `0310544` (`chore: set up project`); no remote refresh requested.

## Summary

Build identity journeys inside existing NestJS modular monolith: email/OTP signup, login, access JWT with live session/account checks, rotated refresh, logout/reset, profile/avatar and minimal permission-based administration. PostgreSQL owns identity, grants, audit and durable email intent; Redis supplies shared throttle; BullMQ processes committed delivery IDs; S3 holds scanned avatar bytes.

Scope/questions are in [spec.md](spec.md); no business use cases or `tasks.md` are implemented. Following the schema-conversion request and its expansion to all models, [prisma/schema.prisma](../../prisma/schema.prisma) contains 45 PostgreSQL models/25 enums, including the 14 identity models/8 identity enums from [data-model.md](data-model.md). Two MongoDB chat models have a separate Prisma reference file; runtime remains Mongoose. Full catalog coverage and limitations are in [schema catalog](../../prisma/README.md). Schema representation of later features does not expand this feature's endpoint scope. Migrations, seeds, SQL constraints and endpoints remain pending.

## Danh sách endpoint dự kiến

Giai đoạn Danh tính có **21 endpoint**, chia thành ba nhóm dưới đây. Các route dùng đường dẫn có version `/api/v1/...`. Bảng mô tả chức năng và điều kiện truy cập; request/response, validation và mã lỗi chi tiết nằm trong [HTTP contract](contracts/http.md). Đây là danh sách dự kiến để triển khai và công bố trên Swagger.

### Quy ước API version

- Version đầu tiên của API Danh tính là `v1`, đặt trong URI ngay sau global prefix `/api`: ví dụ `POST /api/v1/auth/login`, `GET /api/v1/me`.
- Khi triển khai, dùng URI versioning của NestJS (`VersioningType.URI`) trong `src/main.ts`, giữ global prefix `api` và khai báo version `1` rõ ràng trên các controller Danh tính. Không ghi thêm `v1` vào controller path để tránh lặp version. Thiết kế dựa trên [NestJS versioning](https://docs.nestjs.com/techniques/versioning).
- Các endpoint vận hành hiện có `/api/health`, `/api/health/ready` dùng `VERSION_NEUTRAL` khi bật versioning; Swagger vẫn ở `/api/docs` và công bố đầy đủ đường dẫn `/api/v1/...`.
- Không tạo alias Danh tính thiếu version; `/api/auth/...`, `/api/me` và version chưa hỗ trợ phải trả `404`. Khi có thay đổi public contract không tương thích, tạo version mới như `/api/v2/...` và xác định thời gian hỗ trợ/ngừng version cũ trong feature tương ứng.
- Kiểm chứng routing và OpenAPI của đủ 21 endpoint `v1`, các đường dẫn thiếu/sai version và health/readiness sau khi bật versioning. Hiện tại `src/main.ts` mới có global prefix; versioning là hạng mục sẽ triển khai trong feature này.

### Đăng ký, xác thực và phiên đăng nhập — 10 endpoint

| Method | Endpoint                           | Mô tả                                                                                                                                                        | Điều kiện truy cập                                                                                         |
| ------ | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| POST   | `/api/v1/auth/register`            | Đăng ký bằng email/password; tạo tài khoản chờ xác minh, hồ sơ và role USER, đồng thời lên lịch gửi OTP. Trả thông báo trung tính, chưa cấp token đăng nhập. | Không cần đăng nhập; validate thông tin và chấp thuận điều khoản.                                          |
| POST   | `/api/v1/auth/verification/resend` | Gửi lại OTP đăng ký, vô hiệu mã trước đó; áp dụng thời gian chờ và giới hạn gửi lại.                                                                         | Không cần đăng nhập; chỉ tài khoản chờ xác minh đủ điều kiện nhận email, response không tiết lộ tài khoản. |
| POST   | `/api/v1/auth/verification/verify` | Kiểm tra OTP đăng ký dùng một lần; xác minh email và chuyển tài khoản từ PENDING_VERIFICATION sang ACTIVE.                                                   | Không cần đăng nhập; email và OTP đúng, chưa hết hạn hoặc bị thay thế.                                     |
| POST   | `/api/v1/auth/login`               | Đăng nhập email/password, cập nhật lần đăng nhập và cấp access/refresh token; `rememberMe` chọn thời hạn phiên theo cấu hình.                                | Không cần phiên hiện tại; thông tin đúng và tài khoản ACTIVE.                                              |
| POST   | `/api/v1/auth/refresh`             | Cấp cặp token mới và vô hiệu refresh token vừa sử dụng. Phát hiện sử dụng lại token đã dùng sẽ thu hồi toàn bộ phiên tương ứng.                              | Refresh token hợp lệ và phiên/tài khoản còn được phép hoạt động.                                           |
| POST   | `/api/v1/auth/logout`              | Thu hồi phiên được xác định bởi refresh token; token của phiên đó không còn dùng được. Gọi lặp vẫn trả kết quả trung tính.                                   | Gửi refresh token; không yêu cầu access token còn hạn.                                                     |
| POST   | `/api/v1/auth/logout-all`          | Thu hồi mọi phiên của tài khoản, bao gồm phiên đang gọi và các thiết bị khác.                                                                                | Đã đăng nhập, tài khoản ACTIVE.                                                                            |
| POST   | `/api/v1/auth/password/forgot`     | Yêu cầu gửi OTP đặt lại mật khẩu; trả cùng thông báo cho email tồn tại, không tồn tại hoặc không đủ điều kiện.                                               | Không cần đăng nhập; giới hạn chống gửi quá nhiều yêu cầu.                                                 |
| POST   | `/api/v1/auth/password/reset`      | Dùng OTP reset để đặt mật khẩu mới, thu hồi mọi phiên cũ và lên lịch email thông báo. Không tự đăng nhập hoặc mở khóa tài khoản.                             | Không cần đăng nhập; proof RESET_PASSWORD hợp lệ và mật khẩu mới đúng policy.                              |
| POST   | `/api/v1/auth/reauthenticate`      | Xác thực lại mật khẩu Admin để cấp proof ngắn hạn, dùng một lần, gắn với phiên và thao tác thay đổi role STAFF.                                              | Admin đã đăng nhập; mật khẩu hiện tại đúng, purpose STAFF_ROLE_CHANGE.                                     |

### Hồ sơ và avatar — 6 endpoint

| Method | Endpoint                              | Mô tả                                                                                                                                                              | Điều kiện truy cập                                          |
| ------ | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| GET    | `/api/v1/me`                          | Lấy tài khoản và hồ sơ của người đang đăng nhập, gồm email, trạng thái xác minh, role và thông tin hiển thị. Không trả dữ liệu mật khẩu hoặc token nội bộ.         | Đã đăng nhập, tài khoản ACTIVE.                             |
| PATCH  | `/api/v1/me/profile`                  | Cập nhật các trường hồ sơ được phép: fullName, headline, bio, timezone, locale. Không cho sửa role, trạng thái, email đăng nhập hoặc chỉ số hệ thống.              | Chủ tài khoản đã đăng nhập.                                 |
| POST   | `/api/v1/me/avatar`                   | Upload JPG/PNG/WebP tối đa 5 MB; trả mã upload ở trạng thái QUARANTINED. Chỉ thay avatar sau khi kiểm tra nội dung và quét an toàn thành công.                     | Chủ tài khoản đã đăng nhập; upload multipart.               |
| GET    | `/api/v1/me/avatar/uploads/{assetId}` | Tra cứu trạng thái xử lý avatar đã upload. CLEAN cho biết ảnh đã đạt kiểm tra và được chọn vào hồ sơ; không cho xem upload của người khác.                         | Chủ sở hữu upload đã đăng nhập.                             |
| DELETE | `/api/v1/me/avatar`                   | Bỏ avatar đang chọn khỏi hồ sơ và lên lịch dọn file không còn được tham chiếu.                                                                                     | Chủ tài khoản đã đăng nhập.                                 |
| GET    | `/api/v1/profiles/{userId}`           | Xem hồ sơ công khai của tài khoản ACTIVE: tên, headline, bio, avatar và chỉ số hệ thống được phép hiển thị. Không lộ email, role, session hoặc dữ liệu thanh toán. | Người xem đã đăng nhập; tài khoản đích được phép công khai. |

### Quản lý tài khoản và role — 5 endpoint

| Method | Endpoint                                   | Mô tả                                                                                                                          | Điều kiện truy cập                                                            |
| ------ | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| GET    | `/api/v1/admin/users`                      | Danh sách tài khoản có phân trang cursor, lọc theo trạng thái/role; email được che. Mặc định 20, tối đa 100 bản ghi mỗi trang. | Quyền `users.read`; Staff chỉ được dùng khi đã được cấp quyền được phê duyệt. |
| POST   | `/api/v1/admin/users/{userId}/lock`        | Khóa tài khoản ACTIVE với lý do bắt buộc; cập nhật LOCKED, thu hồi mọi phiên và ghi audit trong cùng transaction.              | Quyền `users.lock`.                                                           |
| POST   | `/api/v1/admin/users/{userId}/unlock`      | Mở tài khoản LOCKED đã xác minh về ACTIVE với lý do/audit. Không khôi phục phiên cũ hoặc kích hoạt tài khoản chưa xác minh.    | Quyền `users.unlock`.                                                         |
| PUT    | `/api/v1/admin/users/{userId}/roles/staff` | Gán role STAFF, giữ các role hiện có; kiểm tra và consume proof xác thực lại, ghi audit. Gọi lặp không tạo grant trùng.        | Role ADMIN, quyền `roles.staff.assign` và proof xác thực lại hợp lệ.          |
| DELETE | `/api/v1/admin/users/{userId}/roles/staff` | Gỡ role STAFF, giữ USER/ADMIN; consume proof xác thực lại và ghi audit. Gọi lặp không làm phát sinh thay đổi grant trùng.      | Role ADMIN, quyền `roles.staff.assign` và proof xác thực lại hợp lệ.          |

Các endpoint được bảo vệ kiểm tra trạng thái tài khoản, phiên và quyền hiện hành; tên `/admin` không tự cấp quyền. Staff mặc định chưa có quyền quản trị cho tới khi mapping được phê duyệt. Cấp ADMIN ban đầu dùng thao tác vận hành có audit; Google login, đổi email và các thao tác suspend/deactivate thuộc phạm vi được hoãn trong spec.

## Technical Context

| Item             | Decision/evidence                                                                                                                                                                  |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Language/version | Existing TypeScript 6.0.3, Node 22.12+ on 22.x or 24+                                                                                                                              |
| Dependencies     | Existing NestJS 11, Prisma 7.8/pg, ioredis/BullMQ, class-validator, Pino. Planned Nest JWT, Argon2, SMTP and S3 integrations; select/pin compatible versions during implementation |
| Storage          | PostgreSQL 17 authority for all new entities. MongoDB 8 foundation unchanged. Redis 7 throttle/jobs only                                                                           |
| Testing          | Existing Node foundation runner; planned policy, real-storage integration and Nest HTTP/e2e tests                                                                                  |
| Target/project   | Nest HTTP service; Windows development/container deployment; backend only                                                                                                          |
| Performance      | No approved auth load/SLO; benchmark Argon2 latency and concurrent auth before operational sizing                                                                                  |
| Constraints      | Constitution 1.2.0; SRS field limits; no external calls in DB transactions; fail-closed secret/scan/throttle controls                                                              |
| Scale/scope      | auth/users, minimal email notifications/audit, avatar storage and technical guards; no finance/chat                                                                                |

Verified source baseline when planning began: `src/app.module.ts` exposes health/infrastructure only; Prisma initially contained only SystemConfiguration; environment validation lacks auth/email/storage keys; package lacks JWT/Argon2/email/S3 business integrations. The schema has since been extended with the identity models; database migration and business behavior are still pending. Existing throttle is 120/minute/IP in one process. Errors use `{error:{statusCode,message}}`; only sensitive header redaction currently exists. These observations are not proof of implemented identity.

## Constitution Check

Before research and after design, reviewed against **v1.2.0**. Pass means proposed design compliance; runtime evidence remains pending.

| Principle                  | Before research | After design / evidence                                                                                |
| -------------------------- | --------------- | ------------------------------------------------------------------------------------------------------ |
| Scope/modularity (1)       | Pass            | Pass design: API paths and ownership below                                                             |
| Authoritative stores (2)   | Pass            | Pass design: [data-model.md](data-model.md), no Redis/Mongo identity authority                         |
| Relational atomicity (3)   | Pass            | Pass design: signup/reset/moderation/outbox transactions; finance N/A                                  |
| Auth/security (4)          | Pass            | Pass design: [research.md](research.md), live status/session, Argon2id, rotation, permission/ownership |
| Config/contracts/files (5) | Pass            | Pass design: required validated config, UTC, scan/S3 and [contracts](contracts/http.md)                |
| Verification (6)           | Pass planning   | Runtime Pending; [quickstart.md](quickstart.md) and [validation.md](validation.md) separate evidence   |
| Ownership (7)              | Pass            | Pass design: private repositories and explicit shared transaction context                              |
| Delivery reliability (8)   | Pass            | Pass design: encrypted secret/outbox, lease/retry/recovery; duplicate email possible                   |
| Git workflow               | Pass            | Branch without spec number; actual Git base checked separately; no commit/push                         |

No architecture exception. Production values are explicit release gates rather than unresolved technical architecture. Carry runtime checks into later tasks/validation.

## Project Structure

### Documentation (this feature)

```text
specs/002-user-identity/
  spec.md
  plan.md
  research.md
  data-model.md
  contracts/http.md
  quickstart.md
  checklists/requirements.md
  validation.md
```

### Planned source (relative to services/api)

```text
src/modules/auth/           # Credentials, challenge/session use cases and repositories
src/modules/users/          # Accounts/profiles/grants/avatar metadata
src/modules/notifications/  # Email intent/delivery worker
src/modules/audit/          # Append-only security/administration audit
src/infrastructure/email/   # SMTP/provider adapter
src/infrastructure/storage/ # S3/quarantine/scan and cleanup adapters
src/infrastructure/queue/   # Outbox dispatcher with existing BullMQ
src/shared/auth/            # Guards/decorators
src/shared/database/        # Typed transaction context, no business rules
src/configs/environment.ts
src/main.ts                # URI versioning; health controller version-neutral
src/health.controller.ts   # Preserve existing operational routes
src/app.module.ts
prisma/schema.prisma
prisma/migrations/
test/identity/
```

Use presentation/http, application/use-cases/ports, domain and infrastructure/persistence where responsibility exists; no empty layers. No frontend/shared package/root tool changes needed; later dependency additions affect API manifest and root lockfile.

## Ownership contracts and atomic workflows

| Owner         | Exported application contracts                                                                                                                                        | Authority                                         |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| users         | CreatePendingAccount, ReadIdentityForAuth, ActivateAfterVerification, RecordLoginOutcome, ChangePassword, ReadPrincipal, UpdateOwnProfile, ManageAccount, AssignStaff | User/Profile/grants/AvatarAsset                   |
| auth          | Register/Verify/Login/Refresh/Logout/Reset/Reauthenticate; RevokeSessions(tx,userId/sessionId)                                                                        | Challenges/sessions/refresh history/reauth proofs |
| notifications | ScheduleIdentityEmail(tx,intent), DispatchCommittedDelivery                                                                                                           | Email/outbox state                                |
| audit         | AppendSecurityEvent(tx,event), no update/delete port                                                                                                                  | AuditLog                                          |
| storage       | UploadQuarantine, InspectAndScan, PublishAvatar, DeleteUnreferenced                                                                                                   | Bytes; metadata selected by users                 |

Pass a typed Prisma transaction context through exported use cases; other modules never write owner tables. Auth orchestrates signup/verify/reset; users orchestrates moderation and invokes auth revocation/audit. Lock User rows first (actor/target sorted IDs), then challenge/session rows deterministically. Hash/check expensive passwords outside transaction, then recheck hash/securityVersion/status under lock before issuing credentials.

1. Signup transaction creates User/Profile/USER grant/challenge/protected email intent; uniqueness converts duplicate retries to neutral responses without overwriting data.
2. Verify locks User/challenge, checks purpose/expiry/attempts, consumes/activates atomically. Invalid-attempt increments commit before returning failure; avoid exception rollback of counters.
3. Login/refresh recheck account/security version under User lock. Refresh consumes generation and creates successor atomically. Replay revocation commits before returning 401, rather than rolling back on exception.
4. Reset consumes challenge, changes password/securityVersion, revokes all sessions, appends audit and schedules change email in one transaction; status unchanged.
5. Moderation/role mutation revalidate actor grants under lock, consume action-bound fresh reauth if needed, change status/grants/version, revoke sessions and append audit atomically. Unlock restores no session.
6. Avatar metadata is quarantined first; upload/inspect/scan outside DB transaction; final owner/status check and CLEAN selection atomic. Failure preserves old avatar; cleanup compensates orphan objects idempotently.

## Security and delivery decisions

JWT has minimal sub/sid/securityVersion/iss/aud/iat/exp/jti and explicit access type, verified with trusted algorithm/key allowlist; live session/User checks on each protected request guarantee subsequent revoke enforcement. Resolve current permissions; no blanket Admin bypass. Refresh opaque random credential is digest-only in storage; consumed history retained through family lifetime. Strict replay has no silent grace window; clients serialize refresh and re-login after duplicate/lost-response family revocation.

Email outbox persists in signup/reset transaction. BullMQ payload contains delivery ID only. Six-digit OTP uses keyed verifier; authenticated-encrypted short-lived delivery payload enables restart-safe send, with separate encryption/HMAC keys/key IDs. Dispatcher leases records; sender checks challenge generation/purpose/expiry/status, decrypts only in memory, retries the same delivery, scrubs ciphertext on terminal state. Reconciliation repairs missed enqueue; expired leases recover. Provider acceptance followed by crash may duplicate email; never claim exactly-once send. Sending older email already in flight cannot be recalled, but its code is invalid after resend.

Validated configuration: JWT issuer/audience/keys/algorithm; access/refresh/remember TTL; Argon2 cost; OTP purpose expiries/SRS limits; shared email/IP/device throttle; reauth window; terms version/timezone/initial reputation; SMTP/from; S3/quarantine/scan; separate HMAC/encryption secrets; retry/backoff/lease/retention. Production has no fallback placeholder keys/provider/score. Exclude credential bodies, delivery payloads and tokens from logs/audit/Swagger examples.

Redis rate-limit storage covers all replicas, separate from authoritative PostgreSQL attempt counters. Protected auth operations fail closed with safe 503 on unavailable required throttle/authority. Existing health exemptions remain. Explicit JSON refresh transport requires secure consumer storage; browser cookie/BFF/CSRF integration is a separate client contract.

## Implementation sequence and validation gates

1. Schema/config/ports/seeds/audited operator bootstrap; uniqueness/rollback/lock-order/config tests.
2. Signup/OTP/outbox/login/live guard; neutral responses, code/attempt/resend races and crash recovery.
3. Rotation/logout/reset/reauth; replay commit, immediate subsequent revocation, reset/lock racing login/refresh.
4. Own/public profile and scanned avatar; allowlist/ownership/content/quarantine/cleanup tests.
5. Management permission matrix, lock/unlock/STAFF changes and transactional audit; production Staff grants empty until approved.
6. Enable URI versioning for identity controllers; preserve version-neutral operational routes. Align Swagger with `/api/v1/...` contracts; verify missing/unsupported versions return404, then focused lint/typecheck/build and real-storage/e2e checks; retain evidence separately from foundation tests.

These are phases, not generated tasks. Next command is `$speckit-tasks`; business implementation needs a subsequent request.
