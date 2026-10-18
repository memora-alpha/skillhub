import { Button } from "@/components/Button";
import { Copy } from "@/components/feature-page";
import { ConnectionFeedback } from "@/features/connections";

// Learning-path and schedule updates currently have no public SSE event.
export function PathReadFeedback({
  query,
}: {
  query: {
    isLoading: boolean;
    isFetching: boolean;
    error: unknown;
    refetch: () => unknown;
  };
}) {
  return (
    <>
      <ConnectionFeedback loading={query.isLoading} error={query.error} />
      <Button
        variant="secondary"
        disabled={query.isFetching}
        onPress={() => {
          void query.refetch();
        }}
      >
        {query.isFetching ? "Đang tải trạng thái..." : "Tải lại trạng thái"}
      </Button>
      <Copy muted>Tải lại để xem cập nhật mới từ đối tác.</Copy>
    </>
  );
}
