import { Pressable, Text, View } from "react-native";
import { Icon } from "@/components/Icon";
import { appColors as colors } from "@/constants/theme";
import type { ApiMaterial } from "../api/material-contracts";
import {
  materialFileSize,
  materialFileType,
  materialPrice,
} from "../utils/owner-material-presentation";
import { materialStyles as styles } from "./material.styles";
import { MaterialCover } from "./material-cover";
import { materialDate } from "../utils/owner-material-presentation";
import {
  materialOwnershipLabels,
  type MaterialOwnershipStatus,
} from "../utils/material-ownership-presentation";

export function MaterialFileBadge({
  material,
  large = false,
}: Readonly<{ material?: ApiMaterial; large?: boolean }>) {
  return (
    <View style={large ? styles.largeIcon : styles.fileBadge}>
      <Icon
        name={material?.file?.mimeType.startsWith("image/") ? "image" : "file"}
        size={large ? 30 : 22}
        color={colors.primary}
      />
      {material && materialFileType(material) === "PDF" && (
        <Text style={styles.fileType}>PDF</Text>
      )}
    </View>
  );
}
export function MaterialSummary({
  material,
  cover = false,
  ownershipStatus = "checking",
}: Readonly<{
  material: ApiMaterial;
  cover?: boolean;
  ownershipStatus?: MaterialOwnershipStatus;
}>) {
  if (cover)
    return (
      <View style={styles.bookHeader}>
        <MaterialCover material={material} large />
        <View style={styles.bookInfo}>
          <Text selectable style={styles.sectionTitle}>
            {material.title}
          </Text>
          <Text style={styles.meta}>
            {[
              materialFileType(material),
              materialFileSize(material.file?.sizeBytes),
            ]
              .filter(Boolean)
              .join(" · ")}
          </Text>
          <View style={styles.bookPriceRow}>
            {ownershipStatus !== "free" && (
              <View>
                {ownershipStatus === "purchased" && (
                  <Text style={styles.caption}>Giá hiện tại</Text>
                )}
                <Text style={styles.priceLarge}>{materialPrice(material)}</Text>
              </View>
            )}
            {ownershipStatus !== "checking" && (
              <View
                accessibilityLiveRegion="polite"
                style={[
                  styles.ownershipBadge,
                  ownershipStatus === "purchased" && styles.purchasedBadge,
                ]}
              >
                {ownershipStatus === "purchased" && (
                  <Icon name="check" size={14} color={colors.forest} />
                )}
                <Text
                  style={[
                    styles.ownershipLabel,
                    ownershipStatus === "purchased" && { color: colors.forest },
                  ]}
                >
                  {materialOwnershipLabels[ownershipStatus]}
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.caption}>
            Cập nhật {materialDate(material.updatedAt)}
          </Text>
        </View>
      </View>
    );
  return (
    <View style={styles.section}>
      <View style={styles.inline}>
        <MaterialFileBadge material={material} large />
        <View style={styles.grow}>
          <Text style={styles.meta}>
            {[
              materialFileType(material),
              materialFileSize(material.file?.sizeBytes),
            ]
              .filter(Boolean)
              .join(" · ")}
          </Text>
          <Text style={styles.priceLarge}>{materialPrice(material)}</Text>
        </View>
      </View>
      <Text selectable style={styles.heroTitle}>
        {material.title}
      </Text>
    </View>
  );
}
export function CatalogMaterialCard({
  material,
  onPress,
}: Readonly<{ material: ApiMaterial; onPress: () => void }>) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Xem tài liệu ${material.title}`}
      onPress={onPress}
      style={({ pressed }) => [styles.catalogCard, pressed && styles.pressed]}
    >
      <View style={styles.catalogRow}>
        <MaterialCover material={material} />
        <View style={styles.catalogContent}>
          <Text style={styles.title} numberOfLines={2}>
            {material.title}
          </Text>
          <Text style={styles.caption}>
            {[
              materialFileType(material),
              materialFileSize(material.file?.sizeBytes),
            ]
              .filter(Boolean)
              .join(" · ")}
          </Text>
          <Text numberOfLines={2} style={styles.text}>
            {material.description}
          </Text>
          {material.ratingSummary && (
            <Text style={styles.caption}>
              {material.ratingSummary.average === null
                ? "Chưa có đánh giá"
                : `${material.ratingSummary.average}/5 · ${material.ratingSummary.total} đánh giá`}
            </Text>
          )}
          <View style={styles.cardBottom}>
            <Text style={[styles.price, styles.accent]}>
              {materialPrice(material)}
            </Text>
            <View style={styles.inline}>
              <Icon name="chevron" size={16} color={colors.primary} />
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
}
