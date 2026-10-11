import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

// Use the existing compiler: no test runtime or application dependency needed.
async function moduleUrl(path, imports = {}) {
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  let { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  });
  for (const [specifier, url] of Object.entries(imports)) {
    outputText = outputText.replaceAll(`"${specifier}"`, `"${url}"`);
  }
  return `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`;
}

const validation = await import(
  await moduleUrl("../src/features/profile/utils/profile-validation.ts")
);
const publicUrl = await moduleUrl(
  "../src/features/profile/utils/public-profile.ts",
);
const { toPublicProfile, toOwnProfilePreview, readProfileId } = await import(
  publicUrl
);
const { resolvePublicProfile } = await import(
  await moduleUrl("../src/features/profile/mocks/public-profiles.ts", {
    "../utils/public-profile": publicUrl,
  })
);
const draft = { fullName: "Nguyễn An", headline: "", bio: "" };
const own = {
  userId: "viewer-id",
  ...draft,
  avatarUrl: null,
  reputationScore: 50,
  verifiedSkillCount: 0,
  completedSessionCount: 0,
  sharingSkills: [],
};

test("names accept Vietnamese and legal punctuation, reject boundary and unsupported input", () => {
  for (const fullName of [
    "An",
    " Nguyễn An ",
    "O’Neil",
    "Jean-Luc",
    "A".repeat(100),
    "Nguye\u0302\u0303n An",
  ]) {
    assert.equal(
      validation.validateProfileDraft({ ...draft, fullName }).fullName,
      undefined,
      fullName,
    );
  }
  for (const fullName of [
    "A",
    "A".repeat(101),
    "123",
    "An2",
    "An😀",
    "<An>",
    "--",
    "An\nAn",
  ]) {
    assert.ok(
      validation.validateProfileDraft({ ...draft, fullName }).fullName,
      fullName,
    );
  }
});

test("optional field bounds include emoji and presentation selectors; clearing is valid", () => {
  for (const token of ["a", "😀", "☀️"]) {
    assert.deepEqual(
      validation.validateProfileDraft({
        ...draft,
        headline: token.repeat(120),
        bio: token.repeat(1000),
      }),
      {},
    );
    assert.ok(
      validation.validateProfileDraft({ ...draft, headline: token.repeat(121) })
        .headline,
    );
    assert.ok(
      validation.validateProfileDraft({ ...draft, bio: token.repeat(1001) })
        .bio,
    );
  }
  assert.deepEqual(validation.validateProfileDraft(draft), {});
  assert.deepEqual(
    validation.validateProfileDraft({
      ...draft,
      bio: "<script>alert('text')</script>",
    }),
    {},
  );
});

test("whitespace-only name changes do not save, but explicit optional clearing does", () => {
  assert.equal(
    validation.profileHasChanges(draft, { ...draft, fullName: " Nguyễn An " }),
    false,
  );
  assert.equal(
    validation.profileHasChanges({ ...draft, bio: "Old bio" }, draft),
    true,
  );
  assert.equal(
    validation.profileHasChanges({ ...draft, headline: "Old headline" }, draft),
    true,
  );
});

test("public projection strips account and nested skill secrets", () => {
  const publicData = toPublicProfile({
    ...own,
    email: "private@example.com",
    phone: "private-phone",
    dateOfBirth: "private-date",
    timezone: "private-zone",
    locale: "private-locale",
    role: "ADMIN",
    payment: { token: "private-payment" },
    sharingSkills: [
      {
        id: "sharing-id",
        skillId: "skill-id",
        name: "React",
        level: "ADVANCED",
        description: "Public description",
        experienceYears: "2.0",
        verificationStatus: "VERIFIED",
        evidence: [{ url: "private-evidence" }],
        catalog: { privateDocumentUrl: "private-document" },
      },
    ],
  });
  assert.deepEqual(Object.keys(publicData).sort(), Object.keys(own).sort());
  assert.deepEqual(
    Object.keys(publicData.sharingSkills[0]).sort(),
    [
      "id",
      "skillId",
      "name",
      "level",
      "description",
      "experienceYears",
      "verificationStatus",
    ].sort(),
  );
  assert.equal(JSON.stringify(publicData).includes("private"), false);
});

test("own preview preserves server values and empty fields without inventing skills or reputation", () => {
  const saved = {
    ...own,
    fullName: "Tên đã lưu",
    headline: "",
    bio: "",
    avatarUrl: "https://example.test/avatar.png",
    reputationScore: null,
    verifiedSkillCount: 3,
    completedSessionCount: 7,
    email: "private@example.com",
    timezone: "private-zone",
    locale: "vi",
    sharingSkills: [{ evidence: "private-evidence" }],
  };
  const preview = toOwnProfilePreview(saved);
  assert.equal(preview.fullName, saved.fullName);
  assert.equal(preview.headline, "");
  assert.equal(preview.bio, "");
  assert.equal(preview.avatarUrl, saved.avatarUrl);
  assert.equal(preview.reputationScore, null);
  assert.equal(preview.verifiedSkillCount, 3);
  assert.equal(preview.completedSessionCount, 7);
  assert.deepEqual(preview.sharingSkills, []);
  assert.equal(JSON.stringify(preview).includes("private"), false);
});

test("invalid or unknown targets cannot fall back to the viewer", () => {
  for (const value of [
    undefined,
    "",
    "  ",
    [own.userId],
    [own.userId, "other"],
  ]) {
    assert.equal(readProfileId(value), null);
    assert.deepEqual(resolvePublicProfile(readProfileId(value), own, 0), {
      status: "unavailable",
    });
  }
  assert.deepEqual(resolvePublicProfile("unknown", own, 0), {
    status: "unavailable",
  });
});

test("self-preview uses saved content, other targets keep their own identity", () => {
  const updated = { ...own, fullName: "Tên đã lưu", headline: "", bio: "" };
  assert.deepEqual(
    resolvePublicProfile(readProfileId(own.userId), updated, 0),
    { status: "ready", profile: updated },
  );
  const mentor = resolvePublicProfile("demo-mentor-an", updated, 0);
  assert.equal(mentor.profile.fullName, "Nguyễn An");
  assert.equal(
    mentor.profile.sharingSkills.filter(
      (skill) => skill.verificationStatus === "VERIFIED",
    ).length,
    2,
  );
  const empty = resolvePublicProfile("demo-learner-linh", updated, 0);
  assert.equal(empty.profile.reputationScore, 50);
  assert.equal(empty.profile.bio, "");
  assert.deepEqual(empty.profile.sharingSkills, []);
});

test("recoverable fixture supports retry without changing the viewer", () => {
  assert.deepEqual(resolvePublicProfile("demo-retry", own, 0), {
    status: "error",
  });
  assert.equal(
    resolvePublicProfile("demo-retry", own, 1).profile.userId,
    "demo-mentor-an",
  );
  assert.equal(own.userId, "viewer-id");
});
