import { useEffect } from "react";
import { Stack, usePathname } from "expo-router";
import { colors } from "@/constants/theme";
import { useAuthSession } from "../context/AuthSession";
import { passwordRecoveryStore } from "../utils/password-recovery-flow";

export function AuthNavigator() {
  const { status, session, runtime } = useAuthSession();
  const generation = runtime.controller.generation;
  const email = session?.email.toLowerCase();
  const pathname = usePathname();
  useEffect(() => {
    if (
      !["/forgot-password", "/reset-password-code", "/reset-password"].includes(
        pathname,
      ) ||
      (email &&
        passwordRecoveryStore.getState().draft &&
        passwordRecoveryStore.getState().draft?.email !== email)
    )
      passwordRecoveryStore.getState().clear();
  }, [pathname, email, generation]);
  const authenticated = status === "authenticated";
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "none",
        gestureEnabled: false,
        contentStyle: { backgroundColor: colors.cream },
      }}
    >
      <Stack.Protected guard={!authenticated}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
        <Stack.Screen name="verify-email" />
      </Stack.Protected>
      <Stack.Protected guard={authenticated}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="chat/[proposalId]" />
        <Stack.Screen name="request/[id]" />
        <Stack.Screen name="session/[id]" />
        <Stack.Screen name="edit-profile" />
        <Stack.Screen name="profiles/[userId]" />
        <Stack.Screen name="account-settings" />
        <Stack.Screen name="account-details" />
      </Stack.Protected>
      <Stack.Screen name="forgot-password" />
      <Stack.Screen name="reset-password-code" />
      <Stack.Screen name="reset-password" />
    </Stack>
  );
}
