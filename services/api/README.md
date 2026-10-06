# SkillHub API

NestJS backend in the SkillHub pnpm/Turborepo workspace.

## Phạm vi và trạng thái

Phạm vi phát triển hiện tại của dự án là **backend tại `services/api`**.
Web/mobile chỉ được thay đổi khi có yêu cầu riêng. Git và pnpm workspace vẫn
đặt tại root SkillHub; backend không có Git repository riêng.

API đã có nền tảng hạ tầng và phần Danh tính (spec 002): đăng ký/OTP/login, refresh/logout/reset, hồ sơ/avatar, quyền và quản trị tài khoản có audit. Các module còn lại bên dưới vẫn là kế hoạch; chat và giao dịch Credit chưa được triển khai.

Catalog Prisma đã cập nhật theo logical v3: **48 model PostgreSQL và một document
Message MongoDB** với attachments nhúng. Xem [schema catalog](prisma/README.md)
để đối chiếu 49/49 định nghĩa logical. Schema v3 ở `prisma/schema.prisma` sinh client
riêng `src/generated/prisma-catalog`; chưa được áp vào database/runtime.
API, generate mặc định và migration vẫn dùng `prisma/identity.prisma` riêng,
giữ cấu trúc danh tính cũ đến khi có migration và sửa repository tương ứng.
Migration danh tính, seed/operator bootstrap,
ràng buộc SQL và 21 endpoint `/api/v1/...` đã có; migration chỉ được kiểm thử
trong schema tạm, chưa deploy vào database ứng dụng. Xem [hướng dẫn danh tính](specs/002-user-identity/quickstart.md) và [kết quả kiểm thử](specs/002-user-identity/validation.md).

Nguồn nghiệp vụ:

- [SRS SkillHub V1.4 tiếng Việt](../../docs/SRS_SkillHub_V1.4_BoSungQuyDinhNghiepVu_VI.docx): bản bổ sung nghiệp vụ; RBAC đối chiếu mục 3, NFR-SEC-03, BR-39/40 và mục 18.
- [SRS SkillHub V1.3](../../docs/SRS_SkillHub_V1.3.docx): bản trước để đối chiếu lịch sử.
- [SRS SkillHub V1.5](../../docs/SRS_SkillHub_V1.5.docx): yêu cầu mới; mô hình v3 có điều chỉnh phạm vi theo quyết định người dùng.
- [Danh mục entity/field v3](../../docs/SkillHub_Entities_Fields_v3.md): có phân biệt yêu cầu SRS và đề xuất thiết kế.
- [Logical Data Model v3](../../docs/SkillHub_Logical_Data_Model_v3.md): quan hệ, ràng buộc và transaction boundaries.

[Thiết kế RBAC/ownership SH-002](specs/002-rbac-ownership/spec.md) và
[kế hoạch triển khai](specs/002-rbac-ownership/plan.md) đang triển khai,
do Long phụ trách theo backlog. Các mô hình và breakdown dưới đây có trước lần
bổ sung v1.4; đối chiếu nghiệp vụ mới trong spec từng feature. Việc ghi nhận thiết
kế chưa có nghĩa auth, RBAC hay các module nghiệp vụ đã được tích hợp vào
production API; xem [kết quả kiểm chứng](specs/002-rbac-ownership/validation.md).

Ưu tiên nghiệp vụ Must/Should/Could theo SRS vẫn được giữ. Thứ tự triển khai
bên dưới là đề xuất kỹ thuật, không nâng tính năng Should/Could thành Must.
Tên module, bảng và routes là định hướng thiết kế; contracts/schema vật lý
sẽ được chốt trong spec và plan của từng feature.

## Breakdown backend thành module

Đề xuất dùng một ứng dụng NestJS với các module theo nghiệp vụ, cùng database
và cơ chế transaction. Chưa cần tách microservices. Các routes trong bảng là
nhóm API dự kiến và đều nằm sau prefix `/api` hiện có.

