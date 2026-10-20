import assert from "node:assert/strict";
import test from "node:test";
import { sourceModule } from "./skills-read-harness";

test("verification header Back allows background transfers but blocks a picker or parent save", () => {
  let picking = false;
  const model = {
    draft: { files: [] },
    preparing: true,
    progress: "Đang gửi",
    titleInvalid: false,
    descriptionInvalid: false,
    locked: () => true,
    localLocked: () => picking,
  };
  const module = sourceModule("components/VerificationForm.tsx", {
    react: { useEffect() {}, useImperativeHandle() {} },
    "react-native": { View: "View", Text: "Text" },
    "./SkillsLayout": { SkillsLayout: "SkillsLayout", skillStyles: {} },
    "../hooks/use-verification-form": { useVerificationForm: () => model },
    "./VerificationFields": { VerificationFields: "VerificationFields" },
    "./skill-form-styles": { formStyles: {} },
  });
  const render = (disabled = false) =>
    module.VerificationForm!({ id: "skill", blocked: false, disabled }) as {
      props: { locked: () => boolean };
    };
  assert.equal(render().props.locked(), false);
  picking = true;
  assert.equal(render().props.locked(), true);
  picking = false;
  assert.equal(render(true).props.locked(), true);
});

test("pending Back hook registers only Android hardware Back and cleans up", () => {
  for (const platform of ["android", "ios", "web"]) {
    let focus!: () => (() => void) | undefined;
    let handler: (() => boolean) | undefined;
    let removed = false;
    const module = sourceModule("hooks/use-pending-back.ts", {
      react: {
        useRef: (value: unknown) => ({ current: value }),
        useCallback: (fn: unknown) => fn,
      },
      "react-native": {
        Platform: { OS: platform },
        BackHandler: {
          addEventListener: (_event: string, fn: () => boolean) => {
            handler = fn;
            return {
              remove() {
                removed = true;
              },
            };
          },
        },
      },
      "expo-router": {
        useFocusEffect: (fn: typeof focus) => {
          focus = fn;
        },
      },
    });
    module.usePendingBack!(() => true);
    const cleanup = focus();
    assert.equal(!!handler, platform === "android");
    if (handler) {
      assert.equal(handler(), true);
      cleanup!();
      assert.equal(removed, true);
    }
  }
});
