import { Pressable, Text, View } from "react-native";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { appColors as colors } from "@/constants/theme";
import type { ApiMaterial } from "../api/material-contracts";
import {
  canEditMaterial,
  canDeleteMaterial,
  canArchiveMaterial,
  canWithdrawMaterial,
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
  onDelete,
  onArchive,
  onWithdraw,
}: Readonly<{
  material: ApiMaterial;
  disabled: boolean;
  submitting: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onSubmit: () => void;
  onDelete: () => void;
  onArchive: () => void;
  onWithdraw: () => void;
}>) {
  const fileType = materialFileType(material);
  const size = materialFileSize(material.file?.sizeBytes);
  const submitHint = materialSubmitHint(material);
  const editable = canEditMaterial(material);
  const showSubmit = ["DRAFT", "ARCHIVED"].includes(material.status);
  const deletable = canDeleteMaterial(material);
  const archivable = canArchiveMaterial(material);
  const withdrawable = canWithdrawMaterial(material);
  const singleAction =
    [editable, showSubmit, deletable, archivable, withdrawable].filter(Boolean)
      .length === 1;
  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Xem chi tiết ${material.title}`}
        disabled={disabled}
        accessibilityState={{ disabled }}
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
      {(editable || showSubmit || deletable || archivable || withdrawable) && (
        <View style={styles.actions}>
          {editable && (
            <Button
              variant="paper"
              size="sm"
              leadingIcon="edit"
              style={[styles.action, singleAction && styles.singleAction]}
              disabled={disabled}
              accessibilityLabel={`Chỉnh sửa ${material.title}`}
              onPress={onEdit}
            >
              Chỉnh sửa
            </Button>
          )}
          {deletable && (
            <Button
              variant="danger"
              size="sm"
              leadingIcon="trash"
              style={[styles.action, singleAction && styles.singleAction]}
              disabled={disabled}
              accessibilityLabel={`${material.status === "DRAFT" ? "Xóa bản nháp" : "Xóa tài liệu"} ${material.title}`}
              onPress={onDelete}
            >
              {material.status === "DRAFT" ? "Xóa bản nháp" : "Xóa tài liệu"}
            </Button>
          )}
          {showSubmit && (
            <Button
              variant="craft"
              size="sm"
              leadingIcon="send"
              style={[styles.action, singleAction && styles.singleAction]}
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
          {archivable && (
            <Button
              variant="paper"
              size="sm"
              leadingIcon="eye-off"
              style={[styles.action, singleAction && styles.singleAction]}
              disabled={disabled}
              accessibilityLabel={`Ngừng chia sẻ ${material.title}`}
              onPress={onArchive}
            >
              Ngừng chia sẻ
            </Button>
          )}
          {withdrawable && (
            <Button
              variant="paper"
              size="sm"
              leadingIcon="close"
              style={[styles.action, singleAction && styles.singleAction]}
              disabled={disabled}
              accessibilityLabel={`Rút yêu cầu duyệt ${material.title}`}
              onPress={onWithdraw}
            >
              Rút yêu cầu duyệt
            </Button>
          )}
        </View>
      )}
    </View>
  );
}
