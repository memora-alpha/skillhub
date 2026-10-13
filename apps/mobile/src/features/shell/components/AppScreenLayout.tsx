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
import { AccountMenu } from "./AccountMenu";
import { AppHeader } from "./AppHeader";
import { HomeSearch } from "./HomeSearch";
import { InfoModal } from "@/components/InfoModal";
import { LogoutDialog } from "@/components/LogoutDialog";
import { Tag } from "@/components/Tag";
import { demoNotifications, popularSkills } from "@/mocks/app";
import { appRoutes } from "@/constants/navigation";
import { typography, appColors as colors, fonts } from "@/constants/theme";
import { useAuthSession } from "@/features/auth";

type OpenNotice = (label: string) => void;
type AppScreenLayoutProps = Readonly<{
  title: string;
  selected: string;
  rightAction?: ReactNode | ((openNotice: OpenNotice) => ReactNode);
  back?: Readonly<{
    href: Href;
    label: string;
    behavior?: "destination" | "history";
  }>;
  contentStyle?: StyleProp<ViewStyle>;
  children: (openNotice: OpenNotice) => ReactNode;
}>;

function ScreenNoticeContent({
  notice,
  query,
  onQueryChange,
  onSkillPress,
}: Readonly<{
  notice: string | null;
  query: string;
  onQueryChange: (value: string) => void;
  onSkillPress: (skill: string) => void;
}>) {
  if (notice === "Thông báo") {
    return (
      <View style={{ gap: 12 }}>
        {demoNotifications.map((item) => (
          <Text key={item} style={styles.body}>
            {item}
          </Text>
        ))}
      </View>
    );
  }
  if (notice === "Tìm kiếm") {
    const normalizedQuery = query.trim().toLowerCase();
    const skills = popularSkills.filter((skill) =>
      skill.toLowerCase().includes(normalizedQuery),
    );
    return (
      <View style={{ gap: 12 }}>
        <HomeSearch value={query} onChange={onQueryChange} />
        {skills.map((skill) => (
          <Tag key={skill} label={skill} onPress={() => onSkillPress(skill)} />
        ))}
        {skills.length === 0 && (
          <Text style={styles.body}>
            Không tìm thấy kỹ năng trong dữ liệu mẫu.
          </Text>
        )}
      </View>
    );
  }
  return (
    <Text style={styles.body}>
      Màn {notice?.toLowerCase() ?? ""} sẽ được triển khai ở bước tiếp theo.
      Hiện tại bạn đang xem giao diện với dữ liệu mẫu.
    </Text>
  );
}

// The feature owns its scroll container (FlatList or ScrollView).
export function AppScreenLayout({
  title,
  selected,
  rightAction,
  back,
  contentStyle,
  children,
}: AppScreenLayoutProps) {
  const router = useRouter();
  const { session, signOut } = useAuthSession();
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
  const edges = back
    ? (["top", "left", "right", "bottom"] as const)
    : (["top", "left", "right"] as const);
  const handleBack = back
    ? () => {
        if (back.behavior === "history" && router.canGoBack()) router.back();
        else router.dismissTo(back.href);
      }
    : undefined;
  const headerAction =
    typeof rightAction === "function" ? rightAction(action) : rightAction;
  return (
    <SafeAreaView edges={edges} style={styles.screen}>
      <AppHeader
        appearance="home"
        profile={session}
        title={title}
        onBack={handleBack}
        backLabel={back?.label}
        rightAction={headerAction}
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
        <ScreenNoticeContent
          notice={notice}
          query={query}
          onQueryChange={setQuery}
          onSkillPress={(skill) => {
            setNotice(null);
            router.navigate({
              pathname: "/discover",
              params: { query: skill },
            });
          }}
        />
      </InfoModal>
      <LogoutDialog
        visible={logout}
        onClose={() => setLogout(false)}
        onConfirm={() => {
          void signOut();
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