| Module              | Trách nhiệm và phạm vi API                                                                                                                  | Dữ liệu chính / ranh giới                                                                                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `auth`              | Đăng ký, email/OTP, login/logout, refresh/revoke, reset password, Google OAuth theo ưu tiên SRS; `/auth/*`.                                 | OTP challenge, OAuth account, refresh session. Phối hợp `users` để tạo tài khoản và cập nhật trạng thái; không tự gán STAFF/ADMIN.                                          |
| `users`             | Tài khoản, hồ sơ cá nhân/công khai, avatar, khóa/mở tài khoản, role và permission; `/profiles/*`, `/me`, các thao tác user qua `/admin/*`.  | User, Profile, Role, Permission, UserRole, RolePermission. Một User có thể vừa học vừa chia sẻ; Guest không là role lưu DB. Uy tín và số liệu tiến độ do hệ thống cập nhật. |
| `skills`            | Skill Catalog: danh sách, tìm kiếm, quản lý và archive skill; `/skills/*`, quản trị qua `/admin/*`.                                         | Skill; SkillCategory nếu chốt triển khai. Không hard-delete skill đã được tham chiếu.                                                                                       |
| `sharing-skills`    | Kỹ năng tự khai của User, cập nhật/ẩn, lịch sử kỹ năng đã học; `/me/skills/*`.                                                              | SharingSkill, UserLearnedSkill hoặc projection được chốt trong plan. Kỹ năng đã học không đồng nghĩa với badge VERIFIED.                                                    |
| `verifications`     | Gửi evidence, xem trạng thái, hàng đợi Staff, approve/reject có lý do; `/me/skills/*/verifications`, `/staff/verifications/*`.              | SkillVerification, SkillEvidence. Một yêu cầu PENDING mỗi SharingSkill; file evidence có kiểm soát truy cập. Module này quản lý quyết định xác minh.                        |
| `learning-requests` | Tạo/sửa/hủy nhu cầu học, browse/search/filter, request cá nhân, hết hạn; `/learning-requests/*`.                                            | LearningRequest và preferred slots. Slots/budget chỉ là đề xuất, chưa tạo Session hoặc Hold Credit.                                                                         |
| `proposals`         | Gửi/xem/accept/reject/withdraw/expire Proposal, kiểm tra kỹ năng phù hợp và ngăn match xung đột; `/proposals/*`.                            | Proposal và candidate slots. Accept phối hợp cập nhật Request và mở Conversation, chưa khóa lịch hay Hold.                                                                  |
| `conversations`     | Chat riêng của hai participant, text/file, đã đọc và sự kiện thương lượng; `/conversations/*`.                                              | Conversation/participants thuộc PostgreSQL; Message/MessageAttachment thuộc MongoDB. Chỉ participant được truy cập; tin nhắn không thay thế Confirm lịch có cấu trúc.       |
| `scheduling`        | Đề xuất lịch nhiều buổi, version, Confirm hai phía, kiểm tra conflict và khóa lịch; `/schedule-proposals/*`, truy vấn lịch của User.        | ScheduleProposal, ScheduleVersion, ScheduleItem, ScheduleConfirmation. Điều phối khóa lịch + tạo Session + Hold hai ví trong một transaction.                               |
| `sessions`          | Danh sách/chi tiết buổi học, state machine, xác nhận hoàn thành, hủy/no-show, timeout và tiến độ lộ trình; `/sessions/*`.                   | Session, SessionConfirmation. Tạo từ lịch LOCKED; yêu cầu `credit` settlement khi đủ điều kiện, chặn settlement khi có dispute.                                             |
| `livekit`           | Cấp token đúng participant/Session và join window; mapping room, xác minh webhook, attendance nếu tích hợp; `/sessions/{id}/livekit-token`. | LiveKitRoom, SessionAttendance nếu chọn lưu. Không tự quyết định hoàn thành Session chỉ từ attendance; media do LiveKit xử lý.                                              |
| `credit`            | Ví, ledger, Hold/Release/Settlement, bonus nếu bật, adjustment và lịch sử; `/wallet/*`, các thao tác quản trị qua `/admin/*`.               | CreditWallet, CreditTransaction, HeldCreditAllocation. Là nơi duy nhất ghi biến động số dư/ledger; Credit và VND dùng số nguyên.                                            |
| `payments`          | Tạo yêu cầu nạp, callback/webhook đã xác minh, tra cứu trạng thái; Withdrawal chỉ khi bật; `/payments/*`, `/withdrawals/*` nếu triển khai.  | Payment, Withdrawal tùy chọn. Gọi `credit` để top-up/reserve/release; không tự sửa ví và không ghi nhận PAID từ redirect phía client.                                       |
| `reviews`           | Đánh giá sau Session đủ điều kiện, tra cứu/ẩn review, tính và lưu lịch sử Reputation; `/reviews/*`.                                         | Review, ReputationHistory. Một review mỗi participant/Session; cập nhật điểm qua `users`, bonus qua `credit`. Công thức cần được chốt.                                      |
| `reports`           | Report nội dung/User, dispute Session/Transaction, evidence, lịch sử xử lý, resolve/reject/escalate theo quyền; `/reports/*`.               | ReportCase và evidence/lịch sử theo schema sẽ chốt. Phối hợp `sessions` và `credit`; giữ Held khi tranh chấp chưa giải quyết.                                               |
| `notifications`     | Thông báo in-app, trạng thái đã đọc, gửi email OTP/reset/reminder và kết quả nghiệp vụ; `/notifications/*`.                                 | Notification và delivery metadata nếu cần. Email xác minh/reset phục vụ luồng Must của auth; các kênh khác theo ưu tiên SRS.                                                |
| `administration`    | API Staff/Admin, tổng hợp dashboard/báo cáo, quản lý cấu hình và phân quyền cho thao tác nhạy cảm; `/admin/*`.                              | SystemConfiguration và read models nếu cần. Dùng services của các module sở hữu nghiệp vụ; không tạo bản sao User/Skill/Session/ledger.                                     |
| `audit`             | Ghi lịch sử bất biến của thao tác nhạy cảm, tra cứu theo quyền; `/admin/audit-logs/*`.                                                      | AuditLog. Không log password, OTP, token đầy đủ hay dữ liệu thanh toán nhạy cảm. Audit khác application logs.                                                               |

