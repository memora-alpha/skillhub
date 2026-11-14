import { useLocalSearchParams } from "expo-router";
import { FeaturePage, Copy } from "@/components/feature-page";
import { useConnections, ConnectionFeedback } from "@/features/connections";
import { MaterialEditorForm } from "../components/material-editor-form";
import { useMyMaterials } from "../hooks/use-materials";

export function MaterialEditorScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>(),
    query = useMyMaterials(!!id),
    runtime = useConnections();
  const material = query.data?.find((item) => item.id === id);
  return (
    <FeaturePage
      title={id ? "Chỉnh sửa tài liệu" : "Đăng tài liệu"}
      back="/materials/mine"
      backBehavior="history"
      compact
    >
      <ConnectionFeedback
        loading={query.isLoading}
        error={query.error}
        retry={query.refetch}
      />
      {(!id || material) && (
        <MaterialEditorForm
          key={JSON.stringify([runtime.key, id])}
          material={material}
        />
      )}
      {query.data && id && !material && (
        <Copy>Tài liệu không tồn tại hoặc không thuộc tài khoản này.</Copy>
      )}
    </FeaturePage>
  );
}
