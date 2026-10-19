import assert from "node:assert/strict";
import test from "node:test";
import { createEvidenceTransfers } from "../src/features/skills/utils/evidence-transfers";
import {
  evidenceDraft,
  type VerificationDraft,
} from "../src/features/skills/utils/evidence-draft";
import { createMutationIntent } from "../src/features/skills/utils/mutation-intent";
import {
  verificationSchema,
  ownSkillSchema,
} from "../src/features/skills/api/skill-contracts";
import type { VerificationInput } from "../src/features/skills/types/skills";
import { ids, batch, ownSkill } from "./skills-fixtures";
import { AppError } from "../src/lib/http/errors";

const tick = () => new Promise((resolve) => setImmediate(resolve));
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { resolve, promise };
}
function fixture(
  count = 1,
  sleep?: (ms: number, signal: AbortSignal) => Promise<void>,
  canRead: (id: string) => boolean = () => true,
) {
  const drafts = new Map<string, VerificationDraft>();
  const intents = new Map<string, ReturnType<typeof createMutationIntent>>();
  const draft = {
    title: "Chứng chỉ",
    description: "Bằng chứng",
    files: Array.from({ length: count }, (_, i) =>
      evidenceDraft(
        {
          uri: `blob:${i}`,
          name: `proof-${i}.pdf`,
          file: new File(["proof"], `proof-${i}.pdf`, {
            type: "application/pdf",
          }),
        },
        `local-${i}`,
      ),
    ),
  };
  let current = true,
    uploads = 0,
    keys = 0;
  const calls: { kind: string; body?: VerificationInput; key?: string }[] = [];
  const toasts: string[] = [];
  const remembered: string[] = [];
  const tones: string[] = [];
  const api = {
    upload: async (_id: string, _body: FormData, _signal?: AbortSignal) => {
      assert.equal(_id, ids.sharing);
      assert.equal(_body.has("file"), true);
      assert.equal(_signal?.aborted, false);
      calls.push({ kind: "upload" });
      return {
        fileId: `10000000-0000-4000-8000-${String(100 + ++uploads).padStart(12, "0")}`,
        state: "QUARANTINED",
      };
    },
    fileStatus: async (_id: string, fileId: string, _signal?: AbortSignal) => {
      assert.equal(_signal?.aborted, false);
      calls.push({ kind: "status" });
      return { fileId, state: "READY" };
    },
    submit: async (_id: string, body: VerificationInput, key: string) => {
      calls.push({ kind: "submit", body, key });
      return verificationSchema.parse(batch);
    },
  };
  const transfers = createEvidenceTransfers({
    api,
    drafts,
    intents,
    isCurrent: () => current,
    canRead,
    compress: async (file) => file,
    remember: async (result) => {
      remembered.push(result.id);
    },
    refresh: async () => {
      calls.push({ kind: "refresh" });
    },
    key: () => `key-${++keys}`,
    sleep,
    notify: (message, tone) => {
      toasts.push(message);
      tones.push(tone);
    },
  });
  return {
    transfers,
    drafts,
    intents,
    api,
    draft,
    calls,
    toasts,
    tones,
    remembered,
    switchAccount: () => {
      current = false;
    },
  };
}

test("read denial blocks new evidence work and stops a pending upload before submit", async () => {
  let allowed = false;
  const f = fixture(1, undefined, () => allowed);
  assert.equal(f.transfers.start(ids.sharing, f.draft), false);
  assert.equal(f.calls.length, 0);
  allowed = true;
  const gate = deferred<void>();
  const upload = f.api.upload;
  f.api.upload = async (...args) => {
    const result = await upload(...args);
    await gate.promise;
    return result;
  };
  f.transfers.start(ids.sharing, f.draft);
  await tick();
  allowed = false;
  gate.resolve();
  await tick();
  assert.equal(f.calls.filter((call) => call.kind === "submit").length, 0);
  assert.equal(f.remembered.length, 0);
  assert.equal(f.drafts.get(ids.sharing)?.files.length, 1);
  assert.equal(f.transfers.start(ids.sharing), false);
  allowed = true;
  assert.equal(f.transfers.start(ids.sharing), true);
  await tick();
  assert.equal(f.calls.filter((call) => call.kind === "upload").length, 1);
  assert.equal(f.calls.filter((call) => call.kind === "submit").length, 1);
});

