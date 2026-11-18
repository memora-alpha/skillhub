import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import { pickerValue } from "../src/utils/date-choice";
import {
  draftToInput,
  requestDefaults,
} from "../src/features/learning-requests/schemas/request-form";
import { fixtureRequest } from "./fixtures/learning-requests-data";

type Element = { type: unknown; props: Record<string, unknown> };
function elements(tree: unknown): Element[] {
  if (Array.isArray(tree)) return tree.flatMap(elements);
  if (!tree || typeof tree !== "object" || !("props" in tree)) return [];
  const element = tree as Element;
  return [element, ...elements(element.props.children)];
}

test("expiry suggests 30 days without replacing the default until confirmed; cancel, edit and reset preserve intent", (t) => {
  const now = new Date(2030, 10, 18, 23, 12).getTime();
  t.mock.timers.enable({ apis: ["Date"], now });
  const local = createRequire(
    new URL("../src/components/DateTimeField.tsx", import.meta.url),
  );
  const fieldFile = local.resolve("./DateTimeField.tsx");
  const deadlineFile = local.resolve(
    "../features/learning-requests/components/request-deadline-fields.tsx",
  );
  let state: unknown[] = [];
  let index = 0;
  const jsx = (type: unknown, props: unknown) => ({ type, props });
  const stubs = {
    "react/jsx-runtime": { jsx, jsxs: jsx },
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
      useEffect() {},
    },
    "react-native": {
      View: "View",
      Text: "Text",
      Pressable: "Pressable",
      StyleSheet: { create: (value: unknown) => value },
    },
    "react-hook-form": { Controller: "Controller" },
    "./Button": { Button: "Button" },
    "./Icon": { Icon: "Icon" },
    "./FormNotice": { FormNotice: "FormNotice" },
    "./feature-page": { Copy: "Copy" },
    "./DateTimeSelector": { DateTimeSelector: "DateTimeSelector" },
    "../features/learning-requests/components/request-section": {
      RequestSection: "RequestSection",
    },
  };
  const contexts = Object.entries(stubs).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
  try {
    delete local.cache[fieldFile];
    delete local.cache[deadlineFile];
    const { DateTimeField } = local(
      fieldFile,
    ) as typeof import("../src/components/DateTimeField");
    const { RequestDeadlineFields } = local(
      deadlineFile,
    ) as typeof import("../src/features/learning-requests/components/request-deadline-fields");
    let expiry = "";
    const changes: string[] = [];
    const form = {
      watch: () => expiry,
      control: {},
      formState: { errors: {} },
    } as unknown as Parameters<typeof RequestDeadlineFields>[0]["form"];
    const renderDeadline = (disabled = false) => {
      const tree = RequestDeadlineFields({ form, disabled });
      const controller = elements(tree).find(
        (node) => node.type === "Controller",
      )!;
      const children = (controller.props.render as (props: unknown) => unknown)(
        {
          field: {
            value: expiry,
            onChange: (next: string) => {
              expiry = next;
              changes.push(next);
            },
            onBlur() {},
          },
          fieldState: {},
        },
      );
      const field = elements(children).find(
        (node) => node.type === DateTimeField,
      )!;
      return {
        tree,
        children,
        props: field.props as Parameters<typeof DateTimeField>[0],
      };
    };
    const renderPicker = (props: Parameters<typeof DateTimeField>[0]) => {
      index = 0;
      return DateTimeField(props);
    };
    const press = (tree: unknown, label: string) => {
      const node = elements(tree).find(
        (item) => item.props.accessibilityLabel === label,
      )!;
      (node.props.onPress as () => void)();
    };
    const initial = renderDeadline();
    assert.equal(initial.tree.props.summary, "30 ngày kể từ khi xuất bản");
    let picker = renderPicker(initial.props);
    const label = elements(picker).find((node) => node.type === "Pressable")!
      .props.accessibilityLabel as string;
    press(picker, label);
    picker = renderPicker(initial.props);
    const selector = elements(picker).find(
      (node) => node.type === "DateTimeSelector",
    )!;
    const suggested = selector.props.value as Date;
    assert.equal(suggested.getTime(), now + 30 * 24 * 60 * 60 * 1000);
    assert.deepEqual(changes, []);
    const request = fixtureRequest({ requestedExpiresAt: null });
    assert.equal(
      draftToInput(requestDefaults(request), request, now).expiresAt,
      null,
    );
    press(picker, "Bỏ chọn thời điểm hết hạn tùy chọn");
    assert.equal(expiry, "");
    press(renderPicker(initial.props), label);
    press(renderPicker(initial.props), "Xác nhận thời điểm hết hạn tùy chọn");
    assert.equal(expiry, pickerValue(suggested));
    assert.match(
      JSON.stringify(renderPicker(renderDeadline().props)),
      /Múi giờ thiết bị/,
    );

    expiry = "2030-11-20T18:30";
    state = [];
    const saved = renderDeadline();
    picker = renderPicker(saved.props);
    press(
      picker,
      elements(picker).find((node) => node.type === "Pressable")!.props
        .accessibilityLabel as string,
    );
    picker = renderPicker(saved.props);
    assert.equal(
      pickerValue(
        elements(picker).find((node) => node.type === "DateTimeSelector")!.props
          .value as Date,
      ),
      expiry,
    );
    const reset = elements(saved.children).find(
      (node) => node.type === "Button",
    )!;
    (reset.props.onPress as () => void)();
    assert.equal(expiry, "");
    assert.equal(renderDeadline(true).props.disabled, true);

    expiry = "2030-11-17T18:30";
    state = [];
    const past = renderDeadline();
    picker = renderPicker(past.props);
    press(
      picker,
      elements(picker).find((node) => node.type === "Pressable")!.props
        .accessibilityLabel as string,
    );
    picker = renderPicker(past.props);
    assert.equal(
      (
        elements(picker).find((node) => node.type === "DateTimeSelector")!.props
          .value as Date
      ).getTime(),
      now + 30 * 24 * 60 * 60 * 1000,
      "an old draft must use the 30-day suggestion instead of falling back to one hour",
    );
    press(picker, "Bỏ chọn thời điểm hết hạn tùy chọn");
    assert.equal(
      expiry,
      "2030-11-17T18:30",
      "opening/cancelling does not change the saved deadline",
    );

    state = [];
    const generic = {
      label: "Lịch học",
      value: "",
      disabled: false,
      onChange() {},
    };
    picker = renderPicker(generic);
    press(picker, "Lịch học: Chọn ngày và giờ");
    picker = renderPicker(generic);
    assert.equal(
      (
        elements(picker).find((node) => node.type === "DateTimeSelector")!.props
          .value as Date
      ).getTime(),
      now + 60 * 60 * 1000,
    );
  } finally {
    delete local.cache[fieldFile];
    delete local.cache[deadlineFile];
    for (const context of contexts.reverse()) context.restore();
  }
});
