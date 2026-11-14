import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { AppScreenLayout } from "@/features/shell";
import {
  RequestsFeedScreen,
  RequestCreateButton,
} from "@/features/learning-requests";
import { MaterialsCatalogContent } from "@/features/materials";
import { Button } from "@/components/Button";
import { appColors } from "@/constants/theme";
import { ScreenLoadingBoundary } from "@/components/ScreenLoadingBoundary";
import { DiscoverTabs } from "../components/discover-tabs";

export function DiscoverScreen() {
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const router = useRouter();
  const materials = tab === "materials";
  return (
    <AppScreenLayout
      title="Khám phá"
      selected="Khám phá"
      rightAction={
        materials ? (
          <Button
            variant="craft"
            size="sm"
            leadingIcon="plus"
            onPress={() => router.push("/materials/new")}
          >
            Đăng tài liệu
          </Button>
        ) : (
          <RequestCreateButton />
        )
      }
    >
      {() => (
        <>
          <DiscoverTabs
            materials={materials}
            onChange={(value) =>
              router.setParams({ tab: value ? "materials" : "requests" })
            }
          />
          <ScreenLoadingBoundary>
            <View
              style={{
                flex: 1,
                minHeight: 0,
                backgroundColor: appColors.canvas,
              }}
            >
              {materials ? (
                <MaterialsCatalogContent />
              ) : (
                <RequestsFeedScreen embedded />
              )}
            </View>
          </ScreenLoadingBoundary>
        </>
      )}
    </AppScreenLayout>
  );
}
