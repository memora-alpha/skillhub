import assert from "node:assert/strict";
import test from "node:test";
import { appRoutes } from "../src/constants/navigation";
import { readProfileId } from "../src/features/profile/utils/public-profile";
import { sourceModule } from "./skills-read-harness";
import { ids } from "./skills-fixtures";

type Node = { type: unknown; props: Record<string, unknown> };
function profileScreen() {
  const saved = {
    userId: ids.user,
    fullName: "Saved profile",
    bio: "Saved bio",
  };
  const module = sourceModule(
    "../profile/screens/public-profile-preview-screen.tsx",
    {
      "react-native": {
        StyleSheet: { create: (value: unknown) => value },
        Text: "Text",
        View: "View",
      },
      "expo-router": {
        Redirect: "Redirect",
        useRouter: () => ({ canGoBack: () => true, back() {} }),
      },
      "@/components/EmptyState": { EmptyState: "EmptyState" },
      "@/features/auth": {
        useAuthSession: () => ({
          session: { userId: ids.user },
          runtime: { controller: { generation: 1 } },
        }),
      },
      "@/features/skills": { PublicSelfSkillList: "PublicSelfSkillList" },
      "../components/ProfileLayout": { ProfileLayout: "ProfileLayout" },
      "../components/ProfileSummary": {
        ProfileSummary: "ProfileSummary",
        ProfileAbout: "ProfileAbout",
      },
      "../components/ProfilePrimitives": { profileStyles: {} },
      "../context/ProfilePreview": {
        useProfilePreview: () => ({ profile: saved }),
      },
      "../utils/public-profile": { readProfileId },
      "./public-api-profile-screen": {
        PublicApiProfileScreen: "PublicApiProfileScreen",
      },
    },
  );
  return (userId?: string | string[]) =>
    module.PublicProfilePreviewScreen!({ userId }) as Node;
}

test("Skills shortcuts open API-backed management and creation", () => {
  assert.equal(appRoutes["Kỹ năng"], "/my-skills");
  assert.equal(appRoutes["Thêm kỹ năng chia sẻ"], "/my-skills/new");
  assert.equal(appRoutes["Xác minh kỹ năng"], "/my-skills");
});

test("other UUID profiles use the target API screen without a demo projection", () => {
  const node = profileScreen()(ids.other);
  assert.equal(node.type, "PublicApiProfileScreen");
  assert.equal(node.props.userId, ids.other);
});

test("demo and invalid profile targets are unavailable instead of showing sample Skills or the viewer", () => {
  const render = profileScreen();
  for (const target of [
    "demo-mentor-an",
    "demo-retry",
    "unknown",
    undefined,
    [ids.user],
  ]) {
    const node = render(target);
    const content = (node.props.children as () => Node)();
    const state = content.props.children as Node;
    assert.equal(state.type, "EmptyState");
    assert.equal(state.props.title, "Hồ sơ không khả dụng");
  }
});

test("self preview keeps saved profile fields and reads public Skills through the API list", () => {
  const node = profileScreen()(ids.user);
  const content = (node.props.children as () => Node)();
  const children = (content.props.children as Node).props.children as Node[];
  const profile = children.find((child) => child.type === "ProfileSummary")
    ?.props.profile as { fullName: string };
  assert.equal(profile.fullName, "Saved profile");
  assert.equal(children.at(-1)?.type, "PublicSelfSkillList");
});
