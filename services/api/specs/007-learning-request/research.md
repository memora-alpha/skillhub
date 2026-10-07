# Learning Request research

Ngày 2026-10-06. Chỉ đọc source, migrations, năm tab của sheet và đối chiếu SRS V1.4 với V1.5 user cung cấp; baseline hiện tại là V1.5. Không xác minh database ứng dụng đang chạy. Các contract mới là đề xuất cho plan, không phải API đã tồn tại.

## Source baseline

| Quan sát                                                                                  | Bằng chứng và hệ quả                                                                                                                                                                                                                                                        |
| ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Không có runtime Learning Request, Skill Catalog, Sharing Skill, Proposal hoặc Scheduling | `src/app.module.ts`, danh mục `src/modules/`. SH-030–034/022/023 trên sheet “Đang làm” không chứng minh feature đã có.                                                                                                                                                      |
| Schema là catalog, chưa có table nghiệp vụ tương ứng trong migrations                     | `prisma/schema.prisma`, `prisma/migrations/*/migration.sql`. Catalog hiện có 51 model/25 enum; các con số 45/15 trong README Prisma đã cũ. Migrations tạo 21 table identity/foundation. Không cập nhật README số lượng ngoài phạm vi lượt lập plan.                         |
| LR schema thiếu moderation, tags, updatedAt/version                                       | `schema.prisma` model LearningRequest, enum LearningRequestStatus; không có PENDING_MODERATION/REJECTED. Skill không có Tag model hay tag relation.                                                                                                                         |
| Migration workflow khác full client schema                                                | `package.json` chạy `db:migrate` với `identity.prisma`; `scripts/write-identity-schema.mjs` chọn 21 model/8 enum và chỉ prune inverse relations ở User. Thêm Skill/LR phải sửa snapshot generator có kiểm chứng, không migrate cả catalog.                                  |
| Auth runtime đã có, generic SH-002 guard chưa được nối                                    | `IdentityGuard` gán `request.principal`; generic PermissionGuard đòi `authenticatedIdentity`. `IdentityModule` không bind AUTHORIZATION_READER/generic guard. Chỉ import decorator không tạo bảo vệ runtime.                                                                |
| Permission catalog chưa đủ                                                                | Có LR create/approve/reject; thiếu read/update:self/cancel:self/queue. Runtime seed trong users repository chỉ có users.read/users.lock/users.unlock/roles.staff.assign, không có LR grant.                                                                                 |
| AuditWriter khác identity AuditService                                                    | AuditWriter validate action/projection/reason/context; AuditService identity không enforce cùng policy. LR dùng AuditWriter. Snapshot LEARNING_REQUEST_MODERATE hiện chỉ nhận PENDING/APPROVED/REJECTED/REMOVED, nghĩa là moderation state chứ không phải OPEN/NEGOTIATING. |
| Generic reason không phải LR rejection bounds                                             | `reason.policy.ts` hỗ trợ bounds; audit catalog hiện dùng 1–2000, chỉ VERIFY_SKILL_REJECT dùng 10–500. LR phải enforce reject 10–500, approve dùng generic non-empty 1–2000 nếu chưa có policy hẹp hơn.                                                                     |
| Config chưa có LR key/rule list                                                           | Configuration catalog chỉ có các key foundation/path/session/storage. Không có TTL/max expiry/word list; không tự seed số hoặc từ cấm.                                                                                                                                      |
| Notification chỉ có identity emails                                                       | IdentityEmailKind REGISTER_OTP/RESET_OTP/PASSWORD_CHANGED; Notification model chưa có migration/reader/publisher. Outbox có sẵn nhưng không có rejection consumer.                                                                                                          |

## Existing contracts to reuse

| Contract                                                                                             | File                                                                                                                                      |
| ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `TransactionContext = Prisma.TransactionClient`; `TransactionRunner.run<T>(work, {isolationLevel?})` | `src/infrastructure/database/transaction-context.ts`, `transaction-runner.ts`; Serializable mặc định, tối đa 3 attempts, timeout 5 giây.  |
| `SessionsService.principal(token, tx?)`, `assertLive(tx, principal): Promise<Principal>`             | `src/modules/auth/application/services/sessions.service.ts`; đọc account/session/security version và grants hiện hành.                    |
| `Principal { userId, sessionId, securityVersion, roles, permissions }`                               | Cùng file SessionsService; module export qua IdentityModule.                                                                              |
| `AuditWriter.append(tx, input): Promise<{auditId: string}>`                                          | `src/modules/audit/application/audit-writer.ts`; input có actor/action/target/reason/before/after và UUID request/correlation context.    |
| `validateReason(value, {min,max}): string`                                                           | `src/modules/audit/domain/reason.policy.ts`; trim, đếm Unicode code points.                                                               |
| `OutboxWriter.append(tx, {eventId,type,version,payload,correlationId}): Promise<void>`               | `src/infrastructure/events/outbox-writer.ts`; payload tối đa 4096 ký tự serialized, cấm secret fields.                                    |
| `OutboxPublisherRegistry.register(type, publisher)`; `OutboxPublisher.publish(event): Promise<void>` | `src/infrastructure/events/outbox.types.ts`; NotificationsModule đăng ký rejection publisher.                                             |
| `OutboxConsumer.processOnce<T>(consumer, eventId, work)`                                             | `src/infrastructure/events/outbox-consumer.ts`; receipt và consumer writes cùng PostgreSQL transaction.                                   |
| `SystemConfigurationService.getSnapshot(keys, tx?)`                                                  | `src/modules/system-configuration/application/system-configuration.service.ts`; validated values/versions/readAt; thời gian DB khi có tx. |
| `CLOCK`, `Clock.now()`, `parseAbsoluteTimestamp(input)`                                              | `src/shared/time/clock.ts`, `timestamp.policy.ts`; timezone/invalid calendar được kiểm tra.                                               |
| `success`, `paginated`, `PaginationMeta`                                                             | `src/shared/http/response.ts`; giữ Memora envelope hiện có, không tự thêm top-level error.code.                                           |

