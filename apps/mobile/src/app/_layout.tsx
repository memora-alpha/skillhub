import { StatusBar } from "expo-status-bar";
import { AppProviders } from "@/providers/AppProviders";
import { AuthNavigator } from "@/features/auth";
import { PaymentQaEntry } from "@/qa/payment-qa-entry";

export default function RootLayout() {
  return (
    <AppProviders>
      <StatusBar style="dark" />
      <PaymentQaEntry>
        <AuthNavigator />
      </PaymentQaEntry>
    </AppProviders>
  );
}
