import { Stack } from "expo-router";
import { colors } from "@/constants/theme";
import { useAuthSession } from "../context/AuthSession";

export function AuthNavigator() {
  const { status } = useAuthSession();
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
        <Stack.Screen name="forgot-password" />
        <Stack.Screen name="reset-password" />
      </Stack.Protected>
      <Stack.Protected guard={authenticated}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="chat/[proposalId]" />
        <Stack.Screen name="request/[id]" />
        <Stack.Screen name="session/[id]" />
        <Stack.Screen name="edit-profile" />
        <Stack.Screen name="account-settings" />
      </Stack.Protected>
    </Stack>
  );
}
