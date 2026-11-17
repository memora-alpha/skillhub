import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import {
  fixtureMaterial,
  materialOtherId,
  materialOwnerId,
} from "./fixtures/materials-data";
import type { MaterialOrder } from "../src/features/materials/api/material-contracts";

type Node = { type: unknown; props: Record<string, unknown> };
function nodes(value: unknown): Node[] {
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!value || typeof value !== "object" || !("props" in value)) return [];
  const node = value as Node;
  return [node, ...nodes(node.props.children)];
}
const jsx = (type: unknown, props: unknown) => ({ type, props });
const at = "2026-11-16T03:00:00Z";
function text(value: unknown): string {
  if (Array.isArray(value)) return value.map(text).join("");
  if (value && typeof value === "object" && "props" in value)
    return text((value as Node).props.children);
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : "";
}

test("purchased cards show current listing metadata while preserving purchase history and download/refund guards", async () => {
  const local = createRequire(
    new URL(
      "../src/features/materials/components/material-order-card.tsx",
      import.meta.url,
    ),
  );
  let publicEnabled: boolean | undefined,
    reviewEnabled: boolean | undefined,
    route: string | undefined;
  let issued: (() => void) | undefined;
  let publicMaterial: ReturnType<typeof fixtureMaterial> | undefined;
  let publicError: unknown;
  const downloads: boolean[] = [];
  const invalidations: unknown[] = [];
  const contexts = Object.entries({
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "react-native": { View: "View", Text: "Text", Pressable: "Pressable" },
    "expo-router": {
      useRouter: () => ({
        push: (value: string) => {
          route = value;
        },
      }),
    },
    "@tanstack/react-query": {
      useQueryClient: () => ({
        invalidateQueries: async (value: unknown) => {
          invalidations.push(value);
        },
      }),
    },
    "@/features/connections": { useConnections: () => ({ key: ["owner", 1] }) },
    "@/components/Button": { Button: "Button" },
    "@/components/Icon": { Icon: "Icon" },
    "../hooks/use-materials": {
      usePublicMaterial: (_id: string, enabled: boolean) => {
        publicEnabled = enabled;
        return { data: publicMaterial, error: publicError };
      },
    },
    "../hooks/use-material-reviews": {
      useMaterialReviewEligibility: (_id: string, enabled: boolean) => {
        reviewEnabled = enabled;
        return { data: { canReview: true }, isFetching: false };
      },
    },
    "../hooks/use-material-download": {
      useMaterialDownload: (_id: string, onIssued: () => void) => {
        issued = onIssued;
        return {
          pending: false,
          awaitingConfirmation: false,
          start: async (confirm: boolean) => {
            downloads.push(confirm);
          },
        };
      },
    },
    "./material-download-feedback": {
      MaterialDownloadFeedback: "DownloadFeedback",
    },
    "./material-summary": { MaterialFileBadge: "FileBadge" },
    "./material-cover": { MaterialCover: "Cover" },
    "./material.styles": { materialStyles: {} },
  }).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
  const file = local.resolve("./material-order-card.tsx");
  try {
    delete local.cache[file];
    const { MaterialOrderCard } = local(file);
    const order: MaterialOrder = {
      id: materialOtherId,
      materialId: fixtureMaterial().id,
      sellerId: materialOwnerId,
      listingVersion: 1,
      grossCredit: "10.00",
      feeAmount: "1.00",
      sellerNetCredit: "9.00",
      status: "SUCCESS",
      createdAt: at,
      purchasedMaterial: {
        title: "Tên lúc mua",
        originalFilename: "ban-cu.pdf",
        mimeType: "application/pdf",
        sizeBytes: "1000",
      },
      review: {
        hasReview: false,
        reviewId: null,
        status: null,
        version: null,
        sourceOrderId: null,
        canReview: true,
        reasonCode: null,
      },
      refundEligibility: {
        canRefund: false,
        reasonCode: "MATERIAL_ALREADY_CONSUMED",
        deadline: at,
        evaluatedAt: at,
      },
    };
    const render = (visible = true) =>
      nodes(
        MaterialOrderCard({
          order,
          visible,
          disabled: false,
          onRefund() {},
        }),
      );
    let tree = render();
    const button = (label: string) =>
      tree.find(
        (node) => node.type === "Button" && node.props.children === label,
      )!;
    assert.equal(publicEnabled, true);
    assert.equal(reviewEnabled, false);
    render(false);
    assert.equal(
      publicEnabled,
      false,
      "offscreen rows never request listing metadata",
    );
    tree = render();
    assert.ok(tree.some((node) => node.props.children === "Tên lúc mua"));
    assert.equal(
      tree.some((node) => node.props.children === "Tên phiên bản mới"),
      false,
    );
    assert.equal(button("Hoàn tiền").props.disabled, true);
    assert.equal(button("Tải tài liệu").props.disabled, false);
    (
      tree.find((node) => node.type === "Pressable")!.props
        .onPress as () => void
    )();
    assert.equal(route, `/materials/${order.materialId}`);
    assert.deepEqual(downloads, [], "opening details never issues a download");
    await (button("Tải tài liệu").props.onPress as () => Promise<void>)();
    assert.deepEqual(downloads, [true]);
    publicMaterial = fixtureMaterial({
      title: "Tên phiên bản mới",
      description: "Thông tin tài liệu hiện tại",
      accessType: "PAID",
      priceCredit: "20.00",
      listingVersion: 3,
    });
    tree = render();
    assert.ok(tree.some((node) => node.props.children === "Tên phiên bản mới"));
    assert.ok(
      tree.some(
        (node) => node.props.children === "Thông tin tài liệu hiện tại",
      ),
    );
    assert.equal(
      tree.find((node) => node.type === "Cover")!.props.material,
      publicMaterial,
    );
    const contents = tree.map(text).join(" ");
    assert.match(contents, /Tên lúc mua: Tên lúc mua/);
    assert.match(contents, /Tệp đã mua: ban-cu\.pdf/);
    assert.match(contents, /Giá lúc mua: 10 CR/);
    assert.match(contents, /Bản đã mua v1/);
    assert.equal(order.grossCredit, "10.00");
    (
      tree.find((node) => node.type === "Pressable")!.props
        .onPress as () => void
    )();
    assert.equal(route, `/materials/${order.materialId}`);
    publicMaterial = undefined;
    publicError = new Error("Current metadata unavailable");
    tree = render();
    assert.ok(tree.some((node) => node.props.children === "Tên lúc mua"));
    assert.match(tree.map(text).join(" "), /Thông tin hiện tại chưa khả dụng/);
    assert.equal(button("Tải tài liệu").props.disabled, false);
    (button("Viết đánh giá").props.onPress as () => void)();
    assert.equal(route, `/materials/${order.materialId}/review`);
    issued?.();
    assert.deepEqual(invalidations, [
      { queryKey: ["owner", 1, "materials", "orders"] },
      {
        queryKey: [
          "owner",
          1,
          "materials",
          "review-eligibility",
          order.materialId,
        ],
      },
    ]);
    order.review = {
      hasReview: true,
      reviewId: materialOtherId,
      status: "HIDDEN",
      version: 2,
      sourceOrderId: order.id,
      canReview: false,
      reasonCode: "MATERIAL_REVIEW_ALREADY_EXISTS",
    };
    order.status = "REFUNDED";
    tree = render();
    (
      tree.find((node) => node.type === "Pressable")!.props
        .onPress as () => void
    )();
    assert.equal(route, `/materials/${order.materialId}`);
    assert.ok(button("Xem đánh giá"));
    assert.equal(
      tree.some(
        (node) =>
          node.type === "Button" && node.props.children === "Tải tài liệu",
      ),
      false,
    );
  } finally {
    contexts.reverse().forEach((context) => context.restore());
    delete local.cache[file];
  }
});

