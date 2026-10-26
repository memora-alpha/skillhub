import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import ts from "typescript";
import * as theme from "../src/constants/theme";
import * as profileTheme from "../src/features/profile/constants/theme";
import {
  demoNotifications,
  popularSkills,
  recentMessages,
} from "../src/mocks/app";

// Web permits raw text in containers. Validate the native host-tree constraint
// against the real notice components, including text returned by a component.
function assertNativeText(node: React.ReactNode, insideText = false): void {
  if (typeof node === "string" || typeof node === "number") {
    assert.ok(
      insideText,
      "Text strings must be rendered within a <Text> component.",
    );
    return;
  }
  if (Array.isArray(node)) {
    node.forEach((child) => assertNativeText(child, insideText));
    return;
  }
  if (!React.isValidElement<{ children?: React.ReactNode }>(node)) return;
  if (node.type === React.Fragment) {
    assertNativeText(node.props.children, insideText);
    return;
  }
  if (typeof node.type === "function") {
    const elementProps = node.props;
    const render = node.type as (props: typeof elementProps) => React.ReactNode;
    assertNativeText(render(elementProps), insideText);
    return;
  }
  assertNativeText(node.props.children, node.type === "Text");
}

type NoticeProps = {
  notice: string | null;
  body: string;
  query: string;
  onQueryChange: () => void;
  onSkillPress: () => void;
};
function loadNotice(file: string, component: string) {
  const source = readFileSync(new URL(file, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  });
  const exports: Record<string, (props: NoticeProps) => React.ReactNode> = {};
  const unusedImports = new Set([
    "@/components/SafeArea",
    "expo-router",
    "@/features/auth",
    "@/features/shell",
    "@/components/InfoModal",
    "@/components/LogoutDialog",
    "@/components/KeyboardFormScrollView",
    "@/components/RefreshableScrollView",
    "@/constants/navigation",
    "../context/ProfilePreview",
    "./AccountMenu",
    "./AppHeader",
    "@/components/LoadingScreenBoundary",
    "@/components/ScreenLoadingBoundary",
  ]);
  runInNewContext(
    `${outputText}\nexports.Notice = ${component};`,
    {
      exports,
      require: (name: string) => {
        if (name === "react") return React;
        if (name === "react/jsx-runtime") return jsxRuntime;
        if (name === "react-native")
          return {
            Text: "Text",
            View: "View",
            StyleSheet: { create: (styles: unknown) => styles },
          };
        if (name === "@/constants/theme") return theme;
        if (name === "../constants/theme") return profileTheme;
        if (name === "@/mocks/app")
          return { demoNotifications, popularSkills, recentMessages };
        if (name === "./ProfilePrimitives")
          return { profileStyles: { body: {}, label: {}, caption: {} } };
        if (name === "./HomeSearch")
          return { HomeSearch: () => React.createElement("View") };
        if (name === "@/components/Tag")
          return {
            Tag: ({ label }: { label: string }) =>
              React.createElement("Text", null, label),
          };
        if (unusedImports.has(name)) return {};
        throw new Error(`Unexpected notice dependency: ${name}`);
      },
    },
    { filename: file },
  );
  const Notice = exports.Notice;
  assert.ok(Notice, "Notice component must be exported by the test loader");
  return Notice;
}
const ProfileNotice = loadNotice(
  "../src/features/profile/components/ProfileLayout.tsx",
  "ProfileNoticeContent",
);
const ScreenNotice = loadNotice(
  "../src/features/shell/components/AppScreenLayout.tsx",
  "ScreenNoticeContent",
);
const props = {
  notice: null,
  body: "Chức năng chưa được kết nối.",
  query: "React",
  onQueryChange: () => {},
  onSkillPress: () => {},
};

test("native text validator detects raw strings returned by nested components", () => {
  const RawContent = () => "Unsafe raw notice";
  assert.throws(
    () =>
      assertNativeText(
        React.createElement("View", null, React.createElement(RawContent)),
      ),
    /within a <Text>/,
  );
});

test("profile notices render their fallback body and structured branches inside Text", () => {
  for (const notice of [
    null,
    "Ví Credit",
    "Thành tích",
    "Thông báo",
    "Tin nhắn",
  ])
    assertNativeText(
      React.createElement(
        "ScrollView",
        null,
        React.createElement(ProfileNotice, { ...props, notice }),
      ),
    );
});

test("shared screen notices render fallback, notifications and search without raw native text", () => {
  for (const notice of [null, "Trợ giúp", "Thông báo", "Tìm kiếm"])
    assertNativeText(
      React.createElement(
        "ScrollView",
        null,
        React.createElement(ScreenNotice, { ...props, notice }),
      ),
    );
});