GET /api/health là liveness; GET /api/health/ready kiểm tra PostgreSQL, MongoDB và Redis; cả hai version-neutral. Swagger ở /api/docs trong development/test, tắt trong production. Rate limit chia sẻ qua Redis theo cấu hình, gồm IP toàn API và email/IP/device theo luồng danh tính; health được miễn. Cấu hình danh tính/provider trong `.env.example` bắt buộc có giá trị rõ ràng trước khi khởi động.

Response JSON theo chuẩn Memora: thành công `{success:true,message,data,meta?}`;
lỗi `{success:false,message,statusCode}`. Payload nằm trong `data`, phân trang
danh sách quản trị nằm trong `meta.pagination` (`nextCursor`, `hasMore`, `limit`).
Đăng ký/gửi lại OTP/quên mật khẩu trả `data:null`; response 204 không có body.
Controller dùng helper tại `src/shared/http/response.ts`, use case trả kết quả
nghiệp vụ; Swagger mô tả đúng envelope. Đây là thay đổi contract v1 trước release
theo yêu cầu ngày 2026-10-04; xem [HTTP contract](specs/002-user-identity/contracts/http.md).

## Hạ tầng và quy tắc phụ thuộc

Hạ tầng nằm trong `src/infrastructure/`; không coi mỗi provider là
một module nghiệp vụ mới:

| Thành phần                 | Trách nhiệm                                                                                                                                                                |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Database                   | Kết nối, migrations, repositories, transaction context và concurrency control. Đã chọn PostgreSQL/Prisma và MongoDB/Mongoose; schema nghiệp vụ bổ sung theo feature.       |
| File storage               | Upload/download có quyền, giới hạn dung lượng, MIME thực và kiểm tra file; dùng chung cho avatar/evidence/chat/report. Module nghiệp vụ sở hữu metadata và quyền truy cập. |
| Email và dịch vụ ngoài     | Adapter cho email, Google OAuth, Payment Gateway, LiveKit; xác minh callback/webhook và quản lý secret bằng môi trường.                                                    |
| Jobs/events                | Hết hạn OTP/Request/Proposal, nhắc lịch, timeout/no-show, gửi thông báo. Đã cấu hình Redis/BullMQ và retry/backoff; processors bổ sung theo feature.                       |
| API chung và observability | Validation, error format, auth/permission guards, rate limits, logging có che dữ liệu nhạy cảm và health checks.                                                           |

Mỗi module công bố service/use case cần thiết; module khác không ghi trực tiếp
bảng mà nó sở hữu. Controllers chỉ nhận request, kiểm tra đầu vào và gọi use case.
`src/shared/` giữ thành phần kỹ thuật dùng chung, không gom nghiệp vụ ví/lịch vào đó.

Ba luồng cần phối hợp nhiều module:

1. **Accept Proposal:** `proposals` điều phối trạng thái Proposal/Request và tạo
   Conversation nhất quán; chống accept cạnh tranh. Không tạo Session/Hold.
