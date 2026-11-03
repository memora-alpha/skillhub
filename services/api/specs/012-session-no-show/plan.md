# Session no-show Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development`
> (khuyến nghị) hoặc `superpowers:executing-plans` để triển khai từng task.
> Các bước dùng checkbox (`- [ ]`). Checklist **không** tự cho phép commit, push
> hoặc deploy: bước "Commit" chỉ chạy khi người dùng đã cho phép commit.

**Goal:** Ghi nhận tham gia LiveKit thật, tự xác định vắng, chặn xác nhận khi có
người vắng, timeout/chốt kết quả Session, vắng có lý do, nối Report/uy tín và trả
contract rõ cho mobile (phần A + B + D của spec).

**Architecture:** Interval kết nối theo participant SID (webhook + heartbeat worker)
→ hàm thuần trong `domain/attendance.policy.ts` tính giây/verdict → outcome theo
từng occurrence. Mọi chuyển trạng thái nằm trong hàm thuần nhận `tx` ở
`application/services/session-transitions.ts`, dùng chung cho
`LearningSessionsService`, `SessionOutcomeService` (worker + excuse) và
`ReportsService` (ruling) mà không tạo vòng DI. Credit không đổi: settlement vẫn
chỉ chạy khi mọi Session `COMPLETED`.

**Tech Stack:** NestJS 11, TypeScript 6, Prisma 7.8/PostgreSQL, `livekit-server-sdk`,
Node test runner (`node --test`, import từ `dist`), class-validator, Zod.

**Spec:** [spec.md](spec.md). **Ngày:** 2026-10-29.

Paths tính từ `services/api`; lệnh `pnpm` chạy trong `services/api` trừ khi ghi rõ.

## Execution status — 2026-11-03

Tasks 1–13 implemented and verified with Superpowers TDD, independent review and Ponytail full.
See [validation.md](validation.md) for actual commands, results and review fixes;
[contracts.md](contracts.md) describes the client contract change.
Commit steps are deliberately unchecked: no commit/push/deploy was requested.
Task 2 Step 6 is rollout work, not run against the developer/runtime database.
Migration SQL was generated with Prisma schema diff and exercised by the existing
isolated PostgreSQL test-schema harness instead of migrate-dev on a live database.
The task code blocks below record the initial implementation plan; the reviewed
source includes the corrections recorded in validation.md (saved policy, early
reports, Staff replay/penalty guards, heartbeat recovery and conservative backfill).

## Global Constraints

- Ngưỡng đã chốt: `lateGraceMinutes: 10`, `minAttendancePercent: 80`,
  `dataSettleMinutes: 10`, `confirmWindowHours: 24`, `disputeWindowHours: 48`,
  `makeupWindowDays: 7` (key `session.attendancePolicy`, mutable, có default).
- `schema.prisma` là file **sinh ra**: sửa `scripts/generate-runtime-schema.mjs`
  hoặc `prisma/runtime-support.prisma`, rồi chạy `pnpm db:generate:runtime-schema`.
  Không sửa tay `schema.prisma`, không sửa `catalog.prisma`.
- Migration chỉ thêm; không sửa migration đã có.
- Giữ thứ tự khóa Path → Session (`lockedSession`); không gọi LiveKit trong transaction.
- LiveKit lỗi/disabled hoặc thiếu `livekit.joinWindow` chỉ dẫn tới `UNVERIFIABLE`, không bao giờ `ABSENT`.
- Không có giao dịch Credit theo buổi; không sửa `PathSettlementPort`.
- `applyNoShow` chỉ được gọi từ `finalizeNoShow` (worker / Staff UPHOLD).
- Outbox `dedupeKey` cố định theo outcome/excuse để không gửi trùng.
- BigInt ra API là string. Ngày giờ UTC ISO.
- Không sửa `apps/*`. Không bypass git hooks.
- Test import `dist`: script `test:*` đã `nest build`; integration cần `TEST_DATABASE_URL` đã migrate.
- Sonar: `sort` luôn có comparator; không nested ternary; vòng `await` phải có lý do (khóa/tuần tự).

## File Structure

| File                                                                              | Trách nhiệm                                                                                 |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `src/modules/system-configuration/domain/configuration.catalog.ts`                | Key `session.attendancePolicy`                                                              |
| `scripts/generate-runtime-schema.mjs`                                             | Overlay cột Session, enum SessionStatus, ReportCase.reporterId nullable, back-relation User |
| `prisma/runtime-support.prisma`                                                   | 3 model + 7 enum mới                                                                        |
| `prisma/migrations/<ts>_session_no_show/migration.sql`                            | Migration + backfill                                                                        |
| `src/modules/learning-sessions/domain/attendance.policy.ts`                       | Hàm thuần: giây, verdict, case, các mốc thời gian                                           |
| `src/modules/learning-sessions/domain/attendance-view.ts`                         | Hàm thuần: projection `attendance`/`deadlines`/`allowedActions`                             |
| `src/modules/learning-sessions/application/services/session-tx.ts`                | `lockSession`, `lockedSession`, `databaseNow`, `loadAttendanceContext`                      |
| `src/modules/learning-sessions/application/services/session-attendance.ts`        | Ghi interval từ webhook/heartbeat                                                           |
| `src/modules/learning-sessions/application/services/session-transitions.ts`       | determine/complete/makeup/finalize/ruling/emit                                              |
| `src/modules/learning-sessions/application/services/session-outcome.service.ts`   | Injectable: heartbeat, finalizeDue, excuse                                                  |
| `src/modules/learning-sessions/application/services/learning-sessions.service.ts` | Token stamp, webhook intervals, `ensureDetermined`, confirm gate, detail/mine               |
| `src/modules/learning-sessions/infrastructure/jobs/session-lifecycle.worker.ts`   | Heartbeat + determine + finalize                                                            |
| `src/modules/learning-sessions/infrastructure/livekit/livekit.service.ts`         | Trả participant SID                                                                         |
| `src/modules/learning-sessions/presentation/http/*`                               | Endpoint excuse, DTO                                                                        |
| `src/modules/reports/**`                                                          | System case, outcome DISPUTED, ruling, dispute window từ config                             |
| `src/modules/reputation/application/services/reputation.service.ts`               | `applyNoShow` theo outcome                                                                  |
| `src/modules/scheduling/application/services/scheduling.service.ts`               | Học bù từ `MAKEUP_REQUIRED`, reset occurrence                                               |
| `src/modules/notifications/infrastructure/events/session-notification.handler.ts` | Thông báo Session                                                                           |
| `test/learning-sessions/attendance-policy.test.mjs`                               | Unit hàm thuần                                                                              |
| `test/learning-sessions/attendance.test.mjs`                                      | Fake-DB: interval, determine, confirm gate, finalize, excuse, ruling, makeup                |

---

### Task 1: Cấu hình `session.attendancePolicy`

**Files:**

- Modify: `src/modules/system-configuration/domain/configuration.catalog.ts` (sau `"session.durationMinutes"`)
- Modify: `test/learning-platform/fixtures.mjs:24-28` (`defaultConfiguration`)
- Test: `test/learning-sessions/configuration.test.mjs`

**Interfaces:**

- Produces: `ConfigurationValue<"session.attendancePolicy">` =
  `{ lateGraceMinutes; minAttendancePercent; dataSettleMinutes; confirmWindowHours; disputeWindowHours; makeupWindowDays }` (number).
- Produces: `defaultConfiguration["session.attendancePolicy"]` trong fixtures (mọi test fake-DB và integration stub dùng).

- [x] **Step 1: Viết test fail** — thêm vào cuối `test/learning-sessions/configuration.test.mjs`:

```js
test("attendance policy is mutable, defaulted and strict", () => {
  const definition = CONFIGURATION_DEFINITIONS["session.attendancePolicy"];
  assert.equal(definition.mutable, true);
  const value = {
    lateGraceMinutes: 10,
    minAttendancePercent: 80,
    dataSettleMinutes: 10,
    confirmWindowHours: 24,
    disputeWindowHours: 48,
    makeupWindowDays: 7,
  };
  assert.deepEqual(definition.defaultValue, value);
  assert.deepEqual(
    parseConfigurationValue("session.attendancePolicy", value),
    value,
  );
  for (const bad of [
    { ...value, minAttendancePercent: 0 },
    { ...value, minAttendancePercent: 101 },
    { ...value, confirmWindowHours: 48 },
    { ...value, lateGraceMinutes: 1.5 },
    { ...value, extra: 1 },
  ]) {
    assert.throws(() =>
      parseConfigurationValue("session.attendancePolicy", bad),
    );
  }
});
```

- [x] **Step 2: Chạy, xác nhận fail**

Run: `pnpm nest build; node --test test/learning-sessions/configuration.test.mjs`
Expected: FAIL (`definition` undefined).

- [x] **Step 3: Implement** — trong `CONFIGURATION_DEFINITIONS`, ngay sau `"session.durationMinutes"`:

```ts
  "session.attendancePolicy": {
    schema: z
      .object({
        lateGraceMinutes: z.number().int().min(0).max(180),
        minAttendancePercent: z.number().int().min(1).max(100),
        dataSettleMinutes: z.number().int().min(0).max(120),
        confirmWindowHours: z.number().int().min(1).max(720),
        disputeWindowHours: z.number().int().min(1).max(720),
        makeupWindowDays: z.number().int().min(1).max(90),
      })
      .strict()
      // Absent parties must still be able to dispute after the confirm timeout.
      .refine((value) => value.confirmWindowHours < value.disputeWindowHours),
    mutable: true,
    defaultValue: {
      lateGraceMinutes: 10,
      minAttendancePercent: 80,
      dataSettleMinutes: 10,
      confirmWindowHours: 24,
      disputeWindowHours: 48,
      makeupWindowDays: 7,
    },
  },
```

Và trong `test/learning-platform/fixtures.mjs`, thêm vào `defaultConfiguration`:

```js
  "session.attendancePolicy": {
    lateGraceMinutes: 10,
    minAttendancePercent: 80,
    dataSettleMinutes: 10,
    confirmWindowHours: 24,
    disputeWindowHours: 48,
    makeupWindowDays: 7,
  },
```

- [x] **Step 4: Chạy lại** — `pnpm test:configuration; pnpm nest build; node --test test/learning-sessions/configuration.test.mjs` → PASS.

- [ ] **Step 5: Commit** (nếu được phép)

```bash
git add src/modules/system-configuration/domain/configuration.catalog.ts test/learning-platform/fixtures.mjs test/learning-sessions/configuration.test.mjs
git commit -m "feat(api): add session attendance policy"
```

---

### Task 2: Schema, migration và backfill

**Files:**

- Modify: `scripts/generate-runtime-schema.mjs` (thêm overlay trước khối "Runtime: v3 ..." ở cuối file)
- Modify: `prisma/runtime-support.prisma` (append)
- Generate: `prisma/schema.prisma`, `src/generated/prisma/**`
- Create: `prisma/migrations/<timestamp>_session_no_show/migration.sql`

**Interfaces:**

- Produces Prisma delegates: `tx.sessionAttendanceInterval`, `tx.sessionAttendanceOutcome`, `tx.sessionAbsenceExcuse`.
- Produces compound unique: `sessionId_participantSid`, `sessionId_occurrenceStartAt`; `outcomeId` unique trên excuse.
- Produces Session fields: `teacherTokenIssuedAt`, `learnerTokenIssuedAt`, `lastObservedAt`, `observationFailedAt`, `confirmDeadlineAt`, `makeupDeadlineAt` (`DateTime | null`).
- Produces enum values: `SessionStatus.NO_SHOW`, `SessionStatus.MAKEUP_REQUIRED`; enums `AttendanceRole`, `AttendanceCloseSource`, `AttendanceVerdict`, `AttendanceCase`, `AttendanceOutcomeStatus`, `SessionResolution`, `AbsenceExcuseStatus`.
- `ReportCase.reporterId: string | null`.

- [x] **Step 1: Overlay trong generator** — thêm trước dòng `schema = schema.replace(/^\/\/ Logical v3...`:

```js
// Session no-show (spec 012): attendance evidence, deadlines and two outcome states.
schema = schema.replace(/enum SessionStatus \{[\s\S]*?\n\}/, (block) =>
  fields(block, "  NO_SHOW\n  MAKEUP_REQUIRED"),
);
model("Session", (block) =>
  fields(
    block,
    `
  teacherTokenIssuedAt DateTime? @map("teacher_token_issued_at") @db.Timestamptz(3)
  learnerTokenIssuedAt DateTime? @map("learner_token_issued_at") @db.Timestamptz(3)
  lastObservedAt DateTime? @map("last_observed_at") @db.Timestamptz(3)
  observationFailedAt DateTime? @map("observation_failed_at") @db.Timestamptz(3)
  confirmDeadlineAt DateTime? @map("confirm_deadline_at") @db.Timestamptz(3)
  makeupDeadlineAt DateTime? @map("makeup_deadline_at") @db.Timestamptz(3)
  attendanceIntervals SessionAttendanceInterval[] @relation("AttendanceInterval_session")
  attendanceOutcomes SessionAttendanceOutcome[] @relation("AttendanceOutcome_session")
  @@index([status, confirmDeadlineAt])
  @@index([status, makeupDeadlineAt])
`,
  ),
);
model("User", (block) =>
  fields(
    block,
    `
  attendanceIntervals SessionAttendanceInterval[] @relation("AttendanceInterval_user")
  absenceExcuses SessionAbsenceExcuse[] @relation("AbsenceExcuse_absent_user")
  decidedAbsenceExcuses SessionAbsenceExcuse[] @relation("AbsenceExcuse_decider")
`,
  ),
);
// System-opened cases (no-show timeouts) have no human reporter.
model("ReportCase", (block) =>
  block
    .replace(/\breporterId(\s+)String\b/, "reporterId$1String?")
    .replace(/\breporterIdRecord(\s+)User\b/, "reporterIdRecord$1User?"),
);
```

- [x] **Step 2: Model mới** — append vào `prisma/runtime-support.prisma`:

```prisma
enum AttendanceRole {
  TEACHER
  LEARNER
}

enum AttendanceCloseSource {
  WEBHOOK
  HEARTBEAT
  ROOM_FINISHED
}

enum AttendanceVerdict {
  PRESENT
  ABSENT
  UNVERIFIABLE
}

enum AttendanceCase {
  BOTH_PRESENT
  TEACHER_ABSENT
  LEARNER_ABSENT
  BOTH_ABSENT
  UNVERIFIABLE
}

enum AttendanceOutcomeStatus {
  PROVISIONAL
  FINAL
  EXCUSED
  DISPUTED
  OVERTURNED
}

enum SessionResolution {
  COMPLETED_MUTUAL
  COMPLETED_TIMEOUT
  COMPLETED_LEARNER_NO_SHOW
  COMPLETED_STAFF
  MAKEUP_REQUIRED
  STAFF_REVIEW
}

enum AbsenceExcuseStatus {
  PENDING
  ACCEPTED
  REJECTED
  EXPIRED
}

/// One LiveKit connection (participant SID) of a Session participant.
model SessionAttendanceInterval {
  id             String                 @id @default(uuid()) @map("interval_id") @db.Uuid
  sessionId      String                 @map("session_id") @db.Uuid
  session        Session                @relation("AttendanceInterval_session", fields: [sessionId], references: [id], onDelete: Restrict, onUpdate: Restrict)
  userId         String                 @map("user_id") @db.Uuid
  user           User                   @relation("AttendanceInterval_user", fields: [userId], references: [id], onDelete: Restrict, onUpdate: Restrict)
  role           AttendanceRole
  roomSid        String                 @map("room_sid") @db.Text
  participantSid String                 @map("participant_sid") @db.Text
  joinedAt       DateTime               @map("joined_at") @db.Timestamptz(3)
  leftAt         DateTime?              @map("left_at") @db.Timestamptz(3)
  lastSeenAt     DateTime               @map("last_seen_at") @db.Timestamptz(3)
  closeSource    AttendanceCloseSource? @map("close_source")

  @@unique([sessionId, participantSid])
  @@index([sessionId, userId])
  @@index([userId])
  @@map("session_attendance_intervals")
}

/// Attendance decision for one occurrence (startAt) of a Session; a makeup creates a new row.
model SessionAttendanceOutcome {
  id                   String                  @id @default(uuid()) @map("outcome_id") @db.Uuid
  sessionId            String                  @map("session_id") @db.Uuid
  session              Session                 @relation("AttendanceOutcome_session", fields: [sessionId], references: [id], onDelete: Restrict, onUpdate: Restrict)
  occurrenceStartAt    DateTime                @map("occurrence_start_at") @db.Timestamptz(3)
  occurrenceEndAt      DateTime                @map("occurrence_end_at") @db.Timestamptz(3)
  teacherVerdict       AttendanceVerdict       @map("teacher_verdict")
  learnerVerdict       AttendanceVerdict       @map("learner_verdict")
  teacherLate          Boolean                 @map("teacher_late")
  learnerLate          Boolean                 @map("learner_late")
  teacherSeconds       BigInt                  @map("teacher_seconds")
  learnerSeconds       BigInt                  @map("learner_seconds")
  teacherFirstJoinedAt DateTime?               @map("teacher_first_joined_at") @db.Timestamptz(3)
  learnerFirstJoinedAt DateTime?               @map("learner_first_joined_at") @db.Timestamptz(3)
  attendanceCase       AttendanceCase          @map("attendance_case")
  status               AttendanceOutcomeStatus
  resolution           SessionResolution?
  determinedAt         DateTime                @map("determined_at") @db.Timestamptz(3)
  finalizesAt          DateTime                @map("finalizes_at") @db.Timestamptz(3)
  finalizedAt          DateTime?               @map("finalized_at") @db.Timestamptz(3)
  evidence             Json
  excuse               SessionAbsenceExcuse?

  @@unique([sessionId, occurrenceStartAt])
  @@index([status, finalizesAt])
  @@map("session_attendance_outcomes")
}

model SessionAbsenceExcuse {
  id              String                   @id @default(uuid()) @map("excuse_id") @db.Uuid
  outcomeId       String                   @unique @map("outcome_id") @db.Uuid
  outcome         SessionAttendanceOutcome @relation(fields: [outcomeId], references: [id], onDelete: Restrict, onUpdate: Restrict)
  absentUserId    String                   @map("absent_user_id") @db.Uuid
  absentUser      User                     @relation("AbsenceExcuse_absent_user", fields: [absentUserId], references: [id], onDelete: Restrict, onUpdate: Restrict)
  reason          String                   @db.VarChar(1000)
  status          AbsenceExcuseStatus      @default(PENDING)
  decidedByUserId String?                  @map("decided_by_user_id") @db.Uuid
  decidedBy       User?                    @relation("AbsenceExcuse_decider", fields: [decidedByUserId], references: [id], onDelete: Restrict, onUpdate: Restrict)
  decidedAt       DateTime?                @map("decided_at") @db.Timestamptz(3)
  decisionNote    String?                  @map("decision_note") @db.VarChar(1000)
  createdAt       DateTime                 @default(now()) @map("created_at") @db.Timestamptz(3)

  @@index([absentUserId])
  @@index([decidedByUserId])
  @@map("session_absence_excuses")
}
```

