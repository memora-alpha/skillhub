import assert from "node:assert/strict";
import test from "node:test";
import { createLearningPathsApi } from "../src/features/learning-paths/api/learning-paths-api";
import { AppError } from "../src/lib/http/errors";
import {
  agreementPath,
  withConfirmedSchedules,
  teacherId,
  learnerId,
  confirmedAt,
} from "./fixtures/learning-agreement";
import {
  canConfirmPlan,
  canConfirmSchedule,
  canEditSchedule,
  canValidateForFinalize,
} from "../src/features/learning-paths/utils/policy-api";
import { agreementProgress } from "../src/features/learning-paths/utils/progression";
import {
  scheduleDraft,
  scheduleDraftItems,
} from "../src/features/learning-paths/utils/schedule-draft";
import { parseLocalDateTime } from "../src/utils/local-date-time";

test("all revision endpoints accept same-version no-op only with an explicit unchanged flag", async () => {
  const path = withConfirmedSchedules();
  const plan = path.plans[0]!,
    schedule = plan.schedule!;
  let response: unknown;
  const calls: { url: string; body: unknown; replay: boolean | undefined }[] =
    [];
  const api = createLearningPathsApi(async (url, options) => {
    calls.push({
      url,
      body: options?.body,
      replay: options?.replayAfterRenewal,
    });
    return response;
  }, teacherId);
  const targets = [
    {
      id: path.id,
      version: path.currentVersion,
      send: () =>
        api.revise(
          path.id,
          {
            exchangeType: "ONE_WAY",
            teacherId,
            learnerId,
            negotiatedCredit: "10.50",
          },
          path.currentVersion,
        ),
    },
    {
      id: plan.id,
      version: plan.version,
      send: () =>
        api.revisePlan(
          plan.id,
          {
            skillId: plan.skillId,
            learningGoal: plan.learningGoal,
            totalSessions: plan.totalSessions,
            sessionOutline: plan.sessionOutline,
          },
          plan.version,
        ),
    },
    {
      id: schedule.id,
      version: schedule.version,
      send: () =>
        api.reviseSchedule(schedule.id, schedule.version, schedule.items),
    },
  ];
  for (const target of targets) {
    response = {
      id: target.id,
      version: target.version,
      status: "CONFIRMED",
      unchanged: true,
    };
    assert.equal((await target.send()).unchanged, true);
    response = {
      id: target.id,
      version: target.version + 1,
      status: "PROPOSED",
    };
    assert.equal((await target.send()).unchanged, false);
    for (const invalid of [
      { id: target.id, version: target.version, status: "CONFIRMED" },
      {
        id: target.id,
        version: target.version + 1,
        status: "CONFIRMED",
        unchanged: true,
      },
      {
        id: path.conversationId,
        version: target.version,
        status: "CONFIRMED",
        unchanged: true,
      },
    ]) {
      response = invalid;
      await assert.rejects(target.send(), AppError);
    }
  }
  assert.deepEqual(calls.at(-1), {
    url: `/schedule-proposals/${schedule.id}`,
    body: { expectedVersion: schedule.version, items: schedule.items },
    replay: false,
  });
  assert.ok(calls.every((call) => !call.url.endsWith("/confirm")));
});

test("detail accepts partial NEEDS_REVISION schedules but rejects malformed or incomplete confirmed schedules", async () => {
  const path = withConfirmedSchedules();
  const plan = path.plans[0]!;
  plan.totalSessions = 2;
  plan.sessionOutline.push({ sessionNo: 2, content: "Buổi bổ sung" });
  plan.schedule!.status = "NEEDS_REVISION";
  let response: unknown = path;
  const api = createLearningPathsApi(async () => response, teacherId);
  assert.equal((await api.detail(path.id)).plans[0]!.schedule!.items.length, 1);
  for (const change of [
    { status: "PROPOSED" },
    { items: [plan.schedule!.items[0], plan.schedule!.items[0]] },
    { items: [{ ...plan.schedule!.items[0], sessionNo: 3 }] },
  ]) {
    response = {
      ...path,
      plans: [{ ...plan, schedule: { ...plan.schedule, ...change } }],
    };
    await assert.rejects(api.detail(path.id), AppError);
  }
});

test("plan content revisions keep method and opposing confirmations and only revisit the edited plan", () => {
  const path = withConfirmedSchedules(agreementPath(true));
  const plan = path.plans[0]!;
  const opposite = structuredClone(path.plans[1]!);
  path.status = "PARTIALLY_CONFIRMED";
  plan.version++;
  plan.status = "PROPOSED";
  plan.learnerConfirmedAt = null;
  assert.equal(path.currentVersion, 3);
  assert.equal(agreementProgress(path, learnerId).stage, "plans");
  assert.equal(canConfirmPlan(path, plan, learnerId), true);
  assert.equal(canValidateForFinalize(path), false);
  assert.deepEqual(path.plans[1], opposite);
  plan.status = "CONFIRMED";
  plan.learnerConfirmedAt = confirmedAt;
  path.status = "CONFIRMED";
  assert.equal(agreementProgress(path, learnerId).stage, "finalize");
  assert.equal(canValidateForFinalize(path), true);
});

