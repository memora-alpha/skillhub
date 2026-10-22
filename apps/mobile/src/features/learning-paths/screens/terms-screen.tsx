import { useLocalSearchParams } from "expo-router";
import { EmptyState } from "@/components/EmptyState";
import { FeaturePage } from "@/components/feature-page";
import { FlowRedirect } from "@/components/learning-flow";
import { uuid } from "@/lib/http/contracts";

export function TermsEditorScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  if (uuid.safeParse(id).success)
    return (
      <FlowRedirect
        href={{ pathname: "/paths/[id]", params: { id, editTerms: "1" } }}
      />
    );
  return (
    <FeaturePage
      title="Điều chỉnh điều khoản"
      back="/my-learning?tab=paths"
      demo={false}
    >
      <EmptyState
        title="Không tìm thấy lộ trình"
        description="Mở điều khoản từ một lộ trình hợp lệ để tiếp tục."
      />
    </FeaturePage>
  );
}