- [x] **Step 3: Sinh schema + validate**

Run: `pnpm db:generate:runtime-schema; pnpm db:validate:runtime; pnpm db:generate`
Expected: `The schema at prisma/schema.prisma is valid`. Kiểm tra
`git diff prisma/schema.prisma` chỉ có: 2 giá trị enum, 6 cột + 2 index Session,
3 back-relation User, `reporterId String?`, các model/enum mới.

- [x] **Step 4: Tạo migration** (DB dev đang chạy: `pnpm infra:up`, `DATABASE_URL` trỏ DB dev đã migrate)

Run: `pnpm exec prisma migrate dev --create-only --name session_no_show`
Expected: tạo `prisma/migrations/<timestamp>_session_no_show/migration.sql` chứa
`ALTER TYPE "SessionStatus" ADD VALUE 'NO_SHOW'`, `... 'MAKEUP_REQUIRED'`,
7 `CREATE TYPE`, `ALTER TABLE "report_cases" ALTER COLUMN "reporter_id" DROP NOT NULL`,
`ALTER TABLE "sessions" ADD COLUMN` ×6, 3 `CREATE TABLE`, index/unique/FK. Không
có `DROP` nào khác. Nếu có DROP ngoài dự kiến → dừng, schema lệch DB dev.

- [x] **Step 5: Thêm backfill** vào **cuối** `migration.sql` vừa tạo:

```sql
-- Sessions that started before attendance tracking existed have no interval
-- evidence. Mark their observation as failed and their tokens as issued so the
-- first determination yields UNVERIFIABLE instead of a penalised ABSENT.
UPDATE "sessions"
SET "observation_failed_at" = "start_at",
    "teacher_token_issued_at" = "start_at",
    "learner_token_issued_at" = "start_at"
WHERE "status" IN ('CONFIRMED', 'READY', 'ONGOING', 'AWAITING_CONFIRMATION')
  AND "start_at" <= CURRENT_TIMESTAMP;
```

- [ ] **Step 6: Áp migration + seed config**

Run: `pnpm exec prisma migrate dev; pnpm db:seed-configuration`
Expected: migration applied; seed thêm `session.attendancePolicy` default.
Áp tương tự cho DB test: `$env:DATABASE_URL=$env:TEST_DATABASE_URL; pnpm db:deploy` (PowerShell).

- [x] **Step 7: Type check** — `pnpm check-types` → PASS (chưa có code dùng model mới).

- [ ] **Step 8: Commit** (nếu được phép)

```bash
git add scripts/generate-runtime-schema.mjs prisma/runtime-support.prisma prisma/schema.prisma prisma/migrations
git commit -m "feat(api): add session attendance schema"
```

---

### Task 3: Hàm thuần attendance

**Files:**

- Create: `src/modules/learning-sessions/domain/attendance.policy.ts`
- Test: `test/learning-sessions/attendance-policy.test.mjs`
- Modify: `package.json` script `test:learning-sessions` đã chạy `test/learning-sessions/*.test.mjs` — không cần sửa.

**Interfaces:**

- Produces (export):
  - `type AttendancePolicy` (shape Task 1), `type Verdict = "PRESENT" | "ABSENT" | "UNVERIFIABLE"`, `type AttendanceCaseValue`.
  - `attendedSeconds(intervals: {joinedAt: Date; leftAt: Date | null; lastSeenAt: Date}[], startAt: Date, endAt: Date): number`
  - `participantVerdict(input: {tokenIssued: boolean; seconds: number; firstJoinedAt: Date | null; startAt: Date; endAt: Date; policy: AttendancePolicy; liveKitAvailable: boolean; observationHealthy: boolean}): {verdict: Verdict; late: boolean}`
  - `attendanceCase(teacher: Verdict, learner: Verdict): AttendanceCaseValue`
  - `isAbsentCase(value: AttendanceCaseValue): boolean`
  - `absentUserIds(session: {teacherId: string; learnerId: string}, outcome: {teacherVerdict: Verdict; learnerVerdict: Verdict}): string[]`
  - `observationHealthy(session: {lastObservedAt: Date | null; observationFailedAt: Date | null; startAt: Date; endAt: Date}): boolean`
  - `determinationAt(endAt: Date, joinLateMinutes: number, policy: AttendancePolicy): Date`
  - `hoursAfter(at: Date, hours: number): Date`, `daysAfter(at: Date, days: number): Date`

- [x] **Step 1: Viết test fail** — `test/learning-sessions/attendance-policy.test.mjs`:

```js
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  attendedSeconds,
  participantVerdict,
  attendanceCase,
  absentUserIds,
  observationHealthy,
  determinationAt,
} from "../../dist/modules/learning-sessions/domain/attendance.policy.js";

const startAt = new Date("2026-11-02T10:00:00Z");
const endAt = new Date("2026-11-02T11:00:00Z");
const at = (minutes) => new Date(+startAt + minutes * 60000);
const span = (from, to) => ({
  joinedAt: at(from),
  leftAt: at(to),
  lastSeenAt: at(to),
});
const policy = {
  lateGraceMinutes: 10,
  minAttendancePercent: 80,
  dataSettleMinutes: 10,
  confirmWindowHours: 24,
  disputeWindowHours: 48,
  makeupWindowDays: 7,
};
const base = {
  tokenIssued: true,
  firstJoinedAt: at(0),
  startAt,
  endAt,
  policy,
  liveKitAvailable: true,
  observationHealthy: true,
};

test("seconds union overlapping devices, reconnects and clip to the schedule", () => {
  assert.equal(
    attendedSeconds([span(-5, 20), span(10, 30), span(40, 70)], startAt, endAt),
    50 * 60,
  );
  assert.equal(attendedSeconds([], startAt, endAt), 0);
  assert.equal(attendedSeconds([span(70, 80)], startAt, endAt), 0);
  // An open interval counts only until it was last seen.
  assert.equal(
    attendedSeconds(
      [{ joinedAt: at(0), leftAt: null, lastSeenAt: at(15) }],
      startAt,
      endAt,
    ),
    15 * 60,
  );
  // Out-of-order left before joined collapses to zero length.
  assert.equal(attendedSeconds([span(5, 5)], startAt, endAt), 0);
});

test("verdict thresholds: 80% present, late after 10 minutes", () => {
  assert.deepEqual(participantVerdict({ ...base, seconds: 48 * 60 }), {
    verdict: "PRESENT",
    late: false,
  });
  assert.deepEqual(participantVerdict({ ...base, seconds: 48 * 60 - 1 }), {
    verdict: "ABSENT",
    late: false,
  });
  assert.deepEqual(
    participantVerdict({ ...base, seconds: 49 * 60, firstJoinedAt: at(10) }),
    { verdict: "PRESENT", late: false },
  );
  assert.equal(
    participantVerdict({ ...base, seconds: 48 * 60, firstJoinedAt: at(11) })
      .late,
    true,
  );
});

test("missing data never becomes a penalised absence", () => {
  assert.equal(
    participantVerdict({ ...base, seconds: 0, tokenIssued: false }).verdict,
    "ABSENT",
  );
  assert.equal(
    participantVerdict({ ...base, seconds: 0, observationHealthy: false })
      .verdict,
    "UNVERIFIABLE",
  );
  assert.equal(
    participantVerdict({
      ...base,
      seconds: 0,
      liveKitAvailable: false,
      tokenIssued: false,
    }).verdict,
    "UNVERIFIABLE",
  );
  assert.equal(
    participantVerdict({ ...base, seconds: 48 * 60, observationHealthy: false })
      .verdict,
    "PRESENT",
  );
});

test("case matrix and absent users", () => {
  assert.equal(attendanceCase("PRESENT", "PRESENT"), "BOTH_PRESENT");
  assert.equal(attendanceCase("ABSENT", "PRESENT"), "TEACHER_ABSENT");
  assert.equal(attendanceCase("ABSENT", "UNVERIFIABLE"), "TEACHER_ABSENT");
  assert.equal(attendanceCase("PRESENT", "ABSENT"), "LEARNER_ABSENT");
  assert.equal(attendanceCase("ABSENT", "ABSENT"), "BOTH_ABSENT");
  assert.equal(attendanceCase("PRESENT", "UNVERIFIABLE"), "UNVERIFIABLE");
  assert.deepEqual(
    absentUserIds(
      { teacherId: "t", learnerId: "l" },
      { teacherVerdict: "ABSENT", learnerVerdict: "ABSENT" },
    ),
    ["t", "l"],
  );
});

test("observation health and determination time", () => {
  const row = {
    startAt,
    endAt,
    lastObservedAt: at(30),
    observationFailedAt: null,
  };
  assert.equal(observationHealthy(row), true);
  assert.equal(observationHealthy({ ...row, lastObservedAt: null }), false);
  assert.equal(
    observationHealthy({ ...row, observationFailedAt: at(20) }),
    false,
  );
  assert.equal(
    observationHealthy({ ...row, observationFailedAt: at(-60) }),
    true,
  );
  assert.equal(
    determinationAt(endAt, 10, policy).toISOString(),
    "2026-11-02T11:20:00.000Z",
  );
});
```

- [x] **Step 2: Chạy, xác nhận fail** — `pnpm nest build; node --test test/learning-sessions/attendance-policy.test.mjs` → FAIL (module not found).

- [x] **Step 3: Implement** `src/modules/learning-sessions/domain/attendance.policy.ts`:

```ts
import type { ConfigurationValue } from "../../system-configuration/domain/configuration.catalog";

export type AttendancePolicy = ConfigurationValue<"session.attendancePolicy">;
export type Verdict = "PRESENT" | "ABSENT" | "UNVERIFIABLE";
export type AttendanceCaseValue =
  | "BOTH_PRESENT"
  | "TEACHER_ABSENT"
  | "LEARNER_ABSENT"
  | "BOTH_ABSENT"
  | "UNVERIFIABLE";
export type IntervalInput = {
  joinedAt: Date;
  leftAt: Date | null;
  lastSeenAt: Date;
};

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

export const hoursAfter = (at: Date, hours: number) =>
  new Date(+at + hours * HOUR);
export const daysAfter = (at: Date, days: number) =>
  new Date(+at + days * 24 * HOUR);

/** Union of connection intervals clipped to the occurrence, in whole seconds. */
export function attendedSeconds(
  intervals: readonly IntervalInput[],
  startAt: Date,
  endAt: Date,
): number {
  const spans = intervals
    .map(({ joinedAt, leftAt, lastSeenAt }) => [
      Math.max(+joinedAt, +startAt),
      Math.min(+(leftAt ?? lastSeenAt), +endAt),
    ])
    .filter(([from, to]) => to! > from!)
    .sort((left, right) => left[0]! - right[0]!);
  let total = 0;
  let cursor = Number.NEGATIVE_INFINITY;
  for (const [from, to] of spans) {
    const begin = Math.max(from!, cursor);
    if (to! > begin) total += to! - begin;
    cursor = Math.max(cursor, to!);
  }
  return Math.floor(total / 1000);
}

export function participantVerdict(input: {
  tokenIssued: boolean;
  seconds: number;
  firstJoinedAt: Date | null;
  startAt: Date;
  endAt: Date;
  policy: AttendancePolicy;
  liveKitAvailable: boolean;
  observationHealthy: boolean;
}): { verdict: Verdict; late: boolean } {
  const late =
    input.firstJoinedAt !== null &&
    +input.firstJoinedAt >
      +input.startAt + input.policy.lateGraceMinutes * MINUTE;
  // Without LiveKit or a join window nobody could join, so nobody is at fault.
  if (!input.liveKitAvailable) return { verdict: "UNVERIFIABLE", late };
  // The server issues every token, so no token proves the participant never joined.
  if (!input.tokenIssued) return { verdict: "ABSENT", late: false };
  const required =
    (((+input.endAt - +input.startAt) / 1000) *
      input.policy.minAttendancePercent) /
    100;
  if (input.seconds >= required) return { verdict: "PRESENT", late };
  // Missing seconds may be lost provider data; only a healthy pipeline proves absence.
  return {
    verdict: input.observationHealthy ? "ABSENT" : "UNVERIFIABLE",
    late,
  };
}

export function attendanceCase(
  teacher: Verdict,
  learner: Verdict,
): AttendanceCaseValue {
  if (teacher === "ABSENT" && learner === "ABSENT") return "BOTH_ABSENT";
  if (teacher === "ABSENT") return "TEACHER_ABSENT";
  if (learner === "ABSENT") return "LEARNER_ABSENT";
  if (teacher === "PRESENT" && learner === "PRESENT") return "BOTH_PRESENT";
  return "UNVERIFIABLE";
}

export const isAbsentCase = (value: AttendanceCaseValue) =>
  value === "TEACHER_ABSENT" ||
  value === "LEARNER_ABSENT" ||
  value === "BOTH_ABSENT";

export function absentUserIds(
  session: { teacherId: string; learnerId: string },
  outcome: { teacherVerdict: Verdict; learnerVerdict: Verdict },
): string[] {
  return [
    ...(outcome.teacherVerdict === "ABSENT" ? [session.teacherId] : []),
    ...(outcome.learnerVerdict === "ABSENT" ? [session.learnerId] : []),
  ];
}

/** LiveKit answered during the occurrence and never failed inside it. */
export function observationHealthy(session: {
  lastObservedAt: Date | null;
  observationFailedAt: Date | null;
  startAt: Date;
  endAt: Date;
}): boolean {
  const failed = session.observationFailedAt;
  const failedInside =
    failed !== null && +failed >= +session.startAt && +failed <= +session.endAt;
  return (
    !failedInside &&
    session.lastObservedAt !== null &&
    +session.lastObservedAt >= +session.startAt
  );
}

export function determinationAt(
  endAt: Date,
  joinLateMinutes: number,
  policy: AttendancePolicy,
): Date {
  return new Date(
    +endAt + (joinLateMinutes + policy.dataSettleMinutes) * MINUTE,
  );
}
```

- [x] **Step 4: Chạy lại** → PASS. `pnpm lint` cho file mới → sạch.

- [ ] **Step 5: Commit** (nếu được phép)

```bash
git add src/modules/learning-sessions/domain/attendance.policy.ts test/learning-sessions/attendance-policy.test.mjs
git commit -m "feat(api): add attendance policy functions"
```

---

### Task 4: Helper transaction, token stamp, participant SID

**Files:**

- Create: `src/modules/learning-sessions/application/services/session-tx.ts`
- Modify: `src/modules/learning-sessions/application/services/learning-sessions.service.ts:47-52` (xóa `lockSession` cục bộ), `:135-141` (xóa `lockedSession` private, dùng import), `:143-211` (`issueLiveKitToken`), `:463-469` (`complete` dùng `lockedSession`)
- Modify: `src/modules/learning-sessions/infrastructure/livekit/livekit.service.ts` (`listActiveParticipants`)
- Test: `test/learning-sessions/sessions.test.mjs`

**Interfaces:**

- Produces:
  - `lockSession(tx, sessionId): Promise<void>`; `lockedSession(tx, sessionId): Promise<Session>` (khóa Path → Session rồi đọc lại).
  - `databaseNow(tx): Promise<Date>` (ném `ServiceUnavailableException("DATABASE_TIME_UNAVAILABLE")`).
  - `type AttendanceContext = { policy: AttendancePolicy; joinLateMinutes: number | null; liveKitEnabled: boolean }`
  - `loadAttendanceContext(configuration: Pick<SystemConfigurationService,"getSnapshot">, liveKitEnabled: boolean, tx?): Promise<AttendanceContext | null>` (null khi thiếu attendance policy).
  - `type LiveObservation = { roomSid: string; identities: string[]; participants: { identity: string; sid: string }[] }`; `listActiveParticipants(roomName): Promise<LiveObservation | null>`.

- [x] **Step 1: Viết test fail** — thêm vào `test/learning-sessions/sessions.test.mjs`:

```js
test("first token per participant stamps issuance once per occurrence", async () => {
  const ctx = await ready();
  await ctx.sessions.issueLiveKitToken(participant(A), ctx.session.id);
  const first = ctx.db.rows("session")[0].teacherTokenIssuedAt;
  assert.ok(first instanceof Date);
  assert.equal(ctx.db.rows("session")[0].learnerTokenIssuedAt ?? null, null);
  ctx.clock.now = new Date(+ctx.clock.now + 30000);
  await ctx.sessions.issueLiveKitToken(participant(A), ctx.session.id);
  assert.equal(+ctx.db.rows("session")[0].teacherTokenIssuedAt, +first);
  await ctx.sessions.issueLiveKitToken(participant(B), ctx.session.id);
  assert.ok(ctx.db.rows("session")[0].learnerTokenIssuedAt instanceof Date);
});
```

- [x] **Step 2: Chạy** — `pnpm test:learning-sessions` → FAIL (`teacherTokenIssuedAt` undefined).

- [x] **Step 3: Tạo `session-tx.ts`**:

```ts
import { NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
import { lockLearningPath as lockPath } from "../../../learning-paths/application/services/learning-path-lock";
import type { SystemConfigurationService } from "../../../system-configuration/application/services/system-configuration.service";
import type { AttendancePolicy } from "../../domain/attendance.policy";

export async function lockSession(tx: TransactionContext, sessionId: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT session_id AS id FROM sessions WHERE session_id = ${sessionId}::uuid FOR UPDATE
  `;
  if (rows.length === 0) throw new NotFoundException("SESSION_NOT_FOUND");
}

