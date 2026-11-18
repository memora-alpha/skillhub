import { Text, View } from "react-native";
import { InfoModal } from "@/components/InfoModal";
import { Button } from "@/components/Button";
import { FormNotice } from "@/components/FormNotice";
import type { ApiMaterial } from "../api/material-contracts";
import { materialArchivePresentation } from "../utils/owner-material-presentation";
import { ownerMaterialStyles as styles } from "./owner-material.styles";
import type { OwnerMaterialAction } from "../utils/owner-material-actions";

function actionPresentation(
  action: OwnerMaterialAction,
  material?: ApiMaterial,
) {
  switch (action) {
    case "delete": {
      const draft = material?.status === "DRAFT";
      return {
        title: draft ? "Xóa bản nháp?" : "Xóa tài liệu?",
        label: draft ? "Xóa bản nháp" : "Xóa tài liệu",
        icon: "trash" as const,
        description:
          "Tài liệu sẽ bị xóa khỏi mục Đã đăng. Bạn sẽ không thể khôi phục hoặc đăng lại tài liệu này. Người đã mua vẫn giữ quyền tải.",
      };
    }
    case "withdraw":
      return {
        title: "Rút yêu cầu duyệt?",
        label: "Rút yêu cầu",
        icon: "close" as const,
        description: material?.hasBeenPublished
          ? "Tài liệu sẽ trở về bản nháp và dừng chờ duyệt. Nội dung đã từng đăng được giữ nguyên; bạn có thể gửi duyệt lại."
          : "Tài liệu sẽ trở về bản nháp và dừng chờ duyệt. Bạn có thể chỉnh sửa rồi gửi duyệt lại.",
      };
    case "submit": {
      const archived = material?.status === "ARCHIVED";
      return {
        title: archived ? "Đăng lại tài liệu?" : "Gửi tài liệu để duyệt?",
        label: archived ? "Gửi duyệt lại" : "Gửi duyệt",
        icon: "send" as const,
        description: archived
          ? "Tài liệu sẽ được xét duyệt lại. Khi được chấp thuận, tài liệu sẽ xuất hiện trở lại trong Khám phá. Nội dung, giá và các đánh giá cũ được giữ nguyên."
          : "Tài liệu sẽ được gửi để xét duyệt trước khi xuất hiện công khai.",
      };
    }
    default:
      return material ? materialArchivePresentation(material) : undefined;
  }
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
  const presentation = actionPresentation(action, material);
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
