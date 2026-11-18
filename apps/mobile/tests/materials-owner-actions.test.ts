import assert from "node:assert/strict";
import { test } from "node:test";
import { AppError } from "../src/lib/http/errors";
import {
  createOwnerMaterialActions,
  type OwnerActionState,
} from "../src/features/materials/utils/owner-material-actions";
import {
  canArchiveMaterial,
  canDeleteMaterial,
  canWithdrawMaterial,
  canEditMaterial,
  canSubmitMaterial,
  filterOwnerMaterials,
  materialFileSize,
  materialSubmitHint,
  materialArchivePresentation,
  materialFilters,
} from "../src/features/materials/utils/owner-material-presentation";
import { fixtureMaterial } from "./fixtures/materials-data";

test("published content stays locked across its lifecycle while archive, submit, withdrawal and deletion remain separate", () => {
  assert.equal(canArchiveMaterial(fixtureMaterial()), false);
  assert.equal(canEditMaterial(fixtureMaterial()), true);
  assert.equal(
    canArchiveMaterial(fixtureMaterial({ status: "PUBLISHED" })),
    true,
  );
  assert.equal(
    canArchiveMaterial(fixtureMaterial({ status: "REJECTED" })),
    false,
  );
  for (const status of [
    "DRAFT",
    "PENDING_REVIEW",
    "REJECTED",
    "HIDDEN",
    "ARCHIVED",
  ] as const)
    assert.equal(
      materialArchivePresentation(fixtureMaterial({ status })),
      undefined,
    );
  assert.equal(
    materialFilters.some((status: string) => status === "ARCHIVED"),
    true,
  );
  assert.equal(
    canEditMaterial(fixtureMaterial({ status: "PENDING_REVIEW" })),
    false,
  );
  assert.equal(
    canArchiveMaterial(fixtureMaterial({ status: "PENDING_REVIEW" })),
    false,
  );
  assert.equal(canEditMaterial(fixtureMaterial({ status: "ARCHIVED" })), false);
  for (const status of [
    "DRAFT",
    "PENDING_REVIEW",
    "PUBLISHED",
    "REJECTED",
    "HIDDEN",
    "ARCHIVED",
  ] as const) {
    assert.equal(
      canEditMaterial(fixtureMaterial({ status, hasBeenPublished: true })),
      false,
      `previously published ${status} cannot be edited`,
    );
  }
  assert.equal(canEditMaterial(fixtureMaterial({ status: "REJECTED" })), true);
  for (const change of [
    { hasBeenPublished: undefined },
    { canEdit: undefined },
    { canEdit: false },
    { editBlockedReason: "MATERIAL_CONTENT_LOCKED" as const },
  ])
    assert.equal(canEditMaterial(fixtureMaterial(change)), false);
  assert.equal(
    canSubmitMaterial(fixtureMaterial({ status: "ARCHIVED" })),
    true,
  );
  for (const status of ["DRAFT", "ARCHIVED"] as const)
    assert.equal(canDeleteMaterial(fixtureMaterial({ status })), true);
  assert.equal(
    canWithdrawMaterial(fixtureMaterial({ status: "PENDING_REVIEW" })),
    true,
  );
  for (const status of [
    "PUBLISHED",
    "REJECTED",
    "HIDDEN",
    "PENDING_REVIEW",
  ] as const)
    assert.equal(canDeleteMaterial(fixtureMaterial({ status })), false);
  for (const status of ["HIDDEN"] as const) {
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
      remove: async (id: string) => ({
        id,
        deleted: true as const,
        replayed: false,
      }),
      submit: async () => {
        sends++;
        current = { ...material, status: "PUBLISHED" };
        throw new AppError("network");
      },
      archive: async () => {
        sends++;
        return { ...current, status: "ARCHIVED" };
      },
      withdraw: async () => material,
      ownerDetail: async () => {
        reads++;
        return current;
      },
    },
    isCurrent: () => true,
    onChange: (next) => {
      state = next;
    },
    onResult: async () => {},
    onFailure() {},
    onDeleted: async () => {},
  });
  await actions.run("submit", material);
  assert.equal(state.uncertain?.action, "submit");
  actions.resetFeedback();
  await actions.run("archive", current);
  assert.equal(sends, 1);
  const reconciled = await actions.reconcile();
  assert.equal(
    reconciled && "status" in reconciled ? reconciled.status : undefined,
    "PUBLISHED",
  );
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
      remove: async (id: string) => ({
        id,
        deleted: true as const,
        replayed: false,
      }),
      submit: async () => {
        sends++;
        return new Promise((resolve) => {
          finish = resolve;
        });
      },
      archive: async () => {
        throw new Error("must not send");
      },
      withdraw: async () => fixtureMaterial(),
      ownerDetail: async () => fixtureMaterial(),
    },
    isCurrent: () => active,
    onChange: (state) => states.push(state),
    onResult: async () => {
      results++;
    },
    onFailure() {},
    onDeleted: async () => {},
  });
  const first = actions.run("submit", fixtureMaterial());
  await actions.run("submit", fixtureMaterial());
  assert.equal(sends, 1);
  active = false;
  finish(fixtureMaterial({ status: "PENDING_REVIEW" }));
  await first;
  assert.equal(results, 0);
  assert.equal(states.length, 1);
  assert.equal(states[0]!.pending?.action, "submit");
});
test("known conflicts stay retryable; failed reconciliation retains uncertain state and does not issue mutations", async () => {
  let state: OwnerActionState = {},
    sends = 0;
  const currentState = (): OwnerActionState => state;
  const actions = createOwnerMaterialActions({
    api: {
      remove: async (id: string) => ({
        id,
        deleted: true as const,
        replayed: false,
      }),
      submit: async () => {
        sends++;
        throw sends === 1
          ? new AppError("http", 409, "MATERIAL_FILE_REQUIRED")
          : new AppError("network");
      },
      archive: async () => fixtureMaterial(),
      withdraw: async () => fixtureMaterial(),
      ownerDetail: async () => {
        throw new AppError("network");
      },
    },
    isCurrent: () => true,
    onChange: (next) => {
      state = next;
    },
    onResult: async () => {},
    onFailure() {},
    onDeleted: async () => {},
  });
  await actions.run("submit", fixtureMaterial());
  assert.equal(state.uncertain, undefined);
  await actions.run("submit", fixtureMaterial());
  await actions.reconcile();
  assert.equal(currentState().uncertain?.action, "submit");
  assert.equal(sends, 2);
});