/** Locks Path then Session (the order every Session writer uses) and rereads the row. */
export async function lockedSession(tx: TransactionContext, sessionId: string) {
  const initial = await tx.session.findUnique({ where: { id: sessionId } });
  if (!initial) throw new NotFoundException("SESSION_NOT_FOUND");
  await lockPath(tx, initial.pathId);
  await lockSession(tx, sessionId);
  return tx.session.findUniqueOrThrow({ where: { id: sessionId } });
}

export async function databaseNow(tx: TransactionContext) {
  const [clock] = await tx.$queryRaw<
    { now: Date }[]
  >`SELECT CURRENT_TIMESTAMP AS now`;
  if (!(clock?.now instanceof Date))
    throw new ServiceUnavailableException("DATABASE_TIME_UNAVAILABLE");
  return clock.now;
}

export type AttendanceContext = {
  policy: AttendancePolicy;
  joinLateMinutes: number | null;
  liveKitEnabled: boolean;
};

async function optionalValue<
  K extends "session.attendancePolicy" | "livekit.joinWindow",
>(
  configuration: Pick<SystemConfigurationService, "getSnapshot">,
  key: K,
  tx?: TransactionContext,
) {
  try {
    return (await configuration.getSnapshot([key], tx)).values[key] ?? null;
  } catch (error) {
    if (error instanceof ServiceUnavailableException) return null;
    throw error;
  }
}

/** Null when the attendance policy is not ready: no Session is judged without it. */
export async function loadAttendanceContext(
  configuration: Pick<SystemConfigurationService, "getSnapshot">,
  liveKitEnabled: boolean,
  tx?: TransactionContext,
): Promise<AttendanceContext | null> {
  const policy = await optionalValue(
    configuration,
    "session.attendancePolicy",
    tx,
  );
  if (!policy) return null;
  const joinWindow = await optionalValue(
    configuration,
    "livekit.joinWindow",
    tx,
  );
  return {
    policy,
    joinLateMinutes: joinWindow?.lateMinutes ?? null,
    liveKitEnabled,
  };
}
```

- [x] **Step 4: Dùng helper trong `LearningSessionsService`** — xóa hàm `lockSession` (dòng 47-52) và method `private async lockedSession` (dòng 135-141); thêm import:

```ts
import { databaseNow, lockedSession } from "./session-tx";
```

Thay mọi `this.lockedSession(tx, x)` bằng `lockedSession(tx, x)`. Trong `complete()`, thay đoạn
`const initial … await lockSession(tx, sessionId); const session = await tx.session.findUniqueOrThrow(...)`
bằng `const session = await lockedSession(tx, sessionId);`. Bỏ import `lockPath` nếu không còn dùng
(vẫn cần `lockLearningPathLifecycle`).

- [x] **Step 5: Stamp token** — trong `issueLiveKitToken`, thay khối

```ts
if (!session.roomName)
  await tx.session.update({
    where: { id: session.id },
    data: { roomName },
  });
```

bằng:

```ts
// First issuance per occurrence is the server-side proof a participant could join.
const data: Prisma.SessionUpdateInput = {};
if (!session.roomName) data.roomName = roomName;
if (actor.userId === session.teacherId) {
  if (!session.teacherTokenIssuedAt) data.teacherTokenIssuedAt = clock.now;
} else if (!session.learnerTokenIssuedAt) {
  data.learnerTokenIssuedAt = clock.now;
}
if (Object.keys(data).length)
  await tx.session.update({ where: { id: session.id }, data });
```

(Thêm `Prisma` vào `import type { Session, LearningPath } from "../../../../generated/prisma/client"`.)

- [x] **Step 6: Participant SID** — trong `LiveKitService.listActiveParticipants`, thay `return { ... }`:

```ts
const active = participants.filter((p) => p.state === 2);
return {
  roomSid: rooms[0]!.sid,
  identities: active.map((p) => p.identity),
  participants: active.map((p) => ({ identity: p.identity, sid: p.sid })),
};
```

- [x] **Step 7: Chạy** — `pnpm test:learning-sessions` → test mới PASS, test cũ vẫn PASS. `pnpm check-types` PASS.

- [ ] **Step 8: Commit** (nếu được phép)

```bash
git add src/modules/learning-sessions test/learning-sessions/sessions.test.mjs
git commit -m "feat(api): stamp token issuance and share session locks"
```

---

### Task 5: Interval từ webhook (phần A)

**Files:**

- Create: `src/modules/learning-sessions/application/services/session-attendance.ts`
- Modify: `learning-sessions.service.ts` — `applyLiveKitActivity` (dòng 322-385), `advanceLifecycle` (dòng 429-433)
- Test: `test/learning-sessions/lifecycle.test.mjs`

**Interfaces:**

- Consumes: `lockedSession`, `databaseNow` (Task 4).
- Produces:
  - `INACTIVE_SESSION_STATUSES: readonly string[]` = `["CANCELLED","COMPLETED","DISPUTED","NO_SHOW","MAKEUP_REQUIRED"]`.
  - `recordParticipantEvent(tx, input: { sessionId; userId; role: "TEACHER"|"LEARNER"; roomSid; participantSid; joined: boolean; occurredAt: Date }): Promise<void>`
  - `closeOpenIntervals(tx, sessionId: string, at: Date, source: "HEARTBEAT"|"ROOM_FINISHED", filter?: (interval) => boolean): Promise<void>`

- [x] **Step 1: Viết test fail** — thêm vào `test/learning-sessions/lifecycle.test.mjs` (dùng `activeSession()` sẵn có; A là teacher):

```js
const withSid = (event, sid, createdAt = event.createdAt) => ({
  ...event,
  createdAt,
  participant: { ...event.participant, sid },
});

test("webhook intervals: duplicates, reconnects and out-of-order left", async () => {
  const ctx = await activeSession();
  const t0 = ctx.event.createdAt;
  const joined = withSid(ctx.event, "PA_1");
  await ctx.sessions.applyLiveKitActivity(ctx.db, joined);
  await ctx.sessions.applyLiveKitActivity(ctx.db, joined);
  ctx.clock.now = new Date(+ctx.clock.now + 600000);
  await ctx.sessions.applyLiveKitActivity(ctx.db, {
    ...withSid(ctx.event, "PA_1", t0 + 300n),
    event: "participant_left",
  });
  // Reconnect: left arrives before its joined.
  await ctx.sessions.applyLiveKitActivity(ctx.db, {
    ...withSid(ctx.event, "PA_2", t0 + 500n),
    event: "participant_left",
  });
  await ctx.sessions.applyLiveKitActivity(
    ctx.db,
    withSid(ctx.event, "PA_2", t0 + 360n),
  );
  const rows = ctx.db.rows("sessionAttendanceInterval");
  assert.equal(rows.length, 2);
  const [first, second] = rows;
  assert.equal(first.role, "TEACHER");
  assert.equal((+first.leftAt - +first.joinedAt) / 1000, 300);
  assert.equal((+second.leftAt - +second.joinedAt) / 1000, 140);
});

test("room_finished closes open intervals without changing status", async () => {
  const ctx = await activeSession();
  await ctx.sessions.applyLiveKitActivity(ctx.db, withSid(ctx.event, "PA_1"));
  ctx.clock.now = new Date(+ctx.clock.now + 60000);
  await ctx.sessions.applyLiveKitActivity(ctx.db, {
    ...ctx.event,
    event: "room_finished",
    participant: undefined,
    createdAt: ctx.event.createdAt + 60n,
  });
  const [interval] = ctx.db.rows("sessionAttendanceInterval");
  assert.equal(interval.closeSource, "ROOM_FINISHED");
  assert.equal((+interval.leftAt - +interval.joinedAt) / 1000, 60);
  assert.equal(ctx.db.rows("session")[0].status, "ONGOING");
});
```

- [x] **Step 2: Chạy** — `pnpm test:learning-sessions` → FAIL (không có interval).

- [x] **Step 3: Tạo `session-attendance.ts`**:

```ts
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";

export const INACTIVE_SESSION_STATUSES: readonly string[] = [
  "CANCELLED",
  "COMPLETED",
  "DISPUTED",
  "NO_SHOW",
  "MAKEUP_REQUIRED",
];

const earlier = (a: Date, b: Date) => (+a <= +b ? a : b);
const later = (a: Date, b: Date) => (+a >= +b ? a : b);

/** Idempotent: every write is a min/max, so duplicates and reordering converge. */
export async function recordParticipantEvent(
  tx: TransactionContext,
  input: {
    sessionId: string;
    userId: string;
    role: "TEACHER" | "LEARNER";
    roomSid: string;
    participantSid: string;
    joined: boolean;
    occurredAt: Date;
  },
) {
  const where = {
    sessionId_participantSid: {
      sessionId: input.sessionId,
      participantSid: input.participantSid,
    },
  };
  const existing = await tx.sessionAttendanceInterval.findUnique({ where });
  if (!existing) {
    await tx.sessionAttendanceInterval.create({
      data: {
        sessionId: input.sessionId,
        userId: input.userId,
        role: input.role,
        roomSid: input.roomSid,
        participantSid: input.participantSid,
        joinedAt: input.occurredAt,
        lastSeenAt: input.occurredAt,
        // A left that overtook its joined starts as a zero-length interval.
        ...(input.joined
          ? {}
          : { leftAt: input.occurredAt, closeSource: "WEBHOOK" as const }),
      },
    });
    return;
  }
  if (input.joined) {
    await tx.sessionAttendanceInterval.update({
      where,
      data: {
        joinedAt: earlier(existing.joinedAt, input.occurredAt),
        lastSeenAt: later(existing.lastSeenAt, input.occurredAt),
      },
    });
    return;
  }
  const leftAt = later(existing.joinedAt, input.occurredAt);
  if (existing.leftAt && +existing.leftAt >= +leftAt) return;
  await tx.sessionAttendanceInterval.update({
    where,
    data: {
      leftAt,
      lastSeenAt: later(existing.lastSeenAt, leftAt),
      closeSource: "WEBHOOK",
    },
  });
}

export async function closeOpenIntervals(
  tx: TransactionContext,
  sessionId: string,
  at: Date,
  source: "HEARTBEAT" | "ROOM_FINISHED",
  filter: (interval: {
    participantSid: string;
    lastSeenAt: Date;
  }) => boolean = () => true,
) {
  const open = await tx.sessionAttendanceInterval.findMany({
    where: { sessionId, leftAt: null },
  });
  // Sequential: each row needs its own max(joinedAt, at) under the held Session lock.
  for (const interval of open.filter(filter)) {
    const leftAt = source === "HEARTBEAT" ? interval.lastSeenAt : at;
    await tx.sessionAttendanceInterval.update({
      where: { id: interval.id },
      data: {
        leftAt: +leftAt >= +interval.joinedAt ? leftAt : interval.joinedAt,
        closeSource: source,
      },
    });
  }
}
```

- [x] **Step 4: Viết lại `applyLiveKitActivity`** (thay toàn bộ method):

```ts
  async applyLiveKitActivity(tx: TransactionContext, event: WebhookEvent) {
    if (!event.room?.name || !TRACKED_LIVEKIT_EVENTS.has(event.event)) return;
    const initial = await tx.session.findUnique({
      where: { roomName: event.room.name },
    });
    if (!initial) return;
    const session = await lockedSession(tx, initial.id);
    const path = await tx.learningPath.findUniqueOrThrow({
      where: { id: session.pathId },
    });
    if (
      !["SCHEDULED", "ACTIVE"].includes(path.status) ||
      INACTIVE_SESSION_STATUSES.includes(session.status)
    )
      return;
    if (
      !event.room.sid ||
      (session.providerRoomId && session.providerRoomId !== event.room.sid)
    )
      return;
    const now = await databaseNow(tx);
    const policy = await this.joinPolicy(tx);
    if (!policy) return;
    const providerAt = new Date(Number(event.createdAt) * 1000);
    // Bound provider clock skew; join windows and state transitions still use DB time.
    const occurredAt = new Date(Math.min(+providerAt, +now));
    if (!Number.isFinite(+occurredAt)) return;
    const schedule = await tx.sessionScheduleHistory.findFirst({
      where: { sessionId: session.id, supersededAt: null },
      orderBy: { appliedAt: "desc" },
    });
    // Provider createdAt has whole-second precision, including events in the apply second.
    if (schedule && +providerAt < Math.floor(+schedule.appliedAt / 1000) * 1000)
      return;
    // Roll back the receipt so provider clock skew cannot permanently discard activity.
    if (+providerAt - +now > 5000)
      throw new ServiceUnavailableException("LIVEKIT_EVENT_NOT_YET_CURRENT");
    if (event.event === "room_finished") {
      await closeOpenIntervals(tx, session.id, occurredAt, "ROOM_FINISHED");
      return;
    }
    const identity = event.participant?.identity;
    const isTeacher =
      identity === sessionParticipantIdentity(session.id, session.teacherId);
    const isLearner =
      identity === sessionParticipantIdentity(session.id, session.learnerId);
    if (!isTeacher && !isLearner) return;
    if (!sessionJoinAccess(session, occurredAt, policy, true).canJoin) return;
    const joined = event.event === "participant_joined";
    let status = sessionStatusAt(session, now, policy);
    if (joined && occurredAt >= session.startAt && now < session.endAt)
      status = "ONGOING";
    await tx.session.update({
      where: { id: session.id },
      data: {
        status,
        providerRoomId: event.room.sid,
        ...participantActivityData(session, isTeacher, joined, occurredAt),
      },
    });
    if (event.participant?.sid)
      await recordParticipantEvent(tx, {
        sessionId: session.id,
        userId: isTeacher ? session.teacherId : session.learnerId,
        role: isTeacher ? "TEACHER" : "LEARNER",
        roomSid: event.room.sid,
        participantSid: event.participant.sid,
        joined,
        occurredAt,
      });
  }
```

Thêm ở đầu file (sau `confirmationData`):

```ts
const TRACKED_LIVEKIT_EVENTS = new Set([
  "participant_joined",
  "participant_left",
  "room_finished",
]);
```

và import `INACTIVE_SESSION_STATUSES, closeOpenIntervals, recordParticipantEvent` từ `./session-attendance`.

**Lưu ý thứ tự:** kiểm tra skew 5s giờ đứng trước kiểm tra identity/window. Test
"outsider, stale, future…" kỳ vọng event tương lai của participant hợp lệ ném
`LIVEKIT_EVENT_NOT_YET_CURRENT` — vẫn đúng. Event outsider có `createdAt` hiện tại nên không bị ném.

- [x] **Step 5: `advanceLifecycle`** — thay
      `["CANCELLED", "COMPLETED", "DISPUTED"].includes(session.status)` bằng
      `INACTIVE_SESSION_STATUSES.includes(session.status)`.

- [x] **Step 6: Chạy** — `pnpm test:learning-sessions` → PASS toàn bộ (gồm test cũ của lifecycle).

- [ ] **Step 7: Commit** (nếu được phép)

```bash
git add src/modules/learning-sessions test/learning-sessions/lifecycle.test.mjs
git commit -m "feat(api): record attendance intervals from webhooks"
```

---

### Task 6: Chuyển trạng thái dùng chung và kết luận (phần B)

**Files:**

- Create: `src/modules/learning-sessions/application/services/session-transitions.ts`
- Modify: `learning-sessions.service.ts` — xóa `private async refreshPathStatus` (dòng 659-681), thêm `ensureDetermined`, sửa `complete()`
- Create: `test/learning-sessions/attendance.test.mjs`
- Modify: `test/learning-sessions/sessions.test.mjs` (test "repeated completion…")

**Interfaces:**

- Consumes: Task 3 functions; `lockedSession`, `databaseNow`, `loadAttendanceContext`, `AttendanceContext` (Task 4).
- Produces (session-transitions.ts):
  - `currentOutcome(tx, session: {id; startAt}): Promise<SessionAttendanceOutcome | null>`
  - `emitSessionEvent(tx, type: string, sessionId: string, dedupeKey: string, payload: Record<string, unknown>): Promise<unknown>`
  - `refreshPathStatus(tx, pathId: string): Promise<void>`
  - `completeSession(tx, session: {id; pathId}, outcome: {id; finalizedAt: Date | null} | null, resolution: SessionResolution, now: Date): Promise<void>`
  - `determineOutcome(tx, session: Session, now: Date, context: AttendanceContext): Promise<SessionAttendanceOutcome | null>`
  - `type NoShowReputation = { applyNoShow(tx, input: { userId: string; sessionId: string; outcomeId: string; now: Date }): Promise<void> }`
- Produces (LearningSessionsService): `ensureDetermined(sessionId: string): Promise<void>`
- Error codes mới từ `complete()`: `ATTENDANCE_PENDING`, `SESSION_ATTENDANCE_NOT_MET`, `CONFIRM_WINDOW_CLOSED`.

- [x] **Step 1: Viết test fail** — `test/learning-sessions/attendance.test.mjs`:

```js
import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  finalizedOneWay,
  setup,
  user,
  A,
  B,
} from "../learning-platform/fixtures.mjs";

// A teaches, B learns; the fixture session runs 2026-11-02 10:00-11:00 UTC.
export async function ended({
  teacher = 60,
  learner = 60,
  tokens = [A, B],
  observed = true,
  liveKit = true,
} = {}) {
  const ctx = setup({
    wallets: { [B]: 10000n },
    config: { "livekit.joinWindow": { earlyMinutes: 10, lateMinutes: 10 } },
  });
  const ids = await finalizedOneWay(ctx);
  const session = ctx.db.rows("session")[0];
  ctx.sessions.livekit = { config: { enabled: liveKit } };
  const minute = (n) => new Date(+session.startAt + n * 60000);
  Object.assign(session, {
    roomName: `skillhub-session-${session.id}`,
    teacherTokenIssuedAt: tokens.includes(A) ? minute(-5) : null,
    learnerTokenIssuedAt: tokens.includes(B) ? minute(-5) : null,
    lastObservedAt: observed ? minute(30) : null,
    observationFailedAt: null,
  });
  for (const [userId, role, minutes] of [
    [A, "TEACHER", teacher],
    [B, "LEARNER", learner],
  ])
    if (minutes > 0)
      ctx.db.seed("sessionAttendanceInterval", {
        sessionId: session.id,
        userId,
        role,
        roomSid: "RM_1",
        participantSid: `PA_${role}`,
        joinedAt: minute(0),
        leftAt: minute(minutes),
        lastSeenAt: minute(minutes),
      });
  ctx.clock.now = minute(81); // Td = endAt + 10 (join late) + 10 (settle)
  return { ...ctx, ...ids, session, minute };
}

