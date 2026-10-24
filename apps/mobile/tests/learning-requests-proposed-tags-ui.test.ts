import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as tagSchemas from "../src/features/learning-requests/schemas/request-tags";
import * as requestPolicy from "../src/features/learning-requests/utils/request-policy";
import {
  fixtureRequest,
  fixtureUsers,
  publicFixture,
} from "./fixtures/learning-requests-data";

type Element = { type: unknown; props: Record<string, unknown> };
function nodes(value: unknown): Element[] {
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!value || typeof value !== "object" || !("props" in value)) return [];
  const node = value as Element;
  return [node, ...nodes(node.props.children)];
}
function sourceModule(file: string, dependencies: Record<string, unknown>) {
  const source = readFileSync(
    new URL(
      `../src/features/learning-requests/components/${file}.tsx`,
      import.meta.url,
    ),
    "utf8",
  );
  const exports: Record<string, (props: Record<string, unknown>) => Element> =
    {};
  const jsx = (type: unknown, props: unknown) => ({ type, props });
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  runInNewContext(output, {
    exports,
    require: (name: string) => {
      if (name === "react/jsx-runtime") return { jsx, jsxs: jsx };
      if (name === "react-native")
        return { View: "View", Text: "Text", Pressable: "Pressable" };
      if (name === "../schemas/request-tags") return tagSchemas;
      if (name in dependencies) return dependencies[name];
      throw new Error(`Unexpected proposed tag UI dependency: ${name}`);
    },
  });
  return exports;
}

test("owner proposed-tag section keeps literal labels and hides when approval clears them", () => {
  const { RequestProposedTags } = sourceModule("request-proposed-tags", {
    "@/components/feature-page": { Copy: "Copy" },
    "./request-detail-section": { RequestDetailSection: "Section" },
    "./request-detail-tag": { RequestDetailTag: "Tag" },
  });
  const tree = RequestProposedTags!({ labels: ["OPEN", "React Native"] });
  assert.equal(tree.props.title, "Tag đề xuất");
  assert.deepEqual(
    nodes(tree)
      .filter((node) => node.type === "Tag")
      .map((node) => node.props.label),
    ["OPEN", "React Native"],
  );
  assert.equal(RequestProposedTags!({ labels: [] }), null);
});

test("request detail shows proposed labels only to the owner, including when a public payload contains extra fields", () => {
  const { RequestContent } = sourceModule("request-content", {
    "@/components/Icon": { Icon: "Icon" },
    "@/components/FormNotice": { FormNotice: "Notice" },
    "./request-detail-section": { RequestDetailSection: "Section" },
    "./request-detail-summary": { RequestDetailSummary: "Summary" },
    "./request-proposed-tags": { RequestProposedTags: "Proposals" },
    "./request-exchange-details": { RequestExchangeDetails: "Exchange" },
    "./request-schedule-details": { RequestScheduleDetails: "Schedule" },
    "./request-credit-details": { RequestCreditDetails: "Credit" },
    "./request-public-details": { RequestRequesterDetails: "Requester" },
    "../utils/request-policy": requestPolicy,
    "./request-detail.styles": {
      requestDetailColors: {},
      requestDetailStyles: {},
    },
  });
  const owner = fixtureRequest({
    proposedTags: ["React Native"],
    status: "PENDING_MODERATION",
  });
  const privateView = nodes(RequestContent!({ request: owner }));
  assert.deepEqual(
    privateView.find((node) => node.type === "Proposals")?.props.labels,
    owner.proposedTags,
  );
  const publicRequest = {
    ...publicFixture({ actor: fixtureUsers[0].id, request: owner }),
    proposedTags: owner.proposedTags,
  };
  const publicView = nodes(RequestContent!({ request: publicRequest }));
  assert.equal(
    publicView.some((node) => node.type === "Proposals"),
    false,
  );
});