2. **Khóa lịch:** `scheduling` kiểm tra hai Confirm cùng version, toàn bộ conflict,
   trạng thái và số dư; gọi `sessions` tạo buổi và `credit` Hold cả hai User.
   Các thay đổi dùng cùng transaction context; thất bại phải rollback toàn bộ.
3. **Hoàn thành/hủy/dispute:** `sessions` hoặc `reports` xác định quyết định
   nghiệp vụ; `credit` ghi ledger tương ứng. Settlement từng Session/từng User
   hoàn 96% về chính ví đã Hold, ghi 4% phí; không chuyển 96% sang đối phương.
   Webhook, settlement và các thao tác tài chính phải idempotent.

Thông báo, email và provider calls không được làm hỏng tính nguyên tử của ledger.
Plan phải xác định cách chỉ phát tác vụ sau commit và retry không trùng; nếu chọn
outbox thì ghi rõ thiết kế. Audit của thao tác tài chính nhạy cảm phải được lưu
nhất quán với kết quả nghiệp vụ.

## Cấu trúc source dự kiến

```text
src/
  main.ts
  app.module.ts
  health.controller.ts        # Đang có
  modules/
    auth/
    users/
    skills/
    sharing-skills/
    verifications/
    learning-requests/
    proposals/
    conversations/
    scheduling/
    sessions/
    livekit/
    credit/
    payments/
    reviews/
    reports/
    notifications/
    administration/
    audit/
  infrastructure/             # Database/providers/jobs
  shared/                     # Guards, validation, errors, kỹ thuật dùng chung
```

Theo Memora, module dùng presentation/http (controller/DTO), application (use-cases/commands/results/ports), domain (policies/entities/repository interfaces) và infrastructure (persistence/providers). Chỉ tạo tầng có trách nhiệm thực tế.

Danh tính đã được tổ chức thành 24 use case trong `application/use-cases/`,
các service dùng chung trong `application/services/`, contract/port riêng và
Prisma repository trong `infrastructure/persistence/` của module sở hữu dữ liệu.
Controller gọi trực tiếp use case; `identity.module.ts` giữ vai trò composition
root và chỉ export các contract cần dùng liên module. Danh sách quản trị dùng
query nghiệp vụ, không truyền Prisma filter giữa application services.

Use case điều phối một transaction PostgreSQL; service/repository tham gia dùng
cùng context. Worker BullMQ và timer reconciliation nằm trong
`infrastructure/jobs/`. Application nhận port storage/scanner/email/queue;
HTTP chuyển Multer thành input bytes/MIME/size và Sharp nằm trong infrastructure.
Refactor giữ 21 endpoint, OTP counter/replay commit, audit/outbox atomic và
khôi phục delivery/avatar; xem [plan danh tính](specs/002-user-identity/plan.md).

## Thứ tự triển khai và phụ thuộc

| Giai đoạn               | Phạm vi                                                                                                                | Kết quả cần kiểm chứng                                                                                               |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| 0. Nền tảng             | Constitution, lựa chọn DB/ORM, cấu hình, migrations, API errors/validation, audit nền tảng và email/storage tối thiểu. | API khởi động, config lỗi bị phát hiện, migration và transaction hoạt động; secrets không bị log.                    |
| 1. Danh tính            | `auth`, `users`, quyền Staff/Admin và email cần cho OTP/reset.                                                         | Đăng ký → verify → login → refresh/logout/reset; kiểm tra quyền và hồ sơ công khai không lộ dữ liệu riêng.           |
| 2. Kỹ năng              | `skills`, `sharing-skills`, `verifications`, storage và audit.                                                         | Khai báo kỹ năng → gửi evidence → Staff approve/reject; kiểm tra quyền file và state transitions.                    |
| 3. Kết nối              | `learning-requests`, `proposals`, `conversations`.                                                                     | Request → Proposal → Accept → Conversation; reject self-proposal và accept xung đột; chưa có Hold/Session.           |
| 4. Credit và nạp        | `credit`, `payments`, cấu hình tài chính; API quản trị tối thiểu.                                                      | Nạp đã xác minh → ledger/ví; callback trùng không tăng số dư; các primitive Hold/Release đã kiểm thử.                |
| 5. Lịch và học          | `scheduling`, `sessions`, `livekit`, jobs/reminders và Hold/Settlement của `credit`.                                   | Confirm cùng version → khóa lịch/Hold hai ví → học → xác nhận → settlement; rollback khi thiếu tiền/conflict.        |
| 6. Hoàn thiện nghiệp vụ | `reports`, `reviews`, Reputation và các notifications còn lại.                                                         | Dispute giữ Held; quyết định tạo ledger/audit mới; review đúng participant và tiến độ kỹ năng đã học đúng điều kiện. |
| 7. Quản trị và vận hành | Dashboard, cấu hình, moderation còn lại, reconciliation/giám sát và tính năng Should/Could đã chọn.                    | Quyền Staff/Admin, audit truy vết, xử lý retry/lỗi provider và kiểm chứng end-to-end. Withdrawal chỉ khi được bật.   |

