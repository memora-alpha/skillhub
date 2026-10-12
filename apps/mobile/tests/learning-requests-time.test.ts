import assert from "node:assert/strict";
import test from "node:test";
import { ZodError } from "zod";
import {
  requestDefaults,
  requestFormSchema,
  draftToInput,
  localTimestamp,
} from "../src/features/learning-requests/schemas/request-form";
import { formatPreferredSlots } from "../src/features/learning-requests/preferred-slots";
import {
  fixtureRequest,
  fixtureSkills,
} from "./fixtures/learning-requests-data";

const start = new Date(2035, 0, 1, 10, 0).getTime();
const future = (minutes: number) =>
  new Date(start + minutes * 60_000).toISOString();
const base = () => ({
  ...requestDefaults(),
  skillId: fixtureSkills[0].id,
  title: "Học React căn bản",
  description: "Mong muốn học React từ căn bản để làm ứng dụng.",
  learningGoal: "Xây dựng một ứng dụng của tôi",
});

test("a mounted resolver checks the current clock when a form is submitted late", () => {
  let now = start;
  const original = Date.now;
  Date.now = () => now;
  try {
    const schema = requestFormSchema();
    const draft = {
      ...base(),
      preferredSlots: formatPreferredSlots([
        { startAt: future(5), endAt: future(60) },
      ]),
      expiresAt: localTimestamp(future(10)),
    };
    assert.equal(schema.safeParse(draft).success, true);
    now = start + 11 * 60_000;
    const result = schema.safeParse(draft);
    assert.equal(result.success, false);
    if (!result.success)
      assert.deepEqual(
        result.error.issues.map((issue) => issue.path[0]),
        ["preferredSlots", "expiresAt"],
      );
  } finally {
    Date.now = original;
  }
});

test("conversion rejects slots that became past instead of sending undefined", () => {
  const original = Date.now;
  Date.now = () => start + 10 * 60_000;
  const draft = {
    ...base(),
    preferredSlots: formatPreferredSlots([
      { startAt: future(5), endAt: future(60) },
    ]),
  };
  const preserved = structuredClone(draft);
  try {
    assert.throws(() => draftToInput(draft), ZodError);
    assert.deepEqual(draft, preserved);
  } finally {
    Date.now = original;
  }
});

test("conversion reports expiresAt as a field error after its deadline passes", () => {
  const original = Date.now;
  Date.now = () => start + 10 * 60_000;
  try {
    assert.throws(
      () => draftToInput({ ...base(), expiresAt: localTimestamp(future(5)) }),
      (error: unknown) =>
        error instanceof ZodError &&
        error.issues.some((issue) => issue.path[0] === "expiresAt"),
    );
  } finally {
    Date.now = original;
  }
});

test("untouched server slots and custom expiry retain seconds/milliseconds even when past", () => {
  const request = fixtureRequest(
    {
      preferredSlots: [
        {
          startAt: "2020-01-01T10:00:45.123+07:00",
          endAt: "2020-01-01T11:00:45.123+07:00",
        },
      ],
      requestedExpiresAt: "2020-01-03T10:00:45.123+07:00",
    },
    start,
  );
  const input = draftToInput(requestDefaults(request), request);
  assert.deepEqual(input.preferredSlots, request.preferredSlots);
  assert.equal(input.expiresAt, request.requestedExpiresAt);
  assert.equal("tagIds" in input, false);
});

test("submit conversion normalizes NFKC/trim without HTML stripping or entity decoding", () => {
  const input = draftToInput({
    ...base(),
    title: "  <b>Ｈọc React căn bản</b>  ",
    learningGoal: "  Học React &amp; TypeScript  ",
  });
  assert.equal(input.title, "<b>Học React căn bản</b>");
  assert.equal(input.learningGoal, "Học React &amp; TypeScript");
});

test("slot count/order and changed time boundaries remain enforced", () => {
  const original = Date.now;
  Date.now = () => start;
  try {
    const slot = formatPreferredSlots([
      { startAt: future(5), endAt: future(60) },
    ]);
    assert.equal(
      requestFormSchema().safeParse({
        ...base(),
        preferredSlots: Array(5).fill(slot).join("\n"),
      }).success,
      true,
    );
    assert.equal(
      requestFormSchema().safeParse({
        ...base(),
        preferredSlots: Array(6).fill(slot).join("\n"),
      }).success,
      false,
    );
    assert.equal(
      requestFormSchema().safeParse({
        ...base(),
        preferredSlots: formatPreferredSlots([
          { startAt: future(60), endAt: future(5) },
        ]),
      }).success,
      false,
    );
  } finally {
    Date.now = original;
  }
});
