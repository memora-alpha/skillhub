import assert from "node:assert/strict";
import test from "node:test";
import type { ReactNode } from "react";
import { components, load, nodes } from "./fixtures/proposal-ui";
import {
  apiProposalForm,
  proposalFormValues,
  proposalHints,
  type ApiProposalValues,
} from "../src/features/proposals/schemas/api-proposal-form";
import type { Proposal } from "../src/features/proposals/api/proposals-api";
import { proposal } from "./fixtures/proposals-data";

function harness(saved?: Proposal) {
  let expanded: boolean | undefined;
  let draft: ApiProposalValues;
  let defaults: ApiProposalValues;
  const errors: Record<string, unknown> = {};
  const calls: unknown[] = [];
  const form = load(
    "../../src/features/proposals/components/ApiProposalForm.tsx",
    {
      ...components,
      react: {
        useRef: () => ({ current: null }),
        useState: (initial: boolean) => {
          expanded ??= initial;
          return [
            expanded,
            (value: boolean | ((previous: boolean) => boolean)) => {
              expanded = typeof value === "function" ? value(expanded!) : value;
            },
          ];
        },
      },
      "react-native": { View: "View" },
      "react-hook-form": {
        Controller: "Controller",
        useForm: (options: {
          defaultValues: ApiProposalValues;
          shouldUnregister: boolean;
        }) => {
          defaults = options.defaultValues;
          draft ??= { ...options.defaultValues };
          assert.equal(options.shouldUnregister, false);
          return {
            control: {},
            formState: { errors },
            handleSubmit:
              (send: (values: ApiProposalValues) => unknown) => () =>
                send(apiProposalForm.parse(draft)),
          };
        },
      },
      "@hookform/resolvers/zod": { zodResolver: () => undefined },
      "@/components/ControlledInput": { ControlledInput: "ControlledInput" },
      "@/components/choice-group": { ChoiceGroup: "ChoiceGroup" },
      "./proposal-template-field": {
        ProposalTemplateField: "ProposalTemplateField",
      },
      "../schemas/api-proposal-form": {
        apiProposalForm,
        proposalFormValues,
        proposalHints,
      },
    },
  ).ApiProposalForm!;
  const props = {
    proposal: saved,
    pending: false,
    locked: false,
    disabled: false,
    onSubmit: async (body: unknown) => {
      calls.push(body);
    },
  };
  const render = () => form(props);
  const tree = render();
  return {
    props,
    calls,
    render,
    errors,
    tree,
    draft: draft!,
    defaults: defaults!,
  };
}
function click(tree: ReactNode, label: string) {
  const button = nodes(tree, "Button").find((n) => n.props.children === label);
  assert.ok(button, label);
  (button.props.onPress as () => void)();
}
function choice(
  tree: ReactNode,
  value: string,
  changed: (value: string) => void,
) {
  const controller = nodes(tree, "Controller")[0]!;
  return nodes(
    (controller.props.render as (props: unknown) => ReactNode)({
      field: { value, onChange: changed },
    }),
    "ChoiceGroup",
  )[0]!.props;
}

test("minimal form shows exactly the requested choices and sends their existing BE enums", async () => {
  const h = harness();
  assert.deepEqual(
    nodes(h.tree, "ControlledInput").map((n) => n.props.name),
    [],
  );
  assert.deepEqual(
    nodes(h.tree, "ProposalTemplateField").map((n) => n.props.name),
    ["message", "candidateSlots"],
  );
  assert.equal(h.defaults.type, "TWO_WAY");
  const select = choice(h.tree, h.draft.type!, (value) => {
    h.draft.type = value as ApiProposalValues["type"];
  });
  assert.deepEqual(Array.from(select.options as string[]), [
    "Trao đổi",
    "Tôi muốn dạy bạn",
  ]);
  assert.equal(select.value, "Trao đổi");
  (select.onChange as (value: string) => void)("Tôi muốn dạy bạn");
  assert.equal(h.draft.type, "ONE_WAY");
  h.draft.message = proposal.message;
  h.draft.candidateSlots = "Tối thứ 5 và thứ 7";
  click(h.render(), "Gửi đề xuất");
  await Promise.resolve();
  assert.deepEqual(h.calls, [
    {
      message: proposal.message,
      exchangeTypeHint: "ONE_WAY",
      candidateSlots: "Tối thứ 5 và thứ 7",
    },
  ]);
});

