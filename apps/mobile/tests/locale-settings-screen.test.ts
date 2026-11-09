import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import {
  fixtureIdentity,
  fixtureUsers,
} from "./fixtures/learning-requests-data";

type Element = {
  type: unknown;
  props: {
    children?: unknown;
    footer?: unknown;
    value?: unknown;
    disabled?: unknown;
    selectedValue?: unknown;
    label?: string;
    selected?: boolean;
    onChange(value: string): void;
    onChangeText(value: string): void;
    onValueChange(value: string): void;
    onPress(): void;
  };
};
function elements(tree: unknown): Element[] {
  if (Array.isArray(tree)) return tree.flatMap(elements);
  if (!tree || typeof tree !== "object" || !("props" in tree)) return [];
  const element = tree as Element;
  return [
    element,
    ...elements(element.props.children),
    ...elements(element.props.footer),
  ];
}

test("locale settings initialize from account, save a selected timezone, send only edited preference and preserve failed drafts", async () => {
  const local = createRequire(
    new URL(
      "../src/features/settings/screens/LocaleSettingsScreen.tsx",
      import.meta.url,
    ),
  );
  let states: unknown[] = [],
    refs: { current: unknown }[] = [];
  let stateIndex = 0,
    refIndex = 0,
    generation = 1;
  let calls: unknown[] = [];
  let complete!: (value: unknown) => void;
  let reject!: (error: Error) => void;
  const toasts: unknown[] = [];
  const runtime = {
    controller: {
      get generation() {
        return generation;
      },
    },
  };
  const mutation = {
    isPending: false,
    reset() {},
    mutateAsync: (patch: unknown) => {
      calls.push(patch);
      return new Promise((resolve, fail) => {
        complete = resolve;
        reject = fail;
      });
    },
  };
  const jsx = (type: unknown, props: unknown) => ({ type, props });
  const contexts = Object.entries({
    react: {
      useCallback: (callback: unknown) => callback,
      useRef: (current: unknown) =>
        refs[refIndex++] ?? (refs[refIndex - 1] = { current }),
      useState: (initial: unknown) => {
        const index = stateIndex++;
        if (!(index in states)) states[index] = initial;
        return [
          states[index],
          (value: unknown) => {
            states[index] = value;
          },
        ];
      },
    },
    "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "Fragment" },
    "expo-router": { useFocusEffect: (callback: () => unknown) => callback() },
    "@/components/FormNotice": { FormNotice: "Notice" },
    "../components/SettingsPage": { SettingsPage: "Page" },
    "../components/SettingsUI": {
      SettingsIntro: "Intro",
      SettingsSection: "Section",
      SettingsNote: "Note",
      SettingsChoice: "Choice",
      SettingsSaveButton: "Button",
    },
    "../components/TimezoneField": { TimezoneField: "TimezonePicker" },
    "@/features/auth": {
      useAuthSession: () => ({ runtime }),
      useUpdateProfile: () => mutation,
    },
    "@/providers/ToastProvider": {
      useToast: () => ({
        showToast: (...args: unknown[]) => toasts.push(args),
      }),
    },
  }).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
  const filename = local.resolve("./LocaleSettingsScreen.tsx");
  try {
    delete local.cache[filename];
    const { LocaleSettingsScreen } = local(filename);
    const profile = {
      ...fixtureIdentity(fixtureUsers[0]).profile,
      timezone: "Asia/Tokyo",
    };
    const render = (section = "timezone") => {
      stateIndex = refIndex = 0;
      return elements(LocaleSettingsScreen({ section, profile }));
    };
    const selector = () =>
      render().find((element) => element.type === "TimezonePicker")!.props;
    const save = (section = "timezone") =>
      render(section).find((element) => element.type === "Button")!.props;
    assert.equal(selector().value, "Asia/Tokyo");
    assert.equal(save().disabled, true);
    selector().onChange("Mars/Olympus");
    assert.equal(save().disabled, true);
    selector().onChange("UTC");
    const button = save();
    assert.equal(button.disabled, false);
    button.onPress();
    button.onPress();
    assert.deepEqual(calls, [{ timezone: "UTC" }]);
    reject(new Error("Network failed"));
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(selector().value, "UTC");
    assert.equal(toasts.length, 0);
    save().onPress();
    complete({ ...profile, timezone: "UTC" });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(save().disabled, true);
    assert.equal(toasts.length, 1);

    states = [];
    refs = [];
    calls = [];
    const choices = render("language").filter(
      (element) => element.type === "Choice",
    );
    assert.equal(
      choices.find((element) => element.props.label === "Tiếng Việt")?.props
        .selected,
      true,
    );
    choices
      .find((element) => element.props.label === "English")!
      .props.onPress();
    save("language").onPress();
    assert.deepEqual(calls, [{ locale: "en" }]);
    generation++;
    complete({ ...profile, locale: "en" });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(toasts.length, 1);
  } finally {
    contexts.forEach((context) => context.restore());
    delete local.cache[filename];
  }
});
