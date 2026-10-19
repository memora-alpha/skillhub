import assert from "node:assert/strict";
import test from "node:test";
import { batch, ids, ownSkill } from "./skills-fixtures";
import { readHarness, sourceModule } from "./skills-read-harness";

type Tree = { type: string; props: Record<string, unknown> };
type ReadResult = {
  data?: unknown;
  readDenied?: unknown;
  canRead: () => boolean;
};
function children(tree: unknown): Tree[] {
  if (Array.isArray(tree)) return tree.flatMap(children);
  if (!tree || typeof tree !== "object" || !("props" in tree)) return [];
  const node = tree as Tree;
  return [node, ...children(node.props.children)];
}
function view(h: ReturnType<typeof readHarness>) {
  let navigations = 0;
  const mocks: Record<string, unknown> = {
    react: {
      useState: (v: unknown) => [v, () => {}],
      useRef: () => ({ current: null }),
    },
    "react-native": { Text: "Text", View: "View", FlatList: "FlatList" },
    "expo-router": {
      useRouter: () => ({
        push() {
          navigations++;
        },
      }),
    },
    "expo-linking": {
      openURL() {
        throw new Error("Private download must not mount");
      },
    },
    "../context/SkillsProvider": { useSkills: () => h.runtime },
    "../hooks/use-skill-queries": h.hooks,
    "../hooks/use-skill-action": {
      useSkillAction: () => ({ pending: false, locked: () => false }),
    },
    "../components/SkillsLayout": {
      SkillsLayout: "SkillsLayout",
      skillStyles: {},
    },
    "./SkillsLayout": { skillStyles: {} },
    "@/constants/theme": { appColors: {} },
  };
  for (const name of ["Button", "InfoModal", "FormNotice"])
    mocks[`@/components/${name}`] = { [name]: name };
  for (const name of [
    "SkillDetailHeader",
    "VerificationHistory",
    "QueryFeedback",
    "SubmittedEvidence",
    "SkillAction",
    "SkillCard",
    "SkillFilters",
  ]) {
    mocks[`../components/${name}`] = { [name]: name, PageFooter: "PageFooter" };
    mocks[`./${name}`] = mocks[`../components/${name}`];
  }
  return {
    render: (module: string, name: string, props?: unknown) =>
      sourceModule(module, mocks)[name]!(props) as Tree,
    navigations: () => navigations,
  };
}

test("skill detail unmounts private header/history/actions and old edit callbacks cannot navigate after denial", async () => {
  const h = readHarness(),
    ui = view(h);
  const key = [...h.runtime.scope, "detail", ids.sharing];
  const render = () =>
    ui.render("screens/SkillDetailScreen.tsx", "SkillDetailScreen", {
      sharingSkillId: ids.sharing,
    });
  try {
    render();
    await h.fetch(key);
    const history = children(render()).find(
      (n) => n.type === "VerificationHistory",
    )!;
    const edit = (history.props.headerProps as { onEdit: () => void }).onEdit;
    h.status(403);
    await assert.rejects(h.fetch(key));
    edit();
    assert.equal(ui.navigations(), 0);
    assert.equal(
      children(render()).some((n) =>
        ["VerificationHistory", "InfoModal"].includes(n.type),
      ),
      false,
    );
    assert.equal(
      children(render()).some((n) => n.type === "QueryFeedback"),
      true,
    );
  } finally {
    h.client.clear();
  }
});

test("verification 404 hides cached reasons, evidence and private download buttons", async () => {
  const h = readHarness(),
    ui = view(h);
  const owner = [...h.runtime.scope, "detail", ids.sharing];
  const key = [
    ...h.runtime.scope,
    "verification",
    ids.sharing,
    ids.verification,
  ];
  const render = () =>
    ui.render(
      "screens/VerificationDetailScreen.tsx",
      "VerificationDetailScreen",
      { sharingSkillId: ids.sharing, verificationId: ids.verification },
    );
  try {
    render();
    await h.fetch(owner);
    render();
    await h.fetch(key);
    h.client.setQueryData(key, {
      ...batch,
      note: "private note",
      files: [
        {
          id: ids.file,
          mimeType: "application/pdf",
          approvalStatus: "PENDING",
        },
      ],
    });
    assert.ok(children(render()).some((n) => n.type === "SubmittedEvidence"));
    h.status(404);
    await assert.rejects(h.fetch(key));
    const denied = children(render());
    assert.equal(
      denied.some((n) => n.type === "SubmittedEvidence" || n.type === "Button"),
      false,
    );
    assert.equal(JSON.stringify(denied).includes("private note"), false);
  } finally {
    h.client.clear();
  }
});

test("history denial hides a submitted-verification overlay and the detail header", async () => {
  const h = readHarness(),
    ui = view(h);
  const key = [...h.runtime.scope, "history", ids.sharing];
  const render = () =>
    ui.render("components/VerificationHistory.tsx", "VerificationHistory", {
      id: ids.sharing,
      header: "Header",
      headerProps: { skill: ownSkill },
    });
  try {
    render();
    await h.fetch(key, true);
    h.runtime.submittedVerifications.set(ids.sharing, batch);
    h.status(404);
    await assert.rejects(h.fetch(key, true));
    const tree = render();
    assert.equal((tree.props.data as unknown[]).length, 0);
    assert.equal(
      children(tree.props.ListHeaderComponent).some((n) => n.type === "Header"),
      false,
    );
  } finally {
    h.client.clear();
  }
});

test("own-list denial hides recently created skill overlays and disables creation", async () => {
  const h = readHarness(),
    ui = view(h);
  const key = [...h.runtime.scope, "own", false, "ALL"];
  const render = () =>
    ui.render("screens/MySkillsScreen.tsx", "MySkillsScreen");
  try {
    render();
    await h.fetch(key, true);
    h.runtime.recentlyCreatedSkills.set(ids.sharing, ownSkill);
    h.status(403);
    await assert.rejects(h.fetch(key, true));
    const tree = children(render());
    assert.equal(
      (tree.find((n) => n.type === "FlatList")!.props.data as unknown[]).length,
      0,
    );
    assert.equal(
      tree.find((n) => n.type === "SkillAction")!.props.disabled,
      true,
    );
    assert.equal((h.hooks.useOwnSkills!() as ReadResult).canRead(), false);
  } finally {
    h.client.clear();
  }
});
