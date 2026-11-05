import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  finalizedOneWay,
  setup,
  user,
  A,
  B,
  C,
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

import { SessionOutcomeService } from "../../dist/modules/learning-sessions/application/services/session-outcome.service.js";
import { ReportsService } from "../../dist/modules/reports/application/services/reports.service.js";
import { runner } from "../learning-platform/fake-db.mjs";
import { ReputationService } from "../../dist/modules/reputation/application/services/reputation.service.js";

function outcomes(ctx, penalties = []) {
  return new SessionOutcomeService(
    runner(ctx.db),
    {
      applyNoShow: async (_tx, input) => {
        penalties.push(input);
      },
    },
    new ReportsService(
      runner(ctx.db),
      {},
      {},
      { append: async () => {} },
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
  assert.equal(ctx.db.rows("sessionAttendanceOutcome")[0].status, "DISPUTED");
  assert.equal(
    ctx.db.rows("sessionAttendanceOutcome")[0].resolution,
    "STAFF_REVIEW",
  );
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
  assert.equal(
    ctx.db.rows("sessionAttendanceOutcome")[0].resolution,
    "STAFF_REVIEW",
  );
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
  assert.equal(ctx.db.rows("sessionAttendanceOutcome")[0].status, "FINAL");
});

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
  assert.equal(ctx.session.status, "DISPUTED");
  assert.equal(ctx.session.makeupCount, 1);
  assert.equal(ctx.db.rows("reportCase")[0].reasonCode, "MAKEUP_LIMIT_REACHED");
});

test("Staff can extend the booking deadline of the same makeup without granting a second opportunity", async () => {
  const ctx = await ended({ teacher: 0 });
  await ctx.sessions.ensureDetermined(ctx.session.id);
  const service = outcomes(ctx, []);
  hours(ctx, 49);
  await service.finalizeDue(ctx.session.id);
  const firstDeadline = +ctx.session.makeupDeadlineAt;
  ctx.clock.now = new Date(firstDeadline);
  await service.finalizeDue(ctx.session.id);
  const reports = reportsFor(ctx);
  const report = ctx.db.rows("reportCase")[0];
  await reports.updateCase(staff, report.id, "claim");
  await reports.updateCase(staff, report.id, "resolve", {
    note: "Extend the existing makeup booking opportunity",
    noShowRuling: "EXCUSE",
  });
  assert.equal(ctx.session.status, "MAKEUP_REQUIRED");
  assert.equal(ctx.session.makeupCount, 1);
  assert.ok(+ctx.session.makeupDeadlineAt > firstDeadline);
});

test("unauthorized completion cannot materialize attendance", async () => {
  const ctx = await ended({ learner: 0 });
  await assert.rejects(
    ctx.sessions.complete(user(C), ctx.session.id, "outsider"),
    {
      message: "SESSION_ACCESS_DENIED",
    },
  );
  assert.equal(ctx.db.rows("sessionAttendanceOutcome").length, 0);
});

test("an occurrence keeps its makeup policy after configuration changes", async () => {
  const ctx = await ended({ teacher: 0 });
  await ctx.sessions.ensureDetermined(ctx.session.id);
  ctx.configuration.values["session.attendancePolicy"] = {
    ...ctx.configuration.values["session.attendancePolicy"],
    makeupWindowDays: 1,
  };
  hours(ctx, 49);
  await outcomes(ctx).finalizeDue(ctx.session.id);
  assert.equal(+ctx.session.makeupDeadlineAt, +ctx.clock.now + 7 * 86400000);
});

test("a report opened before determination still freezes a later no-show", async () => {
  const ctx = await ended({ learner: 0 });
  await reportsFor(ctx).createSessionReport(user(B), ctx.session.id, {
    reasonCode: "TECHNICAL_ISSUE",
    description: "I cannot see my attendance yet",
    evidenceFileIds: [],
  });
  await ctx.sessions.ensureDetermined(ctx.session.id);
  const penalties = [];
  hours(ctx, 49);
  await outcomes(ctx, penalties).finalizeDue(ctx.session.id);
  assert.equal(ctx.session.status, "NO_SHOW");
  assert.equal(ctx.db.rows("sessionAttendanceOutcome")[0].status, "DISPUTED");
  assert.deepEqual(penalties, []);
});

test("a delayed heartbeat cannot write attendance on a terminal occurrence", async () => {
  const ctx = await ended({ teacher: 0, learner: 0 });
  ctx.session.status = "MAKEUP_REQUIRED";
  const previous = ctx.session.lastObservedAt;
  await outcomes(ctx).recordObservation(
    ctx.session,
    {
      status: "OK",
      observation: { roomSid: "RM_1", identities: [], participants: [] },
    },
    ctx.minute(31),
  );
  assert.equal(+ctx.session.lastObservedAt, +previous);
});

test("a healthy observation of a heartbeat-closed SID resumes its interval", async () => {
  const ctx = await ended({ teacher: 0, learner: 0 });
  const service = outcomes(ctx);
  const observation = {
    roomSid: "RM_1",
    identities: [`${ctx.session.id}:${A}`],
    participants: [{ identity: `${ctx.session.id}:${A}`, sid: "PA_resume" }],
  };
  await service.recordObservation(
    ctx.session,
    { status: "OK", observation },
    ctx.minute(1),
  );
  await service.recordObservation(
    ctx.session,
    { status: "OK", observation: null },
    ctx.minute(3),
  );
  assert.equal(
    ctx.db.rows("sessionAttendanceInterval")[0].closeSource,
    "HEARTBEAT",
  );
  await service.recordObservation(
    ctx.session,
    { status: "OK", observation },
    ctx.minute(4),
  );
  assert.equal(ctx.db.rows("sessionAttendanceInterval")[0].leftAt, null);
  assert.equal(
    +ctx.db.rows("sessionAttendanceInterval")[0].lastSeenAt,
    +ctx.minute(4),
  );
});

