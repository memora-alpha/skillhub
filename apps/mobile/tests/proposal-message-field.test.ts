import assert from "node:assert/strict";
import test from "node:test";
import type { ReactNode } from "react";
import { load, nodes, type Props } from "./fixtures/proposal-ui";

function harness(
  name: "message" | "candidateSlots",
  initialMessage = "Nội dung đang viết dở",
) {
  let focused = false;
  let message = initialMessage;
  let blurred = 0;
  let inputFocused = 0;
  let refIndex = 0;
  let cleanup: (() => void) | undefined;
  const refs: { current: unknown }[] = [];
  const component = load(
    "../../src/features/proposals/components/proposal-template-field.tsx",
    {
      react: {
        useState: () => [focused, (value: boolean) => (focused = value)],
        useRef: (value: unknown) => (refs[refIndex++] ??= { current: value }),
        useEffect: (effect: () => () => void) => (cleanup ??= effect()),
      },
      "react-native": { Pressable: "Pressable", Text: "Text", View: "View" },
      "react-hook-form": { Controller: "Controller" },
      "@/components/Input": { Input: "Input" },
      "@/constants/theme": { appColors: {}, fonts: {}, typography: {} },
    },
  ).ProposalTemplateField!;
  const props = {
    control: {},
    name,
    disabled: false,
    inputRef: { current: null },
  };
  const render = () => {
    refIndex = 0;
    const controller = nodes(component(props), "Controller")[0]!;
    assert.equal(controller.props.name, name);
    const tree = (controller.props.render as (props: unknown) => ReactNode)({
      field: {
        value: message,
        onChange: (value: string) => (message = value),
        onBlur: () => blurred++,
        ref: () => {},
      },
      fieldState: {},
    });
    const input = nodes(tree, "Input")[0]!.props;
    (input.ref as (node: unknown) => void)({ focus: () => inputFocused++ });
    return tree;
  };
  const input = () => nodes(render(), "Input")[0]!.props;
  return {
    render,
    input,
    props,
    message: () => message,
    blurred: () => blurred,
    inputFocused: () => inputFocused,
    cleanup: () => cleanup?.(),
  };
}
function run(props: Props, name: string) {
  (props[name] as () => void)();
}
const nextTick = () => new Promise((resolve) => setTimeout(resolve, 5));

for (const name of ["message", "candidateSlots"] as const) {
  test(`${name}: templates appear on focus without changing a draft, then disappear on blur`, async () => {
    const h = harness(name);
    assert.equal(nodes(h.render(), "Pressable").length, 0);
    run(h.input(), "onFocus");
    assert.equal(nodes(h.render(), "Pressable").length, 3);
    assert.equal(h.message(), "Nội dung đang viết dở");
    run(h.input(), "onBlur");
    await nextTick();
    assert.equal(nodes(h.render(), "Pressable").length, 0);
    assert.equal(h.blurred(), 1);
    assert.equal(h.message(), "Nội dung đang viết dở");
    h.cleanup();
  });

  test(`${name}: choosing a template fills the real field and allows further edits`, () => {
    const h = harness(name);
    run(h.input(), "onFocus");
    const template = nodes(h.render(), "Pressable")[0]!.props;
    let prevented = false;
    (template.onPressIn as (event: unknown) => void)({
      nativeEvent: {},
      preventDefault: () => (prevented = true),
    });
    assert.equal(prevented, true);
    (template.onPressIn as (event: unknown) => void)({
      nativeEvent: { key: "Enter" },
      preventDefault: () => assert.fail("Enter must retain its default click"),
    });
    run(template, "onPress");
    assert.equal(h.message(), template.accessibilityHint);
    assert.equal(h.inputFocused(), 1);
    (h.input().onChangeText as (value: string) => void)(
      h.message() + " Mình rảnh tối.",
    );
    assert.match(h.message(), /Mình rảnh tối\.$/);
    h.cleanup();
  });

  test(`${name}: keyboard focus can move to a template; leaving it hides suggestions`, async () => {
    const h = harness(name);
    run(h.input(), "onFocus");
    const template = nodes(h.render(), "Pressable")[0]!.props;
    run(h.input(), "onBlur");
    run(template, "onFocus");
    await nextTick();
    assert.equal(nodes(h.render(), "Pressable").length, 3);
    run(template, "onBlur");
    await nextTick();
    assert.equal(nodes(h.render(), "Pressable").length, 0);
    h.cleanup();
  });

  test(`${name}: pending or uncertain forms hide suggestions and disable the field`, () => {
    const h = harness(name);
    run(h.input(), "onFocus");
    h.props.disabled = true;
    assert.equal(h.input().editable, false);
    assert.equal(nodes(h.render(), "Pressable").length, 0);
    h.cleanup();
  });
}
