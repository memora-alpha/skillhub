import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as theme from "../src/constants/theme";

test("connection waiting screen renders neutral placeholders with one accessible loader", () => {
  const source = readFileSync(
    new URL("../src/components/ConnectionScreen.tsx", import.meta.url),
    "utf8",
  );
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  const exports: Record<string, () => unknown> = {};
  const jsx = (type: unknown, props: unknown) => ({ type, props });
  runInNewContext(compiled, {
    exports,
    require: (name: string) => {
      if (name === "react/jsx-runtime") return { jsx, jsxs: jsx };
      if (name === "react-native")
        return {
          View: "View",
          Text: "Text",
          StyleSheet: { create: (styles: unknown) => styles },
        };
      if (name === "./LoadingIndicator") return { LoadingIndicator: "Loader" };
      if (name === "./SafeArea") return { SafeAreaView: "SafeAreaView" };
      if (name === "./BrandLogo") return { BrandLogo: "Logo" };
      if (name === "@/constants/theme") return theme;
      throw new Error(`Unexpected waiting UI dependency: ${name}`);
    },
  });
  const nodes: { type: string; props: Record<string, unknown> }[] = [];
  function walk(node: unknown) {
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (!node || typeof node !== "object") return;
    const element = node as (typeof nodes)[number];
    nodes.push(element);
    walk(element.props?.children);
  }
  const tree = exports.ConnectionScreen!();
  walk(tree);
  assert.equal(nodes.filter((node) => node.type === "Loader").length, 1);
  assert.equal(
    nodes.find((node) => node.type === "Loader")?.props.accessibilityLabel,
    "Đang tải nội dung",
  );
  const placeholders = nodes.find((node) => node.props["aria-hidden"]);
  assert.ok(placeholders);
  assert.equal(
    placeholders.props.importantForAccessibility,
    "no-hide-descendants",
  );
  assert.equal((placeholders.props.children as unknown[]).length, 3);
  assert.doesNotMatch(
    JSON.stringify(tree),
    /ngoại tuyến|Wi-Fi|Thử lại|gián đoạn/,
  );
});
