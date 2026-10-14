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
        <Stack.Screen name="chat-attachment" />
        <Stack.Screen name="request/[id]" />
        <Stack.Screen name="session/[id]" />
        <Stack.Screen name="edit-profile" />
        <Stack.Screen name="profiles/[userId]" />
        <Stack.Screen name="public-skills/[userId]/[sharingSkillId]" />
        <Stack.Screen name="account-settings" />
        <Stack.Screen name="user/[id]" />
        <Stack.Screen name="send-proposal" />
        <Stack.Screen name="proposals" />
        <Stack.Screen name="proposal/[id]/index" />
        <Stack.Screen name="proposal/[id]/edit" />
        <Stack.Screen name="proposal/[id]/close" />
        <Stack.Screen name="account-details" />
        <Stack.Screen name="ui" />
        <Stack.Screen name="states/[state]" />
        <Stack.Screen name="skills/index" />
        <Stack.Screen name="skills/new" />
        <Stack.Screen name="skills/[id]/index" />
        <Stack.Screen name="skills/[id]/edit" />
        <Stack.Screen name="skills/[id]/evidence" />
        <Stack.Screen name="skills/history" />
        <Stack.Screen name="requests/index" />
        <Stack.Screen name="requests/new" />
        <Stack.Screen name="requests/[id]/index" />
        <Stack.Screen name="requests/[id]/edit" />
        <Stack.Screen name="paths/index" />
        <Stack.Screen name="agreement-type" />
        <Stack.Screen name="paths/[id]/index" />
        <Stack.Screen name="paths/[id]/plans/new" />
        <Stack.Screen name="paths/[id]/plans/[planId]/index" />
        <Stack.Screen name="paths/[id]/plans/[planId]/edit" />
        <Stack.Screen name="paths/[id]/schedules/index" />
        <Stack.Screen name="paths/[id]/schedules/[planId]" />
        <Stack.Screen name="paths/[id]/hold" />
        <Stack.Screen name="paths/[id]/cancel" />
        <Stack.Screen name="paths/[id]/terms" />
        <Stack.Screen name="paths/[id]/settlement" />
        <Stack.Screen name="paths/[id]/sessions" />
        <Stack.Screen name="learning-sessions/[id]/index" />
        <Stack.Screen name="learning-sessions/[id]/reschedule" />
        <Stack.Screen name="learning-sessions/[id]/room" />
        <Stack.Screen name="wallet/index" />
        <Stack.Screen name="wallet/topup" />
        <Stack.Screen name="wallet/payment" />
        <Stack.Screen name="wallet/payment-status" />
        <Stack.Screen name="wallet/history" />
        <Stack.Screen name="wallet/transactions/[id]" />
        <Stack.Screen name="materials/index" />
        <Stack.Screen name="materials/[id]/index" />
        <Stack.Screen name="materials/[id]/access" />
        <Stack.Screen name="materials/[id]/purchase" />
        <Stack.Screen name="materials/[id]/edit" />
        <Stack.Screen name="materials/new" />
        <Stack.Screen name="materials/mine" />
        <Stack.Screen name="materials/library" />
        <Stack.Screen name="reports/index" />
        <Stack.Screen name="reports/new" />
        <Stack.Screen name="reports/[id]" />
        <Stack.Screen name="paths/[id]/review" />
        <Stack.Screen name="reviews" />
        <Stack.Screen name="reputation/index" />
        <Stack.Screen name="reputation/history" />
        <Stack.Screen name="achievements" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="search" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="preferences/[section]" />
        <Stack.Screen name="help" />
        <Stack.Screen name="policies" />
        <Stack.Screen name="my-learning" />
        <Stack.Screen name="my-skills/index" />
        <Stack.Screen name="my-skills/new" />
        <Stack.Screen name="my-skills/[sharingSkillId]/index" />
        <Stack.Screen name="my-skills/[sharingSkillId]/edit" />
        <Stack.Screen name="my-skills/[sharingSkillId]/verify" />
        <Stack.Screen name="my-skills/[sharingSkillId]/verifications/[verificationId]" />
      </Stack.Protected>
      <Stack.Screen name="forgot-password" />
      <Stack.Screen name="explore/index" />
      <Stack.Screen name="explore/profiles/[userId]" />
      <Stack.Screen name="explore/requests/[id]" />
      <Stack.Screen name="reset-password-code" />
      <Stack.Screen name="reset-password" />
    </Stack>
  );
}
