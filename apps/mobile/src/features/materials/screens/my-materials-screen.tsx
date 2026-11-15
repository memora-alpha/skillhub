import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { FeaturePage } from "@/components/feature-page";
import { EmptyState } from "@/components/EmptyState";
import { useConnections } from "@/features/connections";
import { MyMaterialTabs, myMaterialTab } from "../components/my-material-tabs";
import { PostedMaterialsContent } from "./posted-materials-content";
import { MaterialLibraryContent } from "./material-library-screen";
import { materialStyles as styles } from "../components/material.styles";

export function MyMaterialsScreen() {
  const runtime = useConnections();
  return <MyMaterialsContent key={JSON.stringify(runtime.key)} />;
}
function MyMaterialsContent() {
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const router = useRouter();
  const selected = myMaterialTab(tab);
  return (
    <FeaturePage
      title="Tài liệu của tôi"
      back="/profile"
      backBehavior="history"
      scrollable={false}
    >
      <MyMaterialTabs
        value={selected}
        onChange={(value) => router.setParams({ tab: value })}
      />
      {selected === "library" ? (
        <MaterialLibraryContent />
      ) : selected === "posted" ? (
        <PostedMaterialsContent />
      ) : (
        <View style={{ padding: 24 }}>
          <EmptyState
            icon="book"
            title="Lưu yêu thích chưa khả dụng"
            titleStyle={styles.heading}
            description="Bạn sẽ có thể lưu tài liệu để xem sau tại đây khi tính năng được bổ sung."
          />
        </View>
      )}
    </FeaturePage>
  );
}