test("transfer is session-owned, immediately observable, and rejects duplicate starts while upload is pending", async () => {
  const f = fixture();
  const upload = f.api.upload;
  const gate = deferred<void>();
  f.api.upload = async (...args) => {
    await gate.promise;
    return upload(...args);
  };
  let updates = 0;
  const unsubscribe = f.transfers.subscribe(() => {
    updates++;
  });
  assert.equal(f.transfers.start(ids.sharing, f.draft), true);
  const sending = f.transfers.get(ids.sharing);
  assert.equal(sending?.state, "SENDING");
  assert.equal(f.transfers.get(ids.sharing), sending);
  assert.equal(f.transfers.start(ids.sharing, f.draft), false);
  await tick();
  assert.equal(f.remembered.length, 0);
  gate.resolve();
  await tick();
  assert.equal(f.transfers.get(ids.sharing)?.state, "PENDING");
  assert.deepEqual(f.toasts, ["Đã gửi yêu cầu xác minh."]);
  assert.equal(f.drafts.has(ids.sharing), false);
  assert.equal(f.transfers.start(ids.sharing, f.draft), false);
  assert.ok(updates >= 4);
  unsubscribe();
});

test("slow scans retain an informational waiting state and check again without uploading bytes", async () => {
  const f = fixture(2, async () => {});
  f.api.fileStatus = async (_id, fileId) => ({ fileId, state: "SCANNING" });
  const progress: string[] = [];
  f.transfers.subscribe(() => {
    const value = f.transfers.get(ids.sharing)?.progress;
    if (value) progress.push(value);
  });
  f.transfers.start(ids.sharing, f.draft);
  await tick();
  assert.equal(f.transfers.get(ids.sharing)?.state, "WAITING_SCAN");
  assert.ok(
    f.drafts
      .get(ids.sharing)!
      .files.every((file) => file.fileId && !file.error),
  );
  assert.ok(progress.some((label) => label.includes("Đang chuẩn bị")));
  assert.ok(progress.some((label) => label.includes("Đang tải")));
  assert.ok(progress.some((label) => label.includes("Đang kiểm tra")));
  assert.ok(progress.some((label) => label.includes("lâu hơn dự kiến")));
  assert.equal(f.calls.filter((call) => call.kind === "submit").length, 0);
  assert.deepEqual(f.tones, ["info"]);
  f.api.fileStatus = async (_id, fileId) => ({ fileId, state: "READY" });
  f.transfers.start(ids.sharing);
  assert.equal(f.transfers.start(ids.sharing), false);
  await tick();
  assert.equal(f.transfers.get(ids.sharing)?.state, "PENDING");
  assert.equal(f.calls.filter((call) => call.kind === "upload").length, 2);
  assert.equal(f.calls.filter((call) => call.kind === "submit").length, 1);
});

test("HTTP 503 remains a failed transfer with a retained draft and no automatic replay", async () => {
  const f = fixture();
  f.api.upload = async () => {
    throw new AppError("http", 503);
  };
  f.transfers.start(ids.sharing, f.draft);
  await tick();
  assert.equal(f.transfers.get(ids.sharing)?.state, "FAILED");
  assert.match(f.transfers.get(ids.sharing)!.error!, /Máy chủ chưa sẵn sàng/);
  assert.equal(f.drafts.get(ids.sharing)?.files.length, 1);
  assert.equal(f.calls.filter((call) => call.kind === "submit").length, 0);
  assert.deepEqual(f.tones, ["error"]);
});

test("partial upload failure remains retryable with previous file IDs and without duplicate uploads", async () => {
  const f = fixture(2);
  const upload = f.api.upload;
  let attempts = 0;
  f.api.upload = async (...args) => {
    if (++attempts === 2) throw new Error("storage unavailable");
    return upload(...args);
  };
  f.transfers.start(ids.sharing, f.draft);
  await tick();
  assert.equal(f.transfers.get(ids.sharing)?.state, "FAILED");
  const firstId = f.drafts.get(ids.sharing)!.files[0]!.fileId;
  assert.ok(firstId);
  assert.equal(f.remembered.length, 0);
  assert.equal(f.transfers.start(ids.sharing), true);
  await tick();
  assert.equal(f.transfers.get(ids.sharing)?.state, "PENDING");
  assert.equal(attempts, 3);
  assert.equal(f.calls.filter((call) => call.kind === "submit").length, 1);
  assert.ok(
    f.calls
      .find((call) => call.kind === "submit")
      ?.body?.fileIds.includes(firstId!),
  );
});

