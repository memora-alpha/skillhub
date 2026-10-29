import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import {
  fixtureId,
  fixtureRequest,
  publicFixture,
} from "./fixtures/learning-requests-data";

type Element = { type: unknown; props: Record<string, unknown> };
function elements(tree: unknown): Element[] {
  if (Array.isArray(tree)) return tree.flatMap(elements);
  if (!tree || typeof tree !== "object" || !("props" in tree)) return [];
  const item = tree as Element;
  return [item, ...elements(item.props.children)];
}
const jsx = (type: unknown, props: unknown) => ({ type, props });

test("request card and public requester use the owner avatar with visibility and image error recovery", () => {
  const local = createRequire(
    new URL(
      "../src/features/learning-requests/components/request-card.tsx",
      import.meta.url,
    ),
  );
  const files = [
    local.resolve("./request-card.tsx"),
    local.resolve("./request-public-details.tsx"),
  ];
  const calls: { owner?: unknown; enabled: boolean }[] = [],
    routes: unknown[] = [];
  const recover = () => {};
  const mocks = {
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "react-native": {
      View: "View",
      Text: "Text",
      Pressable: "Pressable",
      StyleSheet: { create: (value: unknown) => value },
    },
    "expo-router": {
      useRouter: () => ({ push: (route: unknown) => routes.push(route) }),
    },
    "@/components/Avatar": { Avatar: "Avatar" },
    "@/components/Icon": { Icon: "Icon" },
    "@/components/Button": { Button: "Button" },
    "@/features/connections": { ConnectionFeedback: "Feedback" },
    "@/features/proposals/state": {
      useSentRequestProposals: () => ({}),
      sentRequestProposalLabels: {},
    },
    "../hooks/use-requests": { useSkillName: () => ({}) },
    "../hooks/use-request-owner-avatar": {
      useRequestOwnerAvatar: (
        owner: { avatarUrl: string | null } | undefined,
        enabled = true,
      ) => {
        calls.push({ owner, enabled });
        return {
          sourceUri: enabled ? owner?.avatarUrl : undefined,
          onImageError: recover,
        };
      },
    },
  };
  const contexts = Object.entries(mocks).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
  try {
    files.forEach((file) => {
      delete local.cache[file];
    });
    const { RequestCard } = local(
      files[0]!,
    ) as typeof import("../src/features/learning-requests/components/request-card");
    const { RequestRequesterDetails } = local(
      files[1]!,
    ) as typeof import("../src/features/learning-requests/components/request-public-details");
    const request = publicFixture({
      actor: fixtureId(1),
      request: fixtureRequest(),
    });
    request.owner.avatarUrl = "https://images.example/avatar.png";
    const card = (loadAvatar = true) =>
      elements(RequestCard({ request, onPress() {}, loadAvatar })).find(
        (el) => el.type === "Avatar",
      )!;
    assert.equal(card().props.sourceUri, request.owner.avatarUrl);
    assert.equal(card().props.onImageError, recover);
    assert.equal(card(false).props.sourceUri, undefined);
    assert.equal(calls.at(-1)!.enabled, false);
    const details = RequestRequesterDetails({
      owner: request.owner,
      requestId: request.id,
    });
    const avatar = elements(details).find((el) => el.type === "Avatar")!;
    assert.equal(avatar.props.sourceUri, request.owner.avatarUrl);
    assert.equal(avatar.props.onImageError, recover);
    ((details as Element).props.onPress as () => void)();
    assert.deepEqual(routes, [
      {
        pathname: "/profiles/[userId]",
        params: { userId: request.owner.id, requestId: request.id },
      },
    ]);
  } finally {
    files.forEach((file) => {
      delete local.cache[file];
    });
    contexts.reverse().forEach((context) => context.restore());
  }
});

test("Avatar image failure keeps initials and notifies its recovery owner", () => {
  const local = createRequire(
    new URL("../src/components/Avatar.tsx", import.meta.url),
  );
  const filename = local.resolve("./Avatar.tsx");
  let failed = false,
    recovered = 0;
  const mocks = {
    "react/jsx-runtime": { jsx, jsxs: jsx },
    react: {
      useState: () => [
        failed,
        (value: boolean) => {
          failed = value;
        },
      ],
      useEffect() {},
    },
    "react-native": {
      View: "View",
      Text: "Text",
      Image: "Image",
      StyleSheet: { create: (value: unknown) => value },
    },
  };
  const contexts = Object.entries(mocks).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
  try {
    delete local.cache[filename];
    const { Avatar } = local(
      filename,
    ) as typeof import("../src/components/Avatar");
    const props = {
      name: "Thảo Linh",
      sourceUri: "https://images.example/avatar.png",
      onImageError: () => {
        recovered++;
      },
    };
    const image = elements(Avatar(props)).find((el) => el.type === "Image")!;
    (image.props.onError as () => void)();
    assert.equal(recovered, 1);
    const fallback = elements(Avatar(props));
    assert.equal(
      fallback.some((el) => el.type === "Image"),
      false,
    );
    assert.ok(
      fallback.some((el) => el.type === "Text" && el.props.children === "TL"),
    );
  } finally {
    delete local.cache[filename];
    contexts.reverse().forEach((context) => context.restore());
  }
});
