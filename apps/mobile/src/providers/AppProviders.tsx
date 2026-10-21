import nunitoRegular from "../../assets/fonts/Nunito-400.ttf";
import nunitoMedium from "../../assets/fonts/Nunito-500.ttf";
import nunitoSemibold from "../../assets/fonts/Nunito-600.ttf";
import nunitoBold from "../../assets/fonts/Nunito-700.ttf";
import nunitoBlack from "../../assets/fonts/Nunito-900.ttf";
import nunitoItalic from "../../assets/fonts/Nunito-400Italic.ttf";
import frauncesSemibold from "../../assets/fonts/Fraunces-600.ttf";
import frauncesBold from "../../assets/fonts/Fraunces-700.ttf";
import type { ReactNode } from "react";
import { useFonts } from "expo-font";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { colors } from "@/constants/theme";
import { AuthSessionProvider, SessionGate } from "@/features/auth";
import { ChatEventsProvider } from "@/features/messages";
import { ProfilePreviewProvider, AvatarUploadToasts } from "@/features/profile";
import { ConnectionsProvider } from "@/features/connections";
import { UiPreviewProvider } from "@/features/ui-preview";
import { SkillsProvider } from "@/features/skills";
import { WalletProvider } from "@/features/wallet";
import { QueryProvider } from "./QueryProvider";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { ToastProvider } from "./ToastProvider";
import { ConnectionGate } from "./ConnectionGate";

export function AppProviders({ children }: { children: ReactNode }) {
  const [loaded, error] = useFonts({
    NunitoRegular: nunitoRegular,
    NunitoMedium: nunitoMedium,
    NunitoSemibold: nunitoSemibold,
    NunitoBold: nunitoBold,
    NunitoBlack: nunitoBlack,
    NunitoItalic: nunitoItalic,
    FrauncesSemibold: frauncesSemibold,
    FrauncesBold: frauncesBold,
  });
  if (error)
    return (
      <View style={styles.loading}>
        <Text>Không thể tải font. Vui lòng mở lại ứng dụng.</Text>
      </View>
    );
  if (!loaded)
    return (
      <View style={styles.loading}>
        <ActivityIndicator
          color={colors.brand}
          accessibilityLabel="Đang mở SkillHub"
        />
      </View>
    );
  return (
    <SafeAreaProvider>
      <KeyboardProvider>
        <ToastProvider>
          <QueryProvider>
            <AuthSessionProvider>
              <WalletProvider>
                <ConnectionGate>
                  <AvatarUploadToasts />
                  <SessionGate>
                    <SkillsProvider>
                      <ProfilePreviewProvider>
                        <ConnectionsProvider>
                          <ChatEventsProvider>
                            <UiPreviewProvider>{children}</UiPreviewProvider>
                          </ChatEventsProvider>
                        </ConnectionsProvider>
                      </ProfilePreviewProvider>
                    </SkillsProvider>
                  </SessionGate>
                </ConnectionGate>
              </WalletProvider>
            </AuthSessionProvider>
          </QueryProvider>
        </ToastProvider>
      </KeyboardProvider>
    </SafeAreaProvider>
  );
}
const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: colors.cream,
    justifyContent: "center",
    alignItems: "center",
  },
});
