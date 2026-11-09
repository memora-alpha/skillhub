import { useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { Linking } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/Input";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { ChoiceGroup } from "@/components/choice-group";
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
import { FormNotice } from "@/components/FormNotice";
import {
  useMaterial,
  useMaterialSearch,
  useMaterialOwnership,
  useMaterialOrderPages,
  useMaterialsApi,
} from "../hooks/use-materials";

export function MaterialsScreen() {
  const [search, setSearch] = useState(""),
    [term, setTerm] = useState(""),
    [filter, setFilter] = useState("Tất cả");
  const query = useMaterialSearch(
    term,
    filter === "Tất cả" ? undefined : (filter as "FREE" | "PAID"),
  );
  return (
    <FeaturePage
      demo={false}
      title="Tài liệu học tập"
      back="/home"
      refreshing={query.isRefetching}
      onRefresh={() => {
        void query.refetch();
      }}
    >
      <Input
        label="Tìm tài liệu"
        value={search}
        onChangeText={setSearch}
        maxLength={100}
      />
      <Button variant="paper" onPress={() => setTerm(search.trim())}>
        Tìm kiếm
      </Button>
      <ChoiceGroup
        label="Loại tài liệu"
        options={["Tất cả", "FREE", "PAID"]}
        value={filter}
        onChange={setFilter}
      />
      <RouteButton secondary href="/materials/library">
        Tài liệu đã mua
      </RouteButton>
      <RouteButton secondary href="/materials/mine">
        Tài liệu tôi chia sẻ
      </RouteButton>
      <ConnectionFeedback
        loading={query.isLoading}
        error={query.error}
        retry={query.refetch}
      />
      {query.items.map((material) => (
        <Panel key={material.id} title={material.title}>
          <Badge
            label={
              material.accessType === "FREE"
                ? "Miễn phí"
                : material.priceCredit + " CR"
            }
          />
          <Copy>{material.description}</Copy>
          <Copy muted>Phiên bản {material.listingVersion}</Copy>
          <RouteButton secondary href={`/materials/${material.id}`}>
            Xem tài liệu
          </RouteButton>
        </Panel>
      ))}
      {query.data && !query.items.length && (
        <EmptyState
          title="Không tìm thấy tài liệu"
          description="Thử từ khóa hoặc bộ lọc khác."
        />
      )}
      {query.hasNextPage && (
        <Button
          disabled={query.isFetchingNextPage}
          onPress={() => {
            void query.fetchNextPage();
          }}
        >
          Xem thêm tài liệu
        </Button>
      )}
    </FeaturePage>
  );
}
export function MaterialDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(),
    query = useMaterial(id),
    runtime = useConnections();
  const orders = useMaterialOwnership(id);
  const material = query.data,
    owned = material?.ownerId === runtime.userId;
  const purchased = !!orders.data;
  return (
    <FeaturePage
      demo={false}
      title="Chi tiết tài liệu"
      back="/materials"
      refreshing={query.isFetching}
      onRefresh={() => {
        void query.refetch();
      }}
    >
      <ConnectionFeedback
        loading={query.isLoading}
        error={query.error}
        retry={query.refetch}
      />
      {material && (
        <>
          <Panel title={material.title}>
            <Badge label={material.status} />
            <Copy>{material.description}</Copy>
            <Copy>
              Phiên bản {material.listingVersion} ·{" "}
              {material.accessType === "FREE"
                ? "Miễn phí"
                : material.priceCredit + " CR"}
            </Copy>
            {material.rejectReason && (
              <Copy>Lý do từ chối: {material.rejectReason}</Copy>
            )}
            {material.file && (
              <Copy>
                Tệp: {material.file.originalFilename} ·{" "}
                {material.file.sizeBytes} byte
              </Copy>
            )}
          </Panel>
          {owned || purchased || material.accessType === "FREE" ? (
            <RouteButton href={`/materials/${id}/access`}>
              Mở tài liệu
            </RouteButton>
          ) : orders.data !== undefined && !orders.error ? (
            <RouteButton href={`/materials/${id}/purchase`}>
              Xem xác nhận mua
            </RouteButton>
          ) : (
            <ConnectionFeedback
              loading={orders.isLoading}
              error={orders.error}
              retry={orders.refetch}
            />
          )}
          {owned && (
            <RouteButton secondary href={`/materials/${id}/edit`}>
              Chỉnh sửa tài liệu
            </RouteButton>
          )}
          <RouteButton
            secondary
            href={{ pathname: "/reports/new", params: { materialId: id } }}
          >
            Báo cáo tài liệu
          </RouteButton>
        </>
      )}
    </FeaturePage>
  );
}
export function MaterialLibraryScreen() {
  const query = useMaterialOrderPages(),
    api = useMaterialsApi(),
    runtime = useConnections(),
    cache = useQueryClient();
  const [confirm, setConfirm] = useState<string>();
  const command = useConnectionCommand([["materials"]]);
  async function finishRefund(result: unknown) {
    if (result && runtime.isCurrent()) {
      setConfirm(undefined);
      await cache.invalidateQueries({ queryKey: ["wallet", runtime.userId] });
    }
  }
  return (
    <FeaturePage
      demo={false}
      title="Tài liệu đã mua"
      back="/materials"
      refreshing={query.isFetching}
      onRefresh={() => {
        void query.refetch();
      }}
    >
      <ConnectionFeedback
        loading={query.isLoading}
        error={query.error}
        retry={query.refetch}
      />
      {!!command.error && (
        <FormNotice tone="error">{connectionError(command.error)}</FormNotice>
      )}
      <Copy muted>
        Hoàn tiền trong 24 giờ nếu chưa được cấp đường dẫn tải. Hệ thống sẽ kiểm
        tra điều kiện và số dư người bán.
      </Copy>
      {query.items.map((order) => (
        <Panel
          key={order.id}
          title={`Đơn mua · ${new Date(order.createdAt).toLocaleDateString("vi-VN")}`}
        >
          <Badge label={order.status} />
          <Copy>
            {order.grossCredit} CR · phiên bản {order.listingVersion}
          </Copy>
          <Copy>{new Date(order.createdAt).toLocaleString("vi-VN")}</Copy>
          {order.status === "SUCCESS" && (
            <>
              <RouteButton href={`/materials/${order.materialId}/access`}>
                Mở tài liệu đã mua
              </RouteButton>
              <Button
                variant="paper"
                disabled={command.pending || command.uncertain}
                onPress={() => setConfirm(order.id)}
              >
                Yêu cầu hoàn tiền
              </Button>
              {confirm === order.id && (
                <>
                  <Copy>
                    Xác nhận hoàn tiền đơn này và thu hồi quyền truy cập?
                  </Copy>
                  <Button
                    disabled={command.pending}
                    onPress={() => {
                      void command
                        .run("refund:" + order.id, () => api.refund(order.id))
                        .then(finishRefund);
                    }}
                  >
                    Xác nhận hoàn tiền
                  </Button>
                  <Button variant="ghost" onPress={() => setConfirm(undefined)}>
                    Giữ đơn mua
                  </Button>
                </>
              )}
            </>
          )}
        </Panel>
      ))}
      {query.hasNextPage && (
        <Button
          variant="paper"
          disabled={query.isFetching}
          onPress={() => void query.fetchNextPage()}
        >
          Xem thêm đơn mua
        </Button>
      )}
      {query.data && query.items.length === 0 && (
        <EmptyState
          title="Chưa có đơn mua"
          description="Các tài liệu miễn phí có thể mở trực tiếp từ trang khám phá."
        />
      )}
      {command.uncertain && (
        <Button
          disabled={command.pending}
          onPress={() => {
            void command.retry().then(finishRefund);
          }}
        >
          Kiểm tra lại yêu cầu hoàn tiền
        </Button>
      )}
    </FeaturePage>
  );
}
export function MaterialAccessScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(),
    api = useMaterialsApi(),
    runtime = useConnections();
  const [pending, setPending] = useState(false),
    [error, setError] = useState<unknown>();
  return (
    <FeaturePage demo={false} title="Mở tài liệu" back="/materials/library">
      <Panel title="Tệp tài liệu">
        <Copy>Hệ thống kiểm tra quyền truy cập trước mỗi lần mở tệp.</Copy>
        <Copy>
          Mở tệp đã mua sẽ ghi nhận bạn đã sử dụng tài liệu và không còn đủ điều
          kiện hoàn tiền tự động.
        </Copy>
        {!!error && (
          <FormNotice tone="error">{connectionError(error)}</FormNotice>
        )}
        <Button
          disabled={pending}
          onPress={() => {
            if (pending) return;
            setPending(true);
            setError(undefined);
            void api
              .download(id)
              .then(async (file) => {
                if (runtime.isCurrent()) await Linking.openURL(file.url);
              })
              .catch((cause: unknown) => {
                if (runtime.isCurrent()) setError(cause);
              })
              .finally(() => {
                if (runtime.isCurrent()) setPending(false);
              });
          }}
        >
          {pending ? "Đang mở…" : "Mở / tải tệp tài liệu"}
        </Button>
      </Panel>
    </FeaturePage>
  );
}