test("both present: outcome FINAL, confirm opens with a deadline", async () => {
  const ctx = await ended();
  await ctx.sessions.complete(user(A), ctx.session.id, "taught");
  const [outcome] = ctx.db.rows("sessionAttendanceOutcome");
  assert.equal(outcome.attendanceCase, "BOTH_PRESENT");
  assert.equal(outcome.status, "FINAL");
  assert.equal(outcome.teacherSeconds, 3600n);
  assert.equal(+ctx.session.confirmDeadlineAt, +ctx.clock.now + 24 * 3600000);
  await ctx.sessions.complete(user(B), ctx.session.id, "learnt");
  assert.equal(ctx.session.status, "COMPLETED");
  assert.equal(
    ctx.db.rows("sessionAttendanceOutcome")[0].resolution,
    "COMPLETED_MUTUAL",
  );
});

test("confirm is pending before determination and blocked on absence", async () => {
  const early = await ended();
  early.clock.now = early.minute(70);
  await assert.rejects(
    early.sessions.complete(user(A), early.session.id, "x"),
    { message: "ATTENDANCE_PENDING" },
  );

  const absent = await ended({ learner: 0 });
  await assert.rejects(
    absent.sessions.complete(user(A), absent.session.id, "x"),
    { message: "SESSION_ATTENDANCE_NOT_MET" },
  );
  // The determination survives the rejected confirm (it ran in its own transaction).
  assert.equal(absent.session.status, "NO_SHOW");
  assert.equal(
    absent.db.rows("sessionAttendanceOutcome")[0].attendanceCase,
    "LEARNER_ABSENT",
  );
  assert.equal(
    absent.db.rows("sessionAttendanceOutcome")[0].status,
    "PROVISIONAL",
  );
});

test("no token is absent; unhealthy observation or disabled LiveKit is unverifiable", async () => {
  const noToken = await ended({ teacher: 0, tokens: [B] });
  await noToken.sessions.ensureDetermined(noToken.session.id);
  assert.equal(
    noToken.db.rows("sessionAttendanceOutcome")[0].attendanceCase,
    "TEACHER_ABSENT",
  );

  const blind = await ended({ teacher: 0, observed: false });
  await blind.sessions.ensureDetermined(blind.session.id);
  assert.equal(
    blind.db.rows("sessionAttendanceOutcome")[0].attendanceCase,
    "UNVERIFIABLE",
  );

  const off = await ended({
    teacher: 0,
    learner: 0,
    tokens: [],
    liveKit: false,
  });
  off.clock.now = off.minute(71); // no join window applies: Td = endAt + 10
  await off.sessions.complete(user(A), off.session.id, "met elsewhere");
  assert.equal(
    off.db.rows("sessionAttendanceOutcome")[0].attendanceCase,
    "UNVERIFIABLE",
  );
  assert.equal(off.session.teacherConfirmationStatus, "CONFIRMED");
});

test("determination is idempotent and emits one event", async () => {
  const ctx = await ended({ learner: 0 });
  await ctx.sessions.ensureDetermined(ctx.session.id);
  await ctx.sessions.ensureDetermined(ctx.session.id);
  assert.equal(ctx.db.rows("sessionAttendanceOutcome").length, 1);
  assert.equal(
    ctx.db
      .rows("outboxEvent")
      .filter((e) => e.type === "session.attendance.determined").length,
    1,
  );
});
```

Trong `test/learning-sessions/sessions.test.mjs`, test "repeated completion preserves…":
thêm `ctx.sessions.livekit = { config: { enabled: false } };` và đổi
`ctx.clock.now = new Date(+ctx.session.endAt + 1000);` thành
`ctx.clock.now = new Date(+ctx.session.endAt + 11 * 60000);` (LiveKit tắt → UNVERIFIABLE, Td = endAt + 10').

- [x] **Step 2: Chạy** — `pnpm test:learning-sessions` → FAIL (`ensureDetermined` không tồn tại; complete không chặn).

- [x] **Step 3: Tạo `session-transitions.ts`** (phần B; Task 8/9 bổ sung thêm hàm vào cùng file):

```ts
import { randomUUID } from "node:crypto";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
import type {
  Prisma,
  Session,
  SessionResolution,
} from "../../../../generated/prisma/client";
import {
  absentUserIds,
  attendanceCase,
  attendedSeconds,
  determinationAt,
  hoursAfter,
  isAbsentCase,
  observationHealthy,
  participantVerdict,
} from "../../domain/attendance.policy";
import type { AttendanceContext } from "./session-tx";

export type NoShowReputation = {
  applyNoShow(
    tx: TransactionContext,
    input: { userId: string; sessionId: string; outcomeId: string; now: Date },
  ): Promise<void>;
};

const UNDECIDED = ["CONFIRMED", "READY", "ONGOING", "AWAITING_CONFIRMATION"];

export function currentOutcome(
  tx: TransactionContext,
  session: Pick<Session, "id" | "startAt">,
) {
  return tx.sessionAttendanceOutcome.findUnique({
    where: {
      sessionId_occurrenceStartAt: {
        sessionId: session.id,
        occurrenceStartAt: session.startAt,
      },
    },
  });
}

export function emitSessionEvent(
  tx: TransactionContext,
  type: string,
  sessionId: string,
  dedupeKey: string,
  payload: Record<string, unknown>,
) {
  return tx.outboxEvent.create({
    data: {
      eventId: randomUUID(),
      correlationId: randomUUID(),
      aggregateType: "SESSION",
      aggregateId: sessionId,
      type,
      version: 1,
      dedupeKey,
      payload: { sessionId, ...payload } as Prisma.InputJsonValue,
    },
  });
}

export async function refreshPathStatus(
  tx: TransactionContext,
  pathId: string,
) {
  const remaining = await tx.session.count({
    where: { pathId, status: { not: "COMPLETED" } },
  });
  if (remaining !== 0) return;
  const current = await tx.learningPath.findUniqueOrThrow({
    where: { id: pathId },
  });
  // A dispute keeps the path DISPUTED; report resolution moves it back to ACTIVE.
  const path =
    current.status === "DISPUTED"
      ? current
      : await tx.learningPath.update({
          where: { id: pathId },
          data: { status: "ACTIVE" },
        });
  await tx.outboxEvent.create({
    data: {
      eventId: randomUUID(),
      correlationId: randomUUID(),
      aggregateType: "LEARNING_PATH",
      aggregateId: pathId,
      type: "learning-path.sessions-completed",
      version: 1,
      dedupeKey: `path.sessions-completed:${pathId}:${path.lockedVersion}`,
      payload: { pathId, lockedVersion: path.lockedVersion },
    },
  });
}

export async function completeSession(
  tx: TransactionContext,
  session: Pick<Session, "id" | "pathId">,
  outcome: { id: string; finalizedAt: Date | null } | null,
  resolution: SessionResolution,
  now: Date,
) {
  await tx.session.update({
    where: { id: session.id },
    data: { status: "COMPLETED", confirmDeadlineAt: null },
  });
  if (outcome)
    await tx.sessionAttendanceOutcome.update({
      where: { id: outcome.id },
      data: { resolution, finalizedAt: outcome.finalizedAt ?? now },
    });
  await refreshPathStatus(tx, session.pathId);
}

/** Creates the occurrence outcome once Td passed; returns null while it is not due. */
export async function determineOutcome(
  tx: TransactionContext,
  session: Session,
  now: Date,
  context: AttendanceContext,
) {
  const existing = await currentOutcome(tx, session);
  if (existing || !UNDECIDED.includes(session.status) || now < session.endAt)
    return existing;
  const liveKitAvailable =
    context.liveKitEnabled && context.joinLateMinutes !== null;
  const dueAt = determinationAt(
    session.endAt,
    liveKitAvailable ? context.joinLateMinutes! : 0,
    context.policy,
  );
  if (now < dueAt) return null;
  const intervals = await tx.sessionAttendanceInterval.findMany({
    where: { sessionId: session.id },
    orderBy: { joinedAt: "asc" },
  });
  const healthy = observationHealthy(session);
  const side = (userId: string, tokenIssuedAt: Date | null) => {
    // Intervals that ended before this occurrence belong to an earlier (makeup) occurrence.
    const own = intervals.filter(
      (row) =>
        row.userId === userId &&
        +(row.leftAt ?? row.lastSeenAt) > +session.startAt,
    );
    const seconds = attendedSeconds(own, session.startAt, session.endAt);
    const firstJoinedAt = own[0]?.joinedAt ?? null;
    return {
      seconds,
      firstJoinedAt,
      ...participantVerdict({
        tokenIssued: tokenIssuedAt !== null,
        seconds,
        firstJoinedAt,
        startAt: session.startAt,
        endAt: session.endAt,
        policy: context.policy,
        liveKitAvailable,
        observationHealthy: healthy,
      }),
    };
  };
  const teacher = side(session.teacherId, session.teacherTokenIssuedAt);
  const learner = side(session.learnerId, session.learnerTokenIssuedAt);
  const value = attendanceCase(teacher.verdict, learner.verdict);
  const absent = isAbsentCase(value);
  const outcome = await tx.sessionAttendanceOutcome.create({
    data: {
      sessionId: session.id,
      occurrenceStartAt: session.startAt,
      occurrenceEndAt: session.endAt,
      teacherVerdict: teacher.verdict,
      learnerVerdict: learner.verdict,
      teacherLate: teacher.late,
      learnerLate: learner.late,
      teacherSeconds: BigInt(teacher.seconds),
      learnerSeconds: BigInt(learner.seconds),
      teacherFirstJoinedAt: teacher.firstJoinedAt,
      learnerFirstJoinedAt: learner.firstJoinedAt,
      attendanceCase: value,
      status: absent ? "PROVISIONAL" : "FINAL",
      determinedAt: now,
      finalizesAt: hoursAfter(session.endAt, context.policy.disputeWindowHours),
      evidence: {
        policy: context.policy,
        joinLateMinutes: context.joinLateMinutes,
        liveKitAvailable,
        observationHealthy: healthy,
        lastObservedAt: session.lastObservedAt?.toISOString() ?? null,
        observationFailedAt: session.observationFailedAt?.toISOString() ?? null,
        teacherTokenIssuedAt:
          session.teacherTokenIssuedAt?.toISOString() ?? null,
        learnerTokenIssuedAt:
          session.learnerTokenIssuedAt?.toISOString() ?? null,
        intervals: intervals.map((row) => ({
          userId: row.userId,
          participantSid: row.participantSid,
          joinedAt: row.joinedAt.toISOString(),
          leftAt: row.leftAt?.toISOString() ?? null,
          lastSeenAt: row.lastSeenAt.toISOString(),
          closeSource: row.closeSource,
        })),
      },
    },
  });
  await tx.session.update({
    where: { id: session.id },
    data: {
      teacherAttendanceSeconds: BigInt(teacher.seconds),
      learnerAttendanceSeconds: BigInt(learner.seconds),
      ...(absent
        ? { status: "NO_SHOW" as const }
        : {
            status: "AWAITING_CONFIRMATION" as const,
            // Counted from the decision so a late worker never shortens the window.
            confirmDeadlineAt: hoursAfter(
              now,
              context.policy.confirmWindowHours,
            ),
          }),
    },
  });
  await emitSessionEvent(
    tx,
    "session.attendance.determined",
    session.id,
    `attendance-determined:${outcome.id}`,
    {
      outcomeId: outcome.id,
      attendanceCase: value,
      absentUserIds: absentUserIds(session, outcome),
    },
  );
  return outcome;
}
```

- [x] **Step 4: `ensureDetermined` + `complete()`** trong `LearningSessionsService`:

Thêm import:

```ts
import {
  databaseNow,
  loadAttendanceContext,
  lockedSession,
} from "./session-tx";
import {
  completeSession,
  currentOutcome,
  determineOutcome,
} from "./session-transitions";
import { isAbsentCase } from "../../domain/attendance.policy";
```

Thêm method public:

```ts
  /** Materialises the occurrence outcome when due; a no-op before Td or without policy. */
  async ensureDetermined(sessionId: string) {
    await this.transactions.run(async (tx) => {
      const session = await lockedSession(tx, sessionId);
      const context = await loadAttendanceContext(
        this.configuration,
        this.livekit.config.enabled,
        tx,
      );
      if (context) await determineOutcome(tx, session, await databaseNow(tx), context);
    });
  }
```

Thay toàn bộ `complete()`:

```ts
  async complete(actor: Principal, sessionId: string, note: string) {
    // Own transaction: a rejected confirm must not roll the determination back.
    await this.ensureDetermined(sessionId);
    return this.transactions.run(async (tx) => {
      const session = await lockedSession(tx, sessionId);
      const path = await tx.learningPath.findUniqueOrThrow({
        where: { id: session.pathId },
      });
      if (path.status === "DISPUTED")
        throw new ConflictException("SESSION_BLOCKED_BY_DISPUTE");
      const isTeacher = actor.userId === session.teacherId;
      if (!isTeacher && actor.userId !== session.learnerId)
        throw new ForbiddenException("SESSION_ACCESS_DENIED");
      if (session.status === "COMPLETED")
        return { id: sessionId, status: session.status };
      if (["CANCELLED", "DISPUTED", "MAKEUP_REQUIRED"].includes(session.status))
        throw new ConflictException("SESSION_CANNOT_BE_COMPLETED");
      const now = await databaseNow(tx);
      if (session.endAt > now) throw new ConflictException("SESSION_NOT_ENDED");
      const outcome = await currentOutcome(tx, session);
      if (!outcome) throw new ConflictException("ATTENDANCE_PENDING");
      if (isAbsentCase(outcome.attendanceCase))
        throw new ConflictException("SESSION_ATTENDANCE_NOT_MET");
      if (
        (isTeacher
          ? session.teacherConfirmationStatus
          : session.learnerConfirmationStatus) === "CONFIRMED"
      )
        return { id: sessionId, status: session.status };
      if (session.confirmDeadlineAt && now >= session.confirmDeadlineAt)
        throw new ConflictException("CONFIRM_WINDOW_CLOSED");
      const otherConfirmed =
        (isTeacher
          ? session.learnerConfirmationStatus
          : session.teacherConfirmationStatus) === "CONFIRMED";
      await tx.session.update({
        where: { id: sessionId },
        data: {
          status: "AWAITING_CONFIRMATION",
          ...confirmationData(isTeacher, now, note),
        },
      });
      if (!otherConfirmed)
        return { id: sessionId, status: "AWAITING_CONFIRMATION" as const };
      await completeSession(tx, session, outcome, "COMPLETED_MUTUAL", now);
      return { id: sessionId, status: "COMPLETED" as const };
    });
  }