test("saved cover removal waits for explicit save and preserves listing version; changing cover overrides removal", async () => {
  const local = createRequire(
    new URL(
      "../src/features/materials/hooks/use-material-editor.ts",
      import.meta.url,
    ),
  );
  const material = fixtureMaterial();
  let state: unknown[] = [],
    slot = 0;
  const writes: unknown[] = [];
  const values = {
    skillId: material.skillId,
    title: material.title,
    description: material.description,
    accessType: "FREE",
    priceCredit: "0",
    rights: true,
  };
  const contexts = Object.entries({
    react: {
      useState: (initial: unknown) => {
        const n = slot++;
        if (!(n in state)) state[n] = initial;
        return [
          state[n],
          (next: unknown) => {
            state[n] = next;
          },
        ];
      },
    },
    "react-hook-form": {
      useForm: () => ({
        handleSubmit: (fn: (value: unknown) => unknown) => () => fn(values),
        reset() {},
      }),
    },
    "@hookform/resolvers/zod": { zodResolver: () => undefined },
    "expo-router": { useRouter: () => ({ replace() {} }) },
    "@/features/connections": {
      useConnections: () => ({ isCurrent: () => true }),
      useConnectionCommand: () => ({
        run: async (_key: string, fn: () => unknown) => fn(),
        pending: false,
        uncertain: false,
      }),
    },
    "./use-materials": {
      useMaterialsApi: () => ({
        update: async (...args: unknown[]) => {
          writes.push(args);
          return material;
        },
      }),
    },
    "./use-material-editor-recovery": {
      useMaterialEditorRecovery: () => ({
        material,
        adopt: () => material,
        loading: false,
        conflict: false,
      }),
    },
  }).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
  const file = local.resolve("./use-material-editor.ts");
  try {
    delete local.cache[file];
    const { useMaterialEditor } = local(file);
    const render = () => {
      slot = 0;
      return useMaterialEditor(material);
    };
    render().setRemoveCover(true);
    assert.equal(writes.length, 0);
    await render().save();
    assert.deepEqual(writes[0], [
      material.id,
      1,
      {
        skillId: values.skillId,
        title: values.title,
        description: values.description,
        accessType: "FREE",
        priceCredit: "0",
        distributionRightsConfirmed: true,
        coverFileId: null,
      },
    ]);
    render().setCoverFiles([
      { fileId: materialOtherId, state: "READY", name: "new.png" },
    ]);
    await render().save();
    assert.equal((writes[1] as unknown[])[1], 1);
    assert.equal(
      ((writes[1] as unknown[])[2] as { coverFileId: string }).coverFileId,
      materialOtherId,
    );
    render().resolveConflict(false);
    assert.equal(render().removeCover, false);
    assert.deepEqual(render().coverFiles, []);
  } finally {
    state = [];
    contexts.reverse().forEach((context) => context.restore());
    delete local.cache[file];
  }
});
