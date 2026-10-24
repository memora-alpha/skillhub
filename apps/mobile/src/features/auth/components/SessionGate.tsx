import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { LoadingIndicator as ActivityIndicator } from "@/components/LoadingIndicator";
import { SafeAreaView } from "@/components/SafeArea";
import { Button } from "@/components/Button";
import { BrandLogo } from "@/components/BrandLogo";
import { colors, fonts, typography } from "@/constants/theme";
import { errorMessage } from "@/lib/http/errors";
import { useAuthSession } from "../context/AuthSession";

export function SessionGate({ children }: { children: ReactNode }) {
  const { status, error, retryBootstrap, signOut } = useAuthSession();
  if (status === "guest" || status === "authenticated") return children;
  const loading = status === "bootstrapping";
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.content}>
        <BrandLogo />
        {loading ? (
          <ActivityIndicator accessibilityLabel="Đang khôi phục phiên đăng nhập" />
        ) : (
          <>
            <Text accessibilityRole="header" style={styles.title}>
              {status === "reauth"
                ? "Cần đăng nhập lại"
                : "Chưa thể mở tài khoản"}
            </Text>
            <Text style={styles.body}>
              {status === "reauth"
                ? "Kết nối bị gián đoạn khi làm mới phiên. Đăng nhập lại để bảo vệ tài khoản."
                : errorMessage(error)}
            </Text>
            {status !== "reauth" && (
              <Button onPress={retryBootstrap}>Thử lại</Button>
            )}
            <Button
              variant="secondary"
              onPress={() => {
                void signOut();
              }}
            >
              Về đăng nhập
            </Button>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: "center", backgroundColor: colors.cream },
  content: {
    width: "100%",
    maxWidth: 440,
    alignSelf: "center",
    padding: 24,
    gap: 20,
  },
  title: { ...typography.title, fontFamily: fonts.bold, color: colors.ink },
  body: { ...typography.body, fontFamily: fonts.body, color: colors.muted },
});
