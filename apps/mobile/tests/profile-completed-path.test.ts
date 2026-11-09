import assert from "node:assert/strict";
import test from "node:test";
import { parseProfile } from "../src/features/account/api/account-contracts";
import { toOwnProfilePreview } from "../src/features/profile/utils/public-profile";
import {
  fixtureIdentity,
  fixtureUsers,
} from "./fixtures/learning-requests-data";
import { AppError } from "../src/lib/http/errors";

test("own profile projects completed paths separately from completed sessions", () => {
  const base = fixtureIdentity(fixtureUsers[0]).profile;
  const profile = parseProfile({
    ...base,
    completedSessionCount: 19,
    completedLearningPathCount: 2,
  });
  const preview = toOwnProfilePreview(profile);
  assert.equal(preview.completedLearningPathCount, 2);
  assert.equal(preview.completedSessionCount, 19);
  assert.equal("timezone" in preview, false);
  assert.equal("locale" in preview, false);
  assert.equal(
    toOwnProfilePreview(parseProfile(base)).completedLearningPathCount,
    null,
  );
  for (const count of [-1, 1.5, "2"]) {
    assert.throws(
      () => parseProfile({ ...base, completedLearningPathCount: count }),
      AppError,
    );
  }
});
