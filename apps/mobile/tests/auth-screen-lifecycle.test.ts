import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { AppError, errorMessage } from "../src/lib/http/errors";
import { passwordRecoveryStore } from "../src/features/auth/utils/password-recovery-flow";

type Tree = { type: unknown; props: Record<string, unknown> };
function nodes(value: unknown): Tree[] {
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!value || typeof value !== "object" || !("props" in value)) return [];
  const tree = value as Tree;
  return [tree, ...nodes(tree.props.children)];
}
function screen(
  name: "LoginScreen" | "ForgotPasswordScreen" | "ResetPasswordScreen",
  auth: {
    session: { email: string } | null;
    runtime: { controller: { generation: number } };
  },
  actions: Record<string, unknown>,
) {
  const file = new URL(
    `../src/features/auth/screens/${name}.tsx`,
    import.meta.url,
  );
  const local = createRequire(file);
  const filename = fileURLToPath(file);
  const jsx = (type: unknown, props: Tree["props"]) => ({ type, props });
  const navigation: unknown[] = [];
  const replacements: Record<string, Record<string, unknown>> = {
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "react-hook-form": {
      Controller: "Controller",
      useForm: () => ({
        control: {},
        watch: () => auth.session?.email ?? "a@example.test",
        handleSubmit: (submit: (value: unknown) => void) => () =>
          submit({ email: "a@example.test" }),
        reset: () => {},
      }),
    },
    "@hookform/resolvers/zod": { zodResolver: () => undefined },
    "react-native": {
      Keyboard: { dismiss() {} },
      StyleSheet: { create: (styles: unknown) => styles },
      Pressable: "Pressable",
      Text: "Text",
      View: "View",
    },
    "expo-router": {
      Redirect: "Redirect",
      useLocalSearchParams: () => ({}),
      useRouter: () => ({
        push: (path: unknown) => navigation.push(path),
        replace: (path: unknown) => navigation.push(path),
      }),
    },
    "@/components/Button": { Button: "Button" },
    "@/components/LoadingIndicator": { LoadingIndicator: "LoadingIndicator" },
    "@/providers/ToastProvider": { useToast: () => ({ showToast() {} }) },
    zustand: {
      useStore: (
        store: typeof passwordRecoveryStore,
        select: (
          state: ReturnType<typeof passwordRecoveryStore.getState>,
        ) => unknown,
      ) => select(store.getState()),
    },
    "@/components/Checkbox": { Checkbox: "Checkbox" },
    "../components/AuthLayout": { AuthLayout: "AuthLayout" },
    "../components/AuthControls": {
      authStyles: {},
      PasswordRequirements: "PasswordRequirements",
    },
    "../components/AuthFormInput": { AuthFormInput: "AuthFormInput" },
    "../hooks/use-auth-actions": { useAuthActions: () => actions },
    "../hooks/use-auth-feedback": { useAuthFeedback() {} },
    "../hooks/use-remembered-login-email": {
      useRememberedLoginEmail: () => () => {},
    },
    "../hooks/use-verification-cooldown": {
      useVerificationCooldown: () => ({ seconds: 0, reserve: () => true }),
    },
    "../context/AuthSession": { useAuthSession: () => auth },
  };
  const contexts = [];
  try {
    for (const [dependency, namedExports] of Object.entries(replacements))
      contexts.push(
        mock.module(pathToFileURL(local.resolve(dependency)), { namedExports }),
      );
    delete local.cache[filename];
    const module = local(filename) as Record<string, () => unknown>;
    return { tree: nodes(module[name]!()), navigation };
  } finally {
    delete local.cache[filename];
    for (const context of contexts.reverse()) context.restore();
  }
}

test("inactive-account login offers no verification action for a status the API does not distinguish", () => {
  const error = new AppError("http", 403, "ACCOUNT_NOT_ACTIVE");
  const { tree, navigation } = screen(
    "LoginScreen",
    {
      session: null,
      runtime: { controller: { generation: 1 } },
    },
    { login: { error, isPending: false } },
  );
  const buttons = tree.filter((node) => node.type === "Button");
  assert.deepEqual(
    buttons.map((node) => node.props.children),
    ["Đăng nhập"],
  );
  assert.match(errorMessage(error), /liên hệ hỗ trợ SkillHub/);
  assert.doesNotMatch(errorMessage(error), /xác minh email/i);
  assert.deepEqual(navigation, []);
});

for (const signedIn of [true, false]) {
  test(`forgot-password success binds recovery to ${signedIn ? "the signed-in generation" : "the guest flow"}`, () => {
    const auth = {
      session: signedIn ? { email: "a@example.test" } : null,
      runtime: { controller: { generation: 7 } },
    };
    let complete!: () => void;
    try {
      const { tree } = screen("ForgotPasswordScreen", auth, {
        forgot: {
          isPending: false,
          mutate: (_email: string, callbacks: { onSuccess: () => void }) => {
            complete = callbacks.onSuccess;
          },
        },
      });
      const submit = tree.find((node) => node.type === "Button")!.props
        .onPress as () => void;
      submit();
      complete();
      assert.equal(
        passwordRecoveryStore.getState().ownerGeneration,
        signedIn ? 7 : null,
      );
      assert.equal(
        passwordRecoveryStore.getState().draft?.email,
        "a@example.test",
      );
    } finally {
      passwordRecoveryStore.getState().clear();
    }
  });
}

test("late forgot-password success cannot create recovery in a different session", () => {
  const auth = {
    session: { email: "a@example.test" },
    runtime: { controller: { generation: 7 } },
  };
  let complete!: () => void;
  try {
    const { tree, navigation } = screen("ForgotPasswordScreen", auth, {
      forgot: {
        isPending: false,
        mutate: (_email: string, callbacks: { onSuccess: () => void }) => {
          complete = callbacks.onSuccess;
        },
      },
    });
    (
      tree.find((node) => node.type === "Button")!.props.onPress as () => void
    )();
    auth.runtime.controller.generation++;
    complete();
    assert.equal(passwordRecoveryStore.getState().draft, null);
    assert.deepEqual(navigation, []);
  } finally {
    passwordRecoveryStore.getState().clear();
  }
});

test("reset waits for the pending result after session cleanup, then returns to login on success", () => {
  const auth = { session: null, runtime: { controller: { generation: 8 } } };
  passwordRecoveryStore.getState().clear();
  const reset = {
    isPending: true,
    isSuccess: false,
    variables: { email: "a@example.test" },
  };
  const pending = screen("ResetPasswordScreen", auth, { reset });
  assert.ok(pending.tree.some((node) => node.type === "LoadingIndicator"));
  assert.ok(!pending.tree.some((node) => node.type === "Redirect"));
  reset.isPending = false;
  reset.isSuccess = true;
  const done = screen("ResetPasswordScreen", auth, { reset });
  assert.deepEqual(
    done.tree.find((node) => node.type === "Redirect")?.props.href,
    {
      pathname: "/login",
      params: { email: "a@example.test", result: "reset" },
    },
  );
});
