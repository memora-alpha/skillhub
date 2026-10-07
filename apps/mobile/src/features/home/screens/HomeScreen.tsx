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
import { useMockSession, type MockSession } from "@/features/auth";
import { AccountMenu, AppHeader, HomeSearch } from "@/features/shell";
import { HomeContent } from "../components/HomeContent";
import { homeStyles } from "../components/HomePrimitives";
import {
  achievement,
  learningPath,
  matchingRequests,
  nextSession,
} from "../mocks/home";

function getHomeNoticeBody(notice: string | null, session: MockSession) {
  if (!notice) return "";
  switch (notice) {
    case "Vào học":
      return `${nextSession.title}\nVới ${nextSession.mentor}\n${nextSession.schedule}\n\nĐây là buổi học mẫu. Chức năng vào phòng học sẽ được triển khai sau.`;
    case "Lộ trình đang học":
      return `${learningPath.title}\nĐã học ${learningPath.completed}/${learningPath.total} buổi.\nBuổi tiếp: ${learningPath.next}`;
    case "Tiến trình huy hiệu": {
      const completed = session.isNew ? 0 : achievement.completed;
      return `${achievement.title}\n${achievement.description} · ${completed}/${achievement.total} buổi`;
    }
    case "Hồ sơ":
    case "Hoàn thiện hồ sơ":
      return `${session.name}\n${session.email}\n\nĐây là hồ sơ demo trong phiên hiện tại.`;
    case "Ví Credit": {
      const balance = session.isNew ? 50 : 340;
      return `Số dư mẫu: ${balance} CR.\nGiao dịch và thanh toán chưa được kết nối.`;
    }
  }
  const request = matchingRequests.find((item) => item.title === notice);
  if (request) {
    return `${request.title}\n${request.name} · ${request.credit} CR/lộ trình\n${request.match}% phù hợp\n\nĐề xuất học sẽ được triển khai sau.`;
  }
  const message = recentMessages.find((item) => item.name === notice);
  if (message) {
    return `${message.name}\n${message.message}\n${message.time}\n\nTrò chuyện trực tiếp sẽ được triển khai sau.`;
  }
  return `Màn ${notice.toLowerCase()} sẽ được triển khai ở bước tiếp theo. Hiện tại bạn đang xem trang chủ với dữ liệu mẫu.`;
}

function HomeNoticeContent({
  notice,
  noticeBody,
  query,
  onQueryChange,
  onNoticeChange,
}: Readonly<{
  notice: string | null;
  noticeBody: string;
  query: string;
  onQueryChange: (value: string) => void;
  onNoticeChange: (value: string) => void;
}>) {
  if (notice === "Tìm kiếm") {
    const normalizedQuery = query.trim().toLowerCase();
    const skills = popularSkills.filter((skill) =>
      skill.toLowerCase().includes(normalizedQuery),
    );
    return (
      <View style={{ gap: 12 }}>
        <HomeSearch value={query} onChange={onQueryChange} />
        <Text style={homeStyles.caption}>Kỹ năng mẫu</Text>
        {skills.map((skill) => (
          <Pressable
            key={skill}
            accessibilityRole="button"
            onPress={() => onNoticeChange(skill)}
            style={styles.searchResult}
          >
            <Text style={homeStyles.label}>{skill}</Text>
            <Icon name="chevron" size={16} color={colors.muted} />
          </Pressable>
        ))}
        {skills.length === 0 && (
          <Text style={homeStyles.caption}>
            Không tìm thấy kỹ năng trong dữ liệu mẫu.
          </Text>
        )}
      </View>
    );
  }
  if (notice === "Thông báo") {
    return (
      <View style={{ gap: 12 }}>
        {demoNotifications.map((text) => (
          <Text key={text} style={homeStyles.body}>
            {text}
          </Text>
        ))}
      </View>
    );
  }
  if (notice === "Tin nhắn") {
    return (
      <View style={{ gap: 12 }}>
        {recentMessages.map((item) => (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            onPress={() => onNoticeChange(item.name)}
          >
            <Text style={homeStyles.label}>{item.name}</Text>
            <Text style={homeStyles.caption}>{item.message}</Text>
          </Pressable>
        ))}
      </View>
    );
  }
  return <Text style={styles.noticeBody}>{noticeBody}</Text>;
}

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
  const noticeBody = getHomeNoticeBody(notice, session);
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
        <HomeNoticeContent
          notice={notice}
          noticeBody={noticeBody}
          query={query}
          onQueryChange={setQuery}
          onNoticeChange={setNotice}
        />
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
