import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/Button";
import { useConnections } from "@/features/connections";
import type { FreeMaterialAccess } from "../api/material-library-api";
import { useMaterialDownload } from "../hooks/use-material-download";
import { useMaterialReviewEligibility } from "../hooks/use-material-reviews";
import { useMaterialOwnership } from "../hooks/use-materials";
import { materialDate } from "../utils/owner-material-presentation";
import { MaterialCover } from "./material-cover";
import { MaterialDownloadFeedback } from "./material-download-feedback";
import { materialStyles as styles } from "./material.styles";

export function FreeMaterialCard({
  access,
  visible,
}: Readonly<{
  access: FreeMaterialAccess;
  visible: boolean;
}>) {
  const { material } = access;
  const router = useRouter();
  const cache = useQueryClient();
  const runtime = useConnections();
  const eligibility = useMaterialReviewEligibility(material.id, visible);
  const own = material.ownerId === runtime.userId;
  const ownership = useMaterialOwnership(material.id, visible && !own);
  const accessLocked =
    !own &&
    (ownership.data === undefined || ownership.isFetching || !!ownership.error);
  const download = useMaterialDownload(material.id, () => {
    void cache.invalidateQueries({
      queryKey: [...runtime.key, "materials", "orders"],
    });
    void cache.invalidateQueries({
      queryKey: [...runtime.key, "materials", "free-library"],
    });
    void cache.invalidateQueries({
      queryKey: [
        ...runtime.key,
        "materials",
        "review-eligibility",
        material.id,
      ],
    });
  });
  return (
    <View style={styles.catalogCard}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Xem ${material.title}`}
        style={styles.catalogRow}
        onPress={() => router.push(`/materials/${material.id}`)}
      >
        <MaterialCover material={material} />
        <View style={styles.catalogContent}>
          <Text style={styles.title} numberOfLines={2}>
            {material.title}
          </Text>
          <Text style={styles.caption} numberOfLines={2}>
            {material.description}
          </Text>
          <Text style={styles.meta}>
            Tải gần nhất {materialDate(access.lastAccessedAt)}
          </Text>
        </View>
      </Pressable>
      <View style={styles.actions}>
        <Button
          variant="craft"
          size="sm"
          leadingIcon="download"
          style={styles.action}
          disabled={
            download.pending || download.awaitingConfirmation || accessLocked
          }
          onPress={() => {
            if (!accessLocked) void download.start(!own && !!ownership.data);
          }}
        >
          {download.pending ? "Đang tải…" : "Tải tài liệu"}
        </Button>
        <Button
          variant="paper"
          size="sm"
          leadingIcon="star"
          style={styles.action}
          disabled={
            eligibility.isFetching ||
            !eligibility.data ||
            !!eligibility.error ||
            (!eligibility.data.canReview && !eligibility.data.currentReview)
          }
          onPress={() => router.push(`/materials/${material.id}/review`)}
        >
          {eligibility.data?.currentReview ? "Xem đánh giá" : "Viết đánh giá"}
        </Button>
      </View>
      {!!ownership.error && (
        <Button
          variant="ghost"
          size="sm"
          onPress={() => void ownership.refetch()}
        >
          Đọc lại quyền tải
        </Button>
      )}
      {!!eligibility.error && (
        <Button
          variant="ghost"
          size="sm"
          onPress={() => void eligibility.refetch()}
        >
          Đọc lại quyền đánh giá
        </Button>
      )}
      <MaterialDownloadFeedback download={download} />
    </View>
  );
}
