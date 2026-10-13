import assert from "node:assert/strict";
import test from "node:test";
import {
  formValues,
  skillInput,
  skillPatch,
  skillFormSchema,
} from "../src/features/skills/schemas/skill-form";
import {
  evidenceDraft,
  evidenceFormData,
  readyFileIds,
} from "../src/features/skills/utils/evidence-draft";
import { createMutationIntent } from "../src/features/skills/utils/mutation-intent";
import {
  parseContract,
  ownSkillSchema,
} from "../src/features/skills/api/skill-contracts";
import { ownSkill, ids } from "./skills-fixtures";
test("skill form validates Unicode code points after NFC and trim", () => {
  const values = {
    ...formValues(),
    skillId: ids.skill,
    description: `  ${"😀".repeat(20)}  `,
  };
  assert.equal(skillInput(values).description, "😀".repeat(20));
  assert.equal(
    skillFormSchema.safeParse({ ...values, description: "😀".repeat(19) })
      .success,
    false,
  );
  assert.equal(
    skillFormSchema.safeParse({ ...values, description: "x".repeat(1501) })
      .success,
    false,
  );
});
test("experience years keeps decimal strings, accepts comma, and clears with null", () => {
  const values = {
    ...formValues(),
    skillId: ids.skill,
    description: ownSkill.description,
  };
  assert.equal(
    skillInput({ ...values, experienceYears: "2,5" }).experienceYears,
    "2.5",
  );
  assert.equal(
    skillInput({ ...values, experienceYears: "" }).experienceYears,
    null,
  );
  for (const experienceYears of ["-1", "60.1", "2.55", "1e1", "Infinity"])
    assert.equal(
      skillFormSchema.safeParse({ ...values, experienceYears }).success,
      false,
    );
});
test("no-change patch contains only version, and clear uses explicit null", () => {
  const skill = parseContract(ownSkillSchema, ownSkill);
  assert.deepEqual(skillPatch(skill, skillInput(formValues(skill))), {
    expectedVersion: 1,
  });
  assert.deepEqual(
    skillPatch(
      skill,
      skillInput({ ...formValues(skill), experienceYears: "" }),
    ),
    { expectedVersion: 1, experienceYears: null },
  );
});
test("retry intent keeps key until payload/version changes or successful completion", () => {
  let keys = 0;
  const intent = createMutationIntent(() => `key-${++keys}`);
  assert.equal(
    intent.key("update", { expectedVersion: 1 }),
    intent.key("update", { expectedVersion: 1 }),
  );
  assert.equal(intent.key("update", { expectedVersion: 2 }), "key-2");
  assert.equal(intent.key("archive", { expectedVersion: 2 }), "key-3");
  intent.clear();
  assert.equal(intent.key("archive", { expectedVersion: 2 }), "key-4");
});
test("evidence rejects empty/unknown size, unsupported or mismatching MIME, and oversized file", () => {
  const valid = {
    uri: "file:///proof.pdf",
    name: "proof.pdf",
    size: 100,
    mimeType: "application/pdf",
  };
  assert.equal(evidenceDraft(valid, "local").state, "SELECTED");
  for (const bad of [
    { ...valid, size: 0 },
    { ...valid, size: undefined },
    { ...valid, size: 10_000_001 },
    { ...valid, mimeType: "image/png" },
    { ...valid, name: "proof.exe" },
    { ...valid, name: ".pdf" },
    { ...valid, name: "proof.EXE.pdf" },
    { ...valid, name: "proof.ps1.pdf" },
    { ...valid, name: "proof.constructor", mimeType: undefined },
    { ...valid, name: "proof.__proto__", mimeType: undefined },
  ])
    assert.throws(() => evidenceDraft(bad, "local"));
});
test("READY-only submit requires 1–5 distinct file IDs, not merely clean-looking states", () => {
  const file = {
    ...evidenceDraft({ uri: "file:///p.pdf", name: "p.pdf", size: 1 }, "local"),
    fileId: ids.file,
    state: "READY",
  };
  assert.deepEqual(readyFileIds([file]), [ids.file]);
  assert.equal(readyFileIds([{ ...file, checking: true }]), null);
  for (const state of [
    "QUARANTINED",
    "SCANNING",
    "REJECTED",
    "SCAN_FAILED",
    "CLEAN",
    "UNKNOWN",
  ])
    assert.equal(readyFileIds([{ ...file, state }]), null);
  assert.equal(readyFileIds([]), null);
  assert.equal(readyFileIds([file, file]), null);
  assert.equal(
    readyFileIds(
      Array.from({ length: 6 }, (_, index) => ({
        ...file,
        fileId: String(index),
      })),
    ),
    null,
  );
});
test("web evidence multipart uses file field and actual bytes, never avatar field", async () => {
  const file = new File(["proof"], "proof.pdf", { type: "application/pdf" });
  const draft = evidenceDraft(
    { uri: "blob:proof", name: file.name, file },
    "local",
  );
  const body = evidenceFormData(draft);
  assert.equal(body.has("image"), false);
  assert.equal(await (body.get("file") as File).text(), "proof");
});

test("web multipart normalizes generic picker MIME to the backend format without changing bytes", async () => {
  for (const type of ["", "application/octet-stream", "APPLICATION/PDF"]) {
    const file = new File(["%PDF-1.7\nproof"], "proof.pdf", { type });
    const draft = evidenceDraft(
      { uri: "blob:proof", name: file.name, file },
      "local",
    );
    const sent = evidenceFormData(draft).get("file") as File;
    assert.equal(sent.type, "application/pdf");
    assert.equal(sent.name, file.name);
    assert.deepEqual(await sent.arrayBuffer(), await file.arrayBuffer());
  }
});
