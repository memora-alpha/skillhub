import { useLocalSearchParams, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
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
import {
  useMaterial,
  useMaterialOwnership,
  useMaterialsApi,
} from "../hooks/use-materials";
import type { MaterialOrder } from "../api/material-contracts";

export function MaterialPurchaseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(),
    query = useMaterial(id),
    orders = useMaterialOwnership(id);
  const runtime = useConnections(),
    api = useMaterialsApi(),
    cache = useQueryClient(),
    router = useRouter();
  const command = useConnectionCommand<MaterialOrder>([["materials"]]);
  const material = query.data;
  const purchased = !!orders.data;
  async function finish(order: MaterialOrder | undefined) {
    if (!order || !runtime.isCurrent()) return;
    await cache.invalidateQueries({ queryKey: ["wallet", runtime.userId] });
    router.replace(`/materials/${id}/access`);
  }
  return (
    <FeaturePage
      demo={false}
      title="Xác nhận mua tài liệu"
      back={`/materials/${id}`}
    >
      <ConnectionFeedback
        loading={query.isLoading || orders.isLoading}
        error={query.error || orders.error}
        retry={() => {
          void query.refetch();
          void orders.refetch();
        }}
      />
      {material && (
        <Panel title={material.title}>
          <Copy>
            Giá: {material.priceCredit} CR · Phiên bản {material.listingVersion}
          </Copy>
          <Copy>
            Thanh toán bằng Credit khả dụng. Kiểm tra giá và phiên bản trước khi
            xác nhận mua.
          </Copy>
          {purchased ? (
            <RouteButton href={`/materials/${id}/access`}>
              Bạn đã mua · Mở tài liệu
            </RouteButton>
          ) : (
            <Button
              disabled={
                query.isFetching ||
                !!query.error ||
                orders.isFetching ||
                !!orders.error ||
                command.pending ||
                command.uncertain ||
                material.ownerId === runtime.userId ||
                material.status !== "PUBLISHED" ||
                material.accessType !== "PAID"
              }
              onPress={() => {
                void command
                  .run(
                    JSON.stringify({ id, version: material.listingVersion }),
                    (key) => api.purchase(id, material.listingVersion, key),
                  )
                  .then(finish);
              }}
            >
              Xác nhận mua với giá {material.priceCredit} CR
            </Button>
          )}
          {!!command.error && (
            <FormNotice tone="error">
              {connectionError(command.error)}
            </FormNotice>
          )}
          {command.uncertain && (
            <>
              <Copy>
                Chưa xác định kết quả thanh toán. Kiểm tra lại bằng cùng yêu cầu
                để tránh thu hai lần.
              </Copy>
              <Button
                disabled={command.pending}
                onPress={() => {
                  void command.retry().then(finish);
                }}
              >
                Kiểm tra giao dịch mua
              </Button>
            </>
          )}
          <RouteButton secondary href="/wallet">
            Xem ví Credit
          </RouteButton>
        </Panel>
      )}
    </FeaturePage>
  );
}
