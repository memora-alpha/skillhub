import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import ts from "typescript";

export type Props = Record<string, unknown> & { children?: React.ReactNode };
export function nodes(
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
export function load(file: string, mocks: Record<string, unknown>) {
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
    setTimeout,
    clearTimeout,
    require: (name: string) => {
      if (name === "react/jsx-runtime") return jsxRuntime;
      if (name in mocks) return mocks[name];
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });
  return exports;
}
export const components = {
  "@/components/Button": { Button: "Button" },
  "@/components/FormNotice": { FormNotice: "FormNotice" },
  "@/components/EmptyState": { EmptyState: "EmptyState" },
  "@/components/feature-page": {
    ui: { page: {} },
    Copy: "Copy",
    FeaturePage: "FeaturePage",
    Panel: "Panel",
    RouteButton: "RouteButton",
  },
};
