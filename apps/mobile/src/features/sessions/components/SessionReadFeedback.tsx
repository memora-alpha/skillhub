import { ConnectionFeedback } from "@/features/connections";
import { Copy } from "@/components/feature-page";

export function SessionReadFeedback({
  query,
}: Readonly<{
  query: {
    isLoading: boolean;
    isFetching: boolean;
    error: unknown;
    refetch: () => unknown;
  };
}>) {
  return (
    <>
      <ConnectionFeedback
        loading={query.isLoading}
        error={query.error}
        retry={query.isFetching ? undefined : query.refetch}
      />
      {query.isFetching && !query.isLoading && (
        <Copy muted>Đang cập nhật buổi học…</Copy>
      )}
    </>
  );
}
