import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import ts from "typescript";
import { AppError } from "../src/lib/http/errors";
import { uuid } from "../src/lib/http/contracts";
import { fixtureId } from "./fixtures/learning-requests-data";
import { proposalFormValues } from "../src/features/proposals/schemas/api-proposal-form";

type Props = Record<string, unknown> & { children?: React.ReactNode };
function nodes(
  tree: React.ReactNode,
  type: string,
): React.ReactElement<Props>[] {
  if (Array.isArray(tree)) return tree.flatMap((child) => nodes(child, type));
  if (!React.isValidElement<Props>(tree)) return [];
  return [
    ...(tree.type === type ? [tree] : []),
    ...nodes(tree.props.children, type),
  ];
}
function load(file: string, mocks: Record<string, unknown>) {
  const source = readFileSync(new URL(file, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  });
  const exports: Record<string, (props: Props) => React.ReactNode> = {};
  runInNewContext(outputText, {
    exports,
    require: (name: string) => {
      if (name === "react/jsx-runtime") return jsxRuntime;
      if (name in mocks) return mocks[name];
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });
  return exports;
}
const components = {
  "@/components/Button": { Button: "Button" },
  "@/components/FormNotice": { FormNotice: "FormNotice" },
  "@/components/feature-page": {
    Copy: "Copy",
    FeaturePage: "FeaturePage",
    Panel: "Panel",
  },
};

test("an uncertain proposal form prevents all edits and new submissions", () => {
  const component = load(
    "../src/features/proposals/components/ApiProposalForm.tsx",
    {
      ...components,
      react: {
        useState: () => [true, () => {}],
        useRef: () => ({ current: null }),
      },
      "react-native": { View: "View" },
      "react-hook-form": {
        useForm: () => ({
          control: {},
          handleSubmit: () => () => {},
          formState: { errors: {} },
        }),
      },
      "@hookform/resolvers/zod": { zodResolver: () => undefined },
      "@/components/ControlledInput": { ControlledInput: "ControlledInput" },
      "@/components/choice-group": { ChoiceGroup: "ChoiceGroup" },
      "./proposal-template-field": {
        ProposalTemplateField: "ProposalTemplateField",
      },
      "../schemas/api-proposal-form": { proposalFormValues },
    },
  ).ApiProposalForm!;
  const tree = component({
    pending: false,
    locked: true,
    onSubmit: async () => {},
  });
  assert.equal(nodes(tree, "ControlledInput").length, 3);
  assert.equal(nodes(tree, "ProposalTemplateField").length, 2);
  assert.ok(
    nodes(tree, "ProposalTemplateField").every((n) => n.props.disabled),
  );
  assert.equal(nodes(tree, "ChoiceGroup").length, 0);
  for (const input of nodes(tree, "ControlledInput"))
    assert.equal(input.props.editable, false);
  for (const button of nodes(tree, "Button"))
    assert.equal(button.props.disabled, true);
  for (const input of nodes(
    component({ pending: false, locked: false }),
    "ControlledInput",
  ))
    assert.equal(input.props.editable, true);
});

test("proposal recovery remains usable after the source is no longer available and opens the recovered result", async () => {
  const firstError = new AppError("network"),
    retryError = new AppError("http", 503);
  let retries = 0;
  const routes: unknown[] = [];
  const command = {
    pending: false,
    uncertain: true,
    originalError: firstError,
    error: retryError,
    run: async () => {
      assert.fail("regular submission must stay blocked");
    },
    retry: async () => {
      retries++;
      return { id: fixtureId(500) };
    },
  };
  const query = {
    data: undefined as unknown,
    isLoading: false,
    isPending: false,
    isFetching: false,
  };
  const component = load(
    "../src/features/proposals/screens/ApiSendProposalScreen.tsx",
    {
      ...components,
      "expo-router": {
        useRouter: () => ({
          replace: (route: unknown) => routes.push(route),
          push: (route: unknown) => routes.push(route),
        }),
      },
      "@/components/EmptyState": { EmptyState: "EmptyState" },
      "@/features/learning-requests": { useRequestDetail: () => query },
      "@/features/skills": { usePublicSkill: () => query },
      "@/features/connections": {
        useConnections: () => ({ userId: fixtureId(1), isCurrent: () => true }),
        useConnectionCommand: () => command,
        ConnectionFeedback: "ConnectionFeedback",
      },
      "@/lib/http/contracts": { uuid },
      "../hooks/use-proposals-api": { useProposalsApi: () => ({}) },
      "../components/ApiProposalForm": { ApiProposalForm: "ApiProposalForm" },
    },
  ).ApiSendProposalScreen!;
  const props = { requestId: fixtureId(200) };
  const tree = component(props);
  assert.equal(nodes(tree, "ApiProposalForm").length, 0);
  assert.equal(nodes(tree, "EmptyState").length, 0);
  assert.ok(
    nodes(tree, "ConnectionFeedback").some(
      (node) => node.props.error === firstError,
    ),
  );
  assert.ok(
    nodes(tree, "ConnectionFeedback").some(
      (node) => node.props.error === retryError,
    ),
  );
  const buttons = nodes(tree, "Button");
  assert.equal(buttons[0]!.props.disabled, false);
  (buttons[0]!.props.onPress as () => void)();
  await new Promise<void>((resolve) => queueMicrotask(resolve));
  assert.equal(retries, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(routes[0])), {
    pathname: "/proposal/[id]",
    params: { id: fixtureId(500) },
  });
  (buttons[1]!.props.onPress as () => void)();
  assert.deepEqual(JSON.parse(JSON.stringify(routes[1])), {
    pathname: "/proposals",
    params: { tab: "sent" },
  });
  query.data = {
    owner: { id: fixtureId(2), displayName: "Người học" },
    status: "OPEN",
    title: "Muốn học TypeScript cơ bản",
    skill: { name: "TypeScript" },
  };
  const form = nodes(component(props), "ApiProposalForm")[0]!;
  assert.equal(form.props.locked, true);
  await (form.props.onSubmit as (hints: unknown) => Promise<void>)({});
  command.pending = true;
  assert.ok(
    nodes(component(props), "Button").every((node) => node.props.disabled),
  );
});

