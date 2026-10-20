import assert from "node:assert/strict";
import test from "node:test";
import { searchProposals } from "../src/features/proposals/utils/search-proposals";
import { proposal } from "./fixtures/proposals-data";
import { load, nodes } from "./fixtures/proposal-ui";
import { appColors, fonts, typography } from "../src/constants/theme";

test("proposal search matches Vietnamese content with or without accents and preserves the loaded list", () => {
  const items = [
    proposal,
    { ...proposal, id: "another-proposal", message: "Đề xuất học đàn piano." },
  ];
  assert.deepEqual(searchProposals(items, "  HUONG DAN "), [proposal]);
  assert.deepEqual(searchProposals(items, "hướng dẫn"), [proposal]);
  assert.deepEqual(searchProposals(items, "hoc dan"), [items[1]]);
  assert.deepEqual(searchProposals(items, "không tồn tại"), []);
  assert.equal(searchProposals(items, "   "), items);
  assert.equal(items.length, 2);
});

test("proposal search field receives typed content and clears the keyword", () => {
  const changes: unknown[] = [];
  const controls = load(
    "../../src/features/proposals/components/ProposalSearch.tsx",
    {
      "react-native": {
        Pressable: "Pressable",
        TextInput: "TextInput",
        Text: "Text",
        View: "View",
        StyleSheet: { create: (value: unknown) => value },
      },
      "@/components/Icon": { Icon: "Icon" },
      "@/constants/theme": { appColors, fonts, typography },
    },
  );
  const field = controls.ProposalSearchField!({
    value: "React",
    onChange: (value: unknown) => changes.push(value),
  });
  const input = nodes(field, "TextInput")[0]!.props;
  assert.equal(input.value, "React");
  assert.equal(input.autoFocus, true);
  (input.onChangeText as (value: string) => void)("TypeScript");
  (nodes(field, "Pressable")[0]!.props.onPress as () => void)();
  assert.deepEqual(changes, ["TypeScript", ""]);
  assert.equal(
    nodes(
      controls.ProposalSearchField!({ value: "", onChange: () => {} }),
      "Pressable",
    ).length,
    0,
  );
});
