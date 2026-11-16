import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useConnections } from "@/features/connections";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { appColors } from "@/constants/theme";
import type { MaterialOrder } from "../api/material-contracts";
import { usePublicMaterial } from "../hooks/use-materials";
import { materialDate } from "../utils/owner-material-presentation";
import { MaterialFileBadge } from "./material-summary";
import { materialStyles as styles } from "./material.styles";
import { useMaterialDownload } from "../hooks/use-material-download";
import { MaterialDownloadFeedback } from "./material-download-feedback";
import { useMaterialReviewEligibility } from "../hooks/use-material-reviews";
import { materialRefundReason } from "../utils/material-failure";

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
  // New order pages carry purchase snapshots and review state. Only older
  // responses need the separate eligibility read; public metadata is optional.
  const query = usePublicMaterial(
    order.materialId,
    visible && !order.purchasedMaterial,
  );
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
  const title = order.purchasedMaterial
    ? (order.purchasedMaterial.title ??
      order.purchasedMaterial.originalFilename ??
      "Tài liệu đã mua")
    : (query.data?.title ?? "Tài liệu đã mua");
  const hasReview =
    order.review?.hasReview ?? !!eligibility.data?.currentReview;
  const canReview = order.review?.canReview ?? eligibility.data?.canReview;
  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Xem ${title}`}
        onPress={() => router.push(`/materials/${order.materialId}`)}
        style={styles.fileRow}
      >
        <MaterialFileBadge />
        <View style={styles.grow}>
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
          {!!order.purchasedMaterial?.originalFilename && (
            <Text style={styles.meta} numberOfLines={1}>
              {order.purchasedMaterial.originalFilename}
            </Text>
          )}
          <Text style={styles.meta}>
            {materialDate(order.createdAt)} · Phiên bản {order.listingVersion}
          </Text>
        </View>
        <Icon name="chevron" size={18} color={appColors.muted} />
      </Pressable>
      <View style={styles.row}>
        <Text
          style={[
            styles.caption,
            order.status === "SUCCESS" ? styles.success : styles.meta,
          ]}
        >
          {order.status === "SUCCESS" ? "Đã mua" : "Đã hoàn tiền"}
        </Text>
        <Text style={styles.price}>
          {Number(order.grossCredit).toLocaleString("vi-VN")} CR
        </Text>
      </View>
      {order.status === "SUCCESS" && (
        <View style={styles.actions}>
          <Button
            variant="craft"
            size="sm"
            style={styles.action}
            leadingIcon="download"
            disabled={
              disabled || download.pending || download.awaitingConfirmation
            }
            onPress={() => void download.start(true)}
          >
            {download.pending ? "Đang tải…" : "Tải tài liệu"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            style={styles.action}
            disabled={
              disabled ||
              download.pending ||
              download.awaitingConfirmation ||
              order.refundEligibility?.canRefund === false
            }
            onPress={onRefund}
          >
            Hoàn tiền
          </Button>
        </View>
      )}
      {order.status === "SUCCESS" &&
        order.refundEligibility?.canRefund === false && (
          <Text style={styles.caption}>
            {materialRefundReason(order.refundEligibility.reasonCode)}
          </Text>
        )}
      {order.status === "SUCCESS" && order.refundEligibility?.canRefund && (
        <Text style={styles.caption}>
          Hạn yêu cầu hoàn tiền:{" "}
          {new Date(order.refundEligibility.deadline).toLocaleString("vi-VN")}
        </Text>
      )}
      {(hasReview || canReview || (!order.review && eligibility.error)) && (
        <Button
          variant="paper"
          size="sm"
          leadingIcon="star"
          disabled={disabled || (!order.review && eligibility.isFetching)}
          onPress={() => router.push(`/materials/${order.materialId}/review`)}
        >
          {hasReview
            ? "Xem đánh giá"
            : canReview
              ? "Viết đánh giá"
              : "Đánh giá tài liệu"}
        </Button>
      )}
      <MaterialDownloadFeedback download={download} />
    </View>
  );
}
