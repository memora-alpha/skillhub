import { Button } from "@/components/Button";
import { FeaturePage, Panel, Copy } from "@/components/feature-page";
import { ConnectionFeedback } from "@/features/connections";
import { uuid } from "@/lib/http/contracts";
import { TagRequestContent } from "../components/tag-request-content";
import { useTagRequest } from "../hooks/use-tag-requests";

export function TagRequestDetailScreen({
  id,
}: Readonly<{ id?: string | string[] }>) {
  const requestId = typeof id === "string" ? id : "";
  const query = useTagRequest(requestId);
  const valid = uuid.safeParse(requestId).success;
  return (
    <FeaturePage
      title="Chi tiết đề xuất tag"
      back="/tag-requests"
      demo={false}
      refreshing={query.isRefetching}
      onRefresh={valid ? () => void query.refetch() : undefined}
    >
      {!valid ? (
        <Copy>Đề xuất không hợp lệ. Quay lại danh sách để chọn.</Copy>
      ) : (
        <>
          <ConnectionFeedback
            loading={query.isLoading}
            error={query.error}
            retry={query.refetch}
          />
          {query.data && (
            <Panel title={query.data.label}>
              <TagRequestContent request={query.data} />
            </Panel>
          )}
          <Button
            variant="paper"
            disabled={query.isFetching}
            onPress={() => void query.refetch()}
          >
            Tải lại quyết định
          </Button>
        </>
      )}
    </FeaturePage>
  );
}
