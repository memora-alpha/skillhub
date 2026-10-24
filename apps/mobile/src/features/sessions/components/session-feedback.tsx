import type { ReactNode } from "react";
import { LoadingIndicator as ActivityIndicator } from "@/components/LoadingIndicator";
import {
  SessionEmptyState as EmptyState,
  SessionButton as Button,
} from "./session-page";
import { FormNotice } from "@/components/FormNotice";
import { ConnectionFeedback } from "@/features/connections";
import { AppError } from "@/lib/http/errors";
import { sessionReadState, sessionErrorMessage } from "../utils/session-read";
import { isTransientReadError } from "@/lib/query/use-quiet-read-recovery";

type Props = {
  data: unknown;
  enabled: boolean;
  error: unknown;
  denial?: string;
  invalid?: boolean;
  refreshing: boolean;
  retry: () => unknown;
  children: ReactNode;
  quietTransient?: boolean;
};

function sessionFailureLabels(denial: string | undefined, error: unknown) {
  return {
    title:
      denial === "forbidden"
        ? "Không có quyền xem buổi học"
        : "Không tải được buổi học",
    description:
      denial === "unavailable"
        ? "Buổi học không còn khả dụng."
        : sessionErrorMessage(error),
  };
}

export function SessionFeedback({
  data,
  enabled,
  error,
  denial,
  invalid,
  refreshing,
  retry,
  children,
  quietTransient = false,
}: Readonly<Props>) {
  if (invalid)
    return (
      <EmptyState
        title="Không tìm thấy buổi học"
        description="Liên kết buổi học không hợp lệ hoặc chưa khả dụng."
      />
    );
  const state = sessionReadState(data, enabled, error, denial);
  if (quietTransient && !denial && isTransientReadError(error))
    return data === undefined ? (
      <ActivityIndicator accessibilityLabel="Đang tải buổi học" />
    ) : (
      <>{children}</>
    );
  const limited = error instanceof AppError && error.status === 429;
  if (state === "prerequisite" || state === "loading")
    return <ActivityIndicator accessibilityLabel="Đang tải buổi học" />;
  if (state === "denied" || state === "error") {
    if (limited)
      return (
        <ConnectionFeedback error={error} loading={refreshing} retry={retry} />
      );
    const labels = sessionFailureLabels(denial, error);
    return (
      <>
        <EmptyState title={labels.title} description={labels.description} />
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
  }
  return (
    <>
      {limited ? (
        <ConnectionFeedback error={error} loading={refreshing} retry={retry} />
      ) : (
        !!error && (
          <FormNotice tone="error">
            {sessionErrorMessage(error)} Dữ liệu đang hiển thị có thể chưa cập
            nhật.
          </FormNotice>
        )
      )}
      {children}
    </>
  );
}
