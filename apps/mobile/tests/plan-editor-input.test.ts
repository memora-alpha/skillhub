import assert from "node:assert/strict";
import test from "node:test";
import {
  planEditorInput,
  planEditorSchema,
} from "../src/features/learning-paths/schemas/plan-editor-input";
import { fixtureId } from "./fixtures/learning-requests-data";
const values = {
  skillId: fixtureId(10),
  learningGoal: " Xây dựng dự án ",
  sessionOutline: [
    { content: " React components\nThực hành giao diện " },
    { content: "Quản lý trạng thái" },
  ],
};
test("plan editor preserves multiline within a session and derives count from ordered rows", () => {
  assert.deepEqual(planEditorInput(values), {
    skillId: values.skillId,
    learningGoal: "Xây dựng dự án",
    totalSessions: 2,
    sessionOutline: [
      { content: "React components\nThực hành giao diện" },
      { content: "Quản lý trạng thái" },
    ],
  });
  assert.equal(
    planEditorInput({
      ...values,
      sessionOutline: values.sessionOutline.slice(1),
    }).totalSessions,
    1,
  );
});
test("plan editor rejects empty or oversized sessions and enforces the existing API limits", () => {
  for (const sessionOutline of [
    [],
    [{ content: "  " }],
    [{ content: "a".repeat(2001) }],
    Array.from({ length: 101 }, () => ({ content: "Buổi học" })),
  ])
    assert.equal(
      planEditorSchema.safeParse({ ...values, sessionOutline }).success,
      false,
    );
  assert.equal(
    planEditorSchema.safeParse({ ...values, learningGoal: "a".repeat(1501) })
      .success,
    false,
  );
  assert.equal(
    planEditorSchema.safeParse({ ...values, skillId: "" }).success,
    false,
  );
  assert.equal(
    planEditorSchema.safeParse({
      ...values,
      learningGoal: "a".repeat(1500),
      sessionOutline: Array.from({ length: 100 }, () => ({
        content: "a".repeat(2000),
      })),
    }).success,
    true,
  );
});
