import assert from "node:assert/strict";
import test from "node:test";
import { parseProfile } from "../src/features/account/api/account-contracts";
import { toOwnProfilePreview } from "../src/features/profile/utils/public-profile";
import { AppError } from "../src/lib/http/errors";
import {
  fixtureIdentity,
  fixtureUsers,
} from "./fixtures/learning-requests-data";

const base = fixtureIdentity(fixtureUsers[0]).profile;
const entry = {
  action: "HIDE",
  reason: "Nội dung cần chỉnh sửa.",
  at: "2026-11-09T18:00:00.000Z",
};

test("own profile accepts moderation records while public projection excludes private reasons", () => {
  const profile = parseProfile({
    ...base,
    bio: "Original bio for editing",
    profileModeration: {
      bio: entry,
      avatar: { ...entry, action: "REQUEST_EDIT" },
    },
  });
  assert.deepEqual(profile.profileModeration, {
    bio: entry,
    avatar: { ...entry, action: "REQUEST_EDIT" },
  });
  assert.equal(profile.bio, "Original bio for editing");
  assert.equal("profileModeration" in toOwnProfilePreview(profile), false);
  assert.equal(parseProfile(base).profileModeration, null);
  assert.equal(
    parseProfile({ ...base, profileModeration: null }).profileModeration,
    null,
  );
});

test("malformed moderation cannot be treated as a clean profile", () => {
  for (const profileModeration of [
    [],
    "hidden",
    { bio: null },
    { bio: { ...entry, action: "ALLOW" } },
    { avatar: { ...entry, reason: "" } },
    { bio: { ...entry, at: "not-a-date" } },
  ])
    assert.throws(() => parseProfile({ ...base, profileModeration }), AppError);
});
