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
  materialDate,
  materialFileSize,
  materialFileType,
} from "../utils/owner-material-presentation";
import { MaterialFileBadge } from "./material-summary";
import { MaterialCover } from "./material-cover";
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
  return (
    <View style={styles.catalogCard}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Xem ${title}`}
        onPress={() => router.push(`/materials/${order.materialId}`)}
        style={styles.catalogRow}
      >
        {material ? (
          <MaterialCover material={material} />
        ) : (
          <MaterialFileBadge />
        )}
        <View style={styles.catalogContent}>
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
          {material ? (
            <>
              <Text style={styles.caption}>
                {[
                  materialFileType(material),
                  materialFileSize(material.file?.sizeBytes),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
              <Text style={styles.text} numberOfLines={2}>
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
      <Text style={styles.caption}>
        Mua {materialDate(order.createdAt)} · Bản đã mua v{order.listingVersion}
      </Text>
      {!!snapshot?.originalFilename && (
        <Text style={styles.meta} numberOfLines={2}>
          Tệp đã mua: {snapshot.originalFilename}
        </Text>
      )}
      {material && snapshot?.title && snapshot.title !== material.title && (
        <Text style={styles.caption} numberOfLines={2}>
          Tên lúc mua: {snapshot.title}
        </Text>
      )}
      <View style={styles.row}>
        <Text
          style={[
            styles.caption,
            order.status === "SUCCESS" ? styles.success : styles.meta,
          ]}
        >
          {order.status === "SUCCESS" ? "Đã mua" : "Đã hoàn tiền"}
        </Text>
        <Text style={styles.meta}>
          Giá lúc mua:{" "}
          <Text style={styles.price}>
            {Number(order.grossCredit).toLocaleString("vi-VN")} CR
          </Text>
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
