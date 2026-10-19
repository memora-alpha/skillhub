import assert from "node:assert/strict";
import { test } from "node:test";
import {
  prepareLearningRequestContent,
  validateExpiryAtPublish,
} from "../../dist/modules/learning-requests/domain/request-text.policy.js";

const now = new Date("2026-10-06T00:00:00.000Z");
const validInput = (overrides = {}) => ({
  title: "Learn Vietnamese conversation",
  skillId: "11111111-1111-4111-8111-111111111111",
  description: "I want to practice speaking with a patient partner.",
  learningGoal: "Hold a ten-minute conversation.",
  ...overrides,
});

test("sanitizes and decodes plain text without retaining HTML or script content", () => {
  const content = prepareLearningRequestContent(
    validInput({
      description:
        "I want <b onclick=alert(1)>guided</b> practice &amp; feedback. <script>alert(1)</script>",
    }),
    now,
  );
  assert.equal(content.description, "I want guided practice & feedback.");
});

test("counts Unicode code points after sanitizing and trimming", () => {
  assert.throws(
    () =>
      prepareLearningRequestContent(validInput({ title: "😀".repeat(9) }), now),
    (error) => error?.getStatus?.() === 400,
  );
  const title = "😀".repeat(10);
  assert.equal(
    prepareLearningRequestContent(validInput({ title }), now).title,
    title,
  );
});

test("enforces each documented field boundary after sanitization", () => {
  const valid = (field, value) =>
    prepareLearningRequestContent(validInput({ [field]: value }), now);
  for (const [field, minimum] of [
    ["title", 10],
    ["description", 20],
    ["learningGoal", 10],
  ]) {
    assert.throws(() => valid(field, "x".repeat(minimum - 1)));
    assert.equal([...valid(field, "x".repeat(minimum))[field]].length, minimum);
  }
  for (const [field, maximum] of [
    ["title", 120],
    ["description", 3000],
    ["learningGoal", 1000],
  ]) {
    assert.equal([...valid(field, "x".repeat(maximum))[field]].length, maximum);
    assert.throws(() => valid(field, "x".repeat(maximum + 1)));
  }
  assert.equal(
    valid("description", "&#101;" + "x".repeat(19)).description,
    "e" + "x".repeat(19),
  );
});

test("accepts only bounded future absolute slots and at most ten distinct tags", () => {
  const slot = {
    startAt: "2026-10-07T01:00:00+07:00",
    endAt: "2026-10-07T02:00:00+07:00",
  };
  const content = prepareLearningRequestContent(
    validInput({
      preferredSlots: [slot],
      tagIds: ["33333333-3333-4333-8333-333333333333"],
    }),
    now,
  );
  assert.equal(
    content.preferredSlots[0].startAt.toISOString(),
    "2026-10-06T18:00:00.000Z",
  );
  assert.throws(
    () =>
      prepareLearningRequestContent(
        validInput({
          preferredSlots: [{ ...slot, startAt: "2026-10-07T01:00:00" }],
        }),
        now,
      ),
    (error) => error?.getStatus?.() === 400,
  );
  assert.throws(
    () =>
      prepareLearningRequestContent(
        validInput({
          tagIds: Array.from(
            { length: 11 },
            (_, index) =>
              `33333333-3333-4333-8333-${String(index + 1).padStart(12, "0")}`,
          ),
        }),
        now,
      ),
    (error) => error?.getStatus?.() === 400,
  );
  assert.throws(
    () =>
      prepareLearningRequestContent(
        validInput({ preferredSlots: Array(6).fill(slot) }),
        now,
      ),
    (error) => error?.getStatus?.() === 400,
  );
  for (const invalidSlot of [
    { ...slot, startAt: "2026-02-30T01:00:00Z" },
    { ...slot, startAt: "2026-10-07T01:00:00" },
    { ...slot, endAt: "2026-10-07T01:00:00+07:00" },
  ]) {
    assert.throws(
      () =>
        prepareLearningRequestContent(
          validInput({ preferredSlots: [invalidSlot] }),
          now,
        ),
      (error) => error?.getStatus?.() === 400,
    );
  }
});

test("custom expiry is future and no more than 90 days from publish time", () => {
  assert.equal(
    validateExpiryAtPublish(
      new Date("2026-12-01T00:00:00.000Z"),
      now,
    ).toISOString(),
    "2026-12-01T00:00:00.000Z",
  );
  assert.throws(() =>
    validateExpiryAtPublish(new Date("2026-10-06T00:00:00.000Z"), now),
  );
  assert.throws(() =>
    validateExpiryAtPublish(new Date("2027-01-05T00:00:00.000Z"), now),
  );
});

test("verified teacher preference defaults false and accepts only a boolean", () => {
  assert.equal(
    prepareLearningRequestContent(validInput(), now).verifiedTeacherOnly,
    false,
  );
  assert.equal(
    prepareLearningRequestContent(
      validInput({ verifiedTeacherOnly: true }),
      now,
    ).verifiedTeacherOnly,
    true,
  );
  for (const value of ["true", "false", 1, null]) {
    assert.throws(
      () =>
        prepareLearningRequestContent(
          validInput({ verifiedTeacherOnly: value }),
          now,
        ),
      (error) => error?.getStatus?.() === 400,
    );
  }
});
