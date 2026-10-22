import assert from "node:assert/strict";
import test from "node:test";
import { agreementProgress } from "../src/features/learning-paths/utils/progression";
import {
  canCreatePlan,
  canConfirmPlan,
  canEditPlan,
  canSchedule,
  canValidateForFinalize,
} from "../src/features/learning-paths/utils/policy-api";
import {
  agreementPath,
  teacherId,
  learnerId,
  withConfirmedSchedules,
} from "./fixtures/learning-agreement";

test("ONE_WAY directs only the teacher to create a plan; learner waits", () => {
  const path = { ...agreementPath(), status: "PROPOSED" as const, plans: [] };
  assert.equal(
    agreementProgress(path, teacherId).action?.href,
    `/paths/${path.id}/plans/new`,
  );
  assert.equal(canCreatePlan(path, teacherId), true);
  assert.equal(canCreatePlan(path, learnerId), false);
  assert.equal(agreementProgress(path, learnerId).action, undefined);
  assert.match(
    agreementProgress(path, learnerId).waiting.join(),
    /Chờ đối tác tạo/,
  );
});

test("TWO_WAY exposes the current learner's task while the other direction is missing", () => {
  const path = agreementPath(true);
  path.status = "PROPOSED";
  path.plans = [path.plans[0]!];
  path.plans[0]!.learnerConfirmedAt = null;
  path.plans[0]!.status = "PROPOSED";
  const teacher = agreementProgress(path, teacherId);
  const learner = agreementProgress(path, learnerId);
  assert.equal(teacher.stage, "plans");
  assert.equal(teacher.action, undefined);
  assert.match(teacher.waiting.join(), /Chờ đối tác/);
  // B can both confirm the received plan and create B→A; neither is hidden by waiting for A.
  assert.equal(
    learner.action?.href,
    `/paths/${path.id}/plans/${path.plans[0]!.id}`,
  );
  assert.equal(canCreatePlan(path, learnerId), true);
  assert.equal(canValidateForFinalize(path), false);
});

test("changing agreement terms returns both parties to method confirmation before plan actions", () => {
  const path = withConfirmedSchedules();
  path.status = "PROPOSED";
  path.currentVersion++;
  path.agreement.version++;
  path.agreement.participantAConfirmedAt = null;
  path.agreement.participantBConfirmedAt = null;
  assert.equal(agreementProgress(path, learnerId).stage, "terms");
  assert.equal(canConfirmPlan(path, path.plans[0]!, learnerId), false);
  assert.equal(canEditPlan(path, path.plans[0]!, teacherId), false);
  assert.equal(canSchedule(path, path.plans[0]!, teacherId), false);
  assert.equal(canValidateForFinalize(path), false);
});

test("both current agreement confirmations gate plan creation in either exchange type", () => {
  for (const twoWay of [false, true]) {
    const path = agreementPath(twoWay);
    path.status = "PROPOSED";
    path.plans = [];
    path.agreement.participantAConfirmedAt = null;
    path.agreement.participantBConfirmedAt = null;
    assert.equal(agreementProgress(path, teacherId).stage, "terms");
    assert.equal(canCreatePlan(path, teacherId), false);
    path.agreement.participantAConfirmedAt = "2030-01-01T00:00:00Z";
    assert.equal(agreementProgress(path, teacherId).action, undefined);
    assert.equal(canCreatePlan(path, teacherId), false);
    path.agreement.participantBConfirmedAt = "2030-01-01T00:00:00Z";
    assert.equal(agreementProgress(path, teacherId).stage, "plans");
    assert.equal(canCreatePlan(path, teacherId), true);
    assert.equal(canCreatePlan(path, learnerId), twoWay);
    path.agreement.version--;
    assert.equal(canCreatePlan(path, teacherId), false);
  }
});

test("complete timestamps and plans still wait for server CONFIRMED before schedules", () => {
  const path = agreementPath();
  path.status = "PARTIALLY_CONFIRMED";
  assert.equal(agreementProgress(path, teacherId).stage, "plans");
  assert.equal(agreementProgress(path, teacherId).action, undefined);
  assert.equal(canSchedule(path, path.plans[0]!, teacherId), false);
});