for (const source of [
  {
    props: { requestId: fixtureId(200) },
    body: { sourceType: "LEARNING_REQUEST", learningRequestId: fixtureId(200) },
  },
  {
    props: { userId: fixtureId(2), sharingSkillId: fixtureId(300) },
    body: {
      sourceType: "DIRECT_SEARCH",
      recipientSharingSkillId: fixtureId(300),
    },
  },
]) {
  test(`${source.body.sourceType}: send screen carries supported hints into the API call`, async () => {
    const calls: { body: unknown; key: string }[] = [];
    const fingerprints: string[] = [];
    const query = {
      data: {
        owner: { id: fixtureId(2), displayName: "Người học" },
        status: "OPEN",
        title: "Muốn học TypeScript cơ bản",
        skill: { name: "TypeScript" },
      },
      isLoading: false,
      isFetching: false,
    };
    const component = load(
      "../src/features/proposals/screens/ApiSendProposalScreen.tsx",
      {
        ...components,
        "expo-router": { useRouter: () => ({ replace() {} }) },
        "@/components/EmptyState": { EmptyState: "EmptyState" },
        "@/features/learning-requests": { useRequestDetail: () => query },
        "@/features/skills": { usePublicSkill: () => query },
        "@/features/connections": {
          useConnections: () => ({
            userId: fixtureId(1),
            isCurrent: () => true,
          }),
          useConnectionCommand: () => ({
            pending: false,
            uncertain: false,
            run: async (
              fingerprint: string,
              send: (key: string) => Promise<unknown>,
            ) => {
              fingerprints.push(fingerprint);
              return send("same-proposal-key");
            },
          }),
          ConnectionFeedback: "ConnectionFeedback",
        },
        "@/lib/http/contracts": { uuid },
        "../hooks/use-proposals-api": {
          useProposalsApi: () => ({
            create: async (body: unknown, key: string) => {
              calls.push({ body, key });
              return { id: fixtureId(500) };
            },
          }),
        },
        "../components/ApiProposalForm": { ApiProposalForm: "ApiProposalForm" },
      },
    ).ApiSendProposalScreen!;
    const tree = component(source.props);
    assert.equal(
      nodes(tree, "FeaturePage")[0]!.props.keyboardDismissMode,
      "none",
    );
    const form = nodes(tree, "ApiProposalForm")[0]!;
    const message = "Tôi có thể hướng dẫn bạn học TypeScript.";
    await (form.props.onSubmit as (hints: unknown) => Promise<void>)({
      message,
      exchangeTypeHint: "TWO_WAY",
      proposedCredit: "200",
      initialSessionCount: 10,
      proposedDurationMinutes: 90,
      candidateSlots: null,
    });
    assert.deepEqual(JSON.parse(JSON.stringify(calls)), [
      {
        body: {
          message,
          ...source.body,
          exchangeTypeHint: "TWO_WAY",
          proposedCredit: "200",
          initialSessionCount: 10,
          proposedDurationMinutes: 90,
          candidateSlots: null,
        },
        key: "same-proposal-key",
      },
    ]);
    assert.equal(fingerprints[0], JSON.stringify(calls[0]!.body));
  });
}