## Decisions and alternatives

### 1. Giữ một module sở hữu Request, tái sử dụng nền tảng

**Decision**: NestJS modular monolith; Learning Requests sở hữu Request/slots/moderation/lifecycle. Catalog/Sharing Skill và Path/Schedule cung cấp port. Dùng Principal/IdentityGuard đang chạy và kiểm tra action/owner trong application policy sau `assertLive`.

**Rationale**: Không cần đồng thời thay toàn bộ wiring generic SH-002 hoặc chuyển identity endpoints sang authorization framework khác. Danh sách và mutation dùng cùng policy; mutation kiểm tra lại trong transaction.

**Alternatives**: Wire generic guards toàn repo (phạm vi lớn hơn và ảnh hưởng identity); truy cập Prisma bảng module khác trực tiếp từ guard (vi phạm ownership); tách microservice (không cần cho module này).

### 2. Scoped schema và dependency thật

**Decision**: Merge/deploy SH-022 trước; thống nhất tag ID/ownership trước khi thêm request-tag relation. Mở rộng migration snapshot bằng đúng deployed models, prune relations cho mọi selected model. Loại bỏ field LR legacy khỏi contract V1.5 (fields LR không đổi từ V1.4); diff schema chỉ thay chúng nếu xác nhận chưa có consumer/live data cần migration tương thích.

**Rationale**: Full client types không tạo table. Ép migrate toàn bộ catalog sẽ kéo vào Proposal/Schedule/Credit ngoài scope.

**Alternatives**: `db push`/full schema migration (bỏ qua history và CHECK/trigger); tạo một Catalog độc lập trong LR (hai nguồn dữ liệu); bỏ tags khỏi DoD SH-034 (không đáp ứng yêu cầu).

### 3. Moderation xác định, có version

**Decision**: Rule snapshot có version, literal keyword và wildcard pattern với grammar hữu hạn; normalize NFKC/case/whitespace, không bỏ dấu tiếng Việt. Không nhận regex tùy ý. Matcher wildcard dùng thuật toán bounded, không backtracking regex. Filter title/description/learningGoal. Rule set absent/malformed/empty -> unavailable, never auto-OPEN; exact initial terms/categories await PO approval.

**Rationale**: Word/pattern moderation is Must; Gemini is only optional recommendation. User approved normalization/management policy; exact initial terms/categories remain LR-D03.

**Alternatives**: Gemini auto approve/reject (trái SH-114); RegExp tùy ý (rủi ro thời gian chạy khó kiểm soát); chỉ lọc description (bỏ qua nội dung title/goal).

Sanitize text bằng `sanitize-html` với allowedTags=[], allowedAttributes={}, không giữ script/style content; decode output bằng `entities.decodeHTML`, trim/normalize rồi đếm code points trên plain text. Decoder output luôn là dữ liệu JSON, tuyệt đối không dùng như HTML. Ví dụ `<b>Tôi &amp; bạn</b>` thành `Tôi & bạn`, không lưu `&amp;` rồi bắt UI decode lần nữa. Package versions được pin khi cài theo runtime API; typings chỉ thêm nếu cần. Không viết HTML parser bằng regex và không cài package ở lượt lập plan.

