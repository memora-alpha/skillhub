import { Text, View } from "react-native";
import { InfoModal } from "@/components/InfoModal";
import { Button } from "@/components/Button";
import { FormNotice } from "@/components/FormNotice";
import type { ApiMaterial } from "../api/material-contracts";
import {
  canEditMaterial,
  canDeleteMaterial,
  canWithdrawMaterial,
  materialEditHint,
  materialDate,
  materialFileSize,
  materialFileType,
  materialPrice,
  materialArchivePresentation,
} from "../utils/owner-material-presentation";
import { MaterialStatusBadge } from "./owner-material-card";
import { ownerMaterialStyles as styles } from "./owner-material.styles";
import type { OwnerMaterialAction } from "../utils/owner-material-actions";

export function OwnerMaterialDetails({
  material,
  disabled,
  onClose,
  onEdit,
  onArchive,
  onDelete,
  onWithdraw,
}: Readonly<{
  material?: ApiMaterial;
  disabled: boolean;
  onClose: () => void;
  onEdit: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onWithdraw: () => void;
}>) {
  const archivePresentation = material && materialArchivePresentation(material);
  const editable = !!material && canEditMaterial(material);
  const withdrawable = !!material && canWithdrawMaterial(material);
  const deletable = !!material && canDeleteMaterial(material);
  const hasPrimaryActions = editable || !!archivePresentation || withdrawable;
  const editHint = material && materialEditHint(material);
  return (
    <InfoModal
      title={material?.title ?? null}
      titleStyle={styles.heading}
      onClose={onClose}
      showConfirm={false}
      footer={
        material && (hasPrimaryActions || deletable) ? (
          <View style={styles.detailActions}>
            {hasPrimaryActions && (
              <View style={styles.dialogActions}>
                {editable && (
                  <Button
                    variant="craft"
                    size="sm"
                    style={styles.dialogAction}
                    leadingIcon="edit"
                    disabled={disabled}
                    onPress={onEdit}
                  >
                    Chỉnh sửa
                  </Button>
                )}
                {archivePresentation && (
                  <Button
                    variant="paper"
                    size="sm"
                    style={styles.dialogAction}
                    leadingIcon={archivePresentation.icon}
                    disabled={disabled}
                    onPress={onArchive}
                  >
                    {archivePresentation.label}
                  </Button>
                )}
                {withdrawable && (
                  <Button
                    variant="paper"
                    size="sm"
                    style={styles.dialogAction}
                    leadingIcon="close"
                    disabled={disabled}
                    onPress={onWithdraw}
                  >
                    Rút yêu cầu duyệt
                  </Button>
                )}
              </View>
            )}
            {deletable && (
              <Button
                variant="danger"
                size="sm"
                leadingIcon="trash"
                disabled={disabled}
                onPress={onDelete}
              >
                {material.status === "DRAFT" ? "Xóa bản nháp" : "Xóa tài liệu"}
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
          {!!editHint && <Text style={styles.meta}>{editHint}</Text>}
          {material.status === "ARCHIVED" && (
            <Text style={styles.meta}>
              Tài liệu đã ngừng chia sẻ. Bạn có thể gửi duyệt lại nguyên nội
              dung trên cùng bài đăng.
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
export function OwnerMaterialActionDialog({
  material,
  action,
  busy,
  disabled,
  uncertain,
  error,
  onClose,
  onConfirm,
  onReconcile,
}: Readonly<{
  material?: ApiMaterial;
  action: OwnerMaterialAction;
  busy: boolean;
  disabled: boolean;
  uncertain: boolean;
  error?: string;
  onClose: () => void;
  onConfirm: () => void;
  onReconcile: () => void;
}>) {
  const presentation =
    action === "delete"
      ? {
          title:
            material?.status === "DRAFT" ? "Xóa bản nháp?" : "Xóa tài liệu?",
          label: material?.status === "DRAFT" ? "Xóa bản nháp" : "Xóa tài liệu",
          icon: "trash" as const,
          description:
            "Tài liệu sẽ được xóa khỏi danh sách quản lý và không thể khôi phục. Lịch sử và quyền tải theo đơn đã mua vẫn được giữ.",
        }
      : action === "withdraw"
        ? {
            title: "Rút yêu cầu duyệt?",
            label: "Rút yêu cầu",
            icon: "close" as const,
            description: material?.hasBeenPublished
              ? "Tài liệu sẽ trở về bản nháp và dừng chờ duyệt. Nội dung đã từng đăng được giữ nguyên; bạn có thể gửi duyệt lại."
              : "Tài liệu sẽ trở về bản nháp và dừng chờ duyệt. Bạn có thể chỉnh sửa rồi gửi duyệt lại.",
          }
        : action === "submit"
          ? {
              title:
                material?.status === "ARCHIVED"
                  ? "Gửi duyệt để đăng lại?"
                  : "Gửi tài liệu để duyệt?",
              label: "Gửi duyệt",
              icon: "send" as const,
              description:
                material?.status === "ARCHIVED"
                  ? "Tài liệu sẽ được xét duyệt lại trước khi xuất hiện công khai. Lịch sử và đánh giá của bài đăng vẫn được giữ."
                  : "Tài liệu sẽ được gửi để xét duyệt trước khi xuất hiện công khai.",
            }
          : material
            ? materialArchivePresentation(material)
            : undefined;
  return (
    <InfoModal
      title={material ? (presentation?.title ?? null) : null}
      titleStyle={styles.heading}
      onClose={onClose}
      busy={busy}
      showConfirm={false}
      footer={
        <View style={styles.dialogActions}>
          <Button
            variant="paper"
            size="sm"
            style={styles.dialogAction}
            disabled={busy}
            onPress={onClose}
          >
            Hủy
          </Button>
          {uncertain ? (
            <Button
              variant="craft"
              size="sm"
              style={styles.dialogAction}
              disabled={busy}
              onPress={onReconcile}
            >
              {busy ? "Đang kiểm tra…" : "Kiểm tra kết quả"}
            </Button>
          ) : (
            <Button
              variant={action === "delete" ? "danger" : "craft"}
              size="sm"
              style={styles.dialogAction}
              leadingIcon={presentation?.icon}
              disabled={disabled}
              onPress={onConfirm}
            >
              {busy ? "Đang xử lý…" : (presentation?.label ?? "Xác nhận")}
            </Button>
          )}
        </View>
      }
    >
      {material && <Text style={styles.title}>{material.title}</Text>}
      <Text style={styles.text}>{material && presentation?.description}</Text>
      {!!error && (
        <FormNotice tone="error" compact>
          {error}
        </FormNotice>
      )}
    </InfoModal>
  );
}
