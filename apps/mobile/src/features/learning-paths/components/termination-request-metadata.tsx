import { Copy } from "@/components/feature-page";
import { StyleSheet, View } from "react-native";
import { appColors as colors } from "@/constants/theme";
import type { TerminationRequest } from "../api/path-changes-contract";

function date(value: string) {
  return new Date(value).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const closedLabels: Partial<Record<TerminationRequest["status"], string>> = {
  WITHDRAWN: "Rút lúc",
  REJECTED: "Từ chối lúc",
  APPLIED: "Xử lý Credit lúc",
};

export function TerminationRequestMetadata({
  request,
}: Readonly<{
  request: TerminationRequest;
}>) {
  const withdrawn = request.status === "WITHDRAWN";
  const closedLabel = closedLabels[request.status];
  return (
    <View style={styles.timeline}>
      <Copy size="hint">Gửi lúc {date(request.createdAt)}</Copy>
      {closedLabel && (
        <Copy size="hint">
          {closedLabel}{" "}
          {request.closedAt
            ? date(request.closedAt)
            : "chưa có thời gian từ hệ thống"}
        </Copy>
      )}
      {request.status === "EXPIRED" && (
        <Copy size="hint">Hết hạn lúc {date(request.expiresAt)}</Copy>
      )}
      {request.approvedAt && (
        <Copy size="hint">Duyệt hủy lúc {date(request.approvedAt)}</Copy>
      )}
      {request.status === "PENDING" && (
        <Copy size="hint">Hạn phản hồi {date(request.expiresAt)}</Copy>
      )}
      {withdrawn && (
        <Copy size="hint">Yêu cầu hủy này không còn hiệu lực.</Copy>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  timeline: {
    gap: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingTop: 12,
  },
});