test("confirmed plans lead to common terms; confirmed participant waits for their partner", () => {
  const path = agreementPath();
  path.status = "PARTIALLY_CONFIRMED";
  path.agreement.participantBConfirmedAt = null;
  assert.equal(agreementProgress(path, learnerId).stage, "terms");
  assert.equal(
    agreementProgress(path, learnerId).action?.href,
    `/paths/${path.id}`,
  );
  assert.equal(agreementProgress(path, teacherId).action, undefined);
  assert.equal(canSchedule(path, path.plans[0]!, teacherId), false);
});

test("schedule creation requires both terms confirmations and every opposing plan", () => {
  const path = agreementPath(true);
  assert.equal(canSchedule(path, path.plans[0]!, teacherId), true);
  assert.equal(
    agreementProgress(path, teacherId).action?.href,
    `/paths/${path.id}/schedules/${path.plans[0]!.id}`,
  );
  path.plans[1]!.learnerConfirmedAt = null;
  assert.equal(canSchedule(path, path.plans[0]!, teacherId), false);
  path.plans.pop();
  assert.equal(canSchedule(path, path.plans[0]!, teacherId), false);
});

test("schedule confirmation and waiting guidance use the current participant, including participant B", () => {
  const path = withConfirmedSchedules();
  path.plans[0]!.schedule!.participantBConfirmedAt = null;
  assert.equal(
    agreementProgress(path, learnerId).action?.href,
    `/paths/${path.id}/schedules`,
  );
  assert.equal(agreementProgress(path, teacherId).action, undefined);
  assert.match(
    agreementProgress(path, teacherId).waiting.join(),
    /Chờ đối tác xác nhận lịch/,
  );
  assert.equal(canValidateForFinalize(path), false);
});

test("only complete same-version confirmations lead to final validation, without mutating server state", () => {
  for (const twoWay of [false, true]) {
    const path = withConfirmedSchedules(agreementPath(twoWay));
    const original = structuredClone(path);
    assert.equal(agreementProgress(path, learnerId).stage, "finalize");
    assert.equal(canValidateForFinalize(path), true);
    assert.deepEqual(path, original);
    path.plans[0]!.schedule!.version++;
    path.plans[0]!.schedule!.participantAConfirmedAt = null;
    assert.equal(agreementProgress(path, learnerId).stage, "schedules");
    assert.equal(canValidateForFinalize(path), false);
  }
});

test("duplicate directions and incomplete/cancelled schedules never expose finalization", () => {
  const path = withConfirmedSchedules(agreementPath(true));
  path.plans[1] = { ...path.plans[0]!, id: path.plans[1]!.id };
  assert.equal(canValidateForFinalize(path), false);
  assert.equal(agreementProgress(path, teacherId).stage, "plans");
  const oneWay = withConfirmedSchedules();
  oneWay.plans[0]!.schedule!.items = [];
  assert.equal(agreementProgress(oneWay, teacherId).stage, "schedules");
  assert.equal(canValidateForFinalize(oneWay), false);
  oneWay.plans[0]!.schedule!.status = "CANCELLED";
  assert.equal(agreementProgress(oneWay, learnerId).stage, "schedules");
});

test("locked/terminal paths and outsiders cannot restart negotiations", () => {
  const path = withConfirmedSchedules();
  path.status = "SCHEDULED";
  path.lockedVersion = 3;
  assert.equal(agreementProgress(path, teacherId).stage, "sessions");
  assert.equal(canCreatePlan(path, teacherId), false);
  assert.equal(canValidateForFinalize(path), false);
  for (const status of ["CANCELLED", "DISPUTED", "COMPLETED"] as const)
    assert.equal(
      agreementProgress({ ...path, status }, teacherId).stage,
      "closed",
    );
  assert.equal(agreementProgress(path).action, undefined);
  assert.equal(agreementProgress(path, "outsider").action, undefined);
});
