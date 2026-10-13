import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Icon } from "@/components/Icon";
import { isOwnRequest } from "../utils/request-policy";
import type { RequestItem } from "../types";
import {
  requestDetailColors as colors,
  requestDetailStyles as styles,
} from "./request-detail.styles";

export function RequestCreditDetails({
  request,
}: Readonly<{ request: RequestItem }>) {
  if (!request.desiredCreditPerHour) return null;
  return (
    <View style={[styles.card, { borderColor: colors.primaryMuted }]}>
      <LinearGradient
        colors={[colors.amberSoft, colors.surface]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View style={styles.metadataRow}>
        <Icon name="wallet" size={18} color={colors.primary} />
        <Text accessibilityRole="header" style={styles.label}>
          {isOwnRequest(request) ? "Credit mong muốn" : "Ngân sách mong muốn"}
        </Text>
      </View>
      <View style={[styles.row, { alignItems: "baseline" }]}>
        <Text selectable style={styles.creditValue}>
          {request.desiredCreditPerHour} CR
        </Text>
        <Text style={styles.caption}>/ giờ</Text>
      </View>
      <Text style={styles.caption}>
        Mức tham khảo, giá cuối cùng sẽ được thỏa thuận.
      </Text>
    </View>
  );
}