`administration`, `audit` và thông báo được bổ sung dần theo từng giai đoạn;
không trì hoãn quyền, audit hay email bắt buộc tới giai đoạn cuối. Các feature
Spec Kit nên là một luồng nghiệp vụ có thể kiểm chứng, có thể đi qua nhiều module;
không mặc định một module tương ứng với một spec khổng lồ.

## Các quyết định còn mở

- Đã chọn PostgreSQL/Prisma và MongoDB/Mongoose. Schema nghiệp vụ, indexes, transaction isolation/concurrency và provider bên ngoài được chốt theo feature.
- Minimum Credit, bonus, penalty hủy/no-show, timeout/dispute window và điều kiện Withdrawal.
- Quy tắc làm tròn 96%/4%, công thức Reputation, LiveKit join window.
- Chi tiết SkillCategory, chính sách ngăn nhiều match và các projection/counter.

Đọc mục 18.31/phụ lục A của SRS và phần deferred decisions của logical model
trước khi viết spec liên quan. Ghi câu hỏi cần chốt trong feature; không tự đặt
giá trị production hoặc coi bản breakdown này là database schema đã phê duyệt.

## Development

Stack đã chốt và giới hạn triển khai: [foundation plan](specs/001-backend-foundation/plan.md).
Constitution: [.specify/memory/constitution.md](.specify/memory/constitution.md).
Constitution v1.2.0 quy định module sở hữu dữ liệu và cung cấp contract cho module
khác; jobs/webhooks phải xử lý trùng lặp, retry và khôi phục lỗi. Mỗi feature plan
cần Constitution Check và bằng chứng kiểm chứng; ngoại lệ phải ghi rõ lý do,
biện pháp giảm tác động, điều kiện gỡ bỏ và phê duyệt của người dùng. Đây là quy tắc
cho các feature tiếp theo; outbox email và job processors danh tính đã triển khai.
Webhook handlers và các job nghiệp vụ khác vẫn thuộc feature tương ứng.

Git workflow: branch `feat/user-auth`, `fix/refresh-revocation` hoặc
`docs/backend-modules`; slug viết lowercase kebab-case, không kèm số spec.
Commit dùng Conventional Commits, ví dụ `feat(api/auth): add refresh rotation`
nếu chỉ stage module auth, hoặc `docs(api): document backend modules` cho tài liệu API.
Thay đổi root/nhiều workspace có thể bỏ scope. Hooks ở repo root chạy lint-staged
và commitlint; cài dependencies rồi chạy `pnpm prepare` để kích hoạt trên checkout mới.
JWT access + refresh rotation/revocation, Argon2id, RBAC/ownership và S3-compatible
storage là thiết kế đã chọn; endpoints/adapters được triển khai theo feature.
MongoDB lưu Message/attachment metadata; Conversation và participant thuộc PostgreSQL.
Các biến động Credit dùng transaction PostgreSQL, outbox/idempotent retry cho sự kiện xuyên stores.

Cài dependencies từ root repo bằng pnpm install. Chuẩn bị PostgreSQL, MongoDB
và Redis bằng một trong hai cách dưới đây; thông tin kết nối nằm trong .env
riêng của mỗi developer.

### Dịch vụ có sẵn hoặc do team cung cấp

Tạo database skillhub và tài khoản ứng dụng có quyền áp dụng migration.
MongoDB dùng database skillhub_chat. Điền các URI tương ứng trong .env;
Redis hosted dùng URI do provider cấp, với rediss:// nếu yêu cầu TLS.

### Docker Compose cho development

Compose cung cấp PostgreSQL 17, MongoDB 8 và Redis 7 với named volumes.
Chạy pnpm infra:up từ services/api và dùng các giá trị development sau trong .env:

