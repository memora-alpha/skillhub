# Tag API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ADMIN quản lý tag và duyệt đề xuất của USER, giữ tương thích public lookup và Learning Request.

**Architecture:** Mở rộng module `skills`, tách Tag chính thức và TagCreationRequest. Dùng PostgreSQL transaction, live authorization, idempotency và audit sẵn có; không thêm dịch vụ triển khai riêng hoặc dependency.

**Tech Stack:** NestJS 11, TypeScript 6.0.3, Prisma 7.8/PostgreSQL, class-validator, Swagger, Node test runner theo workspace hiện tại.

**Spec:** [spec.md](spec.md). **Brief:** [brief.md](brief.md). **Usage/rollout:** [quickstart.md](quickstart.md).

**Date:** 2026-10-15. **Implementation/validation:** 2026-10-16.
**Status:** Đã triển khai và kiểm chứng local; xem [validation](validation.md).
Git ở `feature/tag-api`; không đổi branch, commit hoặc push. Migration chỉ chạy
trong PostgreSQL kiểm thử biệt lập, chưa áp dụng lên môi trường dùng chung.
Các path phía dưới tương đối với `services/api`, lệnh chạy từ root monorepo.

## Global Constraints

- Chỉ sửa `services/api`; không đổi frontend/mobile hoặc root/shared packages.
- ADMIN và permission tương ứng đều bắt buộc ở API quản trị, kể cả replay.
- USER được duyệt đề xuất vẫn giữ role hiện tại; không có role quản trị từng tag.
- Giữ `GET /api/v1/tags` public, shape `{id,label}`, filter ACTIVE và cursor hiện tại.
- Label mới dài 1–80 Unicode code points; normalize NFC/trim/gộp whitespace/lowercase key, giữ dấu và ký hiệu.
- Reason quản trị 1–2000 code points sau trim; `expectedVersion` integer ≥ 1.
- Không xóa cứng Tag/RequestTag; không thay id hoặc bịa metadata người tạo legacy.
- Không thêm quota, cooldown, notification/SSE hoặc alias/merge khi chưa chốt yêu cầu.
- Người dùng đã chấp nhận plan/brief và yêu cầu triển khai; các rule V1 nằm trong spec.

## Review Focus

1. Hai Admin quyết định cùng request: một winner, một conflict, một lịch sử quyết định (Task 4).
2. Hai request hoặc Admin-create và approve cùng tên: một canonical Tag, không lỗi transaction bị abort (Task 2/4).
3. Unicode, khoảng trắng, `C++`/`C#`, tag legacy trùng: không mất phân biệt hoặc tự merge tham chiếu (Task 1/2).
4. Replay sau mất quyền/đổi role/thu hồi session và đọc request người khác: không bypass quyền (Task 2/3/4).
5. Ẩn tag chạy đồng thời với tạo/sửa/publish Learning Request: kết quả được tuần tự hóa, bài cũ vẫn đọc được (Task 2/5).

## File map và interfaces

| Create/modify                                                                                                                            | Trách nhiệm                                                                                                                  |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Create `src/modules/skills/domain/tag-policy.ts`                                                                                         | `normalizeTagLabel(value:string):{label:string;labelKey:string}`, validate input, `TAG_PERMISSIONS`, kiểm tra ADMIN từ Actor |
| Create `src/modules/skills/infrastructure/tags.repository.ts`                                                                            | Tag/request persistence, scoped lists, row locks, conflict-safe insert                                                       |
| Create `src/modules/skills/application/tags.service.ts`                                                                                  | `TagsService.adminList/create/update`                                                                                        |
| Create `src/modules/skills/application/tag-requests.service.ts`                                                                          | `TagRequestsService.create/mine/mineDetail/adminList/adminDetail/approve/reject`                                             |
| Create `src/modules/skills/application/tag-contracts.ts`                                                                                 | Input/query/page types cho signatures dưới đây, theo field allowlist trong spec                                              |
| Create `src/modules/skills/presentation/http/tags.dto.ts`                                                                                | DTO và Swagger responses cho admin/self; không thay public TagResponse                                                       |
| Create `src/modules/skills/presentation/http/admin-tags.controller.ts`                                                                   | Admin list/create/update                                                                                                     |
| Create `src/modules/skills/presentation/http/tag-requests.controller.ts`                                                                 | Submit, self history và admin review endpoints                                                                               |
| Modify `src/modules/skills/skills.module.ts`, `src/modules/skills/application/skills.service.ts`                                         | Đăng ký providers/controllers; khóa tag trong owner selection contract hiện có                                               |
| Modify `prisma/runtime-support.prisma`, `scripts/generate-runtime-schema.mjs`, regenerate `prisma/schema.prisma`                         | Model/request enums, User backrelations, generated runtime schema                                                            |
| Create `prisma/migrations/20261015000000_tag_creation_requests/migration.sql`, `scripts/preflight-tags.mjs`                              | Additive migration, constraints/indexes, collision report trước migrate                                                      |
| Modify `src/shared/authorization/permission.catalog.ts`, `src/modules/users/infrastructure/persistence/prisma-users-repository.ts`       | Catalog quyền và seed grant từ TAG_PERMISSIONS, chạy lại an toàn                                                             |
| Modify `src/modules/audit/domain/audit-action.catalog.ts`                                                                                | Năm action mới và strict snapshot schemas                                                                                    |
| Create `test/tags/{policies,migration,catalog,requests,decisions,http}.test.mjs`, `test/tags/helpers.mjs`                                | Policy, real PostgreSQL, auth/HTTP/race/rollback; reuse skills fixture                                                       |
| Modify `test/skills/tags.test.mjs`, `package.json`, `README.md`, `prisma/README.md`; create `specs/009-tags/validation.md` khi implement | Regression, test scripts, rollout và bằng chứng thực tế                                                                      |

