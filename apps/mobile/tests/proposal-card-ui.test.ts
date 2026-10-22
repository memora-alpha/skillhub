import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import type { Proposal } from "../src/features/proposals/api/proposals-api";
import { fixtureId } from "./fixtures/learning-requests-data";

test("proposal card routes withdrawal to confirmation and accepted chat to its conversation, never its proposal id", () => {
  const local = createRequire(
    new URL(
      "../src/features/proposals/components/ProposalListCard.tsx",
      import.meta.url,
    ),
  );
  const filename = local.resolve("./ProposalListCard.tsx");
  const routes: unknown[] = [];
  const jsx = (type: unknown, props: unknown) => ({ type, props });
  const contexts = Object.entries({
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "react-native": {
      View: "View",
      Text: "Text",
      StyleSheet: { create: (styles: unknown) => styles },
    },
    "expo-router": {
      useRouter: () => ({ push: (route: unknown) => routes.push(route) }),
    },
    "@/components/Avatar": { Avatar: "Avatar" },
    "@/components/Badge": { Badge: "Badge" },
    "@/components/Button": { Button: "Button" },
    "@/components/Icon": { Icon: "Icon" },
    "@/features/connections": {
      useConnections: () => ({ userId: fixtureId(1) }),
      useParticipantProfile: () => ({
        data: {
          fullName: "Partner",
          avatarUrl: "https://example.test/avatar.png",
        },
      }),
      useCatalogName: () => ({ data: "React" }),
    },
  }).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
  type Element = {
    type: string;
    props: { children?: unknown; onPress: () => void };
  };
  const buttons = (tree: unknown): Element[] => {
    if (Array.isArray(tree)) return tree.flatMap(buttons);
    if (!tree || typeof tree !== "object" || !("props" in tree)) return [];
    const element = tree as Element;
    return element.type === "Button"
      ? [element]
      : buttons(element.props.children);
  };
  try {
    delete local.cache[filename];
    const { ProposalListCard } = local(filename) as {
      ProposalListCard: (input: { proposal: Proposal }) => unknown;
    };
    const proposal: Proposal = {
      id: fixtureId(70),
      proposerId: fixtureId(1),
      recipientId: fixtureId(2),
      skillId: fixtureId(10),
      sourceType: "DIRECT_SEARCH",
      learningRequestId: null,
      message: "Hello",
      exchangeTypeHint: "TWO_WAY",
      proposedCredit: null,
      proposedDurationMinutes: null,
      initialSessionCount: null,
      candidateSlots: null,
      status: "PENDING",
      version: 1,
      createdAt: "2026-10-21T00:00:00Z",
      updatedAt: "2026-10-21T00:00:00Z",
      expiresAt: "2026-10-23T00:00:00Z",
    };
    const pending = buttons(ProposalListCard({ proposal }));
    assert.deepEqual(
      pending.map((button) => button.props.children),
      ["Rút đề xuất", "Chi tiết"],
    );
    pending[0]!.props.onPress();
    assert.deepEqual(routes.pop(), {
      pathname: "/proposal/[id]",
      params: { id: proposal.id, closeAction: "withdraw" },
    });
    const received = buttons(
      ProposalListCard({
        proposal: {
          ...proposal,
          proposerId: fixtureId(2),
          recipientId: fixtureId(1),
        },
      }),
    );
    assert.deepEqual(
      received.map((button) => button.props.children),
      ["Xem và phản hồi"],
    );
    const accepted = buttons(
      ProposalListCard({
        proposal: {
          ...proposal,
          status: "ACCEPTED",
          conversationId: fixtureId(40),
        },
      }),
    );
    accepted
      .find((button) => button.props.children === "Nhắn tin")!
      .props.onPress();
    assert.deepEqual(routes.pop(), {
      pathname: "/chat/[proposalId]",
      params: { proposalId: fixtureId(40), mode: "api" },
    });
    const missing = buttons(
      ProposalListCard({ proposal: { ...proposal, status: "ACCEPTED" } }),
    );
    assert.equal(
      missing.some((button) => button.props.children === "Nhắn tin"),
      false,
    );
    missing
      .find((button) => button.props.children === "Tin nhắn")!
      .props.onPress();
    assert.equal(routes.pop(), "/messages");
  } finally {
    delete local.cache[filename];
    contexts.reverse().forEach((context) => context.restore());
  }
});
