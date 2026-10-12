import { ScrollView, Text } from "react-native";
import { Redirect, useRouter } from "expo-router";
import { appColors, fonts } from "@/constants/theme";
import { appRoutes } from "@/constants/navigation";
import { useAuthSession } from "@/features/auth";
import { AppScreenLayout } from "@/features/shell";
import { useMockMessages } from "@/features/messages";
import { learningRequests } from "@/features/discovery";
import { HomeContent } from "../components/HomeContent";
import { matchingRequests } from "../mocks/home";
export function HomeScreen() {
  const { session } = useAuthSession();
  const { conversations } = useMockMessages();
  const router = useRouter();
  if (!session) return <Redirect href="/login" />;
  return (
    <AppScreenLayout title="" selected="Trang chủ">
      {(open) => {
        const action = (label: string) => {
          if (label === "Hoàn thiện hồ sơ") return router.push("/edit-profile");
          if (appRoutes[label]) return open(label);
          const matched = matchingRequests.find((r) => r.title === label);
          if (matched)
            return router.push(
              learningRequests.some((r) => r.id === matched.id)
                ? `/explore/requests/${matched.id}`
                : "/discover",
            );
          const conversation = conversations.find((c) => c.name === label);
          if (conversation)
            return router.push(`/chat/${conversation.proposal}`);
          router.push("/ui");
        };
        return (
          <ScrollView
            contentContainerStyle={{
              width: "100%",
              maxWidth: 1040,
              alignSelf: "center",
              padding: 20,
              gap: 12,
            }}
            keyboardShouldPersistTaps="handled"
          >
            <Text
              style={{
                color: appColors.muted,
                fontFamily: fonts.body,
                fontSize: 12,
              }}
            >
              Hoạt động học tập bên dưới dùng dữ liệu mẫu. Hồ sơ và tài khoản
              dùng thông tin đã lưu.
            </Text>
            <HomeContent
              name={session.name.split(/\s+/).slice(-2).join(" ")}
              isNew={session.isNew}
              onAction={action}
            />
          </ScrollView>
        );
      }}
    </AppScreenLayout>
  );
}
