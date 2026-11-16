import { Text, View } from "react-native";
import { InfoModal } from "@/components/InfoModal";
import { Button } from "@/components/Button";
import { FormNotice } from "@/components/FormNotice";
import type { ApiMaterial } from "../api/material-contracts";
import {
  canArchiveMaterial,
  canEditMaterial,
  materialDate,
  materialFileSize,
  materialFileType,
  materialPrice,
  materialArchivePresentation,
} from "../utils/owner-material-presentation";
import { MaterialStatusBadge } from "./owner-material-card";
import { ownerMaterialStyles as styles } from "./owner-material.styles";

export function OwnerMaterialDetails({
  material,
  disabled,
  onClose,
  onEdit,
  onArchive,
}: Readonly<{
  material?: ApiMaterial;
  disabled: boolean;
  onClose: () => void;
  onEdit: () => void;
  onArchive: () => void;
}>) {
  return (
    <InfoModal
      title={material?.title ?? null}
      titleStyle={styles.heading}
      onClose={onClose}
      showConfirm={false}
      footer={
        material && canEditMaterial(material) ? (
          <View style={styles.row}>
            <Button
              variant="paper"
              size="sm"
              leadingIcon="edit"
              disabled={disabled}
              onPress={onEdit}
            >
              Chỉnh sửa
            </Button>
            {canArchiveMaterial(material) && (
              <Button
                variant="ghost"
                size="sm"
                leadingIcon={materialArchivePresentation(material).icon}
                disabled={disabled}
                onPress={onArchive}
              >
                {materialArchivePresentation(material).label}
              </Button>
            )}
          </View>
        ) : undefined
      }
    >
      {material && (
        <View style={styles.detail}>
          <View style={styles.row}>
            <MaterialStatusBadge material={material} />
            <Text style={styles.price}>{materialPrice(material)}</Text>
          </View>
          <Text selectable style={styles.text}>
            {material.description}
          </Text>
          {material.rejectReason && (
            <FormNotice tone="error" compact>
              {material.rejectReason}
            </FormNotice>
          )}
          <View style={styles.detailNotice}>
            <Text selectable style={styles.title}>
              {material.file?.originalFilename ?? "Chưa có tệp đính kèm"}
            </Text>
            <Text style={styles.meta}>
              {[
                materialFileType(material),
                materialFileSize(material.file?.sizeBytes),
              ]
                .filter(Boolean)
                .join(" · ")}
            </Text>
            {!!material.file && (
              <Text style={styles.meta}>
                {material.scanStatus === "CLEAN"
                  ? "Tệp đã được kiểm tra an toàn"
                  : "Tệp chưa có kết quả kiểm tra an toàn"}
              </Text>
            )}
          </View>
          <Text style={styles.meta}>
            Cập nhật {materialDate(material.updatedAt)} · Phiên bản{" "}
            {material.listingVersion}
          </Text>
          {!!material.reviewedAt && (
            <Text style={styles.meta}>
              Xét duyệt {materialDate(material.reviewedAt)}
            </Text>
          )}
          {material.status === "PUBLISHED" && (
            <Text style={styles.meta}>
              Chỉnh sửa sẽ chuyển tài liệu về trạng thái chờ duyệt.
            </Text>
          )}
          {material.status === "ARCHIVED" && (
            <Text style={styles.meta}>
              Tài liệu đã dừng đăng, không thể chỉnh sửa hoặc gửi duyệt lại.
            </Text>
          )}
          {material.status === "HIDDEN" && (
            <Text style={styles.meta}>
              Tài liệu đang bị ẩn bởi kiểm duyệt và không thể chỉnh sửa.
            </Text>
          )}
        </View>
      )}
    </InfoModal>
  );
}
export function ArchiveMaterialDialog({
  material,
  busy,
  disabled,
  uncertain,
  error,
  onClose,
  onConfirm,
  onReconcile,
}: Readonly<{
  material?: ApiMaterial;
  busy: boolean;
  disabled: boolean;
  uncertain: boolean;
  error?: string;
  onClose: () => void;
  onConfirm: () => void;
  onReconcile: () => void;
}>) {
  return (
    <InfoModal
      title={material ? materialArchivePresentation(material).title : null}
      titleStyle={styles.heading}
      onClose={onClose}
      busy={busy}
      showConfirm={false}
      footer={
        <View style={styles.row}>
          <Button variant="paper" disabled={busy} onPress={onClose}>
            Hủy
          </Button>
          {uncertain ? (
            <Button variant="craft" disabled={busy} onPress={onReconcile}>
              {busy ? "Đang kiểm tra…" : "Kiểm tra kết quả"}
            </Button>
          ) : (
            <Button
              variant="craft"
              leadingIcon={
                material
                  ? materialArchivePresentation(material).icon
                  : undefined
              }
              disabled={disabled}
              onPress={onConfirm}
            >
              {busy
                ? "Đang xử lý…"
                : material
                  ? materialArchivePresentation(material).label
                  : "Xác nhận"}
            </Button>
          )}
        </View>
      }
    >
      <Text style={styles.text}>
        {material && materialArchivePresentation(material).description}
      </Text>
      {!!error && (
        <FormNotice tone="error" compact>
          {error}
        </FormNotice>
      )}
    </InfoModal>
  );
}
