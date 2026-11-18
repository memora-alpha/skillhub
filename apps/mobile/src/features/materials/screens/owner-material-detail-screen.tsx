import { useState } from "react";
import { Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Button } from "@/components/Button";
import { FeaturePage } from "@/components/feature-page";
import { FormNotice } from "@/components/FormNotice";
import { ConnectionFeedback, useConnections } from "@/features/connections";
import { uuid } from "@/lib/http/contracts";
import { useOwnerMaterial } from "../hooks/use-materials";
import { useMaterialDownload } from "../hooks/use-material-download";
import { MaterialSummary } from "../components/material-summary";
import { MaterialPublisher } from "../components/material-publisher";
import { MaterialStatusBadge } from "../components/owner-material-card";
import { MaterialDetailSkeleton } from "../components/material-detail-skeleton";
import { MaterialDownloadFeedback } from "../components/material-download-feedback";
import { MaterialReviews } from "../components/material-reviews";
import { MaterialUnavailable } from "../components/material-unavailable";
import { isMaterialUnavailable } from "../utils/material-availability";
import { materialStyles as styles } from "../components/material.styles";
import {
  materialDate,
  materialEditHint,
} from "../utils/owner-material-presentation";

export function OwnerMaterialDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = typeof params.id === "string" ? params.id : "";
  const runtime = useConnections();
  return <OwnerDetailContent key={JSON.stringify([runtime.key, id])} id={id} />;
}

function OwnerDetailContent({ id }: Readonly<{ id: string }>) {
  const query = useOwnerMaterial(id);
  const unavailable = isMaterialUnavailable(query.error);
  const material = unavailable || query.denied ? undefined : query.data;
  const download = useMaterialDownload(id);
  const [refreshing, setRefreshing] = useState(false);
  const refresh = async () => {
    if (query.isFetching || refreshing) return;
    setRefreshing(true);
    try {
      await query.refetch();
    } finally {
      setRefreshing(false);
    }
  };
  const locked = query.isFetching || !!query.error || !!query.denied;
  const editHint = material && materialEditHint(material);
  return (
    <FeaturePage
      title="Chi tiết tài liệu"
      back="/materials/mine?tab=posted"
      backBehavior="history"
      compact
      refreshing={refreshing}
      onRefresh={refresh}
      stickyFooter={
        material?.file ? (
          <View style={styles.sticky}>
            <Button
              variant="craft"
              leadingIcon="download"
              disabled={
                locked ||
                material.scanStatus !== "CLEAN" ||
                download.pending ||
                download.awaitingConfirmation
              }
              accessibilityState={{ busy: download.pending }}
              onPress={() => {
                if (!locked && material.scanStatus === "CLEAN")
                  void download.start(false);
              }}
            >
              {download.pending ? "Đang tải…" : "Tải tài liệu"}
            </Button>
          </View>
        ) : undefined
      }
    >
      {unavailable ? (
        <MaterialUnavailable owner />
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
          <View style={styles.row}>
            <MaterialStatusBadge material={material} />
          </View>
          {material.status === "ARCHIVED" && (
            <FormNotice tone="info" compact>
              Tài liệu không còn hiển thị trong Khám phá. Người đã mua vẫn có
              thể tải tài liệu.
            </FormNotice>
          )}
          <MaterialSummary material={material} cover ownershipStatus="own" />
          <MaterialPublisher material={material} />
          <View style={styles.divider} />
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Nội dung</Text>
            <Text selectable style={styles.body}>
              {material.description}
            </Text>
          </View>
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Tệp nội dung</Text>
            <Text selectable style={styles.text}>
              {material.file?.originalFilename ?? "Chưa có tệp đính kèm"}
            </Text>
            {!!material.file && (
              <Text style={styles.meta}>
                {material.scanStatus === "CLEAN"
                  ? "Tệp đã được kiểm tra an toàn"
                  : "Tệp chưa hoàn tất kiểm tra an toàn. Chưa thể tải tệp lúc này."}
              </Text>
            )}
          </View>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Thông tin chia sẻ</Text>
            <Text style={styles.meta}>
              Ngày tạo: {materialDate(material.createdAt)}
            </Text>
            {!!material.reviewedAt && (
              <Text style={styles.meta}>
                Kiểm duyệt gần nhất: {materialDate(material.reviewedAt)}
              </Text>
            )}
            <Text style={styles.meta}>
              {material.distributionRightsConfirmedAt
                ? "Đã xác nhận quyền phân phối tài liệu."
                : "Chưa xác nhận quyền phân phối tài liệu."}
            </Text>
            {material.status === "ARCHIVED" ? (
              <Text style={styles.meta}>
                Bạn có thể gửi duyệt để đăng lại tài liệu này. Nội dung và giá
                được giữ nguyên. Muốn thay đổi, hãy đăng tài liệu mới.
              </Text>
            ) : (
              !!editHint && <Text style={styles.meta}>{editHint}</Text>
            )}
            {material.status === "HIDDEN" && (
              <Text style={styles.meta}>
                Tài liệu đang bị ẩn bởi kiểm duyệt.
              </Text>
            )}
          </View>
          {!!material.rejectReason && (
            <FormNotice tone="error" compact>
              <Text style={styles.title}>Lý do kiểm duyệt</Text>
              {"\n"}
              {material.rejectReason}
            </FormNotice>
          )}
          <MaterialDownloadFeedback download={download} />
          {material.status === "PUBLISHED" && (
            <MaterialReviews material={material} />
          )}
        </View>
      )}
    </FeaturePage>
  );
}
