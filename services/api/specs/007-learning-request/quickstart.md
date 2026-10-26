# Learning Request quickstart

## Public owner avatar — 2026-10-26

Feed, recommended and public detail now include `owner.avatarUrl: string | null`.
Use that value directly for avatars instead of a separate profile API call. Null
means no selected CLEAN avatar; show the client placeholder. URLs use the existing
60-second signing policy. Cached lists must handle expired URLs before loading
images that have not been cached. Backend rollout requires a normal build/restart,
without migration, seed or new environment variables. Smoke with an authenticated
non-owner on all three routes, with/without a CLEAN avatar. Verify the signed URL
loads an image in staging, and mobile rendering immediately and from a list cache
older than 60 seconds. Owner/moderation projections retain their existing fields.

See [plan](owner-avatar-plan.md) and [validation](validation.md) for evidence and
the separate mobile consumption follow-up.

## FE payload after the 2026-10-12 extension

Use `GET /api/v1/skills`, `GET /api/v1/me/skills`, and `GET /api/v1/tags?q=react` to obtain actual catalog/profile IDs. The offered sharing IDs belong to the request owner. Create example (replace illustrative UUIDs):

```json
{
  "title": "Muốn học React từ cơ bản đến nâng cao",
  "skillId": "11111111-1111-4111-8111-111111111111",
  "description": "Mình muốn học React hooks và cách xây dựng component tái sử dụng.",
  "learningGoal": "Tự xây dựng ứng dụng React hoàn chỉnh.",
  "teachingOverview": "Mình có thể hướng dẫn JavaScript cơ bản và cách xử lý dữ liệu.",
  "offeredSharingSkillIds": ["22222222-2222-4222-8222-222222222222"],
  "tagIds": ["33333333-3333-4333-8333-333333333333"],
  "desiredCreditPerHour": "50.00",
  "preferredAvailability": {
    "timeZone": "Asia/Ho_Chi_Minh",
    "weeklySlots": [
      { "weekday": "MON", "startTime": "19:00", "endTime": "21:00" },
      { "weekday": "SAT", "startTime": "09:00", "endTime": "12:00" }
    ]
  }
}
```

PATCH uses the same optional fields plus `expectedVersion`. To clear them, send nullable fields as null and offered IDs as []. Responses normalize the hourly budget to two decimal places and include `offeredSharingSkills` with real skill metadata. Card data is returned by feed/recommended as well as detail.

Deployment from services/api: `pnpm db:deploy`, then restart `pnpm dev`. The extension tests apply all migrations in a disposable schema; this does not deploy the user's existing database. Swagger remains at `/api/docs` (default local port3001); schema verification does not require starting the API.

The original planning notes below are historical; use the full current runtime schema/migrations and the recorded validation rather than the old identity-only migrate commands.

Ngày 2026-10-06. Đây là checklist triển khai/kiểm chứng sau khi plan được review, **không phải hướng dẫn chạy module đã có**. Lượt lập plan chưa tạo endpoints/test scripts/migrations mới.

## Before implementation

1. Đọc [spec](spec.md), [plan](plan.md), [data model](data-model.md), [HTTP](contracts/http.md) và [module ports](contracts/module-ports.md).
2. Accepted decisions are recorded in [spec](spec.md): default TTL 30d/custom max 90d, editable through pre-NEGOTIATING, cancel before Schedule LOCKED, canonical Catalog tags, versioned admin-managed rules preserving accents, explicit grant matrix and IN_APP rejection. PO must approve exact initial rule terms before production.
3. Merge SH-022 migration/exports trước release create/publish; SH-023 trước release recommendations. Verify actual source và deployed tables, không dựa vào sheet status.
4. Continue on feat/learning-request; no commit/push without separate authorization.
5. Đọc [đối chiếu SRS V1.5](srs-v1.5-changes.md) trước tích hợp SH-042/051/055: đủ LearningPlan/learner/agreement/schedule confirmation theo TWO_WAY/ONE_WAY, completion tất cả Session và settlement. Chốt contract/lock order với downstream owners; OP-13 là policy gate ONE_WAY, không tạo thêm field Credit/LearningPlan trong LR.

## Current planning checks

Từ repository root:

```powershell
git branch --show-current
pnpm exec prettier --check 'services/api/specs/007-learning-request/**/*.md' services/api/AGENTS.md services/api/.specify/feature.json
```

Từ services/api:

```powershell
$env:SPECIFY_FEATURE = 'feat/learning-request'
powershell.exe -NoProfile -ExecutionPolicy Bypass -File './.specify/scripts/powershell/check-prerequisites.ps1' -Json
```

Prerequisites kiểm tra tài liệu tồn tại, không chứng minh policy đã chốt hay feature implement. Process override giữ branch thật và execution policy chỉ áp dụng child process; không đổi policy máy. Script hiện coi API không có `.git` riêng là non-Git; branch thật lấy từ Git root. Không tạo nested Git.

## After implementation

Dependencies cài từ root bằng pnpm install. Credentials/config nằm trong ignored environment files; không đưa database test/production secrets vào docs.

Scoped migration flow từ services/api, chỉ trên database phát triển/test đã xác minh:

```powershell
node scripts/write-identity-schema.mjs
pnpm exec prisma validate --schema prisma/identity.prisma
pnpm exec prisma migrate dev --schema prisma/identity.prisma --name learning_requests
```

Review SQL trước áp dụng: chỉ LR/slots/request-tag/Notification và approved Catalog dependencies; không Proposal/Schedule/Credit, không mất CHECK/triggers hiện có. TEST_DATABASE_URL là database riêng. Không chạy db push/full catalog migration để tránh thiếu table.

Sau khi các script Task 7 thực sự được thêm, từ root:

```powershell
pnpm --filter api lint
pnpm --filter api check-types
pnpm --filter api build
pnpm --filter api db:validate
pnpm --filter api test:learning-request
pnpm --filter api test:learning-request:integration
```

Integration require TEST_DATABASE_URL, migrations mới đã apply ở database riêng. Worker recovery cần Redis; record checks không chạy được. Sau sanitizer/config/audit/permission changes, chạy regression tương ứng theo plan.

## Acceptance walkthrough

- ACTIVE User có grant tạo draft đúng field bounds; invalid Skill/tags/slot/owner/status input bị chặn.
- Publish bài sạch -> OPEN, flagged -> PENDING_MODERATION; feed không lộ pending.
- Staff có grant reject với reason10–500; owner xem reason và notification. Replay cùng event vẫn một notification. Approve cần live quyền/reason/pending/version.
- Owner sửa rejected rồi republish, stale Staff review không áp dụng; cancel trước lock giữ history; cancel/expiry/accept/lock race cho kết quả an toàn.
- Search/pagination/own queue/private projections đúng scope; recommended dùng real SharingSkill adapter. Expiry action check không phụ thuộc job đã chạy.
- V1.5 owner-flow checks: thiếu một plan/learner confirm TWO_WAY không MATCHED; ONE_WAY teacher không phải Hold hay đủ 20 Credit; partial completion/dispute/settlement rollback không CLOSED. Có confirmation mà chưa lock không tự MATCHED. Fake tests chỉ kiểm tra protocol, real Path/Wallet evidence còn cần.
- ACTIVE account có session/grant hợp lệ không bị chặn LR chỉ vì OTP email cooldown; OTP softban được implement/verify ở Identity.
- Ghi exact commands/outcomes/infra và pending gates vào [validation](validation.md); chỉ đánh dấu SH-030–034 hoàn tất khi source/runtime có bằng chứng tương ứng.