```

Xóa `private async refreshPathStatus` cũ (đã chuyển sang `session-transitions.ts`), rồi xóa
import không còn dùng (`randomUUID`, `lockPath`) để lint `--max-warnings 0` qua.

- [x] **Step 5: Chạy** — `pnpm test:learning-sessions` → PASS. Chạy thêm fake-DB suites có gọi `complete`:
      `pnpm nest build; node --test test/learning-platform/*.test.mjs test/learning-requests/lifecycle-flow.test.mjs`
      → PASS (fixture LiveKit tắt → UNVERIFIABLE; `completedOneWay` ở 11:30 ≥ Td 11:10).

- [ ] **Step 6: Commit** (nếu được phép)

```bash
git add src/modules/learning-sessions test/learning-sessions
git commit -m "feat(api): determine attendance and gate completion"
```

---

### Task 7: Projection cho mobile (`detail`, `mine`)

**Files:**

- Create: `src/modules/learning-sessions/domain/attendance-view.ts`
- Modify: `learning-sessions.service.ts` — `mine()` (dòng 213-263), `detail()` (dòng 265-289)
- Modify: `presentation/http/learning-sessions.responses.ts` (`sessionReadSelect`)
- Test: `test/learning-sessions/attendance.test.mjs`, `sessions.test.mjs:87`, `lifecycle.test.mjs:46-49`

**Interfaces:**

- Produces:
  - `type SessionAction = "JOIN" | "CONFIRM_COMPLETION" | "SUBMIT_EXCUSE" | "DECIDE_EXCUSE" | "REPORT_NO_SHOW" | "PROPOSE_MAKEUP"`
  - `sessionAttendanceView(input: AttendanceViewInput): { attendance; deadlines; excuse; allowedActions: SessionAction[] }` (shape spec §10).
- Breaking: bỏ `attendanceStatus`, `teacherAttendanceSeconds`/`learnerAttendanceSeconds` top-level khỏi `detail` (chuyển vào `attendance.teacher.seconds`).

- [x] **Step 1: Viết test fail** — thêm vào `test/learning-sessions/attendance.test.mjs`:

```js
test("detail exposes attendance, deadlines and allowed actions per role", async () => {
  const ctx = await ended({ learner: 0 });
  const teacher = await ctx.sessions.detail(user(A), ctx.session.id);
  assert.equal(teacher.attendance.state, "DETERMINED");
  assert.equal(teacher.attendance.case, "LEARNER_ABSENT");
  assert.deepEqual(teacher.attendance.absentUserIds, [B]);
  assert.equal(teacher.attendance.teacher.seconds, "3600");
  assert.equal(teacher.attendance.learner.verdict, "ABSENT");
  assert.equal(
    +teacher.deadlines.excuseOrReportBy,
    +ctx.db.rows("sessionAttendanceOutcome")[0].finalizesAt,
  );
  assert.deepEqual(teacher.allowedActions, ["REPORT_NO_SHOW"]);
  const learner = await ctx.sessions.detail(user(B), ctx.session.id);
  assert.deepEqual(learner.allowedActions, ["SUBMIT_EXCUSE", "REPORT_NO_SHOW"]);
  assert.equal("attendanceStatus" in learner, false);
  const [listed] = await ctx.sessions.mine(user(B), "2026-11-01T00:00:00Z");
  assert.equal(listed.attendance.state, "DETERMINED");
  assert.deepEqual(listed.allowedActions, ["SUBMIT_EXCUSE", "REPORT_NO_SHOW"]);
});

test("before the end attendance is null and only JOIN may be offered", async () => {
  const ctx = await ended();
  ctx.clock.now = ctx.minute(30);
  const detail = await ctx.sessions.detail(user(A), ctx.session.id);
  assert.equal(detail.attendance.state, null);
  assert.ok(!detail.allowedActions.includes("CONFIRM_COMPLETION"));
});
```

Cập nhật test cũ:

- `sessions.test.mjs` dòng `assert.equal(detail.attendanceStatus, "UNAVAILABLE");` →
  `assert.equal(detail.attendance.state, null);` và
  `assert.equal(detail.teacherAttendanceSeconds, "0");` →
  `assert.equal(detail.attendance.teacher.seconds, "0");`
- `lifecycle.test.mjs` dòng 46-49 →
  `assert.equal((await ctx.sessions.detail(user(B), row.id)).attendance.state, null);`

- [x] **Step 2: Chạy** → FAIL.

- [x] **Step 3: Tạo `domain/attendance-view.ts`**:

```ts
import {
  isAbsentCase,
  type AttendanceCaseValue,
  type Verdict,
} from "./attendance.policy";

export type SessionAction =
  | "JOIN"
  | "CONFIRM_COMPLETION"
  | "SUBMIT_EXCUSE"
  | "DECIDE_EXCUSE"
  | "REPORT_NO_SHOW"
  | "PROPOSE_MAKEUP";

type OutcomeView = {
  attendanceCase: AttendanceCaseValue;
  status: string;
  resolution: string | null;
  teacherVerdict: Verdict;
  learnerVerdict: Verdict;
  teacherLate: boolean;
  learnerLate: boolean;
  teacherSeconds: bigint;
  learnerSeconds: bigint;
  teacherFirstJoinedAt: Date | null;
  learnerFirstJoinedAt: Date | null;
  determinedAt: Date;
  finalizesAt: Date;
};

export type AttendanceViewInput = {
  actorId: string;
  now: Date;
  canJoin: boolean;
  reportOpen: boolean;
  session: {
    teacherId: string;
    learnerId: string;
    status: string;
    endAt: Date;
    teacherConfirmationStatus: string | null;
    learnerConfirmationStatus: string | null;
    teacherFirstJoinedAt: Date | null;
    learnerFirstJoinedAt: Date | null;
    confirmDeadlineAt: Date | null;
    makeupDeadlineAt: Date | null;
  };
  outcome: OutcomeView | null;
  excuse: { status: string; reason: string; absentUserId: string } | null;
};

function attendanceState(input: AttendanceViewInput) {
  if (input.outcome)
    return input.outcome.attendanceCase === "UNVERIFIABLE"
      ? "UNVERIFIABLE"
      : "DETERMINED";
  return input.now >= input.session.endAt ? "PENDING_DATA" : null;
}

function noShowActions(
  input: AttendanceViewInput,
  isTeacher: boolean,
): SessionAction[] {
  const { outcome, excuse } = input;
  if (
    input.session.status !== "NO_SHOW" ||
    outcome?.status !== "PROVISIONAL" ||
    input.now >= outcome.finalizesAt
  )
    return [];
  const ownVerdict = isTeacher
    ? outcome.teacherVerdict
    : outcome.learnerVerdict;
  const actions: SessionAction[] = [];
  if (
    ownVerdict === "ABSENT" &&
    outcome.attendanceCase !== "BOTH_ABSENT" &&
    !excuse
  )
    actions.push("SUBMIT_EXCUSE");
  if (ownVerdict !== "ABSENT" && excuse?.status === "PENDING")
    actions.push("DECIDE_EXCUSE");
  if (!input.reportOpen) actions.push("REPORT_NO_SHOW");
  return actions;
}

export function sessionAttendanceView(input: AttendanceViewInput) {
  const { session, outcome, excuse, now } = input;
  const isTeacher = input.actorId === session.teacherId;
  const ownConfirmed =
    (isTeacher
      ? session.teacherConfirmationStatus
      : session.learnerConfirmationStatus) === "CONFIRMED";
  const actions: SessionAction[] = [];
  if (input.canJoin) actions.push("JOIN");
  if (
    session.status === "AWAITING_CONFIRMATION" &&
    outcome &&
    !isAbsentCase(outcome.attendanceCase) &&
    !ownConfirmed &&
    session.confirmDeadlineAt &&
    now < session.confirmDeadlineAt
  )
    actions.push("CONFIRM_COMPLETION");
  actions.push(...noShowActions(input, isTeacher));
  if (
    session.status === "MAKEUP_REQUIRED" &&
    session.makeupDeadlineAt &&
    now < session.makeupDeadlineAt
  )
    actions.push("PROPOSE_MAKEUP");
  const side = (role: "teacher" | "learner") => ({
    verdict: outcome?.[`${role}Verdict`] ?? null,
    late: outcome?.[`${role}Late`] ?? false,
    // Counters are written only at determination, so before it the total is 0.
    seconds: (outcome?.[`${role}Seconds`] ?? 0n).toString(),
    firstJoinedAt: outcome
      ? outcome[`${role}FirstJoinedAt`]
      : session[`${role}FirstJoinedAt`],
  });
  return {
    attendance: {
      state: attendanceState(input),
      case: outcome?.attendanceCase ?? null,
      teacher: side("teacher"),
      learner: side("learner"),
      absentUserIds: [
        ...(outcome?.teacherVerdict === "ABSENT" ? [session.teacherId] : []),
        ...(outcome?.learnerVerdict === "ABSENT" ? [session.learnerId] : []),
      ],
      outcomeStatus: outcome?.status ?? null,
      resolution: outcome?.resolution ?? null,
      determinedAt: outcome?.determinedAt ?? null,
    },
    deadlines: {
      confirmBy: session.confirmDeadlineAt,
      excuseOrReportBy:
        outcome && isAbsentCase(outcome.attendanceCase)
          ? outcome.finalizesAt
          : null,
      makeupBy: session.makeupDeadlineAt,
    },
    excuse,
    allowedActions: actions,
  };
}
```

- [x] **Step 4: `sessionReadSelect`** — xóa `teacherAttendanceSeconds: true` và
      `learnerAttendanceSeconds: true` (BigInt không còn ở top-level; giây nằm trong `attendance`),
      thêm `confirmDeadlineAt: true, makeupDeadlineAt: true`.

- [x] **Step 5: `detail()` và `mine()`** — thay hai method:

```ts
  private async attendanceInputs(actorId: string, sessions: { id: string; startAt: Date }[]) {
    const ids = sessions.map(({ id }) => id);
    const outcomes = (
      await this.db.sessionAttendanceOutcome.findMany({ where: { sessionId: { in: ids } } })
    ).filter((row) =>
      sessions.some((s) => s.id === row.sessionId && +s.startAt === +row.occurrenceStartAt),
    );
    const excuses = await this.db.sessionAbsenceExcuse.findMany({
      where: { outcomeId: { in: outcomes.map(({ id }) => id) } },
      select: { outcomeId: true, status: true, reason: true, absentUserId: true },
    });
    const reports = await this.db.reportCase.findMany({
      where: {
        reporterId: actorId,
        relatedSessionId: { in: ids },
        status: { in: ["OPEN", "UNDER_REVIEW", "NEED_MORE_INFO"] },
      },
      select: { relatedSessionId: true },
    });
    return (sessionId: string) => {
      const outcome = outcomes.find((row) => row.sessionId === sessionId) ?? null;
      const excuse = outcome ? excuses.find((row) => row.outcomeId === outcome.id) : undefined;
      return {
        outcome,
        excuse: excuse
          ? { status: excuse.status, reason: excuse.reason, absentUserId: excuse.absentUserId }
          : null,
        reportOpen: reports.some((row) => row.relatedSessionId === sessionId),
      };
    };
  }
```

Trong `mine()`: mở rộng `select` thêm `teacherFirstJoinedAt, learnerFirstJoinedAt,
confirmDeadlineAt, makeupDeadlineAt: true`;
thay `return sessions.map(...)` bằng:

```ts
const inputsFor = await this.attendanceInputs(actor.userId, sessions);
return sessions.map(
  ({
    teacherFirstJoinedAt,
    learnerFirstJoinedAt,
    confirmDeadlineAt,
    makeupDeadlineAt,
    ...session
  }) => {
    const status = sessionStatusAt(session, now, policy);
    const join = sessionJoinAccess(
      session,
      now,
      policy,
      this.livekit.config.enabled,
    );
    const view = sessionAttendanceView({
      actorId: actor.userId,
      now,
      canJoin: join.canJoin,
      session: {
        ...session,
        status,
        teacherFirstJoinedAt,
        learnerFirstJoinedAt,
        confirmDeadlineAt,
        makeupDeadlineAt,
      },
      ...inputsFor(session.id),
    });
    return {
      ...session,
      status,
      join,
      role: actor.userId === session.teacherId ? "TEACHER" : "LEARNER",
      attendance: { state: view.attendance.state },
      allowedActions: view.allowedActions,
    };
  },
);
```

`detail()`:

```ts
  async detail(actor: Principal, sessionId: string) {
    const member = await this.db.session.findUnique({
      where: { id: sessionId },
      select: { teacherId: true, learnerId: true },
    });
    if (!member) throw new NotFoundException("SESSION_NOT_FOUND");
    this.assertParticipant(actor, member);
    // Reads may materialise a due outcome so clients never wait for the worker.
    await this.ensureDetermined(sessionId);
    const session = await this.db.session.findUniqueOrThrow({
      where: { id: sessionId },
      select: sessionReadSelect,
    });
    const policy = await this.joinPolicy();
    const now = this.clock.now();
    const join = sessionJoinAccess(session, now, policy, this.livekit.config.enabled);
    const status = sessionStatusAt(session, now, policy);
    return {
      ...session,
      status,
      role: actor.userId === session.teacherId ? "TEACHER" : "LEARNER",
      join,
      progress: await this.progress(session.pathId, session.planId),
      ...sessionAttendanceView({
        actorId: actor.userId,
        now,
        canJoin: join.canJoin,
        session: { ...session, status },
        ...(await this.attendanceInputs(actor.userId, [session]))(session.id),
      }),
    };
  }
```

- [x] **Step 6: Chạy** — `pnpm test:learning-sessions; pnpm test:bigint-responses` → PASS.

- [ ] **Step 7: Commit** (nếu được phép)

```bash
git add src/modules/learning-sessions test/learning-sessions
git commit -m "feat(api)!: expose attendance and allowed actions" -m "BREAKING CHANGE: Session detail replaces attendanceStatus and top-level attendance seconds with the attendance object."
```

---

### Task 8: Heartbeat, timeout và chốt vắng (worker)

**Files:**

- Modify: `src/modules/reputation/application/services/reputation.service.ts:204-216` (`applyNoShow`)
- Modify: `test/learning-platform/phase3.test.mjs:172` (thêm `outcomeId`)
- Modify: `session-transitions.ts` (thêm `requireMakeup`, `finalizeNoShow`)
- Create: `src/modules/learning-sessions/application/services/session-outcome.service.ts`
- Modify: `src/modules/reports/application/services/reports.service.ts` (thêm `openSystemSessionCase`)
- Modify: `session-lifecycle.worker.ts`, `learning-sessions.module.ts`
- Test: `test/learning-sessions/attendance.test.mjs`, `test/learning-sessions/worker.test.mjs`

**Interfaces:**

- Consumes: `determineOutcome`, `completeSession`, `currentOutcome`, `emitSessionEvent` (Task 6); `lockedSession`, `databaseNow`, `loadAttendanceContext` (Task 4); `LiveObservation` (Task 4).
- Produces:
  - `ReputationService.applyNoShow(tx, { userId; sessionId; outcomeId; now })`, eventKey `no-show:${outcomeId}:${userId}`.
  - `requireMakeup(tx, session: {id}, outcome: {id}, now: Date, policy: AttendancePolicy, outcomeStatus: "FINAL" | "EXCUSED"): Promise<void>`
  - `finalizeNoShow(tx, reputation: NoShowReputation, session: Session, outcome: SessionAttendanceOutcome, now: Date, policy: AttendancePolicy): Promise<void>`
  - `ReportsService.openSystemSessionCase(tx, { sessionId; pathId; reasonCode: "MAKEUP_EXPIRED" | "ATTENDANCE_UNVERIFIABLE"; description: string }): Promise<string>`
  - `SessionOutcomeService.recordObservation(expected: {id; startAt; endAt}, result: { status: "OK"; observation: LiveObservation | null } | { status: "FAILED" }, now: Date): Promise<void>`
  - `SessionOutcomeService.finalizeDue(sessionId: string): Promise<void>`
  - `SessionLifecycleWorker` constructor thêm tham số cuối `outcomes: SessionOutcomeService`.

- [x] **Step 1: Viết test fail** — thêm vào `test/learning-sessions/attendance.test.mjs`:

```js
import { SessionOutcomeService } from "../../dist/modules/learning-sessions/application/services/session-outcome.service.js";
import { ReportsService } from "../../dist/modules/reports/application/services/reports.service.js";
import { runner } from "../learning-platform/fake-db.mjs";

function outcomes(ctx, penalties = []) {
  return new SessionOutcomeService(
    runner(ctx.db),
    ctx.configuration,
    { config: { enabled: true } },
    {
      applyNoShow: async (_tx, input) => {
        penalties.push(input);
      },
    },
    new ReportsService(
      runner(ctx.db),
      {},
      {},
      {},
      undefined,
      undefined,
      ctx.configuration,
    ),
  );
}
const hours = (ctx, h) => {
  ctx.clock.now = new Date(+ctx.session.endAt + h * 3600000);
};

test("timeout completes a present session once", async () => {
  const ctx = await ended();
  await ctx.sessions.ensureDetermined(ctx.session.id);
  hours(ctx, 25);
  await outcomes(ctx).finalizeDue(ctx.session.id);
  await outcomes(ctx).finalizeDue(ctx.session.id);
  assert.equal(ctx.session.status, "COMPLETED");
  assert.equal(
    ctx.db.rows("sessionAttendanceOutcome")[0].resolution,
    "COMPLETED_TIMEOUT",
  );
  assert.equal(
    ctx.db
      .rows("outboxEvent")
      .filter((e) => e.type === "session.completed.timeout").length,
    1,
  );
});

test("unverifiable without any confirmation goes to Staff", async () => {
  const ctx = await ended({ teacher: 0, observed: false });
  await ctx.sessions.ensureDetermined(ctx.session.id);
  hours(ctx, 25);
  await outcomes(ctx).finalizeDue(ctx.session.id);
  assert.equal(ctx.session.status, "DISPUTED");
  const [item] = ctx.db.rows("reportCase");
  assert.equal(item.reasonCode, "ATTENDANCE_UNVERIFIABLE");
  assert.equal(item.reporterId ?? null, null);
  assert.equal(item.blocksSettlement, true);
});

test("learner no-show finalises as consumed with one penalty", async () => {
  const ctx = await ended({ learner: 0 });
  await ctx.sessions.ensureDetermined(ctx.session.id);
  const penalties = [];
  hours(ctx, 47);
  await outcomes(ctx, penalties).finalizeDue(ctx.session.id);
  assert.equal(ctx.session.status, "NO_SHOW"); // dispute window still open
  hours(ctx, 49);
  await outcomes(ctx, penalties).finalizeDue(ctx.session.id);
  await outcomes(ctx, penalties).finalizeDue(ctx.session.id);
  assert.equal(ctx.session.status, "COMPLETED");
  assert.equal(
    ctx.db.rows("sessionAttendanceOutcome")[0].resolution,
    "COMPLETED_LEARNER_NO_SHOW",
  );
  assert.deepEqual(
    penalties.map((p) => p.userId),
    [B],
  );
});

test("teacher no-show requires a makeup with a 7 day deadline", async () => {
  const ctx = await ended({ teacher: 0 });
  await ctx.sessions.ensureDetermined(ctx.session.id);
  const penalties = [];
  hours(ctx, 49);
  await outcomes(ctx, penalties).finalizeDue(ctx.session.id);
  assert.equal(ctx.session.status, "MAKEUP_REQUIRED");
  assert.equal(+ctx.session.makeupDeadlineAt, +ctx.clock.now + 7 * 86400000);
  assert.deepEqual(
    penalties.map((p) => p.userId),
    [A],
  );
  hours(ctx, 49 + 7 * 24 + 1);
  await outcomes(ctx).finalizeDue(ctx.session.id);
  assert.equal(ctx.session.status, "DISPUTED");
  assert.equal(ctx.db.rows("reportCase")[0].reasonCode, "MAKEUP_EXPIRED");
});

test("heartbeat tracks connections and closes vanished ones at last sight", async () => {
  const ctx = await ended({ teacher: 0, learner: 0 });
  const service = outcomes(ctx);
  const ident = (u) => `${ctx.session.id}:${u}`;
  const seen = (sids) => ({
    status: "OK",
    observation: {
      roomSid: "RM_1",
      identities: sids.map(([u]) => ident(u)),
      participants: sids.map(([u, sid]) => ({ identity: ident(u), sid })),
    },
  });
  await service.recordObservation(
    ctx.session,
    seen([[A, "PA_9"]]),
    ctx.minute(1),
  );
  await service.recordObservation(
    ctx.session,
    seen([[A, "PA_9"]]),
    ctx.minute(2),
  );
  await service.recordObservation(ctx.session, seen([]), ctx.minute(4));
  const [row] = ctx.db.rows("sessionAttendanceInterval");
  assert.equal(row.closeSource, "HEARTBEAT");
  assert.equal(+row.leftAt, +ctx.minute(2));
  assert.equal(+ctx.session.lastObservedAt, +ctx.minute(4));
  await service.recordObservation(
    ctx.session,
    { status: "FAILED" },
    ctx.minute(5),
  );
  assert.equal(+ctx.session.observationFailedAt, +ctx.minute(5));
});
```

Trong `test/learning-sessions/worker.test.mjs`, ở cả hai `new SessionLifecycleWorker(...)`:
thêm `ensureDetermined: async () => {}` vào object `sessions` truyền vào, và thêm tham số thứ 5
`{ recordObservation: async () => {}, finalizeDue: async () => {} }`.

- [x] **Step 2: Chạy** → FAIL.

- [x] **Step 3: `applyNoShow`** — thay method:

```ts
  /** Hook for session lifecycle once a no-show is final; one penalty per occurrence outcome. */
  applyNoShow(
    tx: TransactionContext,
    input: { userId: string; sessionId: string; outcomeId: string; now: Date },
  ): Promise<void> {
    return this.applyViolation(tx, {
      userId: input.userId,
      reasonCode: "NO_SHOW",
      sourceId: input.sessionId,
      eventKey: `no-show:${input.outcomeId}:${input.userId}`,
      now: input.now,
    });
  }