`SkillCommand` dùng lại từ `src/modules/skills/application/skill-contracts.ts`. Input types:
`CreateTagInput={label:string}`; `UpdateTagInput={label?:string;status?:'ACTIVE'|'INACTIVE';expectedVersion:number;reason:string}`;
`CreateTagRequestInput={label:string}`; `ApproveTagRequestInput={expectedVersion:number}`;
`RejectTagRequestInput={expectedVersion:number;reason:string}`.
Query catalog có `q?,status?,limit,cursor?`; query request có `status?,limit,cursor?`.
`Page<T>` là `{data:T[];pagination:{limit:number;hasMore:boolean;nextCursor:string|null}}`.
Services trả generated Prisma `Tag`/`TagCreationRequest`; controllers project response
allowlist trong spec, không trả thẳng model chứa `labelKey`.

## Task 1 — Schema, normalization và migration an toàn

**Files:** policy, runtime-support, generator/runtime schema, preflight, migration,
`test/tags/policies.test.mjs`, `test/tags/migration.test.mjs`, helpers trong file map.
**Consumes:** Tag/RequestTag đang có và skills test fixture. **Produces:** generated
`TagCreationRequest`, `TagCreationRequestStatus`, Tag metadata và `normalizeTagLabel`.

- [x] Viết policy tests: `JavaScript`, `javascript`, `JAVA\u0053CRIPT` cùng key;
      chuỗi NFC/NFD tương đương; `C++`, `C#`, `C` khác key; 80 code points hợp lệ,
      81/rỗng/control characters kể cả tab/newline ở input gốc bị từ chối. Kiểm tra
      gộp whitespace hợp lệ và giữ dấu.
- [x] Chạy test mới qua build + Node test runner; xác nhận fail do policy chưa có.
- [x] Implement `normalizeTagLabel` ở file đã định; không dùng `nameKey` của Skill
      vì helper đó khóa giới hạn 2–100, không đúng contract Tag.
- [x] Viết migration tests: backfill id/label/status/RequestTag không đổi;
      duplicate normalized key và label không hợp lệ làm preflight/migrate dừng;
      metadata legacy null; CHECK quyết định và partial unique hoạt động.
- [x] Implement model/index/check theo spec. Preflight dùng cùng policy ứng dụng;
      migration recheck collision trước đặt unique. Đối chiếu SQL backfill với key
      tính bằng policy Node cho từng row; thử thêm tiếng Việt, Unicode whitespace,
      I/İ và các chữ ngoài ASCII để phát hiện khác biệt collation/lowercase. Nếu
      lệch thì dừng rollout trước mở writer. Chặn tag writers trong rollout
      preflight→migration→đối chiếu; không sửa catalog v3 lịch sử.
- [x] Generate runtime schema hai lần, xác nhận output ổn định; chạy schema
      validation và migration test trên PostgreSQL biệt lập. Expected: pass, không
      có auto merge hoặc mất liên kết.

## Task 2 — ADMIN quản trị danh mục tag

**Files:** TagsRepository, TagsService, tag-contracts, admin controller/DTO/module,
permission catalog/seed, audit catalog, `SkillsService`, catalog/HTTP tests.
**Consumes:** Task 1, SkillActorService, IdempotencyService, AuditWriter.
**Produces:** `TagsService.adminList(command,query):Promise<Page<Tag>>`,
`create(command,input:CreateTagInput):Promise<Tag>`,
`update(command,id:string,input:UpdateTagInput):Promise<Tag>`.

- [x] Viết tests: USER/STAFF bị 403, kể cả STAFF được grant `tag:create`;
      ADMIN thiếu permission bị 403; ADMIN hợp lệ tạo ACTIVE, creator đúng Admin;
      seed hai lần không tạo grant trùng; default STAFF không có quyền tag.
