import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import { fixtureMaterial } from "./fixtures/materials-data";

type Node = { type: unknown; props: Record<string, unknown>; key?: string };
function nodes(value: unknown): Node[] {
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!value || typeof value !== "object" || !("props" in value)) return [];
  const node = value as Node;
  return [node, ...nodes(node.props.children)];
}
test("owner editor waits for a fresh version before mounting, then retains its draft while background reads run or fail", () => {
  const local = createRequire(
    new URL(
      "../src/features/materials/screens/owner-screens.tsx",
      import.meta.url,
    ),
  );
  const file = local.resolve("./owner-screens.tsx");
  const stale = fixtureMaterial(),
    fresh = fixtureMaterial({ listingVersion: 2 });
  let id: string | undefined = stale.id;
  let opened: unknown;
  let freshRequested = false;
  const query = {
    data: stale as typeof stale | undefined,
    isSuccess: true,
    isFetching: true,
    isLoading: false,
    error: undefined as unknown,
    denied: false,
    refetch: async () => {},
  };
  const jsx = (type: unknown, props: unknown, key?: string) => ({
    type,
    props,
    key,
  });
  const contexts = Object.entries({
    react: {
      useState: (initial: unknown) => {
        if (opened === undefined) opened = initial;
        return [
          opened,
          (value: unknown) => {
            opened = value;
          },
        ];
      },
      useEffect: (effect: () => void) => effect(),
    },
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "expo-router": { useLocalSearchParams: () => ({ id }) },
    "@/components/feature-page": { FeaturePage: "Page", Copy: "Copy" },
    "@/features/connections": {
      useConnections: () => ({ key: ["owner", 1] }),
      ConnectionFeedback: "Feedback",
    },
    "../hooks/use-materials": {
      useOwnerMaterial: (requestedId?: string) => {
        freshRequested = requestedId === stale.id;
        return query;
      },
    },
    "../components/material-editor-form": { MaterialEditorForm: "Form" },
  }).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
  try {
    delete local.cache[file];
    const { MaterialEditorScreen } = local(file);
    const render = () => {
      const root = MaterialEditorScreen();
      return nodes(root.type(root.props));
    };
    assert.equal(
      render().some((node) => node.type === "Form"),
      false,
      "cached version must not initialize the editable draft",
    );
    assert.equal(freshRequested, true);
    query.isFetching = false;
    query.data = fresh;
    render();
    const form = render().find((node) => node.type === "Form")!;
    assert.equal(form.props.material, fresh);
    query.isFetching = true;
    const duringRead = render().find((node) => node.type === "Form")!;
    assert.equal(duringRead.key, form.key);
    assert.equal(duringRead.props.readBlocked, true);
    query.isFetching = false;
    query.error = new Error("offline");
    assert.equal(
      render().find((node) => node.type === "Form")?.props.readBlocked,
      true,
    );
    query.error = undefined;
    assert.equal(
      render().find((node) => node.type === "Form")?.props.readBlocked,
      false,
    );
    id = undefined;
    opened = undefined;
    query.data = undefined;
    assert.ok(
      render().find((node) => node.type === "Form"),
      "new documents do not wait for owner history",
    );
    id = "invalid-id";
    opened = undefined;
    query.isSuccess = false;
    const invalid = render();
    assert.equal(
      invalid.some((node) => node.type === "Form"),
      false,
    );
    assert.ok(
      invalid.some((node) => node.type === "Copy"),
      "invalid edit links explain the missing document",
    );
  } finally {
    contexts.reverse().forEach((context) => context.restore());
    delete local.cache[file];
  }
});
