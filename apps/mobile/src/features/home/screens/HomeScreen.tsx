import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Redirect, useRouter } from "expo-router";
import { LogoutDialog } from "@/components/LogoutDialog";
import { Icon } from "@/components/Icon";
import { InfoModal } from "@/components/InfoModal";
import { demoNotifications, popularSkills, recentMessages } from "@/mocks/app";
import { typography, fonts } from "@/constants/theme";
import { homeColors as colors } from "../constants/theme";
import { appRoutes } from "@/constants/navigation";
import { useMockSession } from "@/features/auth";
import { AccountMenu, AppHeader, HomeSearch } from "@/features/shell";
import { HomeContent } from "../components/HomeContent";
import { homeStyles } from "../components/HomePrimitives";
import {
  achievement,
  learningPath,
  matchingRequests,
  nextSession,
} from "../mocks/home";

export function HomeScreen() {
  const router = useRouter();
  const { session, signOut } = useMockSession();
  const [menu, setMenu] = useState(false);
  const [logout, setLogout] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  if (!session) return <Redirect href="/login" />;
  const name = session.name.split(/\s+/).slice(-2).join(" ");
  const action = (title: string) => {
    const route = appRoutes[title];
    if (route && title !== "Trang chủ") return router.navigate(route);
    if (title === "Hồ sơ" || title === "Hoàn thiện hồ sơ")
      return router.push("/profile");
    if (title !== "Trang chủ") {
      setQuery("");
      setNotice(title);
    }
  };
  const request = matchingRequests.find((item) => item.title === notice);
  const message = recentMessages.find((item) => item.name === notice);
  const noticeBody = !notice
    ? ""
    : notice === "Vào học"
      ? `${nextSession.title}\nVới ${nextSession.mentor}\n${nextSession.schedule}\n\nĐây là buổi học mẫu. Chức năng vào phòng học sẽ được triển khai sau.`
      : notice === "Lộ trình đang học"
        ? `${learningPath.title}\nĐã học ${learningPath.completed}/${learningPath.total} buổi.\nBuổi tiếp: ${learningPath.next}`
        : notice === "Tiến trình huy hiệu"
          ? `${achievement.title}\n${achievement.description} · ${session.isNew ? 0 : achievement.completed}/${achievement.total} buổi`
          : notice === "Hồ sơ" || notice === "Hoàn thiện hồ sơ"
            ? `${session.name}\n${session.email}\n\nĐây là hồ sơ demo trong phiên hiện tại.`
            : notice === "Ví Credit"
              ? `Số dư mẫu: ${session.isNew ? 50 : 340} CR.\nGiao dịch và thanh toán chưa được kết nối.`
              : request
                ? `${request.title}\n${request.name} · ${request.credit} CR/lộ trình\n${request.match}% phù hợp\n\nĐề xuất học sẽ được triển khai sau.`
                : message
                  ? `${message.name}\n${message.message}\n${message.time}\n\nTrò chuyện trực tiếp sẽ được triển khai sau.`
                  : `Màn ${notice?.toLowerCase()} sẽ được triển khai ở bước tiếp theo. Hiện tại bạn đang xem trang chủ với dữ liệu mẫu.`;
  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <AppHeader
        appearance="home"
        profile={session}
        onAction={action}
        onAccount={() => setMenu(true)}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <HomeContent name={name} isNew={session.isNew} onAction={action} />
      </ScrollView>
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
        {notice === "Tìm kiếm" ? (
          <View style={{ gap: 12 }}>
            <HomeSearch value={query} onChange={setQuery} />
            <Text style={homeStyles.caption}>Kỹ năng mẫu</Text>
            {popularSkills
              .filter((skill) =>
                skill.toLowerCase().includes(query.trim().toLowerCase()),
              )
              .map((skill) => (
                <Pressable
                  key={skill}
                  accessibilityRole="button"
                  onPress={() => setNotice(skill)}
                  style={styles.searchResult}
                >
                  <Text style={homeStyles.label}>{skill}</Text>
                  <Icon name="chevron" size={16} color={colors.muted} />
                </Pressable>
              ))}
            {!popularSkills.some((skill) =>
              skill.toLowerCase().includes(query.trim().toLowerCase()),
            ) && (
              <Text style={homeStyles.caption}>
                Không tìm thấy kỹ năng trong dữ liệu mẫu.
              </Text>
            )}
          </View>
        ) : notice === "Thông báo" ? (
          <View style={{ gap: 12 }}>
            {demoNotifications.map((text) => (
              <Text key={text} style={homeStyles.body}>
                {text}
              </Text>
            ))}
          </View>
        ) : notice === "Tin nhắn" ? (
          <View style={{ gap: 12 }}>
            {recentMessages.map((item) => (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                onPress={() => setNotice(item.name)}
              >
                <Text style={homeStyles.label}>{item.name}</Text>
                <Text style={homeStyles.caption}>{item.message}</Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <Text style={styles.noticeBody}>{noticeBody}</Text>
        )}
      </InfoModal>
      <LogoutDialog
        visible={logout}
        onClose={() => setLogout(false)}
        onConfirm={() => {
          setLogout(false);
          signOut();
          router.replace("/");
        }}
      />
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  scroll: { flex: 1, backgroundColor: colors.background },
  content: {
    width: "100%",
    maxWidth: 1040,
    alignSelf: "center",
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
  },
  searchResult: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  noticeBody: {
    fontFamily: fonts.body,
    ...typography.body,
    color: colors.muted,
    includeFontPadding: false,
  },
});