test("owner success feedback is a one-time event; unknown results only notify after a read without claiming mutation success", async () => {
  const published = fixtureMaterial({ status: "PUBLISHED" });
  const archived = fixtureMaterial({ status: "ARCHIVED" });
  const pending = fixtureMaterial({ status: "PENDING_REVIEW" });
  const notices: unknown[] = [];
  let mode: "unknown" | "success" | "conflict" = "unknown";
  let active = true;
  let state: OwnerActionState = {};
  const actions = createOwnerMaterialActions({
    api: {
      archive: async () => {
        if (mode !== "success")
          throw mode === "unknown"
            ? new AppError("network")
            : new AppError("http", 409);
        return archived;
      },
      submit: async () => pending,
      withdraw: async () => fixtureMaterial(),
      ownerDetail: async () => archived,
      remove: async (id) => ({ id, deleted: true, replayed: false }),
    },
    isCurrent: () => active,
    onChange: (next) => {
      state = next;
    },
    onResult: async () => {},
    onDeleted: async () => {},
    onFailure() {},
    onNotice: (...args) => notices.push(args),
  });
  await actions.run("archive", published);
  assert.equal(notices.length, 0, "unknown requests do not claim success");
  await actions.reconcile();
  assert.deepEqual(notices, [
    [
      "Đã cập nhật trạng thái tài liệu. Kiểm tra trước khi thao tác tiếp.",
      "info",
    ],
  ]);
  assert.deepEqual(state, {});
  await actions.run("submit", archived);
  await actions.run("withdraw", pending);
  assert.deepEqual(notices.slice(1), [
    ["Đã gửi tài liệu để duyệt.", "success"],
    ["Đã rút yêu cầu duyệt.", "success"],
  ]);
  actions.resetFeedback();
  assert.equal(
    notices.length,
    3,
    "resetting feedback cannot repeat success notifications",
  );
  mode = "conflict";
  await actions.run("archive", published);
  assert.equal(notices.length, 3);
  active = false;
  await actions.run("submit", archived);
  assert.equal(notices.length, 3, "expired sessions cannot notify");
});
