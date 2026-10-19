import { StatusBar } from "expo-status-bar";
import { AppProviders } from "@/providers/AppProviders";
import { AuthNavigator } from "@/features/auth";

export default function RootLayout() {
  return (
    <AppProviders>
      <StatusBar style="dark" />
      <AuthNavigator />
    </AppProviders>
  );
}