```

`phase3.test.mjs:172` → `const noShow = { userId: B, sessionId: "session-1", outcomeId: "outcome-1", now: ctx.clock.now };`

- [x] **Step 4: Thêm vào `session-transitions.ts`**:

```ts
import { byCodeUnit } from "../../../../infrastructure/idempotency/idempotency.service";
import {
  daysAfter,
  type AttendancePolicy,
} from "../../domain/attendance.policy";
import type { SessionAttendanceOutcome } from "../../../../generated/prisma/client";

export async function requireMakeup(
  tx: TransactionContext,
  session: Pick<Session, "id">,
  outcome: Pick<SessionAttendanceOutcome, "id">,
  now: Date,
  policy: AttendancePolicy,
  outcomeStatus: "FINAL" | "EXCUSED",
) {
  await tx.sessionAttendanceOutcome.update({
    where: { id: outcome.id },
    data: {
      status: outcomeStatus,
      resolution: "MAKEUP_REQUIRED",
      finalizedAt: now,
    },
  });
  await tx.session.update({
    where: { id: session.id },
    data: {
      status: "MAKEUP_REQUIRED",
      confirmDeadlineAt: null,
      makeupDeadlineAt: daysAfter(now, policy.makeupWindowDays),
    },
  });
}

export async function finalizeNoShow(
  tx: TransactionContext,
  reputation: NoShowReputation,
  session: Session,
  outcome: SessionAttendanceOutcome,
  now: Date,
  policy: AttendancePolicy,
) {
  const absent = absentUserIds(session, outcome).sort(byCodeUnit);
  // Sequential: each penalty locks that user's reputation row in a fixed order.
  for (const userId of absent)
    await reputation.applyNoShow(tx, {
      userId,
      sessionId: session.id,
      outcomeId: outcome.id,
      now,
    });
  if (outcome.attendanceCase === "LEARNER_ABSENT") {
    await tx.sessionAttendanceOutcome.update({
      where: { id: outcome.id },
      data: { status: "FINAL", finalizedAt: now },
    });
    await completeSession(
      tx,
      session,
      { id: outcome.id, finalizedAt: now },
      "COMPLETED_LEARNER_NO_SHOW",
      now,
    );
  } else {
    await requireMakeup(tx, session, outcome, now, policy, "FINAL");
  }
  await emitSessionEvent(
    tx,
    "session.no-show.finalized",
    session.id,
    `no-show-finalized:${outcome.id}`,
    {
      outcomeId: outcome.id,
      absentUserIds: absent,
    },
  );
}
```

- [x] **Step 5: `ReportsService.openSystemSessionCase`** — thêm method public:

```ts
  /** Case opened by the Session lifecycle itself; holds settlement like a user report. */
  async openSystemSessionCase(
    tx: TransactionContext,
    input: {
      sessionId: string;
      pathId: string;
      reasonCode: "MAKEUP_EXPIRED" | "ATTENDANCE_UNVERIFIABLE";
      description: string;
    },
  ): Promise<string> {
    const open = await tx.reportCase.findFirst({
      where: {
        relatedSessionId: input.sessionId,
        reasonCode: input.reasonCode,
        status: { in: ["OPEN", "UNDER_REVIEW", "NEED_MORE_INFO"] },
      },
      select: { id: true },
    });
    if (open) return open.id;
    const path = await tx.learningPath.findUniqueOrThrow({ where: { id: input.pathId } });
    const caseId = randomUUID();
    const blocksSettlement = path.settledAt === null;
    await tx.reportCase.create({
      data: {
        id: caseId,
        reporterId: null,
        targetType: "SESSION",
        targetId: input.sessionId,
        relatedSessionId: input.sessionId,
        relatedPathId: path.id,
        reasonCode: input.reasonCode,
        description: input.description,
        status: "OPEN",
        blocksSettlement,
      },
    });
    if (blocksSettlement && path.status !== "DISPUTED")
      await tx.learningPath.update({ where: { id: path.id }, data: { status: "DISPUTED" } });
    await tx.outboxEvent.create({
      data: {
        aggregateType: "REPORT_CASE",
        aggregateId: caseId,
        version: 1,
        type: "report.session.opened",
        payload: { caseId, pathId: path.id, sessionId: input.sessionId, reporterId: null, blocksSettlement },
        dedupeKey: `report-session-opened:${caseId}`,
        correlationId: randomUUID(),
      },
    });
    return caseId;
  }
