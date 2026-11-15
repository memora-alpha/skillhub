import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import { createMaterialsApi } from "../src/features/materials/api/materials-api";
import { materialInput } from "../src/features/materials/api/material-contracts";
import {
  materialEditorSchema,
  editorMaterialInput,
} from "../src/features/materials/utils/material-editor-schema";
import { fixtureMaterial, materialOwnerId } from "./fixtures/materials-data";

test("editor explains missing fields and invalid prices in Vietnamese", () => {
  const values = {
    skillId: "",
    title: " ",
    description: "",
    accessType: "FREE" as const,
    priceCredit: "0",
    rights: false,
  };
  const result = materialEditorSchema.safeParse(values);
  assert.equal(result.success, false);
  if (result.success) return;
  assert.deepEqual(
    result.error.issues.map((issue) => [issue.path[0], issue.message]),
    [
      ["skillId", "Chọn một kỹ năng liên quan."],
      ["title", "Nhập tên tài liệu từ 5 đến 150 ký tự."],
      [
        "description",
        "Thêm mô tả từ 10 đến 3.000 ký tự để người học hiểu nội dung.",
      ],
      ["rights", "Xác nhận bạn có quyền phân phối nội dung này."],
    ],
  );
  for (const priceCredit of ["", "abc", "-1", "1.234", "12345678901"]) {
    const invalid = materialEditorSchema.safeParse({ ...values, priceCredit });
    assert.equal(invalid.success, false);
    if (invalid.success) continue;
    assert.equal(
      invalid.error.issues.find((issue) => issue.path[0] === "priceCredit")
        ?.message,
      "Nhập giá bằng số, tối đa 10 chữ số và 2 chữ số thập phân.",
    );
  }
});

test("editor saves a file-less draft, gates upload/read-only states and validates explicit rights, price and Unicode length", async () => {
  const local = createRequire(
    new URL(
      "../src/features/materials/hooks/use-material-editor.ts",
      import.meta.url,
    ),
  );
  const material = fixtureMaterial({ file: null, scanStatus: null });
  const values = {
    skillId: material.skillId,
    title: material.title,
    description: material.description,
    accessType: "FREE" as const,
    priceCredit: "0",
    rights: true,
  };
  let sent: unknown,
    navigation: unknown,
    calls = 0,
    uploadBusy = false;
  let keepSnapshot = false;
  let defaults: { rights: boolean } | undefined;
  const snapshots: { current: unknown }[] = [];
  let refIndex = 0;
  const api = createMaterialsApi(async (path, options) => {
    calls++;
    sent = { path, body: options?.body };
    return material;
  }, materialOwnerId);
  const contexts = Object.entries({
    react: {
      useRef: (value: unknown) => {
        const n = refIndex++;
        return keepSnapshot
          ? (snapshots[n] ??= { current: value })
          : { current: value };
      },
      useEffect() {},
      useState: (value: unknown) => [
        typeof value === "boolean" && !value ? uploadBusy : value,
        () => {},
      ],
    },
    "react-hook-form": {
      useForm: (options: { defaultValues: { rights: boolean } }) => {
        defaults = options.defaultValues;
        return {
          handleSubmit: (send: (values: unknown) => Promise<unknown>) => () =>
            send(values),
        };
      },
    },
    "@hookform/resolvers/zod": { zodResolver: () => undefined },
    "expo-router": {
      useRouter: () => ({
        replace: (target: unknown) => {
          navigation = target;
        },
      }),
    },
    "@/features/connections": {
      useConnections: () => ({ key: [materialOwnerId], isCurrent: () => true }),
      useConnectionCommand: () => ({
        run: (_intent: unknown, send: () => Promise<unknown>) => send(),
        pending: false,
        uncertain: false,
      }),
    },
    "./use-materials": { useMaterialsApi: () => api },
  }).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
  const file = local.resolve("./use-material-editor.ts");
  try {
    delete local.cache[file];
    const { useMaterialEditor: renderEditor } = local(file);
    const useMaterialEditor = (row?: typeof material, readBlocked = false) => {
      refIndex = 0;
      return renderEditor(row, readBlocked);
    };
    await useMaterialEditor().save();
    assert.equal(
      defaults?.rights,
      false,
      "new uploads require a distribution-rights confirmation",
    );
    useMaterialEditor(material);
    assert.equal(
      defaults?.rights,
      true,
      "editing restores the confirmation recorded by BE",
    );
    useMaterialEditor({ ...material, distributionRightsConfirmedAt: null });
    assert.equal(
      defaults?.rights,
      false,
      "missing server confirmation is never invented",
    );
    assert.deepEqual(sent, {
      path: "/me/materials",
      body: editorMaterialInput(values),
    });
    assert.equal(navigation, "/materials/mine?tab=posted");
    for (const status of ["PENDING_REVIEW", "HIDDEN", "ARCHIVED"] as const)
      assert.equal(
        useMaterialEditor({ ...material, status }).disabled,
        status !== "PENDING_REVIEW",
      );
    uploadBusy = true;
    await useMaterialEditor().save();
    assert.equal(calls, 1);
    assert.equal(
      materialEditorSchema.safeParse({ ...values, rights: false }).success,
      false,
    );
    assert.equal(
      materialEditorSchema.safeParse({
        ...values,
        accessType: "PAID",
        priceCredit: "0",
      }).success,
      false,
    );
    assert.equal(
      materialEditorSchema.safeParse({ ...values, title: "😀".repeat(120) })
        .success,
      true,
    );
    assert.equal(
      materialInput.safeParse({
        ...editorMaterialInput(values),
        title: "😀".repeat(120),
      }).success,
      true,
    );
    assert.throws(() =>
      editorMaterialInput(values, {
        fileId: material.id,
        name: "file.pdf",
        state: "QUARANTINED",
      }),
    );
    uploadBusy = false;
    const beforeRead = calls;
    await useMaterialEditor(material, true).save();
    assert.equal(
      calls,
      beforeRead,
      "refreshing or failed owner reads block saving without dropping the form",
    );
    keepSnapshot = true;
    useMaterialEditor(material);
    await useMaterialEditor({
      ...material,
      listingVersion: material.listingVersion + 1,
    }).save();
    assert.deepEqual(
      sent,
      {
        path: `/me/materials/${material.id}`,
        body: {
          ...editorMaterialInput(values),
          expectedListingVersion: material.listingVersion,
        },
      },
      "background reads must not silently apply an old draft to a newer listing version",
    );
    const savedCalls = calls;
    await useMaterialEditor({ ...material, status: "HIDDEN" }).save();
    assert.equal(
      calls,
      savedCalls,
      "a newly read hidden status still blocks editing",
    );
  } finally {
    contexts.forEach((context) => context.restore());
    delete local.cache[file];
  }
});
