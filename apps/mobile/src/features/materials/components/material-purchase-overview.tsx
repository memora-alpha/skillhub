import { Text, View } from "react-native";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { appColors } from "@/constants/theme";
import { HomeWalletBalance } from "@/features/wallet";
import type { ApiMaterial } from "../api/material-contracts";
import {
  materialFileSize,
  materialFileType,
} from "../utils/owner-material-presentation";
import { MaterialCover } from "./material-cover";
import { materialPurchaseStyles as styles } from "./material-purchase.styles";

export function MaterialPurchaseOverview({
  material,
  needsPurchase,
  walletDisabled,
  onWallet,
}: Readonly<{
  material: ApiMaterial;
  needsPurchase: boolean;
  walletDisabled: boolean;
  onWallet: () => void;
}>) {
  const fileSize = materialFileSize(material.file?.sizeBytes);
  return (
    <>
      <View style={styles.section}>
        <Text style={styles.eyebrow}>TÀI LIỆU ĐÃ CHỌN</Text>
        <View style={styles.product}>
          <View style={styles.productRow}>
            <MaterialCover material={material} />
            <View style={styles.productInfo}>
              <View style={styles.format}>
                <Text style={styles.formatLabel}>
                  Tài liệu số · {materialFileType(material)}
                </Text>
              </View>
              <Text selectable style={styles.heading}>
                {material.title}
              </Text>
              {fileSize && <Text style={styles.muted}>{fileSize}</Text>}
            </View>
          </View>
          <Text style={styles.body} numberOfLines={3}>
            {material.description}
          </Text>
        </View>
      </View>
      {needsPurchase && (
        <>
          <View style={styles.section}>
            <Text style={styles.heading}>Phương thức thanh toán</Text>
            <View style={styles.method}>
              <View style={styles.row}>
                <View style={styles.walletIcon}>
                  <Icon name="wallet" size={22} color={appColors.forest} />
                </View>
                <View style={styles.grow}>
                  <Text style={styles.heading}>Ví Credit</Text>
                  <Text style={styles.body}>Thanh toán từ số dư SkillHub</Text>
                </View>
                <Icon name="check-circle" size={22} color={appColors.forest} />
              </View>
              <View style={styles.divider} />
              <View style={styles.balance}>
                <Text style={styles.muted}>Số dư khả dụng</Text>
                <HomeWalletBalance />
              </View>
              <Button
                variant="ghost"
                size="sm"
                disabled={walletDisabled}
                onPress={onWallet}
                icon="chevron"
              >
                Xem ví Credit
              </Button>
            </View>
          </View>
          <View style={styles.policy}>
            <View style={styles.policyIcon}>
              <Icon name="shield" size={20} color={appColors.forest} />
            </View>
            <View style={styles.grow}>
              <Text style={styles.body}>Hoàn tiền có điều kiện</Text>
              <Text style={styles.muted}>
                Trong 24 giờ nếu chưa được cấp đường dẫn tải. Điều kiện được
                kiểm tra khi gửi yêu cầu.
              </Text>
            </View>
          </View>
        </>
      )}
    </>
  );
}
