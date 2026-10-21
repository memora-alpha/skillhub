import assert from "node:assert/strict";
import test from "node:test";
import {
  sessionContentParts,
  sessionContentText,
} from "../src/features/learning-paths/utils/session-content";
import {
  planEditorInput,
  planEditorSchema,
} from "../src/features/learning-paths/schemas/plan-editor-input";
import { fixtureId } from "./fixtures/learning-requests-data";

test("session title and optional description round trip as the existing plain text content", () => {
  for (const content of [
    "React cơ bản",
    "React cơ bản\nThực hành JSX\n\nLàm bài tập",
    "React\n",
  ]) {
    const parts = sessionContentParts(content);
    assert.equal(
      sessionContentText(parts.title, parts.description),
      content.endsWith("\n") ? content.slice(0, -1) : content,
    );
  }
  assert.deepEqual(sessionContentParts("React\r\nMô tả\r\nNhiều dòng"), {
    title: "React",
    description: "Mô tả\r\nNhiều dòng",
  });
  assert.equal(
    sessionContentText("React\nHooks", "Mô tả"),
    "React Hooks\nMô tả",
  );
});
test("optional session detail is saved in content, stays within the combined API limit and cannot replace a missing title", () => {
  const base = { skillId: fixtureId(10), learningGoal: "Học React" };
  const content = sessionContentText("React", "a".repeat(1994));
  assert.equal(content.length, 2000);
  assert.deepEqual(
    planEditorInput({ ...base, sessionOutline: [{ content }] }).sessionOutline,
    [{ content }],
  );
  assert.equal(
    planEditorSchema.safeParse({
      ...base,
      sessionOutline: [{ content: content + "a" }],
    }).success,
    false,
  );
  assert.equal(
    planEditorSchema.safeParse({
      ...base,
      sessionOutline: [
        { content: sessionContentText("", "Mô tả chưa có tiêu đề") },
      ],
    }).success,
    false,
  );
  assert.equal(
    planEditorSchema.safeParse({
      ...base,
      sessionOutline: [{ content: "Chỉ có tiêu đề" }],
    }).success,
    true,
  );
});
