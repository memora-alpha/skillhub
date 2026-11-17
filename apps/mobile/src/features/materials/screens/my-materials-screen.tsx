import { useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Button } from "@/components/Button";
import { signedInChrome } from "@/constants/theme";
import { FeaturePage } from "@/components/feature-page";
import { useConnections } from "@/features/connections";
import { MyMaterialTabs, myMaterialTab } from "../components/my-material-tabs";
import { PostedMaterialsContent } from "./posted-materials-content";
import { MaterialLibraryContent } from "./material-library-screen";
import { SavedMaterialsContent } from "./saved-materials-content";

export function MyMaterialsScreen() {
  const runtime = useConnections();
  return (
    <MyMaterialsContent
      key={JSON.stringify(runtime.key)}
      enabled={runtime.enabled}
    />
  );
}
function MyMaterialsContent({ enabled }: Readonly<{ enabled: boolean }>) {
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const router = useRouter();
  const selected = myMaterialTab(tab);
  const [postedCreateDisabled, setPostedCreateDisabled] = useState(true);
  const [mutationLocked, setMutationLocked] = useState(false);
  return (
    <FeaturePage
      title="Tài liệu của tôi"
      back="/profile"
      backBehavior="history"
      scrollable={false}
      rightAction={
        <Button
          variant="craft"
          size="sm"
          style={{ backgroundColor: signedInChrome.accent }}
          leadingIcon="plus"
          accessibilityLabel="Đăng tài liệu"
          disabled={
            !enabled ||
            mutationLocked ||
            (selected === "posted" && postedCreateDisabled)
          }
          onPress={() => router.push("/materials/new")}
        >
          Đăng tài liệu
        </Button>
      }
    >
      <MyMaterialTabs
        value={selected}
        disabled={mutationLocked}
        onChange={(value) => {
          if (!mutationLocked) router.setParams({ tab: value });
        }}
      />
      {selected === "library" ? (
        <MaterialLibraryContent onMutationLockChange={setMutationLocked} />
      ) : selected === "posted" ? (
        <PostedMaterialsContent
          onCreateDisabledChange={setPostedCreateDisabled}
          onMutationLockChange={setMutationLocked}
        />
      ) : (
        <SavedMaterialsContent />
      )}
    </FeaturePage>
  );
}