test("a resolved report replay cannot extend a makeup or rule on the next occurrence", async () => {
  const ctx = await ended({ learner: 0 });
  await ctx.sessions.ensureDetermined(ctx.session.id);
  const reports = reportsFor(ctx);
  const item = await reports.createSessionReport(user(B), ctx.session.id, {
    reasonCode: "OTHER",
    description: "Please excuse this absence",
    evidenceFileIds: [],
  });
  await reports.updateCase(staff, item.id, "claim");
  const decision = {
    note: "Agreed to make up the lesson",
    noShowRuling: "EXCUSE",
  };
  await reports.updateCase(staff, item.id, "resolve", decision);
  const firstDeadline = +ctx.session.makeupDeadlineAt;
  hours(ctx, 26);
  await reports.updateCase(staff, item.id, "resolve", decision);
  assert.equal(+ctx.session.makeupDeadlineAt, firstDeadline);
});

test("an attendance outcome keeps its report window when configuration changes", async () => {
  const ctx = await ended({ learner: 0 });
  await ctx.sessions.ensureDetermined(ctx.session.id);
  ctx.configuration.values["session.attendancePolicy"] = {
    ...ctx.configuration.values["session.attendancePolicy"],
    disputeWindowHours: 72,
  };
  hours(ctx, 49);
  await assert.rejects(
    reportsFor(ctx).createSessionReport(user(B), ctx.session.id, {
      reasonCode: "OTHER",
      description: "This occurrence had a 48-hour window",
      evidenceFileIds: [],
    }),
    { message: "DISPUTE_WINDOW_CLOSED" },
  );
});

test("a system-opened case records its system actor in audit", async () => {
  const ctx = await ended();
  const audit = [];
  const reports = new ReportsService(
    runner(ctx.db),
    {},
    {},
    { append: async (_tx, entry) => audit.push(entry) },
    {},
    {},
    ctx.configuration,
  );
  const input = {
    sessionId: ctx.session.id,
    pathId: ctx.session.pathId,
    reasonCode: "ATTENDANCE_UNVERIFIABLE",
    description: "Neither participant confirmed unverifiable attendance.",
  };
  await reports.openSystemSessionCase(ctx.db, input);
  await reports.openSystemSessionCase(ctx.db, input);
  assert.equal(audit.length, 1);
  assert.equal(audit[0].actor.kind, "SYSTEM");
  assert.equal(audit[0].target.id, ctx.db.rows("reportCase")[0].id);
});

test("a session ruling cannot stack a generic NO_SHOW violation on its attendance penalty", async () => {
  const ctx = await ended({ learner: 0 });
  await ctx.sessions.ensureDetermined(ctx.session.id);
  const audit = { append: async () => {} };
  const reputation = new ReputationService(audit);
  const reports = new ReportsService(
    runner(ctx.db),
    {},
    {},
    audit,
    reputation,
    {},
    ctx.configuration,
  );
  const item = await reports.createSessionReport(user(B), ctx.session.id, {
    reasonCode: "NO_SHOW_LATE",
    description: "Please check the no-show result",
    evidenceFileIds: [],
  });
  await reports.updateCase(staff, item.id, "claim");
  await assert.rejects(
    reports.updateCase(staff, item.id, "resolve", {
      note: "No-show confirmed",
      noShowRuling: "UPHOLD",
      violations: [{ userId: B, reasonCode: "NO_SHOW" }],
    }),
    { message: "NO_SHOW_REQUIRES_ATTENDANCE_RULING" },
  );
  assert.equal(
    ctx.db.rows("user").find((row) => row.id === B).reputationScore,
    50,
  );
  await reports.updateCase(staff, item.id, "resolve", {
    note: "No-show confirmed",
    noShowRuling: "UPHOLD",
  });
  assert.equal(
    ctx.db.rows("user").find((row) => row.id === B).reputationScore,
    42,
  );
  assert.equal(ctx.db.rows("reputationHistory").length, 1);
});

test("allowedActions hide confirmation and makeup while the path is disputed", async () => {
  const ctx = await ended();
  await ctx.sessions.ensureDetermined(ctx.session.id);
  ctx.db.rows("learningPath")[0].status = "DISPUTED";
  const detail = await ctx.sessions.detail(user(A), ctx.session.id);
  assert.ok(!detail.allowedActions.includes("CONFIRM_COMPLETION"));
  ctx.session.status = "MAKEUP_REQUIRED";
  ctx.session.makeupDeadlineAt = new Date(+ctx.clock.now + 86400000);
  const makeup = await ctx.sessions.detail(user(A), ctx.session.id);
  assert.ok(!makeup.allowedActions.includes("PROPOSE_MAKEUP"));
});

test("a generic Session NO_SHOW penalty is blocked even before determination", async () => {
  const ctx = await ended({ learner: 0 });
  const reports = reportsFor(ctx);
  const item = await reports.createSessionReport(user(A), ctx.session.id, {
    reasonCode: "NO_SHOW_LATE",
    description: "Attendance has not been determined",
    evidenceFileIds: [],
  });
  await reports.updateCase(staff, item.id, "claim");
  await assert.rejects(
    reports.updateCase(staff, item.id, "resolve", {
      note: "Learner did not attend",
      violations: [{ userId: B, reasonCode: "NO_SHOW" }],
    }),
    { message: "NO_SHOW_REQUIRES_ATTENDANCE_RULING" },
  );
  assert.equal(ctx.db.rows("reportCase")[0].status, "UNDER_REVIEW");
});
