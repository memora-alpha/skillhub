import { View } from "react-native";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { useTagOptions } from "../hooks/use-request-options";
import { RequestFailure } from "./request-state";
import { RequestDetailTag } from "./request-detail-tag";
import { requestDetailStyles } from "./request-detail.styles";

export function RequestOwnerTags({
  ids,
  detail = false,
}: {
  ids: string[];
  detail?: boolean;
}) {
  const query = useTagOptions();
  const names = new Map(
    query.data?.pages
      .flatMap((page) => page.items)
      .map((tag) => [tag.id, tag.label]),
  );
  return (
    <View style={{ gap: 8 }}>
      <View
        style={
          detail
            ? requestDetailStyles.topicList
            : { flexDirection: "row", flexWrap: "wrap", gap: 6 }
        }
      >
        {ids.map((id, index) => {
          const label = names.get(id) ?? `Tag ${index + 1} · Chưa có tên`;
          return detail ? (
            <RequestDetailTag key={id} label={label} />
          ) : (
            <Badge key={id} label={label} />
          );
        })}
      </View>
      {query.error && (
        <RequestFailure
          error={query.error}
          retry={() => void query.refetch()}
        />
      )}
      {query.hasNextPage && ids.some((id) => !names.has(id)) && (
        <Button
          variant="ghost"
          disabled={query.isFetching}
          onPress={() => void query.fetchNextPage({ cancelRefetch: false })}
        >
          Tải thêm tên tag
        </Button>
      )}
    </View>
  );
}
