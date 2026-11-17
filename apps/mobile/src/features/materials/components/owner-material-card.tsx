import { Pressable, Text, View } from "react-native";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { appColors as colors } from "@/constants/theme";
import type { ApiMaterial } from "../api/material-contracts";
import {
  canEditMaterial,
  canSubmitMaterial,
  materialFileSize,
  materialFileType,
  materialPrice,
  materialStatuses,
  materialSubmitHint,
} from "../utils/owner-material-presentation";
import { ownerMaterialStyles as styles } from "./owner-material.styles";

export function MaterialStatusBadge({
  material,
}: Readonly<{ material: ApiMaterial }>) {
  const status = materialStatuses[material.status];
  const tone = status.tone;
  return (
    <View style={styles.badge}>
      <View
        style={[styles.statusDot, tone !== "muted" && styles[`${tone}Dot`]]}
      />
      <Text style={[styles.statusLabel, tone !== "muted" && styles[tone]]}>
        {status.label}
      </Text>
    </View>
  );
}
export function OwnerMaterialCard({
  material,
  disabled,
  submitting,
  onOpen,
  onEdit,
  onSubmit,
}: Readonly<{
  material: ApiMaterial;
  disabled: boolean;
  submitting: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onSubmit: () => void;
}>) {
  const fileType = materialFileType(material);
  const size = materialFileSize(material.file?.sizeBytes);
  const submitHint = materialSubmitHint(material);
  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Xem thông tin ${material.title}`}
        onPress={onOpen}
        style={({ pressed }) => [styles.fileRow, pressed && styles.pressed]}
      >
        <View style={styles.fileBadge}>
          <Icon
            name={
              material.file?.mimeType.startsWith("image/") ? "image" : "file"
            }
            size={22}
            color={colors.primary}
          />
          {fileType === "PDF" && <Text style={styles.fileType}>PDF</Text>}
        </View>
        <View style={styles.grow}>
          <Text style={styles.title} numberOfLines={2}>
            {material.title}
          </Text>
          <Text style={styles.meta}>
            {[fileType, size].filter(Boolean).join(" · ")}
          </Text>
        </View>
        <Icon name="chevron" size={18} color={colors.muted} />
      </Pressable>
      <View style={styles.row}>
        <MaterialStatusBadge material={material} />
        <Text style={styles.price}>{materialPrice(material)}</Text>
      </View>
      {!!material.rejectReason && (
        <Text numberOfLines={2} style={styles.reason}>
          {material.rejectReason}
        </Text>
      )}
      {!!submitHint && <Text style={styles.caption}>{submitHint}</Text>}
      {canEditMaterial(material) && (
        <View style={styles.actions}>
          <Button
            variant="ghost"
            size="sm"
            leadingIcon="edit"
            style={styles.action}
            disabled={disabled}
            accessibilityLabel={`Chỉnh sửa ${material.title}`}
            onPress={onEdit}
          >
            Chỉnh sửa
          </Button>
          {["DRAFT", "ARCHIVED"].includes(material.status) && (
            <Button
              variant="craft"
              size="sm"
              leadingIcon="send"
              style={styles.action}
              disabled={disabled || !canSubmitMaterial(material)}
              accessibilityLabel={`${material.status === "ARCHIVED" ? "Đăng lại" : "Gửi duyệt"} ${material.title}`}
              onPress={onSubmit}
            >
              {submitting
                ? "Đang gửi…"
                : material.status === "ARCHIVED"
                  ? "Đăng lại"
                  : "Gửi duyệt"}
            </Button>
          )}
        </View>
      )}
    </View>
  );
}
