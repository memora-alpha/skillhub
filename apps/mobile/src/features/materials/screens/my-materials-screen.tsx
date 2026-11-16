import { useLocalSearchParams, useRouter } from "expo-router";
import { FeaturePage } from "@/components/feature-page";
import { useConnections } from "@/features/connections";
import { MyMaterialTabs, myMaterialTab } from "../components/my-material-tabs";
import { PostedMaterialsContent } from "./posted-materials-content";
import { MaterialLibraryContent } from "./material-library-screen";
import { SavedMaterialsContent } from "./saved-materials-content";

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
        <SavedMaterialsContent />
      )}
    </FeaturePage>
  );
}
