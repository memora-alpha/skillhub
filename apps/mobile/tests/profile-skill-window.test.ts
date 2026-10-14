import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

type WindowProps = {
  count: number;
  hasNextPage?: boolean;
  fetchNextPage?: () => Promise<{ isError: boolean }>;
};
type SkillWindow = {
  visible: number;
  busy: boolean;
  hasMore: boolean;
  showMore: () => Promise<void>;
};
function deferred() {
  let resolve!: (value: { isError: boolean }) => void;
  const promise = new Promise<{ isError: boolean }>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

// Execute the actual hook with controllable navigation and delayed page reads.
function harness(props: WindowProps) {
  const slots: unknown[] = [];
  let cursor = 0;
  let enterFocus!: () => () => void;
  let leaveFocus!: () => void;
  const exports: {
    useProfileSkillWindow?: (props: WindowProps) => SkillWindow;
  } = {};
  const source = readFileSync(
    new URL(
      "../src/features/skills/hooks/use-profile-skill-window.ts",
      import.meta.url,
    ),
    "utf8",
  );
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  });
  runInNewContext(outputText, {
    exports,
    require: (name: string) => {
      if (name === "react")
        return {
          useCallback: (fn: unknown) => fn,
          useRef: (value: unknown) => {
            const index = cursor++;
            return (slots[index] ??= { current: value });
          },
          useState: (value: unknown) => {
            const index = cursor++;
            if (!(index in slots)) slots[index] = value;
            return [
              slots[index],
              (next: unknown) => {
                slots[index] =
                  typeof next === "function" ? next(slots[index]) : next;
              },
            ];
          },
        };
      if (name === "expo-router")
        return {
          useFocusEffect: (fn: typeof enterFocus) => {
            enterFocus = fn;
          },
        };
      throw new Error(`Unexpected hook dependency: ${name}`);
    },
  });
  const render = () => {
    cursor = 0;
    return exports.useProfileSkillWindow!(props);
  };
  render();
  leaveFocus = enterFocus();
  return {
    render,
    blur: () => leaveFocus(),
    focus: () => {
      leaveFocus = enterFocus();
    },
  };
}

test("a page completion from a previous focus cannot expand the restored five-row profile", async () => {
  const page = deferred();
  const view = harness({
    count: 5,
    hasNextPage: true,
    fetchNextPage: () => page.promise,
  });
  const load = view.render().showMore();
  assert.equal(view.render().busy, true);
  view.blur();
  view.focus();
  assert.equal(view.render().visible, 5);
  assert.equal(view.render().busy, false);
  page.resolve({ isError: false });
  await load;
  assert.equal(view.render().visible, 5);
  assert.equal(view.render().busy, false);
});

test("an old page completion cannot unlock a newer request after returning to profile", async () => {
  const oldPage = deferred(),
    newPage = deferred();
  let calls = 0;
  const view = harness({
    count: 5,
    hasNextPage: true,
    fetchNextPage: () => (++calls === 1 ? oldPage.promise : newPage.promise),
  });
  const oldLoad = view.render().showMore();
  view.blur();
  view.focus();
  const newLoad = view.render().showMore();
  oldPage.resolve({ isError: false });
  await oldLoad;
  assert.equal(view.render().busy, true);
  assert.equal(view.render().visible, 5);
  await view.render().showMore();
  assert.equal(calls, 2);
  newPage.resolve({ isError: false });
  await newLoad;
  assert.equal(view.render().visible, 10);
  assert.equal(view.render().busy, false);
});

test("a failed next-page read preserves the row limit and remains explicitly retryable", async () => {
  let calls = 0;
  const view = harness({
    count: 5,
    hasNextPage: true,
    fetchNextPage: async () => ({ isError: ++calls === 1 }),
  });
  await view.render().showMore();
  assert.equal(view.render().visible, 5);
  assert.equal(view.render().busy, false);
  assert.equal(view.render().hasMore, true);
  await view.render().showMore();
  assert.equal(view.render().visible, 10);
  assert.equal(calls, 2);
});