- [x] Viết tests rename/status/version/reason, PATCH rỗng/null/unknown fields;
      duplicate normalized labels trả 409; legacy ARCHIVED trả TAG_ARCHIVED;
      replay không tạo audit mới, replay sau revoke/role change bị chặn.
- [x] Chạy tests để thấy fail; implement ba API admin và grants/audit schemas.
      Các actor field lấy từ server. Các list admin kiểm tra live quyền trong tx.
- [x] Bổ sung khóa Tag theo UUID tăng dần khi `SkillsService.assertActiveSelection`
      kiểm tra ACTIVE; public/historical `readSelections` tiếp tục đọc cả tag ẩn.
      Admin update khóa cùng row. Lock order mở rộng: users → LearningRequest nếu có
      → Skill nếu có → Tag theo UUID; dùng suffix khi luồng không có entity trước.
- [x] Chạy catalog/HTTP tests và lookup regression. Expected: role/quyền/audit,
      duplicate/concurrency và shape public đều đúng; không sửa route lookup hiện tại.

## Task 3 — USER gửi đề xuất và đọc lịch sử

**Files:** TagRequestsService/Repository/contracts/DTO/controllers/module,
request/HTTP tests và audit action TAG_REQUEST_CREATE.
**Consumes:** Task 1/2, generated model, normalizer, permission seed.
**Produces:** `create(command,input:CreateTagRequestInput):Promise<TagCreationRequest>`,
`mine(command,query):Promise<Page<TagCreationRequest>>`,
`mineDetail(command,id:string):Promise<TagCreationRequest>`;
`adminList/adminDetail` signatures tương tự nhưng có ADMIN + read permission.

- [x] Viết tests: submit tạo PENDING, owner lấy từ session; không có Tag mới;
      cùng owner/label chỉ một PENDING; hai owner được lưu request độc lập;
      tag ACTIVE có sẵn trả TAG_ALREADY_EXISTS, tag ẩn trả TAG_UNAVAILABLE.
- [x] Viết tests scope mine/detail và cursor owner/filter; người khác đọc trả
      404; unknown owner/status/reviewer payload bị 400; live restriction/thu hồi
      permission chặn cả request mới lẫn idempotent replay.
- [x] Chạy tests để thấy fail; implement submit/list/detail theo allowlist.
      Chặn restriction `ALL`/permission cụ thể; submit còn chặn CREATE_NEW_ACTIVITY.
      Không tái dùng assertAllowed của Learning Request vì helper đó kiểm tra scope
      riêng `learning-request:create`.
- [x] Chạy requests/HTTP tests. Expected: chỉ đúng owner/Admin đọc được, cursor
      phân trang ổn định, request chưa duyệt không xuất hiện trong public lookup.

## Task 4 — ADMIN approve/reject nguyên tử

**Files:** TagRequestsService/Repository, review endpoints, audit schemas,
`test/tags/decisions.test.mjs`, HTTP tests.
**Consumes:** Tasks 1–3 và idempotency transaction context hiện có.
**Produces:** `approve(command,id:string,input:ApproveTagRequestInput):Promise<TagCreationRequest>`;
`reject(command,id:string,input:RejectTagRequestInput):Promise<TagCreationRequest>`.

- [x] Viết tests PENDING→APPROVED/REJECTED, lưu reviewer/time/result/reason;
      expectedVersion cũ trả STALE_VERSION; quyết định lần hai dùng key mới trả
      TAG_REQUEST_NOT_PENDING; USER không đổi role sau approve.
- [x] Viết real-PG tests approve/approve, approve/reject cùng request; approve
      hai request cùng label; Admin-create đua approve; audit throw rollback toàn bộ.
      Assertions: một canonical Tag, một quyết định/request, không metadata dở dang.
- [x] Chạy tests để thấy fail; implement authorize → khóa request → kiểm tra
      version/state → insert-on-conflict theo labelKey → khóa/revalidate Tag →
      cập nhật request/version → audit → receipt trong một transaction. Review dùng
      users → TagCreationRequest → Tag; không code path khóa Tag rồi khóa request.
- [x] Approve liên kết Tag ACTIVE đã có; Tag ẩn trả 409, request vẫn PENDING.
      Dùng SQL ON CONFLICT và TransactionRunner retry toàn tx khi cần, không tiếp
      tục tx đã abort. Giữ isolation/retry policy hiện có, không thêm retry wrapper.
      Khi tạo mới ghi TAG_CREATE và TAG_REQUEST_APPROVE; khi liên kết chỉ ghi approve.
- [x] Chạy decisions/HTTP tests; thêm replay cùng key/body, key khác body,
      revoke permission/session trước replay. Expected: không thêm tag/audit khi
      replay; rollback và live authorization vẫn hoạt động.

