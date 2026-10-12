import { View } from "react-native";
import { Button } from "@/components/Button";
import { FormNotice } from "@/components/FormNotice";
import { isInvalidRequestCursor } from "../utils/request-list-query";
import { requestError } from "../utils/request-policy";

export function RequestListFooter({
  hasNextPage,
  fetching,
  fetchingNext,
  nextError,
  loadMore,
  reload,
}: {
  hasNextPage: boolean;
  fetching: boolean;
  fetchingNext: boolean;
  nextError?: unknown;
  loadMore: () => void;
  reload: () => void;
}) {
  const invalidCursor = isInvalidRequestCursor(nextError);
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
        {fetchingNext
          ? "Đang tải..."
          : invalidCursor
            ? "Tải lại danh sách"
            : nextError
              ? "Thử lại trang tiếp theo"
              : "Xem thêm yêu cầu"}
      </Button>
    </View>
  );
}
