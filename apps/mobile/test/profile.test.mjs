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
const { toOwnProfilePreview, readProfileId } = await import(publicUrl);
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

test("invalid profile route values cannot select the viewer", () => {
  for (const value of [
    undefined,
    "",
    "  ",
    [own.userId],
    [own.userId, "other"],
  ])
    assert.equal(readProfileId(value), null);
});
