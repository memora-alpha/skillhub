import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as theme from "../src/constants/theme";
import * as pullRefresh from "../src/utils/pull-refresh";

test("web pull survives callback changes during a gesture and uses the latest refresh", () => {
  const listeners = new Map<string, (event: unknown) => void>();
  const node = {
    addEventListener: (name: string, listener: (event: unknown) => void) =>
      listeners.set(name, listener),
    removeEventListener: (name: string) => listeners.delete(name),
    setPointerCapture: () => {},
  };
  const refs: { current: unknown }[] = [];
  let refIndex = 0;
  let pull = 0;
  let deps: unknown[] | undefined;
  let cleanup: (() => void) | undefined;
  const jsx = (type: unknown, props: unknown) => ({ type, props });
  const exports: Record<string, (props: unknown) => unknown> = {};
  const source = readFileSync(
    new URL("../src/components/PullRefreshBoundary.tsx", import.meta.url),
    "utf8",
  );
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  runInNewContext(compiled, {
    exports,
    Element: class {},
    window: { getSelection: () => null },
    require: (name: string) => {
      if (name === "react/jsx-runtime") return { jsx, jsxs: jsx };
      if (name === "react")
        return {
          useRef: (value: unknown) => {
            const index = refIndex++;
            return (refs[index] ??= { current: value === null ? node : value });
          },
          useState: () => [
            pull,
            (value: number) => {
              pull = value;
            },
          ],
          useEffect: (effect: () => () => void, next: unknown[]) => {
            if (deps && next.every((value, index) => value === deps![index]))
              return;
            cleanup?.();
            deps = next;
            cleanup = effect();
          },
        };
      if (name === "react-native")
        return { Platform: { OS: "web" }, View: "View", Text: "Text" };
      if (name === "@/constants/theme") return theme;
      if (name === "@/utils/pull-refresh") return pullRefresh;
      if (name === "./LoadingIndicator") return { LoadingIndicator: "Loader" };
      throw new Error(`Unexpected web pull dependency: ${name}`);
    },
  });
  const scrollY = { current: 0 };
  const render = (refresh: () => void) => {
    refIndex = 0;
    return exports.PullRefreshBoundary!({
      children: "content",
      enabled: true,
      refreshing: false,
      refresh,
      scrollY,
    });
  };
  const pointer = (x: number, y: number) => ({
    pointerType: "mouse",
    button: 0,
    pageX: x,
    pageY: y,
    pointerId: 1,
    target: null,
    preventDefault: () => {},
  });
  let oldCalls = 0,
    newCalls = 0;
  try {
    const original = () => {
      oldCalls++;
    };
    render(original);
    listeners.get("pointerdown")!(pointer(0, 0));
    listeners.get("pointermove")!(pointer(0, 80));
    assert.equal(pull, 64);
    render(() => {
      newCalls++;
    });
    listeners.get("pointerup")!(pointer(0, 80));
    assert.equal(oldCalls, 0);
    assert.equal(
      newCalls,
      1,
      "a parent rerender must not discard an armed gesture",
    );
    assert.equal(pull, 0);
  } finally {
    cleanup?.();
  }
  assert.equal(listeners.size, 0);
});
