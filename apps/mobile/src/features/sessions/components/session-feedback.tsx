import type { ReactNode } from "react";
import { ActivityIndicator } from "react-native";
import {
  SessionEmptyState as EmptyState,
  SessionButton as Button,
} from "./session-page";
import { FormNotice } from "@/components/FormNotice";
import { sessionReadState, sessionErrorMessage } from "../utils/session-read";

type Props = {
  data: unknown;
  enabled: boolean;
  error: unknown;
  denial?: string;
  invalid?: boolean;
  refreshing: boolean;
  retry: () => unknown;
  children: ReactNode;
};
export function SessionFeedback({
  data,
  enabled,
  error,
  denial,
  invalid,
  refreshing,
  retry,
  children,
}: Props) {
  if (invalid)
    return (
      <EmptyState
        title="Không tìm thấy buổi học"
        description="Liên kết buổi học không hợp lệ hoặc chưa khả dụng."
      />
    );
  const state = sessionReadState(data, enabled, error, denial);
  if (state === "prerequisite" || state === "loading")
    return <ActivityIndicator accessibilityLabel="Đang tải buổi học" />;
  if (state === "denied" || state === "error")
    return (
      <>
        <EmptyState
          title={
            denial === "forbidden"
              ? "Không có quyền xem buổi học"
              : "Không tải được buổi học"
          }
          description={
            denial === "unavailable"
              ? "Buổi học không còn khả dụng."
              : sessionErrorMessage(error)
          }
        />
        <Button
          variant="paper"
          disabled={refreshing}
          onPress={() => {
            retry();
          }}
        >
          Thử lại
        </Button>
      </>
    );
  return (
    <>
      {!!error && (
        <FormNotice tone="error">
          {sessionErrorMessage(error)} Dữ liệu đang hiển thị có thể chưa cập
          nhật.
        </FormNotice>
      )}
      {children}
    </>
  );
}
