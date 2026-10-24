import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import {
  requestProposalIndex,
  readSentRequestProposals,
  sentRequestProposalLabels,
} from "../src/features/proposals/api/sent-request-proposals";
import type { Proposal } from "../src/features/proposals/api/proposals-api";
import {
  fixtureId,
  fixtureRequest,
  publicFixture,
} from "./fixtures/learning-requests-data";
const proposal: Proposal = {
  id: fixtureId(70),
  sourceType: "LEARNING_REQUEST",
  learningRequestId: fixtureId(100),
  proposerId: fixtureId(2),
  recipientId: fixtureId(1),
  skillId: fixtureId(10),
  message: "Cùng thực hành React nhé",
  exchangeTypeHint: "TWO_WAY",
  proposedCredit: null,
  proposedDurationMinutes: null,
  initialSessionCount: null,
  candidateSlots: null,
  status: "PENDING",
  version: 1,
  expiresAt: "2030-01-02T00:00:00Z",
  createdAt: "2030-01-01T00:00:00Z",
  updatedAt: "2030-01-01T00:00:00Z",
};
test("Request status prefers active proposals, keeps latest terminal history and ignores direct invitations", () => {
  const later = {
    ...proposal,
    id: fixtureId(71),
    status: "REJECTED" as const,
    createdAt: "2030-01-02T00:00:00Z",
  };
  assert.equal(
    requestProposalIndex([proposal, later])[fixtureId(100)]?.status,
    "PENDING",
  );
  assert.equal(
    requestProposalIndex([{ ...proposal, status: "ACCEPTED" }, later])[
      fixtureId(100)
    ]?.status,
    "ACCEPTED",
  );
  assert.equal(
    requestProposalIndex([{ ...proposal, status: "WITHDRAWN" }, later])[
      fixtureId(100)
    ]?.id,
    later.id,
  );
  assert.deepEqual(
    requestProposalIndex([
      { ...proposal, sourceType: "DIRECT_SEARCH", learningRequestId: null },
    ]),
    {},
  );
});
test("shared status read exhausts cursors and propagates failures rather than declaring unsent", async () => {
  const cursors: (string | undefined)[] = [];
  const result = await readSentRequestProposals(async (cursor) => {
    cursors.push(cursor);
    return {
      items: cursor ? [proposal] : [],
      nextCursor: cursor ? null : "later",
    };
  }, new AbortController().signal);
  assert.deepEqual(cursors, [undefined, "later"]);
  assert.equal(result[fixtureId(100)]?.id, proposal.id);
  await assert.rejects(
    readSentRequestProposals(
      async () => ({ items: [], nextCursor: "same" }),
      new AbortController().signal,
    ),
  );
  await assert.rejects(
    readSentRequestProposals(async () => {
      throw Error("offline");
    }, new AbortController().signal),
  );
});
type Element = { type: unknown; props: Record<string, unknown> };
function elements(value: unknown): Element[] {
  if (Array.isArray(value)) return value.flatMap(elements);
  if (!value || typeof value !== "object" || !("props" in value)) return [];
  const item = value as Element;
  return [item, ...elements(item.props.children)];
}
test("Request detail opens existing pending/accepted proposals, allows terminal resend only while open, blocks unknown reads", () => {
  const local = createRequire(
    new URL(
      "../src/features/learning-requests/components/request-public-details.tsx",
      import.meta.url,
    ),
  );
  const filename = local.resolve("./request-public-details.tsx");
  const cardFilename = local.resolve("./request-card.tsx");
  let status: Proposal["status"] | undefined = "PENDING",
    pending = false,
    error: unknown;
  const routes: unknown[] = [];
  const profileReads: (string | undefined)[] = [];
  const jsx = (type: unknown, props: unknown) => ({ type, props });
  const mocks = {
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "react-native": {
      Text: "Text",
      View: "View",
      Pressable: "Pressable",
      StyleSheet: { create: (value: unknown) => value },
    },
    "expo-router": {
      useRouter: () => ({ push: (route: unknown) => routes.push(route) }),
    },
    "@/components/Avatar": { Avatar: "Avatar" },
    "@/components/Icon": { Icon: "Icon" },
    "@/components/Button": { Button: "Button" },
    "@/features/connections": {
      ConnectionFeedback: "Feedback",
      useParticipantProfile: (id: string | undefined) => {
        profileReads.push(id);
        return {
          data: id
            ? { avatarUrl: "https://example.test/avatar.png" }
            : undefined,
        };
      },
    },
    "@/features/proposals/state": {
      sentRequestProposalLabels,
      useSentRequestProposals: () => ({
        data: status
          ? { [fixtureId(100)]: { ...proposal, status } }
          : undefined,
        isPending: pending,
        isFetching: false,
        error,
        refetch: () => {},
      }),
    },
    "../hooks/use-requests": {
      useSkillName: () => ({ data: { name: "React" } }),
    },
  };
  const contexts = Object.entries(mocks).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
  try {
    delete local.cache[filename];
    delete local.cache[cardFilename];
    const { RequestPublicFooter, RequestRequesterDetails } = local(
      filename,
    ) as typeof import("../src/features/learning-requests/components/request-public-details");
    const { RequestCard } = local(
      cardFilename,
    ) as typeof import("../src/features/learning-requests/components/request-card");
    const request = publicFixture({
      actor: fixtureId(1),
      request: fixtureRequest(),
    });
    const primary = () =>
      elements(RequestPublicFooter({ request }))
        .filter((item) => item.type === "Button")
        .at(-1)!;
    for (const state of ["PENDING", "ACCEPTED"] as const) {
      status = state;
      const button = primary();
      assert.equal(button.props.accessibilityLabel, "Xem đề xuất");
      (button.props.onPress as () => void)();
      assert.deepEqual(routes.at(-1), {
        pathname: "/proposals/[id]",
        params: { id: proposal.id },
      });
    }
    for (const state of ["REJECTED", "WITHDRAWN", "EXPIRED"] as const) {
      status = state;
      const button = primary();
      assert.equal(button.props.accessibilityLabel, "Gửi lại đề xuất");
      (button.props.onPress as () => void)();
      assert.deepEqual(routes.at(-1), {
        pathname: "/send-proposal",
        params: { requestId: request.id },
      });
    }
    status = "REJECTED";
    request.status = "CLOSED";
    assert.equal(primary().props.disabled, true);
    status = undefined;
    request.status = "OPEN";
    pending = true;
    const count = routes.length;
    (primary().props.onPress as () => void)();
    assert.equal(routes.length, count);
    pending = false;
    error = Error("offline");
    assert.equal(primary().props.disabled, true);
    const card = elements(
      RequestCard({ request, proposal, onPress: () => {} }),
    );
    assert.ok(
      card.some(
        (item) => item.props.children === sentRequestProposalLabels.PENDING,
      ),
    );
    assert.ok(card.some((item) => item.props.children === "Đang mở"));
    assert.equal(
      card.find((item) => item.type === "Avatar")?.props.sourceUri,
      "https://example.test/avatar.png",
    );
    const offscreen = elements(
      RequestCard({ request, proposal, onPress: () => {}, loadAvatar: false }),
    );
    assert.equal(profileReads.at(-1), undefined);
    assert.equal(
      offscreen.find((item) => item.type === "Avatar")?.props.sourceUri,
      undefined,
    );
    const author = elements(
      RequestRequesterDetails({ owner: request.owner, requestId: request.id }),
    );
    const avatar = author.find((item) => item.type === "Avatar")!;
    assert.equal(avatar.props.sourceUri, "https://example.test/avatar.png");
    assert.equal(avatar.props.shape, "circle");
    const profileLink = author.find((item) => item.type === "Pressable")!;
    (profileLink.props.onPress as () => void)();
    assert.deepEqual(routes.at(-1), {
      pathname: "/profiles/[userId]",
      params: { userId: request.owner.id, requestId: request.id },
    });
  } finally {
    delete local.cache[filename];
    delete local.cache[cardFilename];
    contexts.reverse().forEach((context) => context.restore());
  }
});
