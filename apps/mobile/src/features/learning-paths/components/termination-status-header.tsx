import { StyleSheet, Text, View } from "react-native";
import { Icon } from "@/components/Icon";
import { Copy } from "@/components/feature-page";
import { appColors as colors, fonts, typography } from "@/constants/theme";
import type { TerminationRequest } from "../api/path-changes-contract";
import {
  openTermination,
  terminationLabels,
} from "../utils/termination-policy";
import { cancellationStyles as ui } from "./cancellation-styles";

export function TerminationStatusHeader({
  request,
  mine,
  canRespond,
}: Readonly<{
  request: TerminationRequest;
  mine: boolean;
  canRespond: boolean;
}>) {
  const approved = !!request.approvedAt || request.status === "APPLIED";
  const open = openTermination(request);
  const accent = approved
    ? colors.forest
    : open
      ? colors.warning
      : colors.muted;
  const background = approved
    ? colors.forestSoft
    : open
      ? colors.amberSoft
      : colors.surfaceInset;
  let title = terminationLabels[request.status];
  if (canRespond) title = "Đối tác muốn hủy lộ trình";
  if (request.approvedAt && request.status === "ACCEPTED")
    title = "Đã duyệt hủy lộ trình";
  return (
    <View style={ui.header}>
      <View style={styles.statusLine}>
        <View style={[styles.badge, { backgroundColor: background }]}>
          <Icon
            name={approved ? "check-circle" : open ? "clock" : "close"}
            size={14}
            color={accent}
          />
          <Text style={[styles.badgeText, { color: accent }]}>
            {approved ? "Đã duyệt hủy" : open ? "Đang xử lý" : "Đã kết thúc"}
          </Text>
        </View>
      </View>
      <Text accessibilityRole="header" style={ui.title}>
        {title}
      </Text>
      <Copy size="hint">{`${mine ? "Bạn" : "Đối tác"} ${request.status === "WITHDRAWN" ? "đã rút yêu cầu hủy" : "đã gửi yêu cầu hủy"}`}</Copy>
    </View>
  );
}

const styles = StyleSheet.create({
  statusLine: { flexDirection: "row", alignItems: "center" },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  badgeText: { ...typography.caption, fontFamily: fonts.bold },
});
