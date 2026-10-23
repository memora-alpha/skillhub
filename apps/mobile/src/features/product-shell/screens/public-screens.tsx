import { RefreshableScrollView as ScrollView } from "@/components/RefreshableScrollView";
import { useState, type ReactNode } from "react";
import { View, Text } from "react-native";
import { SafeAreaView } from "@/components/SafeArea";
import { useLocalSearchParams, useRouter } from "expo-router";
import { BrandLogo } from "@/components/BrandLogo";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { Badge } from "@/components/Badge";
import { EmptyState } from "@/components/EmptyState";
import { ChoiceGroup } from "@/components/choice-group";
import { Panel, Copy, RouteButton, ui } from "@/components/feature-page";
import { publicProfiles } from "@/features/profile";
import { learningRequests } from "@/features/discovery";
import { useAuthSession } from "@/features/auth";
import { appColors, fonts } from "@/constants/theme";
function PublicPage({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const router = useRouter();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: appColors.canvas }}>
      <View
        style={{
          padding: 16,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <BrandLogo size="sm" />
        <Button variant="paper" onPress={() => router.back()}>
          Quay lại
        </Button>
      </View>
      <ScrollView
        contentContainerStyle={ui.page}
        keyboardShouldPersistTaps="handled"
      >
        <Text
          accessibilityRole="header"
          style={{
            fontFamily: fonts.display,
            fontSize: 28,
            lineHeight: 36,
            color: appColors.ink,
          }}
        >
          {title}
        </Text>
        <Copy muted>
          Thông tin công khai mẫu. Đăng nhập để bắt đầu trao đổi.
        </Copy>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}
export function PublicExploreScreen() {
  const { query = "" } = useLocalSearchParams<{ query?: string }>();
  const [search, setSearch] = useState(query);
  const [tab, setTab] = useState("Người chia sẻ");
  const profiles = publicProfiles.filter(
    (p) =>
      p.skills.length &&
      `${p.name} ${p.skills.map((s) => s.name).join(" ")}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const requests = learningRequests.filter((r) =>
    `${r.title} ${r.tags.join(" ")}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <PublicPage title="Khám phá cộng đồng">
      <Input label="Tìm kỹ năng" value={search} onChangeText={setSearch} />
      <ChoiceGroup
        label="Khám phá"
        options={["Người chia sẻ", "Yêu cầu học"]}
        value={tab}
        onChange={setTab}
      />
      {tab === "Người chia sẻ"
        ? profiles.map((p) => (
            <Panel key={p.id} title={p.name}>
              <Copy>{p.skills.map((s) => s.name).join(", ")}</Copy>
              <RouteButton secondary href={`/explore/profiles/${p.id}`}>
                Xem hồ sơ công khai
              </RouteButton>
            </Panel>
          ))
        : requests.map((r) => (
            <Panel key={r.id} title={r.title}>
              <Copy>
                {r.user} · {r.tags.join(", ")}
              </Copy>
              <RouteButton secondary href={`/explore/requests/${r.id}`}>
                Xem nhu cầu học
              </RouteButton>
            </Panel>
          ))}
      {(tab === "Người chia sẻ" ? !profiles.length : !requests.length) && (
        <EmptyState
          title="Không tìm thấy kết quả"
          description="Thử kỹ năng hoặc từ khóa khác."
        />
      )}
      <RouteButton href="/login">Đăng nhập để trao đổi</RouteButton>
    </PublicPage>
  );
}
export function PublicGuestProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const { session } = useAuthSession();
  const profile = publicProfiles.find((p) => p.id === userId);
  return (
    <PublicPage title="Hồ sơ công khai">
      {!profile ? (
        <EmptyState
          title="Không tìm thấy người chia sẻ"
          description="Hồ sơ không có trong dữ liệu mẫu."
        />
      ) : (
        <Panel title={profile.name}>
          <Copy>{profile.bio ?? "Người chia sẻ chưa thêm giới thiệu."}</Copy>
          <Copy>Uy tín mẫu: {profile.reputation ?? "Chưa có thông tin"}</Copy>
          {profile.skills.map((s) => (
            <View key={s.id} style={{ gap: 6 }}>
              <Copy>
                {s.name} · {s.level}
              </Copy>
              <Badge label={s.verified ? "Đã xác minh" : "Chưa xác minh"} />
            </View>
          ))}
          <RouteButton href={session ? "/discover" : "/login"}>
            {session ? "Khám phá người chia sẻ" : "Đăng nhập để kết nối"}
          </RouteButton>
        </Panel>
      )}
    </PublicPage>
  );
}
export function PublicGuestRequestScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuthSession();
  const request = learningRequests.find((r) => r.id === id);
  return (
    <PublicPage title="Nhu cầu học tập">
      {!request ? (
        <EmptyState
          title="Yêu cầu không khả dụng"
          description="Yêu cầu không có trong dữ liệu mẫu."
        />
      ) : (
        <Panel title={request.title}>
          <Badge label="Đang mở" />
          <Copy>
            {request.user} · {request.tags.join(", ")}
          </Copy>
          <Copy>
            {request.sessions} buổi gợi ý · {request.budget}
          </Copy>
          <Copy>
            Người học đang tìm người chia sẻ phù hợp để thương lượng nội dung và
            lịch học.
          </Copy>
          <RouteButton secondary href={`/explore/profiles/${request.userId}`}>
            Xem người đăng
          </RouteButton>
          <RouteButton href={session ? "/discover" : "/login"}>
            {session ? "Tìm yêu cầu học" : "Đăng nhập để kết nối"}
          </RouteButton>
        </Panel>
      )}
    </PublicPage>
  );
}
