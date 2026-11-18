import assert from "node:assert/strict";
import { test } from "node:test";
import { teacherReviewPlan } from "../src/features/community/utils/teacher-review";
import {
  agreementPath,
  teacherId,
  learnerId,
} from "./fixtures/learning-agreement";
import { fixtureId } from "./fixtures/learning-requests-data";

test("one-way reviews address the viewer's teacher, never their learner", () => {
  const path = agreementPath();
  assert.equal(teacherReviewPlan(path, learnerId)?.teacherId, teacherId);
  assert.equal(teacherReviewPlan(path, teacherId), undefined);
  const swapped = {
    ...path,
    participantAId: learnerId,
    participantBId: teacherId,
  };
  assert.equal(teacherReviewPlan(swapped, learnerId)?.teacherId, teacherId);
});

test("two-way participants each review the person who taught them, regardless of plan order", () => {
  const path = agreementPath(true);
  path.plans.reverse();
  assert.equal(teacherReviewPlan(path, teacherId)?.teacherId, learnerId);
  assert.equal(teacherReviewPlan(path, learnerId)?.teacherId, teacherId);
});

test("missing identity, non-participants and unrelated teaching plans do not open a teacher review", () => {
  const path = agreementPath(true);
  assert.equal(teacherReviewPlan(path), undefined);
  assert.equal(teacherReviewPlan(path, fixtureId(99)), undefined);
  assert.equal(teacherReviewPlan({ ...path, plans: [] }, learnerId), undefined);
  path.plans = [{ ...path.plans[0]!, teacherId: fixtureId(99) }];
  assert.equal(teacherReviewPlan(path, learnerId), undefined);
});
