import assert from "node:assert/strict";
import test from "node:test";
import { AppError } from "../src/lib/http/errors";
import {
  requestDefaults,
  draftToInput,
} from "../src/features/learning-requests/schemas/request-form";
import { requestPatch } from "../src/features/learning-requests/utils/request-policy";
import {
  rebaseRequestDraft,
  mutationNeedsReconcile,
  compareRequestDraft,
} from "../src/features/learning-requests/utils/request-recovery";
import { fixtureId, fixtureRequest } from "./fixtures/learning-requests-data";

test("explicit rebase keeps edited fields, adopts untouched server fields and the server version", () => {
  const initial = fixtureRequest(),
    latest = {
      ...initial,
      version: 2,
      title: "Tiêu đề cập nhật từ thiết bị khác",
      learningGoal: "Mục tiêu đã đổi trên máy chủ",
    };
  const draft = {
    ...requestDefaults(initial),
    description: "Mô tả chưa lưu của tôi được giữ nguyên.",
  };
  const original = structuredClone(draft);
  const differences = compareRequestDraft(initial, latest);
  assert.deepEqual(
    differences.map((item) => item.field),
    ["title", "learningGoal"],
  );
  assert.deepEqual(draft, original);
  assert.equal(initial.version, 1);
  const rebased = rebaseRequestDraft(initial, draft, latest);
  assert.equal(rebased.description, draft.description);
  assert.equal(rebased.title, latest.title);
  assert.deepEqual(requestPatch(latest, draftToInput(rebased, latest)), {
    expectedVersion: 2,
    description: draft.description,
  });
});

test("Skill newly locked by publishedAt takes the server ID after an explicit choice", () => {
  const initial = fixtureRequest({ status: "DRAFT", publishedAt: null });
  const draft = {
    ...requestDefaults(initial),
    skillId: fixtureId(11),
    description: "Mô tả local vẫn được giữ khi kỹ năng đã khóa.",
  };
  const latest = {
    ...initial,
    version: 3,
    status: "REJECTED" as const,
    publishedAt: new Date().toISOString(),
  };
  const next = rebaseRequestDraft(initial, draft, latest);
  assert.equal(next.skillId, latest.skillId);
  assert.equal(next.description, draft.description);
});

test("no-change against the accepted snapshot never creates a PATCH", () => {
  const request = fixtureRequest({
    status: "REJECTED",
    moderationStatus: "REJECTED",
    moderationRejectReason: "Cần sửa nội dung.",
  });
  assert.equal(
    requestPatch(request, draftToInput(requestDefaults(request), request)),
    null,
  );
  assert.equal(request.status, "REJECTED");
});
test("a latest terminal state or wrong resource ID cannot become an editable baseline", () => {
  const initial = fixtureRequest(),
    draft = requestDefaults(initial);
  const preserved = structuredClone(draft);
  assert.throws(
    () =>
      rebaseRequestDraft(initial, draft, {
        ...initial,
        effectiveStatus: "EXPIRED",
      }),
    (error: unknown) => error instanceof AppError && error.status === 409,
  );
  assert.throws(
    () =>
      rebaseRequestDraft(initial, draft, { ...initial, id: fixtureId(555) }),
    (error: unknown) => error instanceof AppError && error.kind === "protocol",
  );
  assert.deepEqual(draft, preserved);
});

test("only conflict or ambiguous mutation outcomes block blind resubmission", () => {
  for (const error of [
    new AppError("http", 409),
    new AppError("network"),
    new AppError("protocol"),
    new AppError("http", 500),
  ])
    assert.equal(mutationNeedsReconcile(error), true);
  for (const error of [
    new AppError("http", 400),
    new AppError("http", 403),
    new AppError("http", 429),
    new AppError("http", 503),
  ])
    assert.equal(mutationNeedsReconcile(error), false);
});
