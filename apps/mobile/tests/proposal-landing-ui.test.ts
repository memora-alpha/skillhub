import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import { fixtureId } from "./fixtures/learning-requests-data";

test("successful Request and direct proposals land in Sent; failed sends stay in the form", async () => {
  const local = createRequire(
    new URL(
      "../src/features/proposals/screens/ApiSendProposalScreen.tsx",
      import.meta.url,
    ),
  );
  const filename = local.resolve("./ApiSendProposalScreen.tsx");
  const routes: unknown[] = [];
  let failing = false;
  let eligibility: "eligible" | "missing" | "unverified" = "eligible";
  let duplicate: { id: string } | null = null;
  let preflightError: unknown;
  let createCount = 0;
  const request = {
    status: "OPEN",
    expiresAt: null,
    owner: { id: fixtureId(2), displayName: "Partner" },
    skill: { id: fixtureId(6), name: "React" },
  };
  const jsx = (type: unknown, props: unknown) => ({ type, props });
  const mocks = {
    "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "Fragment" },
    "expo-router": {
      useRouter: () => ({ dismissTo: (route: unknown) => routes.push(route) }),
    },
    "@/components/feature-page": { Copy: "Copy" },
    "@/components/learning-flow": { FlowPage: "Page", FlowSection: "Panel" },
    "@/components/EmptyState": { EmptyState: "EmptyState" },
    "@/components/Button": { Button: "Button" },
    "@/components/FormNotice": { FormNotice: "FormNotice" },
    "@/features/learning-requests": {
      useRequestDetail: () => ({
        data: request,
        isFetching: false,
        refetch: async () => ({ data: request }),
      }),
    },
    "@/features/skills": {
      usePublicSkill: () => ({
        data: { skill: { id: fixtureId(6), name: "React", status: "ACTIVE" } },
        isFetching: false,
        refetch: async () => ({
          data: {
            skill: { id: fixtureId(6), name: "React", status: "ACTIVE" },
          },
        }),
      }),
      useTeacherEligibility: () => ({
        data: { state: eligibility },
        isPending: false,
        isFetching: false,
        refetch: async () => ({ data: { state: eligibility } }),
      }),
    },
    "@/features/connections": {
      ConnectionFeedback: "Feedback",
      useConnections: () => ({ userId: fixtureId(1), isCurrent: () => true }),
      useParticipantProfile: () => ({ data: { fullName: "Partner" } }),
      useConnectionQuery: () => ({
        data: duplicate,
        error: preflightError,
        isPending: false,
        isFetching: false,
        refetch: async () => ({ data: duplicate, error: preflightError }),
      }),
      useConnectionCommand: () => ({
        pending: false,
        uncertain: false,
        run: async (
          _fingerprint: string,
          send: (key: string) => Promise<unknown>,
        ) => {
          try {
            return await send("intent");
          } catch {
            return undefined;
          }
        },
      }),
    },
    "../hooks/use-proposals-api": {
      useProposalsApi: () => ({
        create: async () => {
          createCount++;
          if (failing) throw new Error("network");
          return { id: fixtureId(3) };
        },
      }),
    },
    "../components/ApiProposalForm": { ApiProposalForm: "Form" },
    "../components/proposal-send-layout": { ProposalSendContext: "Context" },
    "../components/proposal-readiness": { ProposalReadiness: "Readiness" },
  };
  const contexts = Object.entries(mocks).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
  const forms = (
    tree: unknown,
  ): { disabled: boolean; onSubmit: (input: unknown) => Promise<void> }[] => {
    if (Array.isArray(tree)) return tree.flatMap(forms);
    if (!tree || typeof tree !== "object" || !("props" in tree)) return [];
    const element = tree as {
      type: unknown;
      props: {
        children?: unknown;
        disabled: boolean;
        onSubmit: (input: unknown) => Promise<void>;
      };
    };
    if (typeof element.type === "function")
      return forms(element.type(element.props));
    return element.type === "Form"
      ? [element.props]
      : forms(element.props.children);
  };
  try {
    delete local.cache[filename];
    const { ApiSendProposalScreen } = local(filename) as {
      ApiSendProposalScreen: (input: unknown) => unknown;
    };
    for (const input of [
      { requestId: fixtureId(4) },
      { userId: fixtureId(2), sharingSkillId: fixtureId(5) },
    ]) {
      const [form] = forms(ApiSendProposalScreen(input));
      assert.ok(form);
      await form.onSubmit({ message: "Hello" });
      assert.deepEqual(routes.at(-1), {
        pathname: "/proposals",
        params: { tab: "sent", status: "PENDING" },
      });
    }
    failing = true;
    const count = routes.length;
    await forms(
      ApiSendProposalScreen({ requestId: fixtureId(4) }),
    )[0]!.onSubmit({ message: "Keep this draft" });
    assert.equal(routes.length, count);
    failing = false;
    for (const state of ["missing", "unverified"] as const) {
      eligibility = state;
      const form = forms(
        ApiSendProposalScreen({ requestId: fixtureId(4) }),
      )[0]!;
      assert.equal(form.disabled, true);
      const before = createCount;
      await form.onSubmit({ message: "Keep this draft" });
      assert.equal(createCount, before);
    }
    eligibility = "eligible";
    duplicate = { id: fixtureId(9) };
    assert.equal(
      forms(ApiSendProposalScreen({ requestId: fixtureId(4) }))[0]!.disabled,
      true,
    );
    duplicate = null;
    preflightError = new Error("offline");
    assert.equal(
      forms(ApiSendProposalScreen({ requestId: fixtureId(4) }))[0]!.disabled,
      true,
    );
    preflightError = undefined;
    const form = forms(ApiSendProposalScreen({ requestId: fixtureId(4) }))[0]!;
    eligibility = "missing";
    const before = createCount;
    await form.onSubmit({ message: "Changed while typing" });
    assert.equal(createCount, before);
    const directForm = forms(
      ApiSendProposalScreen({
        userId: fixtureId(2),
        sharingSkillId: fixtureId(5),
      }),
    )[0]!;
    assert.equal(directForm.disabled, false);
    await directForm.onSubmit({ message: "Mình muốn học từ bạn" });
    assert.equal(createCount, before + 1);
  } finally {
    delete local.cache[filename];
    for (const context of contexts.reverse()) context.restore();
  }
});
