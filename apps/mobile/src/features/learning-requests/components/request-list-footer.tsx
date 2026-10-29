import { View } from "react-native";
import { Button } from "@/components/Button";
import { FormNotice } from "@/components/FormNotice";
import { isInvalidRequestCursor } from "../utils/request-list-query";
import { requestError } from "../utils/request-policy";
import { LoadingIndicator as ActivityIndicator } from "@/components/LoadingIndicator";
import { isTransientReadError } from "@/lib/query/use-quiet-read-recovery";

export function RequestListFooter({
  hasNextPage,
  fetching,
  fetchingNext,
  nextError,
  loadMore,
  reload,
  quietTransient = false,
}: Readonly<{
  hasNextPage: boolean;
  fetching: boolean;
  fetchingNext: boolean;
  nextError?: unknown;
  loadMore: () => void;
  reload: () => void;
  quietTransient?: boolean;
}>) {
  if (quietTransient && isTransientReadError(nextError))
    return (
      <ActivityIndicator
        presentation="placeholder"
        accessibilityLabel="Đang tải thêm yêu cầu học"
      />
    );
  if (fetchingNext)
    return (
      <ActivityIndicator
        presentation="placeholder"
        accessibilityLabel="Đang tải thêm yêu cầu học"
      />
    );
  const invalidCursor = isInvalidRequestCursor(nextError);
  let buttonLabel = "Xem thêm yêu cầu";
  if (invalidCursor) buttonLabel = "Tải lại danh sách";
  else if (nextError) buttonLabel = "Thử lại trang tiếp theo";
  if (!hasNextPage && !nextError) return null;
  return (
    <View style={{ gap: 12 }}>
      {!!nextError && (
        <FormNotice tone="error">
          Chưa tải được trang tiếp theo. Các yêu cầu đã tải vẫn được giữ.{" "}
          {invalidCursor
            ? "Danh sách đã thay đổi. Hãy tải lại từ đầu."
            : requestError(nextError)}
        </FormNotice>
      )}
      <Button
        variant="paper"
        disabled={fetching}
        onPress={invalidCursor ? reload : loadMore}
      >
        {buttonLabel}
      </Button>
    </View>
  );
}
