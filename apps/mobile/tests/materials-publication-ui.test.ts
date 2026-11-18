import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import { fixtureMaterial } from "./fixtures/materials-data";

type Node = { type: unknown; props: Record<string, unknown> };
function nodes(value: unknown): Node[] {
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!value || typeof value !== "object" || !("props" in value)) return [];
  const node = value as Node;
  return [node, ...nodes(node.props.children)];
}
const buttons = (value: unknown) =>
  nodes(value).filter((node) => node.type === "Button");

test("locked owner screens preserve republish, archive, withdraw and delete actions without exposing editing", () => {
  const local = createRequire(
    new URL(
      "../src/features/materials/components/owner-material-card.tsx",
      import.meta.url,
    ),
  );
  const jsx = (type: unknown, props: unknown) => ({ type, props });
  const contexts = Object.entries({
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "react-native": { View: "View", Text: "Text", Pressable: "Pressable" },
    "@/components/Button": { Button: "Button" },
    "@/components/Icon": { Icon: "Icon" },
    "@/components/InfoModal": { InfoModal: "Modal" },
    "@/components/FormNotice": { FormNotice: "Notice" },
    "@/constants/theme": { appColors: {} },
    "./owner-material.styles": { ownerMaterialStyles: {} },
  }).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
  const cardFile = local.resolve("./owner-material-card.tsx");
  try {
    delete local.cache[cardFile];
    const { OwnerMaterialCard } = local(cardFile);
    for (const status of [
      "DRAFT",
      "PENDING_REVIEW",
      "PUBLISHED",
      "REJECTED",
      "HIDDEN",
      "ARCHIVED",
    ] as const) {
      const material = fixtureMaterial({ status, hasBeenPublished: true });
      let submits = 0;
      let deletes = 0;
      const lifecycle: string[] = [];
      const card = OwnerMaterialCard({
        material,
        disabled: false,
        submitting: false,
        onOpen() {},
        onEdit() {
          assert.fail("locked editing cannot be opened");
        },
        onSubmit() {
          submits++;
        },
        onDelete() {
          deletes++;
        },
        onArchive() {
          lifecycle.push("archive");
        },
        onWithdraw() {
          lifecycle.push("withdraw");
        },
      });
      const cardActions = buttons(card);
      assert.equal(
        cardActions.some((node) => node.props.children === "Chỉnh sửa"),
        false,
        status,
      );
      const submit = cardActions.find(
        (node) =>
          node.props.children ===
          (status === "ARCHIVED" ? "Đăng lại" : "Gửi duyệt"),
      );
      if (status === "DRAFT" || status === "ARCHIVED") {
        assert.ok(submit, `${status} can submit unchanged content`);
        assert.equal(submit.props.disabled, false);
        (submit.props.onPress as () => void)();
        assert.equal(submits, 1);
      } else assert.equal(submit, undefined);
      const deleteButton = cardActions.find((node) =>
        ["Xóa bản nháp", "Xóa tài liệu"].includes(String(node.props.children)),
      );
      if (status === "DRAFT" || status === "ARCHIVED") {
        assert.ok(deleteButton, "deletion is visible on the card");
        assert.equal(deleteButton.props.disabled, false);
        (deleteButton.props.onPress as () => void)();
        assert.equal(deletes, 1);
      } else assert.equal(deleteButton, undefined);
      const lifecycleButton = cardActions.find((node) =>
        ["Ngừng chia sẻ", "Rút yêu cầu duyệt"].includes(
          String(node.props.children),
        ),
      );
      if (status === "PUBLISHED" || status === "PENDING_REVIEW") {
        assert.ok(lifecycleButton, "management action is visible on the card");
        (lifecycleButton.props.onPress as () => void)();
        assert.deepEqual(lifecycle, [
          status === "PUBLISHED" ? "archive" : "withdraw",
        ]);
      } else assert.equal(lifecycleButton, undefined);
    }
    for (const status of ["DRAFT", "REJECTED"] as const) {
      const card = OwnerMaterialCard({
        material: fixtureMaterial({ status }),
        disabled: false,
        submitting: false,
        onOpen() {},
        onEdit() {},
        onSubmit() {},
        onDelete() {},
        onArchive() {},
        onWithdraw() {},
      });
      assert.ok(
        buttons(card).some((node) => node.props.children === "Chỉnh sửa"),
      );
    }
    const lockedCard = OwnerMaterialCard({
      material: fixtureMaterial({ status: "ARCHIVED" }),
      disabled: true,
      submitting: false,
      onOpen() {},
      onEdit() {},
      onSubmit() {},
      onDelete() {},
      onArchive() {},
      onWithdraw() {},
    });
    assert.equal(
      buttons(lockedCard).find((node) => node.props.children === "Đăng lại")
        ?.props.disabled,
      true,
    );
    assert.equal(
      buttons(lockedCard).find((node) => node.props.children === "Xóa tài liệu")
        ?.props.disabled,
      true,
    );
  } finally {
    contexts.reverse().forEach((context) => context.restore());
    delete local.cache[cardFile];
  }
});
