import type { ReactNode } from "react";
import { Text, View } from "react-native";
import {
  Redirect,
  useLocalSearchParams,
  useRouter,
  type Href,
} from "expo-router";
import { SafeAreaView } from "@/components/SafeArea";
import { RefreshableScrollView } from "@/components/RefreshableScrollView";
import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/Button";
import { Panel, Copy, RouteButton, ui } from "@/components/feature-page";
import { useAuthSession } from "@/features/auth";
import { appColors, fonts, typography } from "@/constants/theme";
import { guestDestination } from "../public-navigation";

function GuestAccess({
  title,
  destination,
  children,
}: Readonly<{
  title: string;
  destination: Href;
  children: ReactNode;
}>) {
  const router = useRouter();
  const { session } = useAuthSession();
  if (session) return <Redirect href={destination} />;
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
        <Button
          variant="paper"
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace("/")
          }
        >
          Quay lại
        </Button>
      </View>
      <RefreshableScrollView contentContainerStyle={ui.page}>
        <Text
          accessibilityRole="header"
          style={{
            fontFamily: fonts.bold,
            ...typography.title,
            color: appColors.ink,
          }}
        >
          {title}
        </Text>
        <Panel title="Đăng nhập để tiếp tục">
          <Copy>{children}</Copy>
          <RouteButton href="/login">Đăng nhập</RouteButton>
          <RouteButton secondary href="/register">
            Tạo tài khoản
          </RouteButton>
        </Panel>
      </RefreshableScrollView>
    </SafeAreaView>
  );
}

export function PublicExploreScreen() {
  const { query } = useLocalSearchParams<{ query?: string | string[] }>();
  return (
    <GuestAccess
      title="Khám phá cộng đồng"
      destination={guestDestination("explore", query)}
    >
      Đăng nhập để tìm người chia sẻ kỹ năng và các yêu cầu học trong cộng đồng.
    </GuestAccess>
  );
}

export function PublicGuestProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId?: string | string[] }>();
  return (
    <GuestAccess
      title="Hồ sơ công khai"
      destination={guestDestination("profile", userId)}
    >
      Đăng nhập để xem hồ sơ và kỹ năng được chia sẻ.
    </GuestAccess>
  );
}

export function PublicGuestRequestScreen() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  return (
    <GuestAccess
      title="Nhu cầu học tập"
      destination={guestDestination("request", id)}
    >
      Đăng nhập để xem nội dung yêu cầu học và kết nối với người đăng.
    </GuestAccess>
  );
}
