import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
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
  const query = usePublicMaterial(order.materialId, visible);
  const eligibility = useMaterialReviewEligibility(order.materialId, visible);
  const router = useRouter();
  const download = useMaterialDownload(order.materialId);
  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Xem đơn mua ${query.data?.title ?? materialDate(order.createdAt)}`}
        onPress={() =>
          router.push(
            order.status === "SUCCESS" && !query.data
              ? `/materials/${order.materialId}/access`
              : `/materials/${order.materialId}`,
          )
        }
        style={styles.fileRow}
      >
        <MaterialFileBadge />
        <View style={styles.grow}>
          <Text style={styles.title} numberOfLines={2}>
            {query.data?.title ?? "Tài liệu đã mua"}
          </Text>
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
              disabled || download.pending || download.awaitingConfirmation
            }
            onPress={onRefund}
          >
            Hoàn tiền
          </Button>
        </View>
      )}
      {(eligibility.data?.currentReview ||
        eligibility.data?.canReview ||
        eligibility.error) && (
        <Button
          variant="paper"
          size="sm"
          leadingIcon="star"
          disabled={disabled || eligibility.isFetching}
          onPress={() => router.push(`/materials/${order.materialId}/review`)}
        >
          {eligibility.data?.currentReview
            ? "Xem đánh giá"
            : eligibility.data?.canReview
              ? "Viết đánh giá"
              : "Đánh giá tài liệu"}
        </Button>
      )}
      <MaterialDownloadFeedback download={download} />
    </View>
  );
}
