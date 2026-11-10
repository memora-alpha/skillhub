import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import { parseProfile } from "../src/features/account/api/account-contracts";
import {
  fixtureIdentity,
  fixtureUsers,
} from "./fixtures/learning-requests-data";

type Element = { type: unknown; props: Record<string, unknown> };
function elements(tree: unknown): Element[] {
  if (Array.isArray(tree)) return tree.flatMap(elements);
  if (!tree || typeof tree !== "object" || !("props" in tree)) return [];
  const element = tree as Element;
  if (typeof element.type === "function")
    return elements(element.type(element.props));
  return [element, ...elements(element.props.children)];
}
function text(tree: unknown): string {
  if (typeof tree === "string" || typeof tree === "number") return String(tree);
  if (Array.isArray(tree)) return tree.map(text).join("");
  return tree && typeof tree === "object" && "props" in tree
    ? text((tree as Element).props.children)
    : "";
}
function mocksFor(
  local: ReturnType<typeof createRequire>,
  mocks: Record<string, Record<string, unknown>>,
) {
  const jsx = (type: unknown, props: unknown) => ({ type, props });
  return Object.entries({
    "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "Fragment" },
    "react-native": {
      StyleSheet: { create: (value: unknown) => value },
      Text: "Text",
      View: "View",
    },
    ...mocks,
  }).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
}

test("moderation notice shows field-specific actions, reasons and timestamp only to the current owner", () => {
  const local = createRequire(
    new URL(
      "../src/features/profile/components/ProfileModerationNotice.tsx",
      import.meta.url,
    ),
  );
  let account: { profile: ReturnType<typeof parseProfile> } | null = {
    profile: parseProfile({
      ...fixtureIdentity(fixtureUsers[0]).profile,
      profileModeration: {
        bio: {
          action: "HIDE",
          reason: "Giới thiệu chứa thông tin không phù hợp.",
          at: "2026-11-09T00:00:00.000Z",
        },
        avatar: {
          action: "REQUEST_EDIT",
          reason: "Hãy chọn ảnh đại diện rõ hơn.",
          at: "2026-11-09T01:00:00.000Z",
        },
      },
    }),
  };
  const contexts = mocksFor(local, {
    "@/features/auth": { useAuthSession: () => ({ account }) },
    "@/components/Icon": { Icon: "Icon" },
    "./ProfileButton": { ProfileButton: "Button" },
    "./ProfilePrimitives": { ProfileSection: "Section", profileStyles: {} },
  });
  const filename = local.resolve("./ProfileModerationNotice.tsx");
  try {
    delete local.cache[filename];
    const { ProfileModerationNotice } = local(filename);
    let edits = 0;
    const tree = ProfileModerationNotice({ onEdit: () => edits++ });
    const content = text(tree);
    assert.match(content, /Giới thiệu đã bị ẩn/);
    assert.match(content, /Ảnh đại diện cần chỉnh sửa/);
    assert.match(content, /Lý do: Giới thiệu chứa thông tin không phù hợp\./);
    assert.match(content, /Hãy chọn ảnh đại diện rõ hơn\./);
    assert.match(content, /Cập nhật/);
    const button = elements(tree).find((element) => element.type === "Button")!;
    (button.props.onPress as () => void)();
    assert.equal(edits, 1);
    assert.equal(
      elements(ProfileModerationNotice({})).filter(
        (element) => element.type === "Button",
      ).length,
      0,
    );
    account = { profile: { ...account!.profile, profileModeration: {} } };
    assert.equal(ProfileModerationNotice({}), null);
    account = null;
    assert.equal(ProfileModerationNotice({}), null);
  } finally {
    contexts.forEach((context) => context.restore());
    delete local.cache[filename];
  }
});

test("self preview renders public bio, never private owner content on read failure, and preserves contextual Back", () => {
  const local = createRequire(
    new URL(
      "../src/features/profile/screens/public-api-profile-screen.tsx",
      import.meta.url,
    ),
  );
  const owner = fixtureIdentity(fixtureUsers[0]);
  let query = {
    data: { ...owner.profile, bio: "", avatarUrl: null },
    error: null as Error | null,
    refetch() {},
  } as {
    data: typeof owner.profile | null | undefined;
    error: Error | null;
    refetch(): void;
  };
  const destinations: unknown[] = [];
  let requestId: string | undefined;
  const contexts = mocksFor(local, {
    "@/features/auth": {
      useAuthSession: () => ({
        session: { userId: owner.userId },
        account: {
          ...owner,
          profile: { ...owner.profile, bio: "PRIVATE OWNER BIO" },
        },
      }),
    },
    "expo-router": {
      useRouter: () => ({
        canGoBack: () => false,
        replace: (target: unknown) => destinations.push(target),
      }),
      useLocalSearchParams: () => ({ requestId }),
    },
    "@/features/skills": { PublicProfileSkillList: "PublicSkills" },
    "@/components/LoadingIndicator": { LoadingIndicator: "Loading" },
    "@/components/EmptyState": { EmptyState: "EmptyState" },
    "@/components/FormNotice": { FormNotice: "Notice" },
    "../components/ProfileButton": { ProfileButton: "Button" },
    "../components/ProfileLayout": { ProfileLayout: "Layout" },
    "../components/ProfileSummary": {
      ProfileSummary: "Summary",
      ProfileAbout: "About",
    },
    "../components/ProfilePrimitives": { profileStyles: {} },
    "../components/profile-reviews": { ProfileReviews: "Reviews" },
    "../hooks/use-public-profile": { usePublicProfile: () => query },
  });
  const filename = local.resolve("./public-api-profile-screen.tsx");
  try {
    delete local.cache[filename];
    const { PublicApiProfileScreen } = local(filename);
    const layout = () =>
      PublicApiProfileScreen({ userId: owner.userId }) as Element;
    const body = () => elements((layout().props.children as () => unknown)());
    assert.equal(
      body().find((element) => element.type === "About")?.props.bio,
      "",
    );
    assert.equal(
      body().find((element) => element.type === "Summary")?.props.profile,
      query.data,
    );
    assert.equal(
      body().find((element) => element.type === "Reviews")?.props.userId,
      owner.userId,
    );
    (layout().props.onBack as () => void)();
    assert.equal(destinations.at(-1), "/profile");
    requestId = "11111111-1111-4111-8111-111111111111";
    (layout().props.onBack as () => void)();
    assert.deepEqual(destinations.at(-1), {
      pathname: "/request/[id]",
      params: { id: requestId },
    });
    for (const data of [undefined, null]) {
      query = { data, error: new Error("Read failed"), refetch() {} };
      assert.equal(
        body().some(
          (element) =>
            element.type === "About" ||
            element.type === "Summary" ||
            element.type === "Reviews",
        ),
        false,
      );
      assert.equal(
        body().some((element) => element.type === "EmptyState"),
        true,
      );
    }
  } finally {
    contexts.forEach((context) => context.restore());
    delete local.cache[filename];
  }
});
