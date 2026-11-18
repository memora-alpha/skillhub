import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useConnections } from "@/features/connections";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { appColors } from "@/constants/theme";
import type { MaterialOrder } from "../api/material-contracts";
import { usePublicMaterial } from "../hooks/use-materials";
import {
  materialFileSize,
  materialFileType,
} from "../utils/owner-material-presentation";
import { MaterialFileBadge } from "./material-summary";
import { MaterialCover } from "./material-cover";
import { MaterialOrderDetails } from "./material-order-details";
import { materialOrderStyles as orderStyles } from "./material-order.styles";
import { materialStyles as styles } from "./material.styles";
import { useMaterialDownload } from "../hooks/use-material-download";
import { MaterialDownloadFeedback } from "./material-download-feedback";
import { useMaterialReviewEligibility } from "../hooks/use-material-reviews";

export function MaterialOrderCard({
  order,
  visible,
  disabled,
  onRefund,
}: Readonly<{
  order: MaterialOrder;
  visible: boolean;
  disabled: boolean;
  onRefund: () => void;
}>) {
  // Enrich visible rows with the current listing; purchase history stays immutable.
  const query = usePublicMaterial(order.materialId, visible);
  const eligibility = useMaterialReviewEligibility(
    order.materialId,
    visible && !order.review,
  );
  const router = useRouter();
  const cache = useQueryClient();
  const runtime = useConnections();
  const download = useMaterialDownload(order.materialId, () => {
    void cache.invalidateQueries({
      queryKey: [...runtime.key, "materials", "orders"],
    });
    void cache.invalidateQueries({
      queryKey: [
        ...runtime.key,
        "materials",
        "review-eligibility",
        order.materialId,
      ],
    });
  });
  const material = query.data;
  const snapshot = order.purchasedMaterial;
  const title =
    material?.title ??
    snapshot?.title ??
    snapshot?.originalFilename ??
    "Tài liệu đã mua";
  const hasReview =
    order.review?.hasReview ?? !!eligibility.data?.currentReview;
  const canReview = order.review?.canReview ?? eligibility.data?.canReview;
  const showReview = !!(
    hasReview ||
    canReview ||
    (!order.review && eligibility.error)
  );
  const downloadLocked =
    disabled || download.pending || download.awaitingConfirmation;
  const refundLocked =
    downloadLocked || order.refundEligibility?.canRefund === false;
  return (
    <View style={orderStyles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Xem ${title}`}
        onPress={() => router.push(`/materials/${order.materialId}`)}
        style={orderStyles.header}
      >
        {material ? (
          <MaterialCover material={material} compact />
        ) : (
          <View style={orderStyles.fallback}>
            <MaterialFileBadge />
          </View>
        )}
        <View style={orderStyles.content}>
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
          {material ? (
            <>
              <Text style={styles.caption} numberOfLines={1}>
                {[
                  materialFileType(material),
                  materialFileSize(material.file?.sizeBytes),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
              <Text style={styles.text} numberOfLines={1}>
                {material.description}
              </Text>
            </>
          ) : (
            <Text style={styles.caption}>
              {query.error
                ? "Thông tin hiện tại chưa khả dụng."
                : "Thông tin lúc mua"}
            </Text>
          )}
        </View>
        <Icon name="chevron" size={18} color={appColors.muted} />
      </Pressable>
      <MaterialOrderDetails order={order} currentTitle={material?.title} />
      {(order.status === "SUCCESS" || showReview) && (
        <View style={orderStyles.actions}>
          {order.status === "SUCCESS" && (
            <Button
              variant="craft"
              size="sm"
              style={orderStyles.action}
              leadingIcon="download"
              disabled={downloadLocked}
              onPress={() => void download.start(true)}
            >
              {download.pending ? "Đang tải…" : "Tải bản đã mua"}
            </Button>
          )}
          {showReview && (
            <Button
              variant="paper"
              size="sm"
              leadingIcon="star"
              style={orderStyles.action}
              disabled={disabled || (!order.review && eligibility.isFetching)}
              onPress={() =>
                router.push(`/materials/${order.materialId}/review`)
              }
            >
              {hasReview
                ? "Xem đánh giá"
                : canReview
                  ? "Viết đánh giá"
                  : "Đánh giá tài liệu"}
            </Button>
          )}
        </View>
      )}
      {order.status === "SUCCESS" && (
        <View style={orderStyles.refundRow}>
          <Text style={[styles.caption, orderStyles.refundHint]}>
            {order.refundEligibility?.canRefund === false
              ? "Không đủ điều kiện hoàn tiền"
              : "Điều kiện được kiểm tra khi gửi yêu cầu"}
          </Text>
          <Button
            variant="ghost"
            size="sm"
            leadingIcon="wallet"
            disabled={refundLocked}
            onPress={() => {
              if (!refundLocked) onRefund();
            }}
          >
            Hoàn tiền
          </Button>
        </View>
      )}
      <MaterialDownloadFeedback download={download} />
    </View>
  );
}
