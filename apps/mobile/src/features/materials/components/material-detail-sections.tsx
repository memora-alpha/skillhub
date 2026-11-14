import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Icon } from "@/components/Icon";
import { Button } from "@/components/Button";
import { appColors } from "@/constants/theme";
import { ConnectionFeedback } from "@/features/connections";
import type { ApiMaterial } from "../api/material-contracts";
import { useRelatedMaterials } from "../hooks/use-related-materials";
import { CatalogMaterialCard } from "./material-summary";
import { materialStyles as styles } from "./material.styles";

export function MaterialReviewPlaceholder() {
  return (
    <View style={styles.section}>
      <View style={styles.row}>
        <Text style={styles.sectionTitle}>Đánh giá & bình luận</Text>
        <Text style={styles.comingSoon}>Sắp có</Text>
      </View>
      <View style={styles.reviewPlaceholder}>
        <Icon name="message" size={22} color={appColors.muted} />
        <View style={styles.grow}>
          <Text style={styles.title}>Chia sẻ trải nghiệm về tài liệu</Text>
          <Text style={styles.meta}>
            Bạn sẽ có thể xem đánh giá và để lại nhận xét tại đây trong phiên
            bản sau.
          </Text>
        </View>
      </View>
    </View>
  );
}

export function RelatedMaterials({
  material,
}: Readonly<{ material: ApiMaterial }>) {
  const query = useRelatedMaterials(material);
  const router = useRouter();
  if (material.status !== "PUBLISHED") return null;
  return (
    <View style={styles.section}>
      <View style={styles.row}>
        <View style={styles.grow}>
          <Text style={styles.sectionTitle}>Tài liệu đề xuất</Text>
          <Text style={styles.caption}>Cùng kỹ năng với tài liệu này</Text>
        </View>
        <Button
          variant="ghost"
          size="sm"
          onPress={() =>
            router.push({
              pathname: "/discover",
              params: { tab: "materials", skillId: material.skillId },
            })
          }
        >
          Xem tất cả
        </Button>
      </View>
      <ConnectionFeedback
        loading={query.isLoading}
        loadingPresentation="inline"
        error={query.error}
        retry={query.refetch}
      />
      {query.data?.map((row) => (
        <CatalogMaterialCard
          key={row.id}
          material={row}
          onPress={() => router.push(`/materials/${row.id}`)}
        />
      ))}
      {query.data && !query.error && !query.data.length && (
        <Text style={styles.meta}>Chưa có tài liệu cùng kỹ năng khác.</Text>
      )}
    </View>
  );
}