## Task 5 — Regression, docs và rollout

**Files:** tests/scripts/docs/validation trong file map.
**Consumes:** Toàn bộ slices. **Produces:** API contract đã test và validation
ghi rõ bằng chứng local, check chưa chạy và hướng rollout.

- [x] Thêm regression PostgreSQL: approve → GET tags → tạo Learning Request
      dùng tagId; request PENDING không dùng được; hide → không chọn mới được;
      detail bài cũ vẫn đọc tag. Chạy hide đồng thời create/edit/publish: nếu hide
      commit trước selection thì selection bị từ chối; nếu selection khóa trước
      thì command hoàn tất trước hide. Kiểm tra không deadlock với skill locks.
- [x] Test Swagger đủ 10 route mới, Bearer/key/version/reason/errors, public
      lookup không đổi. Test admin list mọi status và owner list không lộ dữ liệu.
- [x] Thêm scripts `test:tags` (build + policies) và `test:tags:integration`
      (require-integration-env + build + migration/catalog/requests/decisions/http,
      concurrency=1 giữa files). Require TEST_DATABASE_URL; không fallback DB thật.
- [x] Chạy tuần tự: `pnpm --filter api db:validate:runtime`, `pnpm --filter api lint`,
      `pnpm --filter api check-types`, `pnpm --filter api build`,
      `pnpm --filter api test:tags`, `pnpm --filter api test:tags:integration`.
      Expected: exit 0; integration thiếu env phải fail rõ, không coi skip là pass.
- [x] Chạy affected suites: `pnpm --filter api test:skills:integration`,
      `pnpm --filter api test:learning-request`,
      `pnpm --filter api test:learning-request:integration`,
      `pnpm --filter api test:rbac`, `pnpm --filter api test:audit`.
      Các suite không có storage chỉ được ghi nhận theo coverage thực sự đã chạy.
- [x] Cập nhật README/schema docs, thêm validation report. Rollout: preflight
      dữ liệu → xử lý collision qua quyết định riêng nếu có → migrate → identity seed
      idempotent → deploy API → smoke USER/Admin/lookup/Learning Request. Dùng cửa sổ
      bảo trì chặn writer; không tự chạy deploy/migrate môi trường dùng chung.

Mỗi task có thể review riêng; khi thực thi lưu checkpoint bằng diff đã kiểm tra.
Commit/push chỉ làm khi được yêu cầu, không tự coi bước lập plan là cho phép commit.

## Constitution Check

Đối chiếu constitution v1.2.0 khi thiết kế ngày 2026-10-15 và kiểm chứng ngày 2026-10-16.

| Principle               | Thiết kế                                                          | Bằng chứng triển khai                                     |
| ----------------------- | ----------------------------------------------------------------- | --------------------------------------------------------- |
| 1. Scope/architecture   | Pass: API-only, mở rộng owner skills, không empty layers          | Pass: source/DI/build và review độc lập                   |
| 2–3. Store/atomicity    | Pass: PostgreSQL authoritative; review/audit/receipt cùng tx      | Pass local: migration, race, rollback                     |
| 4. Auth/privacy         | Pass: ADMIN + permission, live replay, owner scope                | Pass: role/revoke/IDOR tests                              |
| 5. Contracts/validation | Pass: Swagger, UTC, bounded cursors, allowlists                   | Pass: schema/HTTP/Swagger tests                           |
| 6. Verification         | Pass: kiểm chứng theo phạm vi feature                             | Pass local: lint/types/build và các suite ở validation    |
| 7. Ownership            | Pass: skills sở hữu Tag/request; LR dùng SkillsService contract   | Pass: create/edit/publish và historical detail regression |
| 8. Delivery             | Not applicable: V1 chưa phát event/notification hoặc gọi provider | Mở lại check nếu mở rộng scope                            |
| Git                     | Pass: giữ branch hiện hữu, không commit/push                      | Diff và phạm vi được kiểm tra trước bàn giao              |

## Complexity Tracking và review trước implementation

Không có ngoại lệ constitution. Một bảng request giữ lịch sử độc lập; không thêm
queue worker hoặc module triển khai riêng. Chưa cần migration dữ liệu giữa stores.
Plan/brief đã được duyệt; không có thay đổi policy khi thực thi. Các test fixtures
Learning Request cũ được cập nhật theo schema hiện có và default grants mới để
regression chạy được; không đổi nghiệp vụ Learning Request. Shared tag locks
cho phép nhiều selection đồng thời và chặn hide cho tới khi transaction kết thúc.
Preflight chặn lệch chuẩn hóa DB/Node thay vì âm thầm sửa legacy data. Các giới
hạn rollout và kết quả review được ghi trong validation.
