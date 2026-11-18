import { Text, View } from "react-native";
import type { MaterialOrder } from "../api/material-contracts";
import { materialStyles as styles } from "./material.styles";
import { materialOrderStyles as orderStyles } from "./material-order.styles";

export function MaterialOrderDetails({
  order,
  currentTitle,
}: Readonly<{
  order: MaterialOrder;
  currentTitle?: string;
}>) {
  const purchased = order.status === "SUCCESS";
  const snapshot = order.purchasedMaterial;
  return (
    <>
      <View style={orderStyles.summary}>
        <View style={[orderStyles.badge, purchased && orderStyles.purchased]}>
          <Text
            style={[
              orderStyles.badgeLabel,
              purchased && orderStyles.purchasedLabel,
            ]}
          >
            {purchased ? "Đã mua" : "Đã hoàn tiền"}
          </Text>
        </View>
        <View style={orderStyles.amount}>
          <Text style={styles.caption}>Giá lúc mua</Text>
          <Text style={orderStyles.price}>
            {Number(order.grossCredit).toLocaleString("vi-VN")} CR
          </Text>
        </View>
      </View>
      {!!snapshot?.originalFilename && (
        <Text style={styles.caption} numberOfLines={2}>
          Tệp đã mua: {snapshot.originalFilename}
        </Text>
      )}
      {currentTitle && snapshot?.title && snapshot.title !== currentTitle && (
        <Text style={styles.caption} numberOfLines={2}>
          Tên lúc mua: {snapshot.title}
        </Text>
      )}
    </>
  );
}
