import { Text, View } from "react-native";
import { InfoModal } from "@/components/InfoModal";
import { Button } from "@/components/Button";
import { FormNotice } from "@/components/FormNotice";
import type { ApiMaterial } from "../api/material-contracts";
import { materialPrice } from "../utils/owner-material-presentation";
import { materialPurchaseStyles as styles } from "./material-purchase.styles";

export function MaterialPurchaseDialog({
  material,
  busy,
  disabled,
  stale,
  onClose,
  onConfirm,
}: Readonly<{
  material?: ApiMaterial;
  busy: boolean;
  disabled: boolean;
  stale: boolean;
  onClose: () => void;
  onConfirm: () => void;
}>) {
  return (
    <InfoModal
      title={material ? "Xác nhận mua tài liệu?" : null}
      titleStyle={styles.heading}
      busy={busy}
      onClose={onClose}
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
          <Button
            variant="craft"
            size="sm"
            leadingIcon="wallet"
            style={styles.dialogAction}
            disabled={disabled}
            onPress={onConfirm}
            accessibilityLabel={
              material
                ? `Đồng ý mua · ${materialPrice(material)}`
                : "Đồng ý mua"
            }
          >
            {busy ? "Đang xử lý…" : "Đồng ý mua"}
          </Button>
        </View>
      }
    >
      {material && (
        <View style={styles.section}>
          <Text style={styles.heading}>{material.title}</Text>
          <View style={styles.totalRow}>
            <Text style={styles.body}>Thanh toán bằng Credit</Text>
            <Text style={styles.heading}>{materialPrice(material)}</Text>
          </View>
          <Text style={styles.muted}>
            Giao dịch thành công sẽ trừ Credit từ ví của bạn.
          </Text>
          {stale && (
            <FormNotice tone="warning" compact>
              Thông tin hoặc quyền mua đã thay đổi. Hủy để kiểm tra lại trước
              khi mua.
            </FormNotice>
          )}
        </View>
      )}
    </InfoModal>
  );
}