test("expanding and collapsing optional details preserves saved hints while message-only edit omits them", async () => {
  const saved = {
    ...proposal,
    exchangeTypeHint: "TWO_WAY" as const,
    proposedCredit: "25.50",
    initialSessionCount: 2,
    proposedDurationMinutes: 120,
    candidateSlots: "Cuối tuần",
  };
  const h = harness(saved);
  assert.deepEqual({ ...h.defaults }, proposalFormValues(saved));
  click(h.render(), "Thêm Credit và số buổi (tùy chọn)");
  assert.deepEqual(
    nodes(h.render(), "ControlledInput").map((n) => n.props.name),
    ["credit", "sessions", "duration"],
  );
  click(h.render(), "Thu gọn chi tiết");
  assert.equal(nodes(h.render(), "ControlledInput").length, 0);
  h.draft.message = "Chỉ cập nhật lời nhắn mới.";
  click(h.render(), "Lưu thay đổi");
  await Promise.resolve();
  assert.deepEqual(h.calls, [{ message: h.draft.message }]);
  h.draft.candidateSlots = "";
  click(h.render(), "Lưu thay đổi");
  await Promise.resolve();
  assert.deepEqual(h.calls[1], {
    message: h.draft.message,
    candidateSlots: null,
  });
});

test("validation errors reveal the corresponding optional fields and locked forms cannot change intent", () => {
  const h = harness();
  h.errors.credit = { message: "Credit không hợp lệ" };
  assert.equal(nodes(h.render(), "ControlledInput").length, 3);
  for (const field of ["pending", "locked", "disabled"] as const) {
    h.props[field] = true;
    const tree = h.render();
    assert.ok(
      nodes(tree, "ProposalTemplateField").every((n) => n.props.disabled),
    );
    assert.ok(
      nodes(tree, "ControlledInput").every(
        (node) => node.props.editable === false,
      ),
    );
    assert.ok(nodes(tree, "Button").every((node) => node.props.disabled));
    const select = choice(tree, "TWO_WAY", () =>
      assert.fail("must not change the locked intent"),
    );
    assert.equal(select.disabled, true);
    (select.onChange as (value: string) => void)("Tôi muốn dạy bạn");
    click(tree, field === "pending" ? "Đang gửi..." : "Gửi đề xuất");
    assert.deepEqual(h.calls, []);
    h.props[field] = false;
  }
});

test("swiping outside a template field keeps focus; only an outside tap blurs the fields", () => {
  const h = harness();
  const root = nodes(h.tree, "View")[0]!.props;
  let blurCount = 0;
  for (const field of nodes(h.tree, "ProposalTemplateField")) {
    (field.props.inputRef as { current: unknown }).current = {
      blur: () => blurCount++,
    };
  }
  const touch = (name: string, x: number, y: number, webTouch = false) =>
    (root[name] as (event: unknown) => void)({
      nativeEvent: webTouch
        ? { touches: [{ pageX: x, pageY: y }] }
        : { pageX: x, pageY: y },
    });
  touch("onTouchStart", 100, 300);
  assert.equal(blurCount, 0);
  touch("onTouchMove", 100, 150);
  touch("onTouchEnd", 100, 150);
  assert.equal(blurCount, 0);
  touch("onTouchStart", 100, 300, true);
  touch("onTouchMove", 100, 150, true);
  touch("onTouchEnd", 100, 150, true);
  assert.equal(blurCount, 0);
  touch("onTouchStart", 100, 300);
  touch("onTouchCancel", 100, 300);
  touch("onTouchEnd", 100, 300);
  assert.equal(blurCount, 0);
  touch("onTouchStart", 100, 300);
  touch("onTouchEnd", 100, 300);
  assert.equal(blurCount, 2);
  assert.equal(h.calls.length, 0);
});
