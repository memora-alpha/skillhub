import { useState, type ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Redirect, useRouter, type Href } from "expo-router";
import { AccountMenu, AppHeader, HomeSearch } from "./AppHeader";
import { InfoModal } from "./InfoModal";
import { LogoutDialog } from "./LogoutDialog";
import { Tag } from "./Tag";
import { demoNotifications, popularSkills } from "@/mocks/app";
import { appRoutes } from "@/constants/navigation";
import { typography, appColors as colors, fonts } from "@/constants/theme";
import { useMockSession } from "@/features/auth/context/MockSession";

// The feature owns its scroll container (FlatList or ScrollView).
export function AppScreenLayout({
  title,
  selected,
  rightAction,
  back,
  contentStyle,
  children,
}: {
  title: string;
  selected: string;
  rightAction?:
    ReactNode | ((openNotice: (label: string) => void) => ReactNode);
  back?: { href: Href; label: string };
  contentStyle?: StyleProp<ViewStyle>;
  children: (openNotice: (label: string) => void) => ReactNode;
}) {
  const router = useRouter();
  const { session, signOut } = useMockSession();
  const [menu, setMenu] = useState(false);
  const [logout, setLogout] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  if (!session) return <Redirect href="/login" />;
  const action = (label: string) => {
    const route = appRoutes[label];
    if (route) {
      if (back && label === selected) router.dismissTo(route);
      else if (label !== selected) router.navigate(route);
      return;
    }
    setQuery("");
    setNotice(label);
  };
  return (
    <SafeAreaView
      edges={
        back ? ["top", "left", "right", "bottom"] : ["top", "left", "right"]
      }
      style={styles.screen}
    >
      <AppHeader
        appearance="home"
        profile={session}
        title={title}
        onBack={back ? () => router.dismissTo(back.href) : undefined}
        backLabel={back?.label}
        rightAction={
          typeof rightAction === "function" ? rightAction(action) : rightAction
        }
        onAction={action}
        onAccount={() => setMenu(true)}
      />
      <KeyboardAvoidingView
        style={[styles.content, contentStyle]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {children(action)}
      </KeyboardAvoidingView>
      <AccountMenu
        visible={menu}
        profile={session}
        onClose={() => setMenu(false)}
        onAction={action}
        onLogout={() => {
          setMenu(false);
          setLogout(true);
        }}
      />
      <InfoModal title={notice} onClose={() => setNotice(null)}>
        {notice === "Thông báo" ? (
          <View style={{ gap: 12 }}>
            {demoNotifications.map((item) => (
              <Text key={item} style={styles.body}>
                {item}
              </Text>
            ))}
          </View>
        ) : notice === "Tìm kiếm" ? (
          <View style={{ gap: 12 }}>
            <HomeSearch value={query} onChange={setQuery} />
            {popularSkills
              .filter((skill) =>
                skill.toLowerCase().includes(query.trim().toLowerCase()),
              )
              .map((skill) => (
                <Tag
                  key={skill}
                  label={skill}
                  onPress={() => {
                    setNotice(null);
                    router.navigate({
                      pathname: "/discover",
                      params: { query: skill },
                    });
                  }}
                />
              ))}
            {!popularSkills.some((skill) =>
              skill.toLowerCase().includes(query.trim().toLowerCase()),
            ) && (
              <Text style={styles.body}>
                Không tìm thấy kỹ năng trong dữ liệu mẫu.
              </Text>
            )}
          </View>
        ) : (
          `Màn ${notice?.toLowerCase() ?? ""} sẽ được triển khai ở bước tiếp theo. Hiện tại bạn đang xem giao diện với dữ liệu mẫu.`
        )}
      </InfoModal>
      <LogoutDialog
        visible={logout}
        onClose={() => setLogout(false)}
        onConfirm={() => {
          signOut();
          setLogout(false);
          router.replace("/");
        }}
      />
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { flex: 1, backgroundColor: colors.canvas },
  body: {
    fontFamily: fonts.body,
    ...typography.body,
    color: colors.body,
  },
});