```

Constructor `ReportsService` thêm tham số cuối
`private readonly configuration: SystemConfigurationService` (dùng ở Task 10); import
`SystemConfigurationModule` vào `ReportsModule.imports`. Cập nhật mọi `new ReportsService(`
trong test (5 file: `test/bigint-responses.test.mjs`, `test/learning-platform/fixtures.mjs`,
`test/learning-platform/phase3.test.mjs`, `test/learning-requests/lifecycle.integration.test.mjs`,
`test/learning-sessions/integration/persistence.test.mjs`) để truyền đủ 7 tham số; tham số thứ 7 là
object configuration sẵn có trong file (`configuration` của `setup()` hoặc stub `getSnapshot`);
nếu file không có, truyền
`{ getSnapshot: async () => ({ values: { "session.attendancePolicy": defaultConfiguration["session.attendancePolicy"] } }) }`
(import `defaultConfiguration` từ `../learning-platform/fixtures.mjs`).

- [x] **Step 6: Tạo `session-outcome.service.ts`**:

```ts
import { Injectable } from "@nestjs/common";
import { TransactionRunner } from "../../../../infrastructure/database/transaction-runner";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
import type {
  Session,
  SessionAttendanceOutcome,
} from "../../../../generated/prisma/client";
import { SystemConfigurationService } from "../../../system-configuration/application/services/system-configuration.service";
import { ReputationService } from "../../../reputation/application/services/reputation.service";
import { ReportsService } from "../../../reports/application/services/reports.service";
import {
  LiveKitService,
  type LiveObservation,
} from "../../infrastructure/livekit/livekit.service";
import { sessionParticipantIdentity } from "../../domain/session.policy";
import {
  closeOpenIntervals,
  recordParticipantEvent,
} from "./session-attendance";
import {
  databaseNow,
  lockedSession,
  loadAttendanceContext,
} from "./session-tx";
import {
  completeSession,
  currentOutcome,
  emitSessionEvent,
  finalizeNoShow,
} from "./session-transitions";

export type ObservationResult =
  { status: "OK"; observation: LiveObservation | null } | { status: "FAILED" };

/** A connection unseen this long is treated as gone at its last sighting. */
const HEARTBEAT_STALE_MS = 90_000;

@Injectable()
export class SessionOutcomeService {
  constructor(
    private readonly transactions: TransactionRunner,
    private readonly configuration: SystemConfigurationService,
    private readonly livekit: LiveKitService,
    private readonly reputation: ReputationService,
    private readonly reports: ReportsService,
  ) {}

  recordObservation(
    expected: Pick<Session, "id" | "startAt" | "endAt">,
    result: ObservationResult,
    now: Date,
  ) {
    return this.transactions.run(async (tx) => {
      const session = await lockedSession(tx, expected.id);
      // The provider answer was fetched outside the transaction; drop it if the schedule moved.
      if (
        +session.startAt !== +expected.startAt ||
        +session.endAt !== +expected.endAt
      )
        return;
      if (result.status === "FAILED") {
        await tx.session.update({
          where: { id: session.id },
          data: { observationFailedAt: now },
        });
        return;
      }
      await tx.session.update({
        where: { id: session.id },
        data: { lastObservedAt: now },
      });
      const seen = new Set<string>();
      // Sequential: upserts share the locked Session and must not race each other.
      for (const participant of result.observation?.participants ?? []) {
        const isTeacher =
          participant.identity ===
          sessionParticipantIdentity(session.id, session.teacherId);
        const isLearner =
          participant.identity ===
          sessionParticipantIdentity(session.id, session.learnerId);
        if (!isTeacher && !isLearner) continue;
        seen.add(participant.sid);
        await recordParticipantEvent(tx, {
          sessionId: session.id,
          userId: isTeacher ? session.teacherId : session.learnerId,
          role: isTeacher ? "TEACHER" : "LEARNER",
          roomSid: result.observation!.roomSid,
          participantSid: participant.sid,
          joined: true,
          occurredAt: now,
        });
      }
      await closeOpenIntervals(
        tx,
        session.id,
        now,
        "HEARTBEAT",
        (interval) =>
          !seen.has(interval.participantSid) &&
          +now - +interval.lastSeenAt >= HEARTBEAT_STALE_MS,
      );
    });
  }

  finalizeDue(sessionId: string) {
    return this.transactions.run(async (tx) => {
      const session = await lockedSession(tx, sessionId);
      const path = await tx.learningPath.findUniqueOrThrow({
        where: { id: session.pathId },
      });
      if (!["SCHEDULED", "ACTIVE", "DISPUTED"].includes(path.status)) return;
      const context = await loadAttendanceContext(
        this.configuration,
        this.livekit.config.enabled,
        tx,
      );
      if (!context) return;
      const now = await databaseNow(tx);
      const outcome = await currentOutcome(tx, session);
      if (session.status === "AWAITING_CONFIRMATION" && outcome)
        return this.timeout(tx, session, outcome, now);
      if (
        session.status === "NO_SHOW" &&
        outcome?.status === "PROVISIONAL" &&
        now >= outcome.finalizesAt
      ) {
        await tx.sessionAbsenceExcuse.updateMany({
          where: { outcomeId: outcome.id, status: "PENDING" },
          data: { status: "EXPIRED" },
        });
        return finalizeNoShow(
          tx,
          this.reputation,
          session,
          outcome,
          now,
          context.policy,
        );
      }
      if (
        session.status === "MAKEUP_REQUIRED" &&
        session.makeupDeadlineAt &&
        now >= session.makeupDeadlineAt
      )
        return this.expireMakeup(tx, session);
    });
  }

  private async timeout(
    tx: TransactionContext,
    session: Session,
    outcome: SessionAttendanceOutcome,
    now: Date,
  ) {
    if (!session.confirmDeadlineAt || now < session.confirmDeadlineAt) return;
    const confirmed = [
      session.teacherConfirmationStatus,
      session.learnerConfirmationStatus,
    ].some((status) => status === "CONFIRMED");
    if (outcome.attendanceCase === "BOTH_PRESENT" || confirmed) {
      await completeSession(tx, session, outcome, "COMPLETED_TIMEOUT", now);
      await emitSessionEvent(
        tx,
        "session.completed.timeout",
        session.id,
        `completed-timeout:${outcome.id}`,
        {
          outcomeId: outcome.id,
        },
      );
      return;
    }
    await this.reports.openSystemSessionCase(tx, {
      sessionId: session.id,
      pathId: session.pathId,
      reasonCode: "ATTENDANCE_UNVERIFIABLE",
      description:
        "Attendance could not be verified and neither participant confirmed completion.",
    });
    await tx.sessionAttendanceOutcome.update({
      where: { id: outcome.id },
      data: { resolution: "STAFF_REVIEW", finalizedAt: now },
    });
    await tx.session.update({
      where: { id: session.id },
      data: { status: "DISPUTED", confirmDeadlineAt: null },
    });
  }

  private async expireMakeup(tx: TransactionContext, session: Session) {
    await this.reports.openSystemSessionCase(tx, {
      sessionId: session.id,
      pathId: session.pathId,
      reasonCode: "MAKEUP_EXPIRED",
      description: "No makeup time was agreed before the makeup deadline.",
    });
    await tx.session.update({
      where: { id: session.id },
      data: { status: "DISPUTED", makeupDeadlineAt: null },
    });
    await emitSessionEvent(
      tx,
      "session.makeup.expired",
      session.id,
      `makeup-expired:${session.id}:${+session.makeupDeadlineAt!}`,
      {},
    );
  }
}
```

Export `LiveObservation` từ `livekit.service.ts`:

```ts
export type LiveObservation = {
  roomSid: string;
  identities: string[];
  participants: { identity: string; sid: string }[];
};
```

và khai báo kiểu trả về `Promise<LiveObservation | null>` cho `listActiveParticipants`.

- [x] **Step 7: Worker** — constructor thêm `private readonly outcomes: SessionOutcomeService` ở cuối.
      `sweep()` thành:

```ts
await this.advanceActiveSessions(now, limit);
await this.determineEndedSessions(now, limit);
await this.finalizeDueSessions(now, limit);
await this.settleCompletedPaths(limit);
```

Trong `advanceActiveSessions`, thay khối xử lý một row:

```ts
const result = await this.observeLiveRoom(row, now);
if (result)
  await this.outcomes
    .recordObservation(row, result, now)
    .catch(() => this.logger.error("SESSION_ATTENDANCE_DEFERRED"));
await this.sessions
  .advanceLifecycle(row, result?.status === "OK" ? result.observation : null)
  .catch(() => this.logger.error("SESSION_LIFECYCLE_DEFERRED"));
```

`observeLiveRoom` trả `ObservationResult | null`:

```ts
  private async observeLiveRoom(
    row: { roomName: string | null; startAt: Date; endAt: Date },
    now: Date,
  ): Promise<ObservationResult | null> {
    if (!row.roomName || row.startAt > now || row.endAt <= now || !this.livekit.config.enabled)
      return null;
    try {
      return { status: "OK", observation: await this.livekit.listActiveParticipants(row.roomName) };
    } catch {
      this.logger.warn("LIVEKIT_OBSERVATION_UNAVAILABLE");
      return { status: "FAILED" };
    }
  }
```

Thêm hai bước (cùng kiểu seek cursor như `settleCompletedPaths`):

```ts
  private async determineEndedSessions(now: Date, limit: number) {
    let cursor: string | undefined;
    while (!this.stopped) {
      const rows: { id: string }[] = await this.db.session.findMany({
        where: {
          status: { in: ["CONFIRMED", "READY", "ONGOING", "AWAITING_CONFIRMATION"] },
          endAt: { lte: now },
          confirmDeadlineAt: null,
          ...(cursor ? { id: { gt: cursor } } : {}),
        },
        orderBy: { id: "asc" },
        take: limit,
        select: { id: true },
      });
      for (const row of rows) {
        if (this.stopped) break;
        await this.sessions
          .ensureDetermined(row.id)
          .catch(() => this.logger.error("SESSION_ATTENDANCE_DEFERRED"));
      }
      if (rows.length < limit) break;
      cursor = rows.at(-1)!.id;
    }
  }

  // ponytail: three bounded queries per sweep; page them when due rows exceed `limit`.
  private async finalizeDueSessions(now: Date, limit: number) {
    const [timeouts, makeups, noShows] = await Promise.all([
      this.db.session.findMany({
        where: { status: "AWAITING_CONFIRMATION", confirmDeadlineAt: { lte: now } },
        take: limit,
        select: { id: true },
      }),
      this.db.session.findMany({
        where: { status: "MAKEUP_REQUIRED", makeupDeadlineAt: { lte: now } },
        take: limit,
        select: { id: true },
      }),
      this.db.sessionAttendanceOutcome.findMany({
        where: { status: "PROVISIONAL", finalizesAt: { lte: now } },
        take: limit,
        select: { sessionId: true },
      }),
    ]);
    const ids = [
      ...new Set([
        ...timeouts.map(({ id }) => id),
        ...makeups.map(({ id }) => id),
        ...noShows.map(({ sessionId }) => sessionId),
      ]),
    ].sort(byCodeUnit);
    for (const id of ids) {
      if (this.stopped) break;
      await this.outcomes
        .finalizeDue(id)
        .catch(() => this.logger.error("SESSION_FINALIZATION_DEFERRED"));
    }
  }
```

(import `byCodeUnit` từ `infrastructure/idempotency/idempotency.service`, `ObservationResult`,
`SessionOutcomeService`.)

- [x] **Step 8: Module** — `learning-sessions.module.ts` thêm `SessionOutcomeService` vào `providers`.

- [x] **Step 9: Chạy** — `pnpm test:learning-sessions; pnpm nest build; node --test test/learning-platform/phase3.test.mjs` → PASS. `pnpm check-types` PASS.

- [ ] **Step 10: Commit** (nếu được phép)

```bash
git add src/modules test/learning-sessions test/learning-platform test/bigint-responses.test.mjs test/learning-requests test/learning-sessions/integration
git commit -m "feat(api): finalize session attendance outcomes"
```

---

### Task 9: Vắng có lý do (excuse)

**Files:**

- Modify: `session-outcome.service.ts` (thêm `submitExcuse`, `decideExcuse`)
- Modify: `presentation/http/learning-sessions.dto.ts`, `learning-sessions.controller.ts`
- Modify: `test/learning-sessions/http.test.mjs` (provider stub)
- Test: `test/learning-sessions/attendance.test.mjs`

**Interfaces:**

- Consumes: `requireMakeup`, `currentOutcome`, `emitSessionEvent`; `absentUserIds`.
- Produces:
  - `SessionOutcomeService.submitExcuse(actor: Principal, sessionId: string, reason: string): Promise<{ id: string; status: "PENDING" }>`
  - `SessionOutcomeService.decideExcuse(actor: Principal, sessionId: string, accept: boolean, note?: string): Promise<{ id: string; status: "ACCEPTED" | "REJECTED" }>`
  - `POST /v1/sessions/:sessionId/absence-excuse` body `{ reason }` (10..1000 ký tự)
  - `POST /v1/sessions/:sessionId/absence-excuse/decision` body `{ accept: boolean; note?: string }`
  - Error codes: `ABSENCE_EXCUSE_NOT_ALLOWED` (409), `ABSENCE_EXCUSE_EXISTS` (409), `ABSENCE_EXCUSE_NOT_PENDING` (409), `SESSION_ACCESS_DENIED` (403).

- [x] **Step 1: Viết test fail**:

```js
test("accepted excuse: makeup without penalty; only the present party decides", async () => {
  const ctx = await ended({ learner: 0 });
  await ctx.sessions.ensureDetermined(ctx.session.id);
  const penalties = [];
  const service = outcomes(ctx, penalties);
  await assert.rejects(
    service.submitExcuse(user(A), ctx.session.id, "I was there all along"),
    { message: "ABSENCE_EXCUSE_NOT_ALLOWED" },
  );
  await service.submitExcuse(
    user(B),
    ctx.session.id,
    "Hospital emergency, sorry",
  );
  await assert.rejects(
    service.submitExcuse(user(B), ctx.session.id, "Hospital emergency again"),
    { message: "ABSENCE_EXCUSE_EXISTS" },
  );
  await assert.rejects(service.decideExcuse(user(B), ctx.session.id, true), {
    message: "ABSENCE_EXCUSE_NOT_ALLOWED",
  });
  await service.decideExcuse(user(A), ctx.session.id, true, "ok");
  assert.equal(ctx.session.status, "MAKEUP_REQUIRED");
  assert.equal(ctx.db.rows("sessionAttendanceOutcome")[0].status, "EXCUSED");
  hours(ctx, 49);
  await service.finalizeDue(ctx.session.id);
  assert.deepEqual(penalties, []);
});

test("rejected or expired excuse still finalises the no-show; both absent cannot excuse", async () => {
  const ctx = await ended({ teacher: 0 });
  await ctx.sessions.ensureDetermined(ctx.session.id);
  const penalties = [];
  const service = outcomes(ctx, penalties);
  await service.submitExcuse(
    user(A),
    ctx.session.id,
    "Power outage in my area",
  );
  hours(ctx, 49);
  await service.finalizeDue(ctx.session.id);
  assert.equal(ctx.db.rows("sessionAbsenceExcuse")[0].status, "EXPIRED");
  assert.deepEqual(
    penalties.map((p) => p.userId),
    [A],
  );

  const both = await ended({ teacher: 0, learner: 0 });
  await both.sessions.ensureDetermined(both.session.id);
  await assert.rejects(
    outcomes(both).submitExcuse(user(A), both.session.id, "Power outage here"),
    { message: "ABSENCE_EXCUSE_NOT_ALLOWED" },
  );
});
```

Trong `http.test.mjs`, thêm vào `providers` của `Test.createTestingModule`:
`{ provide: SessionOutcomeService, useValue: {} }` (import từ dist).

- [x] **Step 2: Chạy** → FAIL.

- [x] **Step 3: Implement trong `SessionOutcomeService`** (import thêm `ConflictException, ForbiddenException`, `Principal`, `absentUserIds`, `requireMakeup`):

```ts
  private async openNoShow(tx: TransactionContext, actor: Principal, sessionId: string) {
    const session = await lockedSession(tx, sessionId);
    if (actor.userId !== session.teacherId && actor.userId !== session.learnerId)
      throw new ForbiddenException("SESSION_ACCESS_DENIED");
    const now = await databaseNow(tx);
    const outcome = await currentOutcome(tx, session);
    if (
      session.status !== "NO_SHOW" ||
      outcome?.status !== "PROVISIONAL" ||
      now >= outcome.finalizesAt ||
      outcome.attendanceCase === "BOTH_ABSENT"
    )
      throw new ConflictException("ABSENCE_EXCUSE_NOT_ALLOWED");
    const absent = absentUserIds(session, outcome).includes(actor.userId);
    return { session, outcome, now, absent };
  }

  submitExcuse(actor: Principal, sessionId: string, reason: string) {
    return this.transactions.run(async (tx) => {
      const { session, outcome, absent } = await this.openNoShow(tx, actor, sessionId);
      if (!absent) throw new ConflictException("ABSENCE_EXCUSE_NOT_ALLOWED");
      if (await tx.sessionAbsenceExcuse.findUnique({ where: { outcomeId: outcome.id } }))
        throw new ConflictException("ABSENCE_EXCUSE_EXISTS");
      const excuse = await tx.sessionAbsenceExcuse.create({
        data: { outcomeId: outcome.id, absentUserId: actor.userId, reason: reason.trim(), status: "PENDING" },
      });
      await emitSessionEvent(tx, "session.absence-excuse.submitted", session.id, `excuse-submitted:${excuse.id}`, {
        excuseId: excuse.id,
        absentUserId: actor.userId,
      });
      return { id: excuse.id, status: "PENDING" as const };
    });
  }

  decideExcuse(actor: Principal, sessionId: string, accept: boolean, note?: string) {
    return this.transactions.run(async (tx) => {
      const { session, outcome, now, absent } = await this.openNoShow(tx, actor, sessionId);
      if (absent) throw new ConflictException("ABSENCE_EXCUSE_NOT_ALLOWED");
      const excuse = await tx.sessionAbsenceExcuse.findUnique({ where: { outcomeId: outcome.id } });
      if (excuse?.status !== "PENDING") throw new ConflictException("ABSENCE_EXCUSE_NOT_PENDING");
      const status = accept ? ("ACCEPTED" as const) : ("REJECTED" as const);
      await tx.sessionAbsenceExcuse.update({
        where: { id: excuse.id },
        data: { status, decidedByUserId: actor.userId, decidedAt: now, decisionNote: note?.trim() || null },
      });
      if (accept) {
        const context = await loadAttendanceContext(this.configuration, this.livekit.config.enabled, tx);
        if (!context) throw new ConflictException("ATTENDANCE_PENDING");
        await requireMakeup(tx, session, outcome, now, context.policy, "EXCUSED");
      }
      await emitSessionEvent(tx, "session.absence-excuse.decided", session.id, `excuse-decided:${excuse.id}`, {
        excuseId: excuse.id,
        absentUserId: excuse.absentUserId,
        status,
      });
      return { id: excuse.id, status };
    });
  }
```

- [x] **Step 4: DTO** — thêm vào `learning-sessions.dto.ts` (import `IsBoolean, MinLength`):

```ts
export class SubmitAbsenceExcuseDto {
  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  reason!: string;
}

export class DecideAbsenceExcuseDto {
  @IsBoolean()
  accept!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
```

- [x] **Step 5: Controller** — constructor thêm `private readonly outcomes: SessionOutcomeService`; thêm:

```ts
  @Post(":sessionId/absence-excuse")
  @ApiOperation({ summary: "Explain an absence; the present participant decides" })
  @ApiErrorResponse(409)
  async submitExcuse(
    @CurrentIdentity() actor: Principal,
    @Param("sessionId", ParseUUIDPipe) sessionId: string,
    @Body() body: SubmitAbsenceExcuseDto,
  ) {
    return success(
      await this.outcomes.submitExcuse(actor, sessionId, body.reason),
      "Absence excuse submitted.",
    );
  }

  @Post(":sessionId/absence-excuse/decision")
  @HttpCode(200)
  @ApiOperation({ summary: "Accept or reject the partner's absence excuse" })
  @ApiErrorResponse(409)
  async decideExcuse(
    @CurrentIdentity() actor: Principal,
    @Param("sessionId", ParseUUIDPipe) sessionId: string,
    @Body() body: DecideAbsenceExcuseDto,
  ) {
    return success(
      await this.outcomes.decideExcuse(actor, sessionId, body.accept, body.note),
      "Absence excuse decided.",
    );
  }
```

- [x] **Step 6: Chạy** — `pnpm test:learning-sessions` → PASS.

- [ ] **Step 7: Commit** (nếu được phép)

```bash
git add src/modules/learning-sessions test/learning-sessions
git commit -m "feat(api): add absence excuse endpoints"
```

---

### Task 10: Report: outcome DISPUTED, ruling của Staff, dispute window từ config

**Files:**

- Modify: `session-transitions.ts` (thêm `applyNoShowRuling`, `releaseDisputedOutcome`)
- Modify: `src/modules/reports/application/services/reports.service.ts` — `createSessionReport` (dòng 140-238), `assertPathSettlementAllowed` (284-301), `updateCase` (303-427), `assertResolutionAllowed` (481-508), `disputeDeadline` (633-635)
- Modify: `src/modules/reports/presentation/http/reports.dto.ts` (`ReportCaseActionDto`)
- Test: `test/learning-sessions/attendance.test.mjs`

**Interfaces:**

- Consumes: `finalizeNoShow`, `requireMakeup`, `completeSession`, `currentOutcome`, `lockedSession`; `hoursAfter`, `isAbsentCase`.
- Produces:
  - `type NoShowRuling = "UPHOLD" | "EXCUSE" | "COMPLETE"`
  - `applyNoShowRuling(tx, reputation: NoShowReputation, input: { sessionId; ruling: NoShowRuling; now: Date; policy: AttendancePolicy }): Promise<void>`
  - `releaseDisputedOutcome(tx, sessionId: string, closingCaseId: string): Promise<void>`
  - `ReportCaseActionDto.noShowRuling?: NoShowRuling`
  - Error codes: `NO_SHOW_RULING_NOT_APPLICABLE` (409), `NO_SHOW_RULING_REQUIRED` (409).

- [x] **Step 1: Viết test fail**:

```js
function reportsFor(ctx, penalties = []) {
  return new ReportsService(
    runner(ctx.db),
    {},
    {
      attachReady: async () => {
        throw new Error("no files in this test");
      },
    },
    { append: async () => {} },
    {
      applyNoShow: async (_tx, input) => {
        penalties.push(input);
      },
      applyViolation: async () => {},
    },
    {},
    ctx.configuration,
  );
}
const staff = {
  userId: "0d0d0d0d-0000-4000-8000-00000000000d",
  roles: ["STAFF"],
  permissions: ["report:moderate"],
};

test("a report freezes the no-show; UPHOLD penalises once, COMPLETE overturns", async () => {
  const ctx = await ended({ learner: 0 });
  await ctx.sessions.ensureDetermined(ctx.session.id);
  const penalties = [];
  const reports = reportsFor(ctx, penalties);
  const opened = await reports.createSessionReport(user(B), ctx.session.id, {
    reasonCode: "TECHNICAL_ISSUE",
    description: "My camera froze, I was in the room",
    evidenceFileIds: [],
  });
  assert.equal(ctx.db.rows("sessionAttendanceOutcome")[0].status, "DISPUTED");
  hours(ctx, 49);
  await outcomes(ctx).finalizeDue(ctx.session.id);
  assert.equal(ctx.session.status, "NO_SHOW"); // frozen while disputed
  await reports.updateCase(staff, opened.id, "claim");
  await reports.updateCase(staff, opened.id, "resolve", {
    note: "Logs show the learner joined",
    noShowRuling: "COMPLETE",
  });
  assert.equal(ctx.session.status, "COMPLETED");
  assert.equal(ctx.db.rows("sessionAttendanceOutcome")[0].status, "OVERTURNED");
  assert.equal(
    ctx.db.rows("sessionAttendanceOutcome")[0].resolution,
    "COMPLETED_STAFF",
  );
  assert.deepEqual(penalties, []);
});

test("rejecting a no-show report returns the outcome to provisional", async () => {
  const ctx = await ended({ learner: 0 });
  await ctx.sessions.ensureDetermined(ctx.session.id);
  const reports = reportsFor(ctx);
  const opened = await reports.createSessionReport(user(B), ctx.session.id, {
    reasonCode: "OTHER",
    description: "I disagree with this absence",
    evidenceFileIds: [],
  });
  await reports.updateCase(staff, opened.id, "claim");
  await reports.updateCase(staff, opened.id, "reject", {
    note: "No evidence provided",
  });
  assert.equal(
    ctx.db.rows("sessionAttendanceOutcome")[0].status,
    "PROVISIONAL",
  );
});

test("system cases require a ruling", async () => {
  const ctx = await ended({ teacher: 0, observed: false });
  await ctx.sessions.ensureDetermined(ctx.session.id);
  hours(ctx, 25);
  await outcomes(ctx).finalizeDue(ctx.session.id);
  const reports = reportsFor(ctx);
  const [item] = ctx.db.rows("reportCase");
  await reports.updateCase(staff, item.id, "claim");
  await assert.rejects(
    reports.updateCase(staff, item.id, "reject", { note: "n/a" }),
    { message: "NO_SHOW_RULING_REQUIRED" },
  );
  await reports.updateCase(staff, item.id, "resolve", {
    note: "Met on another call",
    noShowRuling: "COMPLETE",
  });
  assert.equal(ctx.session.status, "COMPLETED");
});
```

- [x] **Step 2: Chạy** → FAIL.

- [x] **Step 3: Thêm vào `session-transitions.ts`**:

```ts
import { ConflictException } from "@nestjs/common";
import { lockedSession } from "./session-tx";

export type NoShowRuling = "UPHOLD" | "EXCUSE" | "COMPLETE";

/** Staff decision for a Session held by a report case; runs inside the resolve transaction. */
export async function applyNoShowRuling(
  tx: TransactionContext,
  reputation: NoShowReputation,
  input: {
    sessionId: string;
    ruling: NoShowRuling;
    now: Date;
    policy: AttendancePolicy;
  },
) {
  const session = await lockedSession(tx, input.sessionId);
  const outcome = await currentOutcome(tx, session);
  if (
    !outcome ||
    !["NO_SHOW", "DISPUTED", "MAKEUP_REQUIRED"].includes(session.status)
  )
    throw new ConflictException("NO_SHOW_RULING_NOT_APPLICABLE");
  const absent = isAbsentCase(outcome.attendanceCase);
  if (input.ruling === "UPHOLD") {
    if (!absent || session.status !== "NO_SHOW")
      throw new ConflictException("NO_SHOW_RULING_NOT_APPLICABLE");
    return finalizeNoShow(
      tx,
      reputation,
      session,
      outcome,
      input.now,
      input.policy,
    );
  }
  if (input.ruling === "EXCUSE")
    return requireMakeup(
      tx,
      session,
      outcome,
      input.now,
      input.policy,
      absent ? "EXCUSED" : "FINAL",
    );
  if (absent)
    await tx.sessionAttendanceOutcome.update({
      where: { id: outcome.id },
      data: { status: "OVERTURNED", finalizedAt: input.now },
    });
  await completeSession(
    tx,
    session,
    { id: outcome.id, finalizedAt: input.now },
    "COMPLETED_STAFF",
    input.now,
  );
}

/** A closed report without ruling lets the no-show finalise normally, unless another case holds it. */
export async function releaseDisputedOutcome(
  tx: TransactionContext,
  sessionId: string,
  closingCaseId: string,
) {
  const others = await tx.reportCase.count({
    where: {
      relatedSessionId: sessionId,
      id: { not: closingCaseId },
      status: { in: ["OPEN", "UNDER_REVIEW", "NEED_MORE_INFO"] },
    },
  });
  if (others === 0)
    await tx.sessionAttendanceOutcome.updateMany({
      where: { sessionId, status: "DISPUTED" },
      data: { status: "PROVISIONAL" },
    });
}
```

Ghi chú: `MAKEUP_REQUIRED` không có case giữ nó; nó chỉ chuyển `DISPUTED` khi hết hạn bù. `EXCUSE`
trên `DISPUTED` của `MAKEUP_EXPIRED` cho hạn bù mới; `requireMakeup` ghi đè `resolution` thành
`MAKEUP_REQUIRED`.

- [x] **Step 4: DTO** — trong `ReportCaseActionDto`:

```ts
  @IsOptional()
  @IsIn(["UPHOLD", "EXCUSE", "COMPLETE"])
  noShowRuling?: "UPHOLD" | "EXCUSE" | "COMPLETE";
```

- [x] **Step 5: `ReportsService`**:

1. Thêm helper:

```ts
  private async attendancePolicy(tx: TransactionContext) {
    const { values } = await this.configuration.getSnapshot(["session.attendancePolicy"], tx);
    const policy = values["session.attendancePolicy"];
    if (!policy)
      throw new ServiceUnavailableException("Configuration not ready: session.attendancePolicy");
    return policy;
  }
```

2. Thay `private disputeDeadline(sessionEndAt)` bằng:

```ts
  private async disputeDeadline(tx: TransactionContext, sessionEndAt: Date) {
    return hoursAfter(sessionEndAt, (await this.attendancePolicy(tx)).disputeWindowHours);
  }
```

và hai chỗ gọi: `clock.now >= (await this.disputeDeadline(tx, session.endAt))`,
`const deadline = await this.disputeDeadline(tx, latestEnd);`.

3. Trong `createSessionReport`, ngay sau `tx.reportCase.create(...)`:

```ts
if (session.status === "NO_SHOW")
  await tx.sessionAttendanceOutcome.updateMany({
    where: { sessionId, status: "PROVISIONAL" },
    data: { status: "DISPUTED" },
  });
```

4. Trong `assertResolutionAllowed`, thêm vào `requested`:
   `noShowRuling: input.noShowRuling !== undefined,`.

5. Trong `updateCase`, ngay sau dòng `if (action === "resolve") { await this.applyResolution(...) }`:

```ts
await this.settleSessionRuling(tx, item, action, input, clock.now);
```

và method:

```ts
  private async settleSessionRuling(
    tx: TransactionContext,
    item: { id: string; relatedSessionId: string | null },
    action: "resolve" | "reject",
    input: ReportCaseActionDto,
    now: Date,
  ) {
    if (!item.relatedSessionId) return;
    const session = await tx.session.findUniqueOrThrow({
      where: { id: item.relatedSessionId },
      select: { status: true },
    });
    if (action === "resolve" && input.noShowRuling) {
      await applyNoShowRuling(tx, this.reputation, {
        sessionId: item.relatedSessionId,
        ruling: input.noShowRuling,
        now,
        policy: await this.attendancePolicy(tx),
      });
      return;
    }
    // Only a ruling can move a Session the lifecycle handed to Staff.
    if (session.status === "DISPUTED")
      throw new ConflictException("NO_SHOW_RULING_REQUIRED");
    await releaseDisputedOutcome(tx, item.relatedSessionId, item.id);
  }
```

6. Trong `staffCaseDetail`, thêm `startAt: true` vào select `session` (đã có) và trả kèm bằng chứng:

```ts
const outcome = session
  ? await tx.sessionAttendanceOutcome.findFirst({
      where: { sessionId: session.id, occurrenceStartAt: session.startAt },
    })
  : null;
const [withSizes] = withEvidenceSizeText([item]);
return {
  ...withSizes,
  session,
  path,
  // Attendance evidence lets Staff reconcile a no-show report without uploads.
  attendanceOutcome: outcome && {
    ...outcome,
    teacherSeconds: outcome.teacherSeconds.toString(),
    learnerSeconds: outcome.learnerSeconds.toString(),
  },
};
```

Import `applyNoShowRuling, releaseDisputedOutcome` từ
`../../../learning-sessions/application/services/session-transitions` và `hoursAfter` từ
`../../../learning-sessions/domain/attendance.policy`. (Chỉ import file, không import module
Nest, nên không có vòng DI.) `ServiceUnavailableException` thêm vào import `@nestjs/common`.

Lưu ý: kiểm tra `"NO_SHOW_RULING_REQUIRED"` phải chạy **trước** khi case bị chuyển `REJECTED`.
Vì toàn bộ `updateCase` là một transaction, ném lỗi sẽ rollback cả update case — chấp nhận được.

- [x] **Step 6: Chạy** — `pnpm test:learning-sessions; pnpm nest build; node --test test/learning-platform/*.test.mjs` → PASS.

- [ ] **Step 7: Commit** (nếu được phép)

```bash
git add src/modules test/learning-sessions
git commit -m "feat(api): add staff no-show rulings to session reports"
```

---

### Task 11: Học bù qua reschedule

**Files:**

- Modify: `src/modules/scheduling/application/services/scheduling.service.ts` — `applyReschedule` (dòng 79-158), `proposeReschedule` (dòng 619-658)
- Test: `test/learning-sessions/attendance.test.mjs`

**Interfaces:**

- Consumes: Session `MAKEUP_REQUIRED`, `makeupDeadlineAt`.
- Produces: reschedule từ `MAKEUP_REQUIRED` → `CONFIRMED` với occurrence reset; lỗi `MAKEUP_WINDOW_CLOSED` (409).

- [x] **Step 1: Viết test fail**:

```js
test("makeup reschedule starts a fresh occurrence that is judged again", async () => {
  const ctx = await ended({ teacher: 0 });
  await ctx.sessions.ensureDetermined(ctx.session.id);
  const penalties = [];
  hours(ctx, 49);
  await outcomes(ctx, penalties).finalizeDue(ctx.session.id);
  const proposal = ctx.db.rows("scheduleProposal")[0];
  const next = {
    startAt: "2026-11-06T10:00:00Z",
    endAt: "2026-11-06T11:00:00Z",
  };
  const proposed = await ctx.schedules.proposeReschedule(
    user(A),
    ctx.session.id,
    {
      ...next,
      expectedVersion: proposal.currentVersion,
    },
  );
  await ctx.schedules.confirmProposal(user(A), proposed.id, proposed.version);
  await ctx.schedules.confirmProposal(user(B), proposed.id, proposed.version);
  assert.equal(ctx.session.status, "CONFIRMED");
  assert.equal(ctx.session.makeupDeadlineAt, null);
  assert.equal(ctx.session.teacherTokenIssuedAt, null);
  // The makeup occurrence is missed again: a second, distinct penalty.
  ctx.clock.now = new Date("2026-11-06T11:21:00Z");
  ctx.session.learnerTokenIssuedAt = new Date("2026-11-06T09:55:00Z");
  ctx.session.lastObservedAt = new Date("2026-11-06T10:30:00Z");
  await ctx.sessions.ensureDetermined(ctx.session.id);
  assert.equal(ctx.db.rows("sessionAttendanceOutcome").length, 2);
  ctx.clock.now = new Date("2026-11-08T12:00:00Z");
  await outcomes(ctx, penalties).finalizeDue(ctx.session.id);
  const teacherPenalties = penalties.filter((p) => p.userId === A);
  assert.equal(teacherPenalties.length, 2);
  assert.notEqual(teacherPenalties[0].outcomeId, teacherPenalties[1].outcomeId);
});
```

(Nếu `proposeReschedule` trả shape khác `{ id, version }`, đọc `scheduling.service.ts:597-760` và
dùng đúng field trả về; test chỉ cần id proposal và version mới.)

- [x] **Step 2: Chạy** → FAIL `SESSION_CANNOT_BE_RESCHEDULED`.

- [x] **Step 3: `proposeReschedule`** — thay điều kiện trạng thái và cutoff:

```ts
const makeup = lockedSession.status === "MAKEUP_REQUIRED";
if (
  (path.status !== "SCHEDULED" && path.status !== "ACTIVE") ||
  (!makeup && !["CONFIRMED", "READY"].includes(lockedSession.status))
) {
  throw new ConflictException("SESSION_CANNOT_BE_RESCHEDULED");
}
```

và:

```ts
if (
  makeup &&
  lockedSession.makeupDeadlineAt &&
  clock.now >= lockedSession.makeupDeadlineAt
)
  throw new ConflictException("MAKEUP_WINDOW_CLOSED");
// A makeup replaces an occurrence already in the past, so the old start has no cutoff.
if (
  !makeup &&
  lockedSession.startAt.getTime() - clock.now.getTime() <
    values["schedule.rescheduleCutoffMinutes"] * millisecondsPerMinute
) {
  throw new ConflictException("RESCHEDULE_CUTOFF_VIOLATION");
}
```

- [x] **Step 4: `applyReschedule`** — trong `if (changed)`:

```ts
if (changed) {
  const makeup = session.status === "MAKEUP_REQUIRED";
  if (
    makeup
      ? session.makeupDeadlineAt !== null && now >= session.makeupDeadlineAt
      : !["CONFIRMED", "READY"].includes(session.status) ||
        session.startAt.getTime() - now.getTime() <
          cutoffMinutes * millisecondsPerMinute
  ) {
    throw new ConflictException("RESCHEDULE_CUTOFF_OR_STATE_VIOLATION");
  }
}
```

(Nếu Sonar S3358 phàn nàn ternary trong điều kiện, tách thành `const violates = makeup ? … : …;`.)

Và thay `data: { startAt: item.startAt, endAt: item.endAt, status: "CONFIRMED" }` bằng:

```ts
        data: {
          startAt: item.startAt,
          endAt: item.endAt,
          status: "CONFIRMED",
          // A new occurrence: confirmations, attendance evidence and deadlines start over.
          teacherConfirmationStatus: null,
          teacherConfirmedAt: null,
          teacherConfirmationNote: null,
          learnerConfirmationStatus: null,
          learnerConfirmedAt: null,
          learnerConfirmationNote: null,
          teacherTokenIssuedAt: null,
          learnerTokenIssuedAt: null,
          teacherFirstJoinedAt: null,
          learnerFirstJoinedAt: null,
          teacherLastLeftAt: null,
          learnerLastLeftAt: null,
          teacherAttendanceSeconds: 0n,
          learnerAttendanceSeconds: 0n,
          lastObservedAt: null,
          observationFailedAt: null,
          confirmDeadlineAt: null,
          makeupDeadlineAt: null,
          providerRoomId: null,
        },
```

- [x] **Step 5: Chạy** — `pnpm test:learning-sessions; pnpm nest build; node --test test/learning-platform/*.test.mjs` → PASS (reschedule cũ vẫn đúng vì Session CONFIRMED chưa có dữ liệu occurrence).

- [ ] **Step 6: Commit** (nếu được phép)

```bash
git add src/modules/scheduling test/learning-sessions
git commit -m "feat(api): reschedule makeup sessions"
```

---

### Task 12: Thông báo Session

**Files:**

- Create: `src/modules/notifications/infrastructure/events/session-notification.handler.ts`
- Modify: `src/modules/notifications/skill-notification.module.ts` (providers, cạnh `LearningPathNotificationHandler`)
- Modify: `src/modules/notifications/infrastructure/events/learning-path-notification.handler.ts` (reporter null)
- Test: `test/learning-sessions/notifications.test.mjs` (mới)

**Interfaces:**

- Consumes: outbox event types từ Task 6/8/9: `session.attendance.determined`, `session.absence-excuse.submitted`, `session.absence-excuse.decided`, `session.no-show.finalized`, `session.completed.timeout`, `session.makeup.expired`; payload luôn có `sessionId`, excuse event có `absentUserId`.
- Consumes: `NotificationDispatcher.dispatch({ eventId, type, userIds, title, body, payload })`.

- [x] **Step 1: Viết test fail** — `test/learning-sessions/notifications.test.mjs`:

```js
import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { SessionNotificationHandler } from "../../dist/modules/notifications/infrastructure/events/session-notification.handler.js";

const session = { teacherId: "t", learnerId: "l" };
function handler() {
  const sent = [];
  const registered = [];
  const instance = new SessionNotificationHandler(
    { register: (type) => registered.push(type) },
    { dispatch: async (message) => sent.push(message) },
    { session: { findUnique: async () => session } },
  );
  instance.onModuleInit();
  return { instance, sent, registered };
}
const event = (type, payload) => ({
  eventId: "e1",
  type,
  version: 1,
  payload: { sessionId: "s", ...payload },
});

test("routes session events to the right participants", async () => {
  const { instance, sent, registered } = handler();
  assert.equal(registered.length, 6);
  await instance.publish(
    event("session.absence-excuse.submitted", { absentUserId: "l" }),
  );
  await instance.publish(
    event("session.absence-excuse.decided", {
      absentUserId: "l",
      status: "ACCEPTED",
    }),
  );
  await instance.publish(event("session.no-show.finalized", {}));
  assert.deepEqual(
    sent.map((m) => m.userIds),
    [["t"], ["l"], ["t", "l"]],
  );
  assert.equal(sent[0].payload.sessionId, "s");
  await assert.rejects(instance.publish(event("session.unknown", {})));
});
```

Thêm file vào script: `package.json` `test:learning-sessions` đã glob `test/learning-sessions/*.test.mjs` — không cần sửa.

- [x] **Step 2: Chạy** → FAIL.

- [x] **Step 3: Implement handler**:

```ts
import { Injectable, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../../../../infrastructure/database/prisma.service";
import {
  OutboxPublisherRegistry,
  type OutboxMessage,
  type OutboxPublisher,
} from "../../../../infrastructure/events/outbox.types";
import { NotificationDispatcher } from "../../application/services/notification-dispatcher";

type Audience = "BOTH" | "PRESENT" | "ABSENT";
const messages: Record<
  string,
  { audience: Audience; title: string; body: string }
> = {
  "session.attendance.determined": {
    audience: "BOTH",
    title: "Session attendance recorded",
    body: "Attendance for your session has been determined. Check the session for next steps.",
  },
  "session.absence-excuse.submitted": {
    audience: "PRESENT",
    title: "Absence explanation received",
    body: "Your partner explained their absence. Please accept or reject it.",
  },
  "session.absence-excuse.decided": {
    audience: "ABSENT",
    title: "Absence explanation decided",
    body: "Your partner responded to your absence explanation.",
  },
  "session.no-show.finalized": {
    audience: "BOTH",
    title: "Session no-show finalized",
    body: "The no-show result for your session is now final.",
  },
  "session.completed.timeout": {
    audience: "BOTH",
    title: "Session completed",
    body: "The confirmation window ended and the session was completed.",
  },
  "session.makeup.expired": {
    audience: "BOTH",
    title: "Makeup session overdue",
    body: "No makeup time was agreed in time; staff will review the session.",
  },
};

@Injectable()
export class SessionNotificationHandler
  implements OnModuleInit, OutboxPublisher
{
  constructor(
    private readonly registry: OutboxPublisherRegistry,
    private readonly dispatcher: NotificationDispatcher,
    private readonly db: PrismaService,
  ) {}

  onModuleInit(): void {
    for (const type of Object.keys(messages))
      this.registry.register(type, this);
  }

  async publish(event: OutboxMessage): Promise<void> {
    const message = messages[event.type];
    const payload = event.payload as Record<string, unknown> | null;
    if (!message || event.version < 1 || typeof payload?.sessionId !== "string")
      throw new Error("INVALID_SESSION_EVENT");
    const session = await this.db.session.findUnique({
      where: { id: payload.sessionId },
      select: { teacherId: true, learnerId: true },
    });
    if (!session) throw new Error("SESSION_EVENT_TARGET_MISSING");
    const both = [session.teacherId, session.learnerId];
    const absentUserId = payload.absentUserId;
    if (message.audience !== "BOTH" && typeof absentUserId !== "string")
      throw new Error("INVALID_SESSION_EVENT");
    const audiences: Record<Audience, string[]> = {
      BOTH: both,
      PRESENT: both.filter((id) => id !== absentUserId),
      ABSENT: [absentUserId as string],
    };
    await this.dispatcher.dispatch({
      eventId: event.eventId,
      type: event.type,
      userIds: audiences[message.audience],
      title: message.title,
      body: message.body,
      payload: { sessionId: payload.sessionId },
    });
  }
}
```

- [x] **Step 4: Reporter null trong `LearningPathNotificationHandler`**:
  - `resolveSessionNotification`: đổi điều kiện thành
    `typeof data.sessionId !== "string" || (data.reporterId !== null && typeof data.reporterId !== "string")`;
    recipients giữ `filter((id) => id !== data.reporterId)` (null → cả hai).
  - Nhánh `report.case.updated`: cho phép `data.reporterId === null`; trong `caseRecipients`
    nhận `reporterId: string | null`, trả `[...new Set([...(reporterId ? [reporterId] : []), …participants])]`
    và khi không phải RESOLVED/REJECTED mà reporter null thì trả hai participant của path (nếu có `pathId`).
  - `emitCaseUpdated` trong `ReportsService` nhận `reporterId: string | null` (đổi kiểu tham số).

- [x] **Step 5: Đăng ký** — thêm `SessionNotificationHandler` vào `providers` của
      `skill-notification.module.ts` cạnh `LearningPathNotificationHandler`.

- [x] **Step 6: Chạy** — `pnpm test:learning-sessions; pnpm check-types` → PASS.

- [ ] **Step 7: Commit** (nếu được phép)

```bash
git add src/modules/notifications src/modules/reports test/learning-sessions/notifications.test.mjs
git commit -m "feat(api): notify session attendance outcomes"
```

---

### Task 13: Integration DB thật và kiểm chứng toàn bộ

**Files:**

- Modify: `test/learning-sessions/integration/persistence.test.mjs:250-270`
- Modify: các file đã đổi constructor (đã làm ở Task 8)
- Modify: `specs/012-session-no-show/spec.md` (trạng thái)

- [x] **Step 1: Sửa integration persistence** — trong đoạn dựng session đã kết thúc (dòng ~250):

```js
const endedAt = new Date(Date.now() - 30 * 60000);
await f.db.session.update({
  where: { id: session.id },
  data: {
    startAt: new Date(+endedAt - 3600000),
    endAt: endedAt,
    status: "CONFIRMED",
    // Tokens were issued but LiveKit never observed the room: unverifiable, confirm allowed.
    teacherTokenIssuedAt: new Date(+endedAt - 3600000),
    learnerTokenIssuedAt: new Date(+endedAt - 3600000),
  },
});
```

- [x] **Step 2: Kiểm chứng khóa + unique thật** — ngay sau `f.db.session.update(...)` ở Step 1,
      trước `sessions.advanceLifecycle(...)`:

```js
// Concurrent determinations serialize on the Session lock and the unique key.
await Promise.all([
  sessions.ensureDetermined(session.id),
  sessions.ensureDetermined(session.id),
]);
const decided = await f.db.sessionAttendanceOutcome.findMany({
  where: { sessionId: session.id },
});
assert.equal(decided.length, 1);
assert.equal(decided[0].attendanceCase, "UNVERIFIABLE");
```

Lưu ý: sau bước này Session đã ở `AWAITING_CONFIRMATION`; `advanceLifecycle(expected, …)` kế
tiếp so `expected` (lịch cũ) nên vẫn bỏ qua như trước, và hai `complete` song song vẫn ra
`COMPLETED` một lần.

- [x] **Step 3: Migrate DB test và chạy integration**

```powershell
$env:DATABASE_URL = $env:TEST_DATABASE_URL; pnpm db:deploy
pnpm test:learning-sessions:integration
```

Expected: PASS. Chạy thêm các integration suite có đụng Session/Report:
`node test/require-integration-env.mjs; pnpm nest build; node --test --test-concurrency=1 test/learning-requests/lifecycle.integration.test.mjs test/learning-platform/finalize.integration.test.mjs`.

- [x] **Step 4: Kiểm chứng toàn bộ** (từ repo root, tuần tự):

```bash
pnpm --filter api lint
pnpm --filter api check-types
pnpm --filter api build
pnpm --filter api test:learning-sessions
pnpm --filter api test:configuration
pnpm --filter api test:bigint-responses
```

Và fake-DB suites: `pnpm --filter api exec node --test test/learning-platform/phase1.test.mjs test/learning-platform/phase2.test.mjs test/learning-platform/phase3.test.mjs test/learning-platform/phase4.test.mjs test/learning-requests/lifecycle-flow.test.mjs`.
Expected: tất cả PASS, lint 0 warning. Ghi output thật vào PR; không tuyên bố pass khi chưa chạy.

- [x] **Step 5: Cập nhật trạng thái spec** — dòng `**Trạng thái:**` thành
      `Đã triển khai backend A+B+D; phần C (Credit) chưa làm.`

- [ ] **Step 6: Commit** (nếu được phép)

```bash
git add test/learning-sessions/integration specs/012-session-no-show
git commit -m "test(api): cover attendance with postgres"
```

---

## Rollout

1. Deploy migration (`pnpm db:deploy`) **cùng** code; backfill trong migration chặn phạt oan các buổi đang diễn ra.
2. `pnpm --filter api db:seed-configuration` để thêm `session.attendancePolicy` default.
3. Mobile cần đọc `attendance`, `deadlines`, `excuse`, `allowedActions`; `attendanceStatus` đã bỏ (breaking, ghi trong PR).
4. Staff UI/API: resolve case Session có thể kèm `noShowRuling`; case hệ thống (`reporterId = null`) bắt buộc ruling.

## Ngoài phạm vi (phần C)

Tỷ lệ giữ/hoàn/trừ Credit theo trường hợp vắng và tự động hủy/hoàn khi học bù quá hạn.
Trong lúc chờ, Staff dùng `creditAdjustments` khi resolve case.