test("incomplete schedules require teacher repair, then both participants can confirm a complete revised version", () => {
  const path = withConfirmedSchedules();
  const plan = path.plans[0]!,
    schedule = plan.schedule!;
  plan.totalSessions = 2;
  schedule.status = "NEEDS_REVISION";
  schedule.participantAConfirmedAt = schedule.participantBConfirmedAt = null;
  assert.equal(canEditSchedule(path, plan, teacherId), true);
  assert.equal(canEditSchedule(path, plan, learnerId), false);
  assert.equal(canEditSchedule(path, plan, path.conversationId), false);
  assert.equal(canConfirmSchedule(path, plan, teacherId), false);
  assert.equal(canValidateForFinalize(path), false);
  assert.equal(
    agreementProgress(path, teacherId).action?.href,
    `/paths/${path.id}/schedules/${plan.id}`,
  );
  schedule.items.push({
    sessionNo: 2,
    startAt: "2030-01-03T10:00:00Z",
    endAt: "2030-01-03T11:00:00Z",
  });
  assert.equal(canConfirmSchedule(path, plan, teacherId), true);
  assert.equal(canConfirmSchedule(path, plan, learnerId), true);
  assert.equal(canValidateForFinalize(path), false);
  schedule.participantAConfirmedAt = confirmedAt;
  schedule.status = "PARTIALLY_CONFIRMED";
  assert.equal(canConfirmSchedule(path, plan, teacherId), false);
  assert.equal(canConfirmSchedule(path, plan, learnerId), true);
  schedule.participantBConfirmedAt = confirmedAt;
  schedule.status = "PROPOSED";
  assert.equal(canValidateForFinalize(path), true);
  for (const status of ["LOCKED", "CANCELLED", "EXPIRED"] as const) {
    schedule.status = status;
    assert.equal(canEditSchedule(path, plan, teacherId), false);
    assert.equal(canConfirmSchedule(path, plan, teacherId), false);
  }
  path.lockedVersion = path.currentVersion;
  assert.equal(canEditSchedule(path, plan, teacherId), false);
});

test("schedule editing preloads retained local times, leaves new sessions blank and preserves exact unchanged timestamps", () => {
  const path = withConfirmedSchedules(),
    plan = path.plans[0]!;
  const slot = plan.schedule!.items[0]!;
  slot.startAt = "2098-01-01T19:30:27+07:00";
  slot.endAt = "2098-01-01T20:30:27+07:00";
  const input = scheduleDraft(plan);
  assert.equal(
    parseLocalDateTime(input.items[0]!.local)!.getTime(),
    Date.parse(slot.startAt) - 27000,
  );
  assert.deepEqual(scheduleDraftItems(input, plan), [slot]);
  input.items[0]!.minutes = "90";
  const revised = scheduleDraftItems(input, plan)[0]!;
  assert.equal(revised.startAt, slot.startAt);
  assert.equal(
    Date.parse(revised.endAt) - Date.parse(revised.startAt),
    90 * 60000,
  );
  plan.totalSessions = 2;
  const incomplete = scheduleDraft(plan);
  assert.deepEqual(incomplete.items[1], { local: "", minutes: "60" });
  assert.throws(() => scheduleDraftItems(incomplete, plan));
});

test("edited schedules reject overlap hidden by retained timestamp seconds", () => {
  const plan = withConfirmedSchedules().plans[0]!;
  plan.totalSessions = 2;
  plan.schedule!.items = [
    {
      sessionNo: 1,
      startAt: "2098-01-01T19:30:27Z",
      endAt: "2098-01-01T20:30:27Z",
    },
    {
      sessionNo: 2,
      startAt: "2098-01-01T21:00:00Z",
      endAt: "2098-01-01T22:00:00Z",
    },
  ];
  const input = scheduleDraft(plan);
  const overlap = new Date("2098-01-01T20:30:00Z");
  const pad = (n: number) => String(n).padStart(2, "0");
  input.items[1]!.local = `${overlap.getFullYear()}-${pad(overlap.getMonth() + 1)}-${pad(overlap.getDate())}T${pad(overlap.getHours())}:${pad(overlap.getMinutes())}`;
  assert.throws(() => scheduleDraftItems(input, plan), /không trùng/);
});
