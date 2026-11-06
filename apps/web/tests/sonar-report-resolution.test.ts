import assert from "node:assert/strict";
import { test } from "node:test";
import {
  reportResolutionBody,
  type ResolutionDraft,
} from "../src/lib/staff/report-resolution";

const learner = "11111111-1111-4111-8111-111111111111";
const teacher = "22222222-2222-4222-8222-222222222222";
function draft(overrides: Partial<ResolutionDraft> = {}): ResolutionDraft {
  return {
    participants: [
      { userId: learner, violation: "", delta: "", amount: "" },
      { userId: teacher, violation: "", delta: "", amount: "" },
    ],
    restrictedUserId: "",
    days: "",
    reversals: "",
    ...overrides,
  };
}

test("Makeup rulings require one decision and an actual participant", () => {
  assert.deepEqual(
    reportResolutionBody(
      draft({ noShowRuling: "EXCUSE", makeupUserId: learner }),
      false,
    ),
    { noShowRuling: "EXCUSE", makeupUserId: learner },
  );
  for (const cancellationMakeupRuling of ["EXTEND", "COMPLETE"] as const) {
    assert.deepEqual(
      reportResolutionBody(draft({ cancellationMakeupRuling }), false),
      { cancellationMakeupRuling },
    );
    assert.throws(() =>
      reportResolutionBody(
        draft({ cancellationMakeupRuling, noShowRuling: "UPHOLD" }),
        false,
      ),
    );
  }
  assert.throws(() =>
    reportResolutionBody(
      draft({ noShowRuling: "EXCUSE", makeupUserId: "another-user" }),
      false,
    ),
  );
  assert.throws(() =>
    reportResolutionBody(
      draft({ noShowRuling: "COMPLETE", makeupUserId: learner }),
      false,
    ),
  );
});

test("No-show is not penalized twice and fraud retains validated integer penalties", () => {
  const outcome = {
    userId: learner,
    violation: "NO_SHOW" as const,
    delta: "",
    amount: "",
  };
  assert.throws(() =>
    reportResolutionBody(
      draft({ noShowRuling: "UPHOLD", participants: [outcome] }),
      false,
    ),
  );
  for (const delta of ["-30", "-20"])
    assert.deepEqual(
      reportResolutionBody(
        draft({ participants: [{ ...outcome, violation: "FRAUD", delta }] }),
        false,
      ),
      {
        violations: [
          { userId: learner, reasonCode: "FRAUD", delta: Number(delta) },
        ],
      },
    );
  for (const delta of ["", "-31", "-19", "-20.5"])
    assert.throws(() =>
      reportResolutionBody(
        draft({ participants: [{ ...outcome, violation: "FRAUD", delta }] }),
        false,
      ),
    );
});

test("Staff requests cannot emit Admin credit adjustments, restrictions or reversals", () => {
  const input = draft({
    participants: [
      { userId: learner, violation: "", delta: "", amount: "10.25" },
    ],
    restrictedUserId: learner,
    days: "7",
    reversals: teacher,
  });
  assert.deepEqual(reportResolutionBody(input, false), {});
  assert.deepEqual(reportResolutionBody(input, true), {
    creditAdjustments: [{ userId: learner, amount: "10.25" }],
    restriction: { userId: learner, days: 7 },
    reversals: [{ operationId: teacher }],
  });
});
