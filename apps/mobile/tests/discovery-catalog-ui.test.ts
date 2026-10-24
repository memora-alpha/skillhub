import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";

test("closed, locked or disabled catalog selectors do not enable background reads", () => {
  const local = createRequire(
    new URL(
      "../src/features/learning-requests/components/skill-selector.tsx",
      import.meta.url,
    ),
  );
  const skillFile = local.resolve("./skill-selector.tsx"),
    tagFile = local.resolve("./tag-selector.tsx");
  let expanded = false;
  const skills: unknown[][] = [],
    tags: unknown[][] = [];
  const jsx = (type: unknown, props: unknown) => ({ type, props });
  const mocks = {
    react: {
      useState: (initial: unknown) => [
        typeof initial === "boolean" ? expanded : initial,
        () => {},
      ],
      useEffect() {},
      useRef: (initial: unknown) => ({ current: initial }),
    },
    "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "Fragment" },
    "react-native": { Pressable: "Pressable", Text: "Text", View: "View" },
    "@/components/Input": { Input: "Input" },
    "@/components/Button": { Button: "Button" },
    "@/components/feature-page": { Copy: "Copy" },
    "@/components/FormNotice": { FormNotice: "Notice" },
    "@/components/Icon": { Icon: "Icon" },
    "../hooks/use-requests": {
      useSkillOptions: (...args: unknown[]) => {
        skills.push(args);
        return {};
      },
      useSkillName: () => ({}),
    },
    "../hooks/use-request-options": {
      useTagOptions: (...args: unknown[]) => {
        tags.push(args);
        return {};
      },
    },
    "./request-state": { RequestFailure: "Failure", RequestLoading: "Loading" },
    "./request-form.styles": { requestFormColors: {}, requestFormStyles: {} },
    "./request-multi-select": { RequestMultiSelect: "MultiSelect" },
  };
  const contexts = Object.entries(mocks).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
  try {
    delete local.cache[skillFile];
    delete local.cache[tagFile];
    const { SkillSelector } = local(
      skillFile,
    ) as typeof import("../src/features/learning-requests/components/skill-selector");
    const { TagSelector } = local(
      tagFile,
    ) as typeof import("../src/features/learning-requests/components/tag-selector");
    const render = (disabled = false, locked = false) => {
      SkillSelector({ value: "", onChange() {}, disabled, locked });
      TagSelector({ value: [], onChange() {}, disabled });
    };
    render();
    assert.equal(skills.at(-1)?.[1], false);
    assert.equal(tags.at(-1)?.[1], false);
    expanded = true;
    render();
    assert.equal(skills.at(-1)?.[1], true);
    assert.equal(tags.at(-1)?.[1], true);
    render(true);
    assert.equal(skills.at(-1)?.[1], false);
    assert.equal(tags.at(-1)?.[1], false);
    render(false, true);
    assert.equal(skills.at(-1)?.[1], false);
    expanded = false;
    TagSelector({ value: ["selected-tag"], disabled: true, onChange() {} });
    assert.equal(
      tags.at(-1)?.[1],
      true,
      "existing tag labels still load in a readonly form",
    );
  } finally {
    delete local.cache[skillFile];
    delete local.cache[tagFile];
    contexts.reverse().forEach((context) => context.restore());
  }
});
