import { Redirect } from "expo-router";
import { WelcomeScreen, useAuthSession } from "@/features/auth";
export default function WelcomeRoute() {
  const { status } = useAuthSession();
  if (status === "authenticated") return <Redirect href="/home" />;
  return <WelcomeScreen />;
}
