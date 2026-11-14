import assert from "node:assert/strict";
import { test } from "node:test";
import { AppError } from "../src/lib/http/errors";
import {
  createOwnerMaterialActions,
  type OwnerActionState,
} from "../src/features/materials/utils/owner-material-actions";
import {
  canArchiveMaterial,
  canEditMaterial,
  canSubmitMaterial,
  filterOwnerMaterials,
  materialFileSize,
  materialSubmitHint,
} from "../src/features/materials/utils/owner-material-presentation";
import { fixtureMaterial } from "./fixtures/materials-data";

test("owner actions match BE lifecycle, including editable pending and read-only hidden listings", () => {
  assert.equal(
    canEditMaterial(fixtureMaterial({ status: "PENDING_REVIEW" })),
    true,
  );
  assert.equal(
    canArchiveMaterial(fixtureMaterial({ status: "PENDING_REVIEW" })),
    true,
  );
  for (const status of ["HIDDEN", "ARCHIVED"] as const) {
    assert.equal(canEditMaterial(fixtureMaterial({ status })), false);
    assert.equal(canArchiveMaterial(fixtureMaterial({ status })), false);
  }
  assert.equal(canSubmitMaterial(fixtureMaterial()), true);
  assert.equal(materialSubmitHint(fixtureMaterial()), null);
  assert.equal(
    materialSubmitHint(fixtureMaterial({ file: null, scanStatus: null })),
    "Thêm tệp trước khi gửi duyệt.",
  );
  for (const row of [
    fixtureMaterial({ file: null, scanStatus: null }),
    fixtureMaterial({ scanStatus: "UNKNOWN" }),
    fixtureMaterial({ distributionRightsConfirmedAt: null }),
    fixtureMaterial({ status: "PUBLISHED" }),
  ])
    assert.equal(canSubmitMaterial(row), false);
  assert.equal(
    filterOwnerMaterials([fixtureMaterial()], "DRAFT", "tai lieu giao tiep")
      .length,
    1,
  );
  assert.equal(
    filterOwnerMaterials([fixtureMaterial()], "PUBLISHED", "").length,
    0,
  );
  assert.equal(materialFileSize("1250000"), "1,3 MB");
  assert.equal(materialFileSize("9999999999999999999"), null);
});
test("unknown submission locks all writes until a read reconciles current status, without replaying POST", async () => {
  let sends = 0,
    reads = 0;
  let state: OwnerActionState = {};
  const material = fixtureMaterial();
  let current = material;
  const actions = createOwnerMaterialActions({
    api: {
      submit: async () => {
        sends++;
        current = { ...material, status: "PENDING_REVIEW" };
        throw new AppError("network");
      },
      archive: async () => {
        sends++;
        return { ...current, status: "ARCHIVED" };
      },
      mine: async () => {
        reads++;
        return [current];
      },
    },
    isCurrent: () => true,
    onChange: (next) => {
      state = next;
    },
    onResult: async () => {},
    onFailure() {},
  });
  await actions.run("submit", material);
  assert.equal(state.uncertain?.action, "submit");
  actions.resetFeedback();
  await actions.run("archive", current);
  assert.equal(sends, 1);
  assert.equal((await actions.reconcile())?.status, "PENDING_REVIEW");
  assert.equal(state.uncertain, undefined);
  assert.equal(reads, 1);
  assert.equal(sends, 1);
  await actions.run("archive", current);
  assert.equal(sends, 2);
});
test("duplicate dispatches and completions from an old session cannot write cache or success state", async () => {
  let active = true,
    sends = 0,
    results = 0;
  let finish!: (value: ReturnType<typeof fixtureMaterial>) => void;
  const states: OwnerActionState[] = [];
  const actions = createOwnerMaterialActions({
    api: {
      submit: async () => {
        sends++;
        return new Promise((resolve) => {
          finish = resolve;
        });
      },
      archive: async () => {
        throw new Error("must not send");
      },
      mine: async () => [],
    },
    isCurrent: () => active,
    onChange: (state) => states.push(state),
    onResult: async () => {
      results++;
    },
    onFailure() {},
  });
  const first = actions.run("submit", fixtureMaterial());
  await actions.run("submit", fixtureMaterial());
  assert.equal(sends, 1);
  active = false;
  finish(fixtureMaterial({ status: "PENDING_REVIEW" }));
  await first;
  assert.equal(results, 0);
  assert.equal(states.length, 1);
  assert.equal(states[0]!.notice, undefined);
});
test("known conflicts stay retryable; failed reconciliation retains uncertain state and does not issue mutations", async () => {
  let state: OwnerActionState = {},
    sends = 0;
  const currentState = (): OwnerActionState => state;
  const actions = createOwnerMaterialActions({
    api: {
      submit: async () => {
        sends++;
        throw sends === 1
          ? new AppError("http", 409, "MATERIAL_FILE_REQUIRED")
          : new AppError("network");
      },
      archive: async () => fixtureMaterial(),
      mine: async () => {
        throw new AppError("network");
      },
    },
    isCurrent: () => true,
    onChange: (next) => {
      state = next;
    },
    onResult: async () => {},
    onFailure() {},
  });
  await actions.run("submit", fixtureMaterial());
  assert.equal(state.uncertain, undefined);
  await actions.run("submit", fixtureMaterial());
  await actions.reconcile();
  assert.equal(currentState().uncertain?.action, "submit");
  assert.equal(sends, 2);
});
