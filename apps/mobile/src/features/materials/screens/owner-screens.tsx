import { useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { FormNotice } from "@/components/FormNotice";
import {
  FeaturePage,
  Panel,
  Copy,
  RouteButton,
} from "@/components/feature-page";
import {
  useConnections,
  useConnectionCommand,
  ConnectionFeedback,
  connectionError,
} from "@/features/connections";
import { MaterialEditorForm } from "../components/material-editor-form";
import {
  useMyMaterials,
  useMyMaterialPages,
  useMaterialsApi,
} from "../hooks/use-materials";

export function MyMaterialsScreen() {
  const query = useMyMaterialPages(),
    api = useMaterialsApi();
  const command = useConnectionCommand([["materials"]]);
  const [archive, setArchive] = useState<string>();
  return (
    <FeaturePage
      demo={false}
      title="Tài liệu tôi chia sẻ"
      back="/profile"
      refreshing={query.isFetching}
      onRefresh={() => {
        void query.refetch();
      }}
    >
      <RouteButton href="/materials/new">Đăng tài liệu</RouteButton>
      <ConnectionFeedback
        loading={query.isLoading}
        error={query.error}
        retry={query.refetch}
      />
      {!!command.error && (
        <FormNotice tone="error">{connectionError(command.error)}</FormNotice>
      )}
      {command.uncertain && (
        <Copy>
          Chưa xác định kết quả thao tác. Tải lại danh sách để kiểm tra trước
          khi gửi lại.
        </Copy>
      )}
      {query.items.map((material) => (
        <Panel key={material.id} title={material.title}>
          <Badge label={material.status} />
          <Copy>{material.rejectReason ?? material.description}</Copy>
          <RouteButton secondary href={`/materials/${material.id}/edit`}>
            Xem / chỉnh sửa
          </RouteButton>
          {material.status === "DRAFT" && (
            <Button
              disabled={
                command.pending ||
                command.uncertain ||
                query.isFetching ||
                !!query.error
              }
              onPress={() => {
                void command.run("submit:" + material.id, () =>
                  api.submit(material.id),
                );
              }}
            >
              Gửi duyệt
            </Button>
          )}
          {!["ARCHIVED", "PENDING_REVIEW"].includes(material.status) && (
            <Button
              variant="paper"
              disabled={command.pending || command.uncertain}
              onPress={() => setArchive(material.id)}
            >
              Ngừng phân phối
            </Button>
          )}
          {archive === material.id && (
            <>
              <Copy>Xác nhận ngừng phân phối tài liệu này?</Copy>
              <Button
                disabled={command.pending || command.uncertain}
                onPress={() => {
                  void command
                    .run("archive:" + material.id, () =>
                      api.archive(material.id),
                    )
                    .then((result) => {
                      if (result) setArchive(undefined);
                    });
                }}
              >
                Xác nhận ngừng
              </Button>
              <Button variant="ghost" onPress={() => setArchive(undefined)}>
                Giữ tài liệu
              </Button>
            </>
          )}
        </Panel>
      ))}
      {query.data && query.items.length === 0 && (
        <Copy>Bạn chưa chia sẻ tài liệu nào.</Copy>
      )}
      {query.hasNextPage && (
        <Button
          variant="paper"
          disabled={query.isFetching}
          onPress={() => void query.fetchNextPage()}
        >
          Xem thêm tài liệu
        </Button>
      )}
    </FeaturePage>
  );
}
export function MaterialEditorScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>(),
    query = useMyMaterials(),
    runtime = useConnections();
  const material = query.data?.find((item) => item.id === id);
  return (
    <FeaturePage
      demo={false}
      title={id ? "Chỉnh sửa tài liệu" : "Đăng tài liệu"}
      back="/materials/mine"
    >
      <ConnectionFeedback
        loading={query.isLoading}
        error={query.error}
        retry={query.refetch}
      />
      {query.data && (!id || material) && (
        <MaterialEditorForm
          key={JSON.stringify([runtime.key, id, material?.listingVersion])}
          material={material}
        />
      )}
      {query.data && id && !material && (
        <Copy>Tài liệu không tồn tại hoặc không thuộc tài khoản này.</Copy>
      )}
    </FeaturePage>
  );
}