```dotenv
DATABASE_URL=postgresql://skillhub:skillhub_local@127.0.0.1:5433/skillhub
MONGODB_URI=mongodb://127.0.0.1:27018/skillhub_chat
REDIS_URL=redis://127.0.0.1:6380/0
```

Đây là credential mẫu của Compose development. pnpm infra:down dừng dịch vụ
và giữ volumes. MongoDB Compose chạy standalone; cần replica set khi feature
sử dụng MongoDB transactions.

### Chạy API

Từ root repo, sau pnpm install:

```powershell
cd services/api
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
# Điền URI phù hợp với các dịch vụ đã chuẩn bị.
pnpm db:deploy
pnpm dev
```

Nest ConfigModule và Prisma đọc .env khi chạy từ thư mục API. Giữ .env ngoài
Git; .env.example dùng cho cấu hình mẫu chung. Không ghi credential thật hoặc
địa chỉ server riêng của developer vào tài liệu được commit.

Prisma Client được generate trước build/dev/typecheck; generated files không commit.
Migration nền tảng tạo bảng system_configurations; domain tables được bổ sung theo feature.
pnpm db:migrate tạo migration trong development; pnpm db:deploy áp dụng migration
đã có. Kiểm tra trạng thái bằng pnpm exec prisma migrate status.

```powershell
pnpm db:validate
pnpm lint
pnpm check-types
pnpm build
pnpm test:foundation
```

API mặc định chạy ở http://localhost:3001. GET /api/health kiểm tra liveness;
GET /api/health/ready xác minh PostgreSQL, MongoDB và Redis; Swagger ở /api/docs.
Xem validation report trong foundation spec để phân biệt kiểm tra đã đạt và phần
còn cần kiểm chứng. Unit tests không thay thế runtime tests và auth nghiệp vụ.

## Spec Kit

Backend Spec Kit artifacts use the 0.9.0 template baseline with PowerShell
scripts and Codex/Claude Code integrations. Install agent/Spec Kit tooling in
your own development environment as needed. Git and pnpm remain at the
repository root; this API directory has no nested Git repository.

```text
.agents/skills/    Codex skills
.claude/skills/    Claude Code skills
.specify/         Shared configuration, templates, scripts, and constitution
specs/            Feature artifacts, including 001-backend-foundation
AGENTS.md         Backend scope and project guidance
CLAUDE.md         Imports the same project guidance for Claude Code
```

Start the coding agent in this directory:

```powershell
cd services/api
codex
# Or:
claude
```

For the Codex desktop app, use this directory as the chat's working directory
so the local `.agents/skills` are discovered. If they do not appear, reopen the
chat or restart the app.

Invoke the following in the agent's chat, one step at a time (not in PowerShell):

| Step                         | Codex                   | Claude Code             |
| ---------------------------- | ----------------------- | ----------------------- |
| Establish project principles | `$speckit-constitution` | `/speckit-constitution` |
| Specify a backend feature    | `$speckit-specify`      | `/speckit-specify`      |
| Resolve ambiguities          | `$speckit-clarify`      | `/speckit-clarify`      |
| Design the implementation    | `$speckit-plan`         | `/speckit-plan`         |
| Check requirement quality    | `$speckit-checklist`    | `/speckit-checklist`    |
| Break down the work          | `$speckit-tasks`        | `/speckit-tasks`        |
| Check artifact consistency   | `$speckit-analyze`      | `/speckit-analyze`      |
| Implement the tasks          | `$speckit-implement`    | `/speckit-implement`    |

Example input after the specification skill:

> Specify backend account registration and login using the SRS in ../../docs/.
> Scope changes to this API. Record unresolved requirements; do not implement web UI.

Constitution và foundation spec/plan là nguồn quyết định chung của project.
Business features được triển khai theo spec riêng.

Both agents use the same feature artifacts and the same nine core skills.
The bundled agent-context extension currently has an additional skill in the
Codex integration. This does not affect Claude's core feature workflow.
Use `specify integration use codex` or `specify integration use claude` to select
the default integration; check extension registration separately when adding
extensions or updating the CLI.

## Installation checks

```powershell
specify version
specify integration list
.\.specify\scripts\powershell\check-prerequisites.ps1 -Json -PathsOnly
```

The last command should report this API directory as `REPO_ROOT`. A normal
prerequisite check expects a feature plan and should be run after planning.

Upstream references: [Spec Kit integrations](https://github.github.com/spec-kit/reference/integrations.html)
and [installation](https://github.github.com/spec-kit/installation.html).
