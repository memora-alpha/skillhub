import { useEffect, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { FeaturePage, Copy } from "@/components/feature-page";
import { useConnections, ConnectionFeedback } from "@/features/connections";
import { MaterialEditorForm } from "../components/material-editor-form";
import { useMyMaterials } from "../hooks/use-materials";

export function MaterialEditorScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const runtime = useConnections();
  return <OwnerEditorContent key={JSON.stringify([runtime.key, id])} id={id} />;
}
function OwnerEditorContent({ id }: Readonly<{ id?: string }>) {
  const query = useMyMaterials(!!id, true);
  const runtime = useConnections();
  const [opened, setOpened] = useState(!id);
  const material = query.data?.find((item) => item.id === id);
  useEffect(() => {
    if (query.isSuccess && !query.isFetching && !query.error && material)
      setOpened(true);
  }, [query.isSuccess, query.isFetching, query.error, material]);
  return (
    <FeaturePage
      title={id ? "Chỉnh sửa tài liệu" : "Đăng tài liệu"}
      back="/materials/mine?tab=posted"
      backBehavior="history"
      compact
    >
      <ConnectionFeedback
        loading={!!id && !opened && (query.isLoading || query.isFetching)}
        error={query.error}
        retry={query.refetch}
      />
      {(!id || (opened && material)) && (
        <MaterialEditorForm
          key={JSON.stringify([runtime.key, id])}
          material={material}
          readBlocked={
            !!id && (query.isFetching || !!query.error || query.denied)
          }
        />
      )}
      {query.isSuccess &&
        !query.isFetching &&
        !query.error &&
        query.data &&
        id &&
        !material && (
          <Copy>Tài liệu không tồn tại hoặc không thuộc tài khoản này.</Copy>
        )}
    </FeaturePage>
  );
}