`sanitize-html` cho cấu hình allowlist và escape text; `entities` có decodeHTML. Primary references được kiểm tra ngày 2026-10-06: [sanitize-html documentation trong monorepo hiện hành](https://github.com/apostrophecms/apostrophe/tree/main/packages/sanitize-html), [entities README](https://github.com/fb55/entities). Đây là dependencies cần cho SRS sanitize; chỉ API package và generated root lockfile thay đổi khi implement, không thay root tooling/frontend.

### 4. Rejection notification là một deliverable thực tế

**Decision đề xuất**: Rejection + audit + outbox event cùng transaction. Event giữ snapshot reason/owner/request/version tối thiểu, không giữ content/flagged rules. Notifications-owned publisher dùng processOnce để ghi IN_APP Notification và receipt; Notification.id = eventId. Thêm API inbox/read của chính recipient cho slice rejection.

**Rationale**: Đợi SH-110/113 toàn bộ sẽ treo DoD SH-032; chỉ viết outbox không giúp owner đọc được notification. Reason snapshot không mất khi Request được sửa; unique id/receipt xử lý retry.

**Alternatives**: Sending email in a transaction holds locks; outbox-only leaves SH-032 incomplete; building all push/email preferences exceeds scope while OP-05 stays open. User selected IN_APP for LR rejection.

### 5. Đồng bộ state thay vì tin guard/job

**Decision**: Optimistic `expectedVersion` kết hợp lock Request row trong shared PostgreSQL transaction. Filter chạy ngoài transaction trên snapshot bất biến; commit so sánh content/request version và config version. Cancel/expiry/accept/schedule lock dùng cùng giao thức lock và owner contract. Không gọi provider trong transaction.

**Rationale**: Guard trước transaction và expiry job có thể chậm; snapshot stale không được publish/approve, trạng thái không bị job cũ đảo ngược.

**Alternatives**: Check status một lần rồi unconditional update (TOCTOU); tin bảng Scheduling chưa tồn tại là unlocked (không an toàn); trigger ghi thẳng state Request từ module khác (bypass owner rules).

## SRS V1.5 comparison and integration update

Đọc XML paragraphs/tables của cả hai DOCX theo thứ tự tài liệu; so sánh riêng các mục 6.4, 8.2, 18.10, 18.31 và BR-07–12/AC-03/04. Nội dung các phần này không đổi, nên fields/validation/moderation/expiry/search core không thay. [Change report](srs-v1.5-changes.md) ghi nguồn revision/hash và các phần khác có ảnh hưởng.

**Decision**: Cập nhật lifecycle caller contracts theo V1.5 6.14, 18.13/19/32/39/40. LearningPath là thỏa thuận tổng; LearningPlan theo learner. Đủ hai plan đối ứng TWO_WAY hoặc một plan ONE_WAY, learner confirmation hiện hành cùng A/B agreement/schedule confirmation và final validation mới lock/MATCHED. CLOSED sau mọi Session của mọi plan và settlement theo exchangeType commit thành công. Caller owner enforce các precondition trong shared tx; LR không truy cập trực tiếp models/ledger của owner khác.

**Rationale**: Giữ cách hiểu một LearningPath tương đương một plan sẽ cho lock/đóng Request quá sớm. Hai chiều có thể dạy hai skill khác nhau; Request mô tả nhu cầu ban đầu, không ép mọi plan dùng Request.skillId/goal. Việc chọn exchangeType/role/negotiatedCredit diễn ra trong Chat nên không thêm các field này vào Request.

**Dependency**: OP-13 mới cần chốt fee/min-max/refund/cancel/no-show ONE_WAY trước downstream production flow. Không áp 20 Credit/4% TWO_WAY cho ONE_WAY hoặc bắt teacher Hold. Constitution hiện yêu cầu integer Credit/VND; SRS cho precision decimal hoặc integer sub-credit tương đương. Wallet owner cần thống nhất mapping/rounding trong feature tiền; LR không có monetary field, không sửa constitution hay mô hình tiền tại đây. BR-41 OTP cooldown không đổi account thành LOCKED: chỉ thêm access regression LR, OTP implementation vẫn thuộc Identity. Material/OP-14 và các notification/audit riêng của plan/payment/material ngoài scope rejection slice.

**Alternatives**: Add exchangeType/price vào LR (SRS LR không yêu cầu, duplicate agreement data); triển khai LearningPlan/Credit trong feature LR (vượt ownership/scope); chỉ rename Path mà không đổi integration cases (không ngăn MATCHED/CLOSED sớm).

## Updated gate status

User selected A for TTL/edit/cancel/tag taxonomy/versioned moderation/Admin management/Staff review and IN_APP rejection on 2026-10-06. Grant matrix is now explicit in the spec. The moderation engine can ship behind a strict config gate; exact production keywords/categories remain an owner input. Catalog/Tag and downstream SH-042/051/055 runtime ownership still blocks end-to-end release; core LR can be implemented/tested against strict ports.

Spec Kit trước/sau specify/plan chỉ đăng ký hook agent-context optional, không có hook commit/deploy. Đã chạy script context nhưng runtime bundled Python thiếu PyYAML nên script skip; managed plan reference trong API AGENTS.md được cập nhật trực tiếp, giữ các instruction khác. Script Get-CurrentBranch coi API không có `.git` riêng là non-Git và có thể suy ra `007-learning-request`; branch thật được xác minh từ root là `feat/learning-request`, truyền vào setup-plan qua SPECIFY_FEATURE của process. Không tạo nested Git để khắc phục khác biệt tooling này.

## Server-side input libraries

The implementation pins `sanitize-html` 2.18.0 from the Apostrophe monorepo package and `html-entities` 2.6.0. The sanitizer is used only on the API server; HTML entities are decoded after sanitization before storing plain text. Upstream references: [sanitize-html package and Node usage](https://github.com/apostrophecms/apostrophe/tree/main/packages/sanitize-html), [html-entities HTML5 decoding API](https://github.com/mdevils/html-entities).
