import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import { fixtureMaterial } from "./fixtures/materials-data";

type Node = { type: unknown; props: Record<string, unknown> };
function nodes(value: unknown): Node[] {
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!value || typeof value !== "object" || !("props" in value)) return [];
  const node = value as Node;
  return [node, ...nodes(node.props.children)];
}

for (const owner of [true, false]) {
  test(`${owner ? "owner actions" : "refunds"} keep hub navigation locked through pending and uncertain results, and release it after recovery`, () => {
    const local = createRequire(
      new URL(
        `../src/features/materials/screens/${owner ? "posted-materials-content" : "material-library-screen"}.tsx`,
        import.meta.url,
      ),
    );
    const command: {
      pending: boolean;
      uncertain: boolean;
      resetFeedback: () => void;
      run: (action: string, row: unknown) => Promise<void>;
    } = {
      pending: false,
      uncertain: false,
      resetFeedback() {},
      run: async (action, row) => {
        sends.push([action, row]);
      },
    };
    const sends: unknown[] = [];
    const runtime = { enabled: true, key: ["owner", 1], isCurrent: () => true };
    const query = {
      items: [] as ReturnType<typeof fixtureMaterial>[],
      data: {},
      isFetching: false,
      refetch: async () => ({}),
    };
    const state: unknown[] = [];
    let slot = 0;
    let locked: boolean | undefined;
    const cleanups: (() => void)[] = [];
    const jsx = (type: unknown, props: unknown) => ({ type, props });
    const stubs = {
      react: {
        useState: (initial: unknown) => {
          const n = slot++;
          if (!(n in state)) state[n] = initial;
          return [
            state[n],
            (value: unknown) => {
              state[n] = value;
            },
          ];
        },
        useEffect: (effect: () => (() => void) | undefined) => {
          const cleanup = effect();
          if (cleanup) cleanups.push(cleanup);
        },
      },
      "react/jsx-runtime": { jsx, jsxs: jsx },
      "react-native": { View: "View", Text: "Text" },
      "expo-router": {
        useRouter: () => ({ push() {} }),
        useIsFocused: () => true,
        Redirect: "Redirect",
      },
      "@tanstack/react-query": { useQueryClient: () => ({}) },
      "@/features/connections": {
        useConnections: () => runtime,
        useConnectionCommand: () => command,
        ConnectionFeedback: "Feedback",
      },
      "@/features/wallet": { useRefreshWallet: () => () => {} },
      "@/components/RefreshableFlatList": { RefreshableFlatList: "List" },
      "@/components/use-visible-list-rows": {
        useVisibleListRows: () => ({ visibleIds: new Set() }),
      },
      "@/components/filter-bar": { FilterBar: "Filter" },
      "@/components/Input": { Input: "Input" },
      "@/components/Icon": { Icon: "Icon" },
      "@/components/Button": { Button: "Button" },
      "@/components/EmptyState": { EmptyState: "Empty" },
      "@/components/FormNotice": { FormNotice: "Notice" },
      "@/components/InfoModal": { InfoModal: "Modal" },
      "@/providers/ToastProvider": { useToast: () => ({ showToast() {} }) },
      "../hooks/use-materials": {
        useMyMaterialPages: () => query,
        useMaterialOrderPages: () => query,
        useMaterialsApi: () => ({}),
      },
      "../hooks/use-owner-material-actions": {
        useOwnerMaterialActions: () => command,
      },
      "../components/owner-material-card": { OwnerMaterialCard: "Card" },
      "../components/owner-material-dialogs": {
        OwnerMaterialDetails: "Details",
        OwnerMaterialActionDialog: "ActionDialog",
      },
      "../components/owner-material.styles": { ownerMaterialStyles: {} },
      "../components/material.styles": { materialStyles: {} },
      "../components/material-order-card": { MaterialOrderCard: "Card" },
      "../components/material-library-header": {
        MaterialLibraryHeader: "Filter",
      },
      "./free-materials-content": { FreeMaterialsContent: "Free" },
    };
    const contexts = Object.entries(stubs).map(([name, namedExports]) =>
      mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
    );
    const file = local.resolve(
      owner
        ? "./posted-materials-content.tsx"
        : "./material-library-screen.tsx",
    );
    try {
      delete local.cache[file];
      const module = local(file);
      const props = {
        onCreateDisabledChange() {},
        onMutationLockChange: (value: boolean) => {
          locked = value;
        },
      };
      const render = () => {
        slot = 0;
        let root = owner
          ? module.PostedMaterialsContent(props)
          : module.MaterialLibraryContent(props);
        if (!owner) root = root.type(root.props);
        const list = nodes(root).find((node) => node.type === "List")!;
        return {
          header: nodes(list.props.ListHeaderComponent),
          empty: list.props.ListEmptyComponent as Node,
          dialog: nodes(root).find((node) => node.type === "ActionDialog"),
          renderItem: list.props.renderItem as (props: unknown) => Node,
        };
      };
      const initial = render();
      assert.equal(locked, false);
      if (owner) {
        (
          initial.header.find((node) => node.type === "Filter")!.props
            .onChange as (value: string) => void
        )("ARCHIVED");
        assert.equal(render().empty.props.action, "Bỏ bộ lọc");
      }
      for (const uncertain of [false, true]) {
        command.pending = !uncertain;
        command.uncertain = uncertain;
        const tree = render();
        assert.equal(locked, true);
        assert.equal(
          tree.header.find((node) => node.type === "Filter")!.props.disabled,
          true,
        );
        if (owner) {
          assert.equal(tree.empty.props.action, undefined);
          (tree.empty.props.onAction as () => void)();
          assert.equal(
            render().header.find((node) => node.type === "Filter")!.props.value,
            "ARCHIVED",
          );
        }
      }
      command.uncertain = false;
      render();
      assert.equal(locked, false);
      query.isFetching = true;
      render();
      assert.equal(
        locked,
        false,
        "background reads must not trap users in a hub tab",
      );
      cleanups.at(-1)?.();
      assert.equal(locked, false);
      if (owner) {
        query.isFetching = false;
        const draft = fixtureMaterial();
        query.items = [draft];
        const card = render().renderItem({ item: draft });
        (card.props.onSubmit as () => void)();
        assert.equal(
          sends.length,
          0,
          "sending a draft opens confirmation without POST",
        );
        assert.equal(render().dialog?.props.action, "submit");
        assert.equal(render().dialog?.props.material, draft);
        (render().dialog!.props.onClose as () => void)();
        assert.equal(
          sends.length,
          0,
          "cancelling draft submission cannot send",
        );
        assert.equal(render().dialog?.props.material, undefined);
        (card.props.onSubmit as () => void)();
        (render().dialog!.props.onConfirm as () => void)();
        assert.deepEqual(sends, [["submit", draft]]);
      }
    } finally {
      contexts.reverse().forEach((context) => context.restore());
      delete local.cache[file];
    }
  });
}
