import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import { fixtureMaterial, materialOtherId } from "./fixtures/materials-data";

type Node = { type: unknown; props: Record<string, unknown> };
function nodes(value: unknown): Node[] {
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!value || typeof value !== "object" || !("props" in value)) return [];
  const node = value as Node;
  return [node, ...nodes(node.props.children)];
}
test("free history never bypasses purchased-snapshot confirmation or unresolved ownership, and reads only visible rows", () => {
  const local = createRequire(
    new URL(
      "../src/features/materials/components/free-material-card.tsx",
      import.meta.url,
    ),
  );
  const starts: boolean[] = [],
    reads: boolean[] = [];
  let ownership: { data: unknown; isFetching: boolean; error?: unknown } = {
    data: undefined,
    isFetching: true,
  };
  const jsx = (type: unknown, props: unknown) => ({ type, props });
  const contexts = Object.entries({
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "react-native": { View: "View", Text: "Text", Pressable: "Pressable" },
    "expo-router": { useRouter: () => ({ push() {} }) },
    "@tanstack/react-query": {
      useQueryClient: () => ({ invalidateQueries() {} }),
    },
    "@/features/connections": {
      useConnections: () => ({ key: ["account", 1], userId: materialOtherId }),
    },
    "@/components/Button": { Button: "Button" },
    "../hooks/use-materials": {
      useMaterialOwnership: (_id: string, enabled: boolean) => {
        reads.push(enabled);
        return ownership;
      },
    },
    "../hooks/use-material-reviews": {
      useMaterialReviewEligibility: () => ({
        data: { canReview: true },
        isFetching: false,
      }),
    },
    "../hooks/use-material-download": {
      useMaterialDownload: () => ({
        pending: false,
        awaitingConfirmation: false,
        start: (bought: boolean) => starts.push(bought),
      }),
    },
    "./material-cover": { MaterialCover: "Cover" },
    "./material-download-feedback": {
      MaterialDownloadFeedback: "DownloadFeedback",
    },
    "./material.styles": { materialStyles: {} },
  }).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
  const file = local.resolve("./free-material-card.tsx");
  try {
    delete local.cache[file];
    const { FreeMaterialCard } = local(file);
    const access = {
      accessSource: "FREE_PUBLIC",
      material: fixtureMaterial({ status: "PUBLISHED" }),
      firstAccessedAt: "2026-11-16T03:00:00Z",
      lastAccessedAt: "2026-11-16T03:00:00Z",
    };
    const button = (visible = true) =>
      nodes(FreeMaterialCard({ access, visible })).find(
        (node) => node.props.children === "Tải tài liệu",
      )!;
    for (const value of [
      { data: undefined, isFetching: true },
      { data: null, isFetching: false, error: new Error("read failed") },
      { data: { id: "order" }, isFetching: true },
    ]) {
      ownership = value;
      assert.equal(button().props.disabled, true);
      (button().props.onPress as () => void)();
    }
    assert.deepEqual(starts, []);
    ownership = { data: { id: "order" }, isFetching: false };
    (button().props.onPress as () => void)();
    ownership = { data: null, isFetching: false };
    (button().props.onPress as () => void)();
    assert.deepEqual(starts, [true, false]);
    button(false);
    assert.equal(reads.at(-1), false);
  } finally {
    contexts.reverse().forEach((context) => context.restore());
    delete local.cache[file];
  }
});
