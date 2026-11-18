import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Pressable, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { FeaturePage } from "@/components/feature-page";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { appColors } from "@/constants/theme";
import { FormNotice } from "@/components/FormNotice";
import { useConnections, ConnectionFeedback } from "@/features/connections";
import { uuid } from "@/lib/http/contracts";
import { useMaterial, useMaterialOwnership } from "../hooks/use-materials";
import {
  canEditMaterial,
  materialPrice,
} from "../utils/owner-material-presentation";
import { MaterialSummary } from "../components/material-summary";
import { MaterialPublisher } from "../components/material-publisher";
import { materialStyles as styles } from "../components/material.styles";
import { materialOwnershipStatus } from "../utils/material-ownership-presentation";
import { useMaterialDownload } from "../hooks/use-material-download";
import { MaterialDownloadFeedback } from "../components/material-download-feedback";
import { RelatedMaterials } from "../components/material-detail-sections";
import { MaterialReviews } from "../components/material-reviews";
import { MaterialDetailSkeleton } from "../components/material-detail-skeleton";
import { MaterialFavoriteButton } from "../components/material-favorite-button";
import { MaterialUnavailable } from "../components/material-unavailable";
import { isMaterialUnavailable } from "../utils/material-availability";

export function MaterialDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = typeof params.id === "string" ? params.id : "";
  const runtime = useConnections();
  return <DetailContent key={JSON.stringify([runtime.key, id])} id={id} />;
}
function DetailContent({ id }: Readonly<{ id: string }>) {
  const cache = useQueryClient();
  const query = useMaterial(id);
  const runtime = useConnections();
  const router = useRouter();
  const unavailable = isMaterialUnavailable(query.error);
  const material = unavailable || query.denied ? undefined : query.data;
  const [refreshing, setRefreshing] = useState(false);
  const own = material?.ownerId === runtime.userId;
  const ownership = useMaterialOwnership(id, !!material && !own);
  const download = useMaterialDownload(id, () => {
    void cache.invalidateQueries({
      queryKey: [...runtime.key, "materials", "free-library"],
    });
    void cache.invalidateQueries({
      queryKey: [...runtime.key, "materials", "orders"],
    });
    void cache.invalidateQueries({
      queryKey: [...runtime.key, "materials", "review-eligibility", id],
      exact: true,
    });
  });
  const open = own || !!ownership.data || material?.accessType === "FREE";
  const available =
    !!material &&
    (own
      ? !!material.file
      : !!ownership.data || material.status === "PUBLISHED");
  const locked =
    query.isFetching ||
    !!query.error ||
    (!own &&
      (ownership.isFetching ||
        !!ownership.error ||
        ownership.data === undefined));
  const checkingAccess =
    !own && ownership.isFetching && ownership.data === undefined;
  const refresh = async () => {
    if (refreshing || query.isFetching || ownership.isFetching) return;
    setRefreshing(true);
    try {
      await Promise.allSettled([
        query.refetch(),
        ...(!own ? [ownership.refetch()] : []),
        ...(material
          ? [
              cache.refetchQueries({
                queryKey: [
                  ...runtime.key,
                  "materials",
                  "related",
                  material.skillId,
                  id,
                ],
                type: "active",
              }),
            ]
          : []),
        cache.refetchQueries({
          queryKey: [...runtime.key, "materials", "reviews", id],
          type: "active",
        }),
        cache.refetchQueries({
          queryKey: [...runtime.key, "materials", "review-eligibility", id],
          type: "active",
        }),
      ]);
    } finally {
      setRefreshing(false);
    }
  };
  return (
    <FeaturePage
      title="Chi tiết tài liệu"
      section="Khám phá"
      back="/discover"
      backBehavior="history"
      compact
      refreshing={refreshing}
      onRefresh={refresh}
      rightAction={
        material && !own ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Báo cáo tài liệu"
            style={({ pressed }) => [
              styles.reportAction,
              pressed && styles.pressed,
            ]}
            onPress={() =>
              router.push({
                pathname: "/reports/new",
                params: { materialId: id },
              })
            }
          >
            <Icon name="flag" size={20} color={appColors.muted} />
          </Pressable>
        ) : undefined
      }
      stickyFooter={
        material ? (
          <View style={styles.sticky}>
            <Button
              variant="craft"
              leadingIcon={open ? "download" : "wallet"}
              accessibilityState={{ busy: download.pending || checkingAccess }}
              disabled={
                locked ||
                !available ||
                download.pending ||
                download.awaitingConfirmation
              }
              onPress={() => {
                if (locked || !available) return;
                if (open) void download.start(!own && !!ownership.data);
                else router.push(`/materials/${id}/purchase`);
              }}
            >
              {checkingAccess
                ? "Đang kiểm tra quyền truy cập…"
                : download.pending
                  ? "Đang tải…"
                  : open
                    ? "Tải tài liệu"
                    : `Mua tài liệu · ${materialPrice(material)}`}
            </Button>
          </View>
        ) : undefined
      }
    >
      {unavailable ? (
        <MaterialUnavailable />
      ) : (
        <ConnectionFeedback error={query.error} retry={refresh} />
      )}
      {query.isLoading && !material && <MaterialDetailSkeleton />}
      {!uuid.safeParse(id).success && (
        <FormNotice tone="info" compact>
          Tài liệu không khả dụng.
        </FormNotice>
      )}
      {material && (
        <View style={styles.page}>
          {material.status === "ARCHIVED" && (
            <FormNotice tone="info" compact>
              Tài liệu đã ngừng chia sẻ và không còn hiển thị trong Khám phá.
              Người đã mua vẫn có thể tải tài liệu từ Thư viện.
            </FormNotice>
          )}
          <MaterialSummary
            material={material}
            cover
            ownershipStatus={materialOwnershipStatus({
              own,
              free: material.accessType === "FREE",
              purchased: !!ownership.data,
              resolved: ownership.data !== undefined,
              error: !!ownership.error,
            })}
          />
          <MaterialPublisher material={material} />
          {material.status === "PUBLISHED" && (
            <MaterialFavoriteButton materialId={material.id} />
          )}
          <View style={styles.divider} />
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Nội dung</Text>
            <Text selectable style={styles.body}>
              {material.description}
            </Text>
          </View>
          {material.file && (
            <View style={styles.attachment}>
              <Icon name="paperclip" size={18} color={appColors.muted} />
              <Text selectable style={[styles.meta, { flex: 1 }]}>
                {material.file.originalFilename ?? "Tệp tài liệu"}
              </Text>
            </View>
          )}
          {!own && (
            <ConnectionFeedback
              error={ownership.error}
              retry={ownership.refetch}
            />
          )}
          {own && canEditMaterial(material) && (
            <Button
              variant="paper"
              leadingIcon="edit"
              onPress={() => router.push(`/materials/${id}/edit`)}
            >
              Chỉnh sửa tài liệu
            </Button>
          )}
          <MaterialDownloadFeedback download={download} />
          {material.status === "PUBLISHED" && (
            <MaterialReviews material={material} />
          )}
          <RelatedMaterials material={material} />
        </View>
      )}
    </FeaturePage>
  );
}