test("unknown submit result retains the exact intent and checks READY again on explicit retry", async () => {
  const f = fixture();
  const submit = f.api.submit;
  let attempts = 0;
  f.api.submit = async (...args) => {
    const result = await submit(...args);
    if (++attempts === 1) throw new Error("response lost");
    return result;
  };
  f.transfers.start(ids.sharing, f.draft);
  await tick();
  assert.equal(f.transfers.get(ids.sharing)?.state, "FAILED");
  assert.equal(f.intents.has(ids.sharing), true);
  f.transfers.start(ids.sharing);
  await tick();
  const submissions = f.calls.filter((call) => call.kind === "submit");
  assert.equal(submissions[0]?.key, submissions[1]?.key);
  assert.deepEqual(submissions[0]?.body, submissions[1]?.body);
  assert.equal(f.calls.filter((call) => call.kind === "upload").length, 1);
  assert.equal(f.calls.filter((call) => call.kind === "status").length, 2);
  assert.equal(f.remembered.length, 1);
});

test("pausing the app cancels checks, retains the draft, and requires explicit retry", async () => {
  const f = fixture();
  const status = f.api.fileStatus;
  f.api.fileStatus = async (_id, fileId, signal) => {
    await new Promise<void>((resolve) =>
      signal?.addEventListener("abort", () => resolve(), { once: true }),
    );
    return { fileId, state: "SCANNING" };
  };
  f.transfers.start(ids.sharing, f.draft);
  await tick();
  f.transfers.pause();
  await tick();
  assert.equal(f.transfers.get(ids.sharing)?.state, "FAILED");
  assert.ok(f.drafts.get(ids.sharing)?.files[0]?.fileId);
  assert.equal(f.toasts.length, 0);
  f.api.fileStatus = status;
  f.transfers.resume();
  f.transfers.start(ids.sharing);
  await tick();
  assert.equal(f.transfers.get(ids.sharing)?.state, "PENDING");
});

test("a skill create completing after backgrounding retains evidence without starting new requests", async () => {
  const f = fixture();
  f.transfers.pause();
  assert.equal(f.transfers.start(ids.sharing, f.draft), false);
  assert.equal(f.transfers.get(ids.sharing)?.state, "FAILED");
  assert.equal(f.drafts.get(ids.sharing)?.files.length, 1);
  f.transfers.resume();
  await tick();
  assert.equal(f.calls.length, 0);
  assert.equal(f.transfers.start(ids.sharing), true);
  await tick();
  assert.equal(f.transfers.get(ids.sharing)?.state, "PENDING");
});

test("late upload from an old session cannot scan, submit, cache or notify the new account", async () => {
  const f = fixture();
  const gate = deferred<{ fileId: string; state: string }>();
  f.api.upload = () => gate.promise;
  f.transfers.start(ids.sharing, f.draft);
  await tick();
  f.switchAccount();
  f.transfers.dispose();
  gate.resolve({ fileId: ids.file, state: "QUARANTINED" });
  await tick();
  assert.equal(f.calls.length, 0);
  assert.equal(f.remembered.length, 0);
  assert.equal(f.toasts.length, 0);
  assert.equal(f.transfers.get(ids.sharing), null);
});

test("confirmed archive cancels the matching job and prevents later callbacks", async () => {
  const f = fixture();
  const gate = deferred<{ fileId: string; state: string }>();
  f.api.upload = () => gate.promise;
  f.transfers.start(ids.sharing, f.draft);
  await tick();
  f.transfers.forget(ids.sharing);
  gate.resolve({ fileId: ids.file, state: "QUARANTINED" });
  await tick();
  assert.equal(f.calls.length, 0);
  assert.equal(f.toasts.length, 0);
  assert.equal(f.drafts.has(ids.sharing), false);
  assert.equal(f.transfers.start(ids.sharing, f.draft), false);
});

test("a matching server decision releases pending status; unrelated decisions cannot", async () => {
  const f = fixture();
  f.transfers.start(ids.sharing, f.draft);
  await tick();
  f.transfers.observe([
    { id: ids.other, sharingSkillId: ids.sharing, status: "APPROVED" },
  ]);
  assert.equal(f.transfers.get(ids.sharing)?.state, "PENDING");
  f.transfers.observeSkills([
    ownSkillSchema.parse({
      ...ownSkill,
      latestVerification: { ...batch, status: "APPROVED" },
    }),
  ]);
  assert.equal(f.transfers.get(ids.sharing), null);
});

test("already-reviewed submit replay does not claim pending approval", async () => {
  const f = fixture();
  f.api.submit = async () =>
    verificationSchema.parse({ ...batch, status: "APPROVED" });
  f.transfers.start(ids.sharing, f.draft);
  await tick();
  assert.equal(f.transfers.get(ids.sharing), null);
  assert.deepEqual(f.toasts, ["Yêu cầu xác minh đã được xử lý."]);
});
