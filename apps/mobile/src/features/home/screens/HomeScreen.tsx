import { Redirect, useIsFocused, useRouter } from "expo-router";
import { RefreshableScrollView } from "@/components/RefreshableScrollView";
import { useAuthSession } from "@/features/auth";
import { RequestsProvider } from "@/features/learning-requests";
import { AppScreenLayout } from "@/features/shell";
import { useAppRefresh } from "@/providers/AppRefreshProvider";
import { HomeContent } from "../components/HomeContent";
import { useHomeData } from "../hooks/use-home-data";

export function HomeDashboard() {
  const { session } = useAuthSession();
  const router = useRouter();
  const focused = useIsFocused();
  const data = useHomeData(focused);
  const refresh = useAppRefresh();
  if (!session) return <Redirect href="/login" />;
  return (
    <AppScreenLayout title="" selected="Trang chủ">
      {() => (
        <RefreshableScrollView
          contentContainerStyle={{
            width: "100%",
            maxWidth: 1040,
            alignSelf: "center",
            padding: 20,
            paddingBottom: 32,
          }}
          keyboardShouldPersistTaps="handled"
          refreshing={refresh.refreshing}
          onRefresh={() => void refresh.refresh()}
        >
          <HomeContent
            session={session}
            data={data}
            onNavigate={(href) => router.push(href)}
          />
        </RefreshableScrollView>
      )}
    </AppScreenLayout>
  );
}

export function HomeScreen() {
  const { session } = useAuthSession();
  if (!session) return <Redirect href="/login" />;
  return (
    <RequestsProvider key={session.userId}>
      <HomeDashboard />
    </RequestsProvider>
  );
}
