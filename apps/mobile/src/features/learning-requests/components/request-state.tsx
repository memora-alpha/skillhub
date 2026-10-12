import { ActivityIndicator, View } from "react-native";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/Button";
import { FormNotice } from "@/components/FormNotice";
import { Copy } from "@/components/feature-page";
import { appColors } from "@/constants/theme";
import { requestError } from "../utils/request-policy";
import { requestListStyles } from "./request-list.styles";
import type { ReadDenial } from "../utils/request-read";
export function RequestLoading() {
  return (
    <View style={{ gap: 12, padding: 24, alignItems: "center" }}>
      <ActivityIndicator
        color={appColors.primary}
        accessibilityLabel="Đang tải yêu cầu học"
      />
      <Copy muted>Đang tải...</Copy>
    </View>
  );
}
export function RequestFailure({
  error,
  retry,
  pending = false,
  stale = false,
}: {
  error: unknown;
  retry: () => void;
  pending?: boolean;
  stale?: boolean;
}) {
  return (
    <View style={{ gap: 12 }}>
      {stale && (
        <FormNotice tone="info">
          Chưa cập nhật được trạng thái. Đang hiển thị dữ liệu của lần đọc
          trước.
        </FormNotice>
      )}
      <FormNotice tone="error">{requestError(error)}</FormNotice>
      <Button variant="paper" onPress={retry} disabled={pending}>
        {pending ? "Đang tải lại..." : "Thử lại"}
      </Button>
    </View>
  );
}
export function RequestReadDenied({
  denial,
  retry,
  pending = false,
}: {
  denial: ReadDenial;
  retry: () => void;
  pending?: boolean;
}) {
  return (
    <View style={{ gap: 12 }}>
      {denial === "unavailable" ? (
        <RequestUnavailable />
      ) : (
        <FormNotice tone="error">
          Bạn không có quyền xem yêu cầu này.
        </FormNotice>
      )}
      <Button variant="paper" disabled={pending} onPress={retry}>
        {pending ? "Đang tải lại..." : "Thử đọc lại yêu cầu"}
      </Button>
    </View>
  );
}
export function RequestUnavailable() {
  return (
    <EmptyState
      title="Yêu cầu không khả dụng"
      description="Kiểm tra lại liên kết hoặc trở về danh sách yêu cầu học."
      titleStyle={requestListStyles.heading}
    />
  );
}
