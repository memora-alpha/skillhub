import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";

type Node = { type: unknown; props: Record<string, unknown>; key?: string };
function nodes(value: unknown): Node[] {
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!value || typeof value !== "object" || !("props" in value)) return [];
  const node = value as Node;
  return [node, ...nodes(node.props.children)];
}
test("my materials opens the library, separates posted and unavailable saved, and scopes its content to the account", () => {
  const local = createRequire(
    new URL(
      "../src/features/materials/screens/my-materials-screen.tsx",
      import.meta.url,
    ),
  );
  let tab: string | undefined;
  let user = "owner-a";
  const jsx = (type: unknown, props: unknown, key?: string) => ({
    type,
    props,
    key,
  });
  const contexts = Object.entries({
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "react-native": {
      View: "View",
      Text: "Text",
      Pressable: "Pressable",
      Platform: { OS: "web" },
      StyleSheet: { create: (styles: unknown) => styles },
    },
    "expo-router": {
      useLocalSearchParams: () => ({ tab }),
      useRouter: () => ({
        setParams: (value: { tab: string }) => {
          tab = value.tab;
        },
      }),
    },
    "@/components/feature-page": { FeaturePage: "Page" },
    "@/components/EmptyState": { EmptyState: "EmptyState" },
    "@/features/connections": {
      useConnections: () => ({ key: ["connections", user, 1] }),
    },
    "./posted-materials-content": { PostedMaterialsContent: "Posted" },
    "./material-library-screen": { MaterialLibraryContent: "Library" },
  }).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
  const file = local.resolve("./my-materials-screen.tsx");
  try {
    delete local.cache[file];
    const { MyMaterialsScreen } = local(file);
    const render = () => {
      const root = MyMaterialsScreen();
      return { root, tree: nodes(root.type(root.props)) };
    };
    const first = render();
    assert.ok(first.tree.some((node) => node.type === "Library"));
    assert.equal(
      first.tree.some((node) => node.type === "Posted"),
      false,
    );
    (
      first.tree.find(
        (node) =>
          typeof node.type === "function" &&
          node.type.name === "MyMaterialTabs",
      )!.props.onChange as (tab: string) => void
    )("posted");
    assert.ok(render().tree.some((node) => node.type === "Posted"));
    assert.equal(
      render().tree.some((node) => node.type === "Library"),
      false,
    );
    tab = "saved";
    const saved = render().tree;
    assert.equal(
      saved.find((node) => node.type === "EmptyState")?.props.title,
      "Lưu yêu thích chưa khả dụng",
    );
    assert.equal(
      saved.some((node) => node.type === "Library" || node.type === "Posted"),
      false,
    );
    user = "owner-b";
    assert.notEqual(render().root.key, first.root.key);
    tab = "unknown";
    assert.ok(render().tree.some((node) => node.type === "Library"));
  } finally {
    contexts.reverse().forEach((context) => context.restore());
    delete local.cache[file];
  }
});
