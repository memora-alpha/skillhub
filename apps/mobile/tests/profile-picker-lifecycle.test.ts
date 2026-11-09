import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";

type Element = { type: unknown; props: Record<string, unknown> };
function elements(tree: unknown): Element[] {
  if (Array.isArray(tree)) return tree.flatMap(elements);
  if (!tree || typeof tree !== "object" || !("props" in tree)) return [];
  const element = tree as Element;
  return [element, ...elements(element.props.children)];
}

test("avatar picker releases the form lock when it resolves while blurred", async () => {
  const local = createRequire(
    new URL(
      "../src/features/profile/screens/EditProfileScreen.tsx",
      import.meta.url,
    ),
  );
  const filename = local.resolve("./EditProfileScreen.tsx");
  const states: unknown[] = [],
    refs: { current: unknown }[] = [];
  let stateIndex = 0,
    refIndex = 0,
    active = true;
  let focus: () => () => void = () => () => {},
    blur = () => {};
  let complete: (result: unknown) => void = () => {};
  let picked = 0;
  const session = { name: "Minh Anh", headline: "", bio: "" };
  const mutation = { isPending: false, reset() {} };
  const jsx = (type: unknown, props: unknown) => ({ type, props });
  const mocks = {
    react: {
      useCallback: (callback: unknown) => callback,
      useRef: (current: unknown) =>
        refs[refIndex++] ?? (refs[refIndex - 1] = { current }),
      useState: (initial: unknown) => {
        const index = stateIndex++;
        if (!(index in states))
          states[index] = typeof initial === "function" ? initial() : initial;
        return [
          states[index],
          (value: unknown) => {
            states[index] = value;
          },
        ];
      },
    },
    "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "Fragment" },
    "react-hook-form": {
      useForm: () => ({
        formState: {},
        watch: () => ({
          fullName: session.name,
          headline: session.headline,
          bio: session.bio,
        }),
        handleSubmit: (callback: unknown) => callback,
      }),
    },
    "react-native": {
      View: "View",
      Text: "Text",
      Platform: { OS: "web" },
      Keyboard: {},
      BackHandler: {},
      StyleSheet: { create: (value: unknown) => value },
    },
    "expo-router": {
      Redirect: "Redirect",
      useRouter: () => ({}),
      useFocusEffect: (callback: () => () => void) => {
        focus = callback;
        if (active) blur = callback();
      },
    },
    "expo-image-picker": {
      launchImageLibraryAsync: () => {
        picked++;
        return new Promise((resolve) => {
          complete = resolve;
        });
      },
    },
    "@/features/auth": {
      useAuthSession: () => ({
        session,
        runtime: { controller: { generation: 1 } },
      }),
      useUpdateProfile: () => mutation,
      useSaveAvatar: () => mutation,
    },
    "@/providers/ToastProvider": { useToast: () => ({}) },
    "../components/ProfileButton": { ProfileButton: "Button" },
    "@/components/ControlledInput": { ControlledInput: "Input" },
    "@/components/FormNotice": { FormNotice: "Notice" },
    "../components/ProfileLayout": { ProfileLayout: "Layout" },
    "../components/ProfilePrimitives": {
      ProfileSection: "Section",
      profileStyles: {},
    },
    "../components/AvatarDraftEditor": { AvatarDraftEditor: "Avatar" },
    "../components/ProfileModerationNotice": {
      ProfileModerationNotice: "ModerationNotice",
    },
  };
  const contexts = Object.entries(mocks).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
  try {
    delete local.cache[filename];
    const { EditProfileScreen } = local(filename);
    const outer = EditProfileScreen();
    const render = () => {
      stateIndex = refIndex = 0;
      const layout = outer.type(outer.props);
      return elements(layout.props.children());
    };
    const avatar = () =>
      render().find((element) => element.type === "Avatar")!.props;
    (avatar().onPick as () => void)();
    assert.equal(avatar().picking, true);
    active = false;
    blur();
    complete({ canceled: true });
    await new Promise((resolve) => setImmediate(resolve));
    active = true;
    blur = focus();
    assert.equal(avatar().picking, false);
    assert.equal(avatar().disabled, false);
    (avatar().onPick as () => void)();
    assert.equal(picked, 2, "the same form can open the picker again");
    active = false;
    blur();
    complete({ canceled: false, assets: [{ uri: "stale-avatar.jpg" }] });
    await new Promise((resolve) => setImmediate(resolve));
    active = true;
    blur = focus();
    assert.equal(
      avatar().draft,
      null,
      "a blurred picker result cannot replace the draft",
    );
    assert.equal(avatar().picking, false);
  } finally {
    delete local.cache[filename];
    for (const context of contexts.reverse()) context.restore();
  }
});
