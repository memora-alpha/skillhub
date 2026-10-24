import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as theme from "../src/constants/theme";
import * as tagSchemas from "../src/features/learning-requests/schemas/request-tags";
import * as weekly from "../src/features/learning-requests/utils/request-weekly-slots";
import * as weeklyEditor from "../src/features/learning-requests/utils/request-weekly-editor";
import * as tagOptions from "../src/features/learning-requests/utils/request-tag-options";
import {
  requestDefaults,
  requestFormSchema,
  draftToInput,
} from "../src/features/learning-requests/schemas/request-form";
import { rebaseRequestDraft } from "../src/features/learning-requests/utils/request-recovery";
import { fixtureRequest } from "./fixtures/learning-requests-data";

type Node = { type: unknown; key?: string; props: Record<string, unknown> };
function nodes(value: unknown): Node[] {
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!value || typeof value !== "object" || !("props" in value)) return [];
  const node = value as Node;
  return [node, ...nodes(node.props.children)];
}
function action(node: Node, name: string, ...args: unknown[]) {
  (node.props[name] as (...args: unknown[]) => void)(...args);
}
function hooks() {
  let index = 0;
  const state: unknown[] = [];
  let effects: (() => void)[] = [];
  return {
    reset() {
      index = 0;
      effects = [];
    },
    flush() {
      effects.forEach((effect) => effect());
    },
    react: {
      useState(initial: unknown) {
        const slot = index++;
        if (!(slot in state)) state[slot] = initial;
        return [
          state[slot],
          (next: unknown) => {
            state[slot] = next;
          },
        ];
      },
      useRef(initial: unknown) {
        const slot = index++;
        if (!(slot in state)) state[slot] = { current: initial };
        return state[slot];
      },
      useEffect(callback: () => void) {
        effects.push(callback);
      },
    },
  };
}
function source(file: string, dependencies: Record<string, unknown>) {
  const text = readFileSync(
    new URL(`../src/features/learning-requests/${file}`, import.meta.url),
    "utf8",
  );
  const output = ts.transpileModule(text, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  const exports = {};
  const jsx = (type: unknown, props: unknown, key?: string) => ({
    type,
    props,
    key,
  });
  runInNewContext(output, {
    exports,
    setTimeout: (callback: () => void) => callback(),
    clearTimeout() {},
    require(name: string) {
      if (name === "react/jsx-runtime") return { jsx, jsxs: jsx };
      if (name === "react-native")
        return {
          View: "View",
          Text: "Text",
          Pressable: "Pressable",
          StyleSheet: { create: (value: unknown) => value },
        };
      if (name === "@/constants/theme") return theme;
      if (name === "@/components/Icon") return { Icon: "Icon" };
      if (name === "@/components/Button") return { Button: "Button" };
      if (name === "../schemas/request-tags") return tagSchemas;
      if (name === "../utils/request-tag-options") return tagOptions;
      if (name === "../utils/request-weekly-editor") return weeklyEditor;
      if (name in dependencies) return dependencies[name];
      throw new Error(`Unexpected compact form dependency: ${name}`);
    },
  });
  return exports;
}

function tagPicker(initial = fixtureRequest()) {
  const state = hooks();
  const draft = requestDefaults(initial);
  const errors: Record<string, unknown> = {};
  const form = {
    control: {},
    setValue(name: keyof typeof draft, value: unknown) {
      Object.assign(draft, { [name]: value });
    },
    clearErrors(name: string) {
      delete errors[name];
    },
  };
  let pending = false,
    disabled = false,
    error: unknown;
  let active = false;
  let queryText: string | undefined;
  const catalog = [
    { id: "react-id", label: "React" },
    { id: "native-id", label: "React Native" },
  ];
  const loaded = source("hooks/use-request-tag-picker.ts", {
    react: state.react,
    "react-hook-form": {
      useWatch: () => [draft.tagIds, draft.proposedTags],
      useController: () => ({
        field: {
          value: draft.tagSearch,
          onChange(value: string) {
            draft.tagSearch = value;
          },
        },
        fieldState: {},
      }),
    },
    "./use-request-options": {
      useTagOptions(keyword: string | undefined, enabled: boolean) {
        active = enabled;
        queryText = keyword;
        return {
          data: {
            pages: [
              {
                items: catalog.filter(
                  (tag) =>
                    !keyword ||
                    tag.label
                      .toLowerCase()
                      .includes(keyword.trim().toLowerCase()),
                ),
              },
            ],
          },
          isFetching: pending,
          isPending: pending,
          error,
        };
      },
    },
  }) as typeof import("../src/features/learning-requests/hooks/use-request-tag-picker");
  const render = () => {
    state.reset();
    const result = loaded.useRequestTagPicker(form as never, disabled);
    state.flush();
    return result;
  };
  return {
    draft,
    render,
    active: () => active,
    queryText: () => queryText,
    pending(value: boolean) {
      pending = value;
    },
    disabled(value: boolean) {
      disabled = value;
    },
    error(value: unknown) {
      error = value;
    },
  };
}

test("unfinished tag text blocks Save, survives conflict recovery and never enters the API payload", () => {
  const initial = fixtureRequest();
  const draft = { ...requestDefaults(initial), tagSearch: "Luyện phỏng vấn" };
  const parsed = requestFormSchema(initial).safeParse(draft);
  assert.equal(parsed.success, false);
  if (!parsed.success)
    assert.ok(
      parsed.error.issues.some((issue) => issue.path[0] === "tagSearch"),
    );
  assert.equal(
    rebaseRequestDraft(initial, draft, { ...initial, version: 2 }).tagSearch,
    draft.tagSearch,
  );
  assert.throws(() => draftToInput(draft, initial));
  const input = draftToInput(
    { ...draft, tagSearch: "", proposedTags: [draft.tagSearch] },
    initial,
  );
  assert.equal("tagSearch" in input, false);
  assert.deepEqual(input.proposedTags, [draft.tagSearch]);
});

test("unified picker waits for search, chooses known tags and replaces an equivalent proposal", () => {
  const picker = tagPicker(
    fixtureRequest({ tagIds: [], proposedTags: ["react"] }),
  );
  picker.render();
  assert.equal(picker.active(), false);
  picker.render().setExpanded(true);
  picker.render().search(" React ");
  picker.render();
  picker.pending(true);
  picker.render().add();
  assert.equal(picker.draft.tagIds.length, 0);
  picker.pending(false);
  picker.render().add();
  assert.equal(JSON.stringify(picker.draft.tagIds), '["react-id"]');
  assert.equal(picker.draft.proposedTags.length, 0);
  assert.equal(picker.draft.tagSearch, "");
  assert.equal(picker.active(), true);
  picker.render().search("React");
  picker.render();
  picker.render().add();
  assert.equal(picker.draft.tagIds.length, 1);
  assert.equal(picker.draft.proposedTags.length, 0);
  assert.equal(picker.draft.tagSearch, "");
});

test("unified picker normalizes proposals, rejects duplicates and preserves removals at the shared limit", () => {
  const picker = tagPicker(fixtureRequest({ tagIds: [], proposedTags: [] }));
  const enter = (value: string) => {
    picker.render().search(value);
    picker.render();
    picker.render().add();
  };
  enter("  Luyện   phỏng vấn  ");
  assert.equal(picker.draft.proposedTags[0], "Luyện phỏng vấn");
  enter("LUYỆN PHỎNG VẤN");
  assert.match(picker.render().error ?? "", /trùng/);
  assert.equal(picker.draft.proposedTags.length, 1);
  picker.draft.tagIds = Array.from({ length: 9 }, (_, index) => `tag-${index}`);
  enter("Another tag");
  assert.equal(picker.draft.proposedTags.length, 1);
  picker.render().change("proposedTags", []);
  assert.equal(picker.render().full, false);
  picker.disabled(true);
  enter("Pending tag");
  picker.render().change("tagIds", []);
  assert.equal(picker.draft.tagIds.length, 9);
  assert.equal(picker.draft.proposedTags.length, 0);
});

test("catalog failure leaves pending text intact instead of silently proposing an existing tag", () => {
  const picker = tagPicker(fixtureRequest({ tagIds: [], proposedTags: [] }));
  picker.render().search("Offline label");
  picker.render();
  picker.error(new Error("offline"));
  picker.render().add();
  assert.equal(picker.draft.tagSearch, "Offline label");
  assert.equal(picker.draft.proposedTags.length, 0);
});

test("tag search collapses whitespace consistently and keeps a cached exact match selectable", () => {
  const picker = tagPicker(fixtureRequest({ tagIds: [], proposedTags: [] }));
  picker.render().setExpanded(true);
  picker.render();
  picker.render().search("  React   Native  ");
  picker.render();
  let result = picker.render();
  assert.equal(picker.queryText(), "React Native");
  assert.equal(
    result.options.some((tag) => tag.id === result.exact?.id),
    true,
  );
  result.add();
  assert.equal(picker.draft.tagIds[0], "native-id");
  assert.equal(picker.draft.tagSearch, "");
  picker.render().search("React Native");
  picker.render();
  picker.error(new Error("catalog temporarily unavailable"));
  result = picker.render();
  assert.equal(
    result.options.some((tag) => tag.id === result.exact?.id),
    true,
  );
});

test("catalog queries stay within 120 UTF-16 units without splitting Unicode or changing proposal validation", () => {
  const picker = tagPicker(fixtureRequest({ tagIds: [], proposedTags: [] }));
  const input = `React${" ".repeat(130)}Native`;
  picker.render().search(input);
  picker.render();
  picker.render();
  assert.equal(picker.queryText(), "React Native");
  const unicode = "😀".repeat(80);
  picker.render().search(unicode);
  picker.render();
  picker.render().add();
  assert.equal(picker.queryText()?.length, 120);
  assert.equal([...picker.queryText()!].length, 60);
  assert.equal(picker.draft.proposedTags[0], unicode);
  picker.render().search("a".repeat(121));
  picker.render();
  picker.render().add();
  assert.equal(picker.queryText()?.length, 120);
  assert.match(picker.render().error ?? "", /80/);
  assert.equal(picker.draft.proposedTags.length, 1);
});

test("full tag budget allows an equivalent canonical replacement through both touch and keyboard", () => {
  const initial = fixtureRequest({
    tagIds: Array.from({ length: 9 }, (_, i) => `id-${i}`),
    proposedTags: ["react native"],
  });
  const picker = tagPicker(initial);
  picker.render().setExpanded(true);
  picker.render().search("React Native");
  picker.render();
  const result = picker.render();
  assert.equal(result.full, true);
  assert.equal(result.canChoose(result.exact!), true);
  assert.equal(result.canChoose({ id: "react-id", label: "React" }), false);
  const { RequestTagFields } = source("components/request-tag-fields.tsx", {
    "../hooks/use-request-tag-picker": { useRequestTagPicker: () => result },
    "@/components/Input": { Input: "Input" },
    "@/components/feature-page": { Copy: "Copy" },
    "@/components/FormNotice": { FormNotice: "Notice" },
    "./request-state": { RequestLoading: "Loading", RequestFailure: "Failure" },
    "./request-form.styles": { requestFormStyles: {} },
  }) as typeof import("../src/features/learning-requests/components/request-tag-fields");
  const tree = nodes(
    RequestTagFields({
      form: { formState: { errors: {} } } as never,
      disabled: false,
    }),
  );
  const suggestions = tree.find(
    (node) =>
      typeof node.type === "function" && node.type.name === "TagSuggestions",
  )!;
  const buttons = nodes(
    (suggestions.type as (props: unknown) => Node)(suggestions.props),
  );
  const choose = buttons.find(
    (node) => node.type === "Button" && node.props.children === "React Native",
  )!;
  assert.equal(choose.props.disabled, false);
  action(choose, "onPress");
  assert.equal(picker.draft.proposedTags.length, 0);
  assert.equal(picker.draft.tagIds.length, 10);
  const keyboard = tagPicker(initial);
  keyboard.render().search("React Native");
  keyboard.render();
  keyboard.render().add();
  assert.equal(keyboard.draft.proposedTags.length, 0);
  assert.equal(keyboard.draft.tagIds.length, 10);
});

test("weekly editor keys survive updates and deletion, and ignore callbacks from removed or replaced rows", () => {
  const state = hooks();
  const first = {
    weekday: "MON" as const,
    startTime: "19:00",
    endTime: "21:00",
  };
  const second = {
    weekday: "TUE" as const,
    startTime: "20:00",
    endTime: "22:00",
  };
  let value = weekly.weeklyRowsValue([first, second]);
  const form = {
    control: {},
    watch: (name: string) => (name === "weeklyAvailability" ? value : ""),
    formState: { errors: {}, isSubmitted: false },
  };
  const { RequestTimeFields } = source("components/request-time-fields.tsx", {
    react: state.react,
    "react-hook-form": { Controller: "Controller" },
    "@/components/feature-page": { Copy: "Copy" },
    "@/components/FormNotice": { FormNotice: "Notice" },
    "../utils/request-dates": { slotRows: () => [], slotRowsValue: () => "" },
    "../utils/request-weekly-slots": weekly,
    "./request-saved-slots": { RequestSavedSlots: "SavedSlots" },
    "./request-weekly-row": { RequestWeeklyRow: "WeeklyRow" },
    "./request-section": { RequestSection: "Section" },
    "./request-deadline-fields": { RequestDeadlineFields: "Deadline" },
    "../utils/request-time-zone": { requestTimeZoneNote: () => "GMT+7" },
  }) as typeof import("../src/features/learning-requests/components/request-time-fields");
  const render = () => {
    state.reset();
    const tree = nodes(
      RequestTimeFields({ form: form as never, disabled: false }),
    );
    const controller = tree.find(
      (node) => node.props.name === "weeklyAvailability",
    )!;
    const body = (controller.props.render as (props: unknown) => Node)({
      field: {
        value,
        onChange: (next: string) => {
          value = next;
        },
        onBlur() {},
      },
      fieldState: {},
    });
    return nodes(body).filter((node) => node.type === "WeeklyRow");
  };
  let rows = render();
  const removed = rows[0]!,
    retainedKey = rows[1]!.key;
  action(rows[1]!, "onChange", { ...second, startTime: "20:30" });
  rows = render();
  assert.equal(rows[1]!.key, retainedKey);
  action(rows[0]!, "onRemove");
  rows = render();
  assert.equal(rows[0]!.key, retainedKey);
  assert.notEqual(rows[0]!.key, removed.key);
  action(removed, "onChange", { ...first, startTime: "18:00" });
  assert.equal(weekly.weeklyRows(value)![0]!.startTime, "20:30");
  value = weekly.weeklyRowsValue([first]);
  rows = render();
  assert.notEqual(rows[0]!.key, retainedKey);
  action(removed, "onRemove");
  assert.equal(weekly.weeklyRows(value)!.length, 1);
});

test("collapsed sections keep children mounted and reveal validation errors without losing draft fields", () => {
  const state = hooks();
  const { RequestSection } = source("components/request-section.tsx", {
    react: state.react,
  }) as typeof import("../src/features/learning-requests/components/request-section");
  const render = (hasError = false) => {
    state.reset();
    return nodes(
      RequestSection({
        title: "Tùy chọn",
        children: "Draft fields",
        collapsible: true,
        hasError,
      }),
    );
  };
  let tree = render();
  assert.equal(
    tree.find((node) => node.type === "Pressable")?.props.accessibilityState &&
      (
        tree.find((node) => node.type === "Pressable")!.props
          .accessibilityState as { expanded: boolean }
      ).expanded,
    false,
  );
  assert.ok(
    tree.some(
      (node) =>
        node.props.children === "Draft fields" &&
        (node.props.style as { display: string }).display === "none",
    ),
  );
  action(
    tree.find((node) => node.type === "Pressable")!,
    "onPress",
  );
  tree = render();
  assert.ok(
    tree.some(
      (node) =>
        node.props.children === "Draft fields" &&
        (node.props.style as { display: string }).display === "flex",
    ),
  );
  action(
    tree.find((node) => node.type === "Pressable")!,
    "onPress",
  );
  tree = render(true);
  assert.ok(
    tree.some(
      (node) =>
        node.props.children === "Draft fields" &&
        (node.props.style as { display: string }).display === "flex",
    ),
  );
});

test("weekly rows summarize complete values but expose incomplete or invalid entries for correction", () => {
  const state = hooks();
  const { RequestWeeklyRow } = source("components/request-weekly-row.tsx", {
    react: state.react,
    "../utils/request-weekly-slots": weekly,
    "./request-slot-fields": { RequestSlotFields: "SlotFields" },
    "./request-form.styles": { requestFormStyles: {} },
  }) as typeof import("../src/features/learning-requests/components/request-weekly-row");
  const row = { weekday: "MON" as const, startTime: "19:00", endTime: "21:00" };
  const render = (value = row, hasError = false) => {
    state.reset();
    return nodes(
      RequestWeeklyRow({
        row: value,
        index: 0,
        hasError,
        disabled: false,
        onChange() {},
        onRemove() {},
      }),
    );
  };
  let tree = render();
  assert.equal(
    tree.some((node) => node.type === "SlotFields"),
    false,
  );
  action(
    tree.find((node) => node.type === "Pressable")!,
    "onPress",
  );
  assert.equal(
    render().some((node) => node.type === "SlotFields"),
    true,
  );
  tree = render({ ...row, endTime: "" });
  assert.equal(
    tree.some((node) => node.type === "SlotFields"),
    true,
  );
  assert.equal(
    render(row, true).some((node) => node.type === "SlotFields"),
    true,
  );
});
