import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { LoadingIndicator } from "@/components/LoadingIndicator";
import { ConnectionFeedback } from "@/features/connections";
import { isTransientReadError } from "@/lib/query/use-quiet-read-recovery";
import { homeStyles } from "./HomePrimitives";

export function HomeReadFeedback({
  loading,
  error,
  hasData,
  retry,
  children,
}: Readonly<{
  loading: boolean;
  error: unknown;
  hasData: boolean;
  retry: () => unknown;
  children: ReactNode;
}>) {
  const quiet = isTransientReadError(error);
  if (!hasData && (loading || quiet))
    return <LoadingIndicator accessibilityLabel="Đang tải dữ liệu trang chủ" />;
  return (
    <View style={{ gap: 12 }}>
      {!!error && !quiet && <ConnectionFeedback error={error} retry={retry} />}
      {!!error && hasData && (
        <Text accessibilityLiveRegion="polite" style={homeStyles.caption}>
          Đang hiển thị dữ liệu đã tải trước đó. Kéo xuống để cập nhật.
        </Text>
      )}
      {(!error || hasData) && children}
    </View>
  );
}
