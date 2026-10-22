import { ConnectionFeedback } from "@/features/connections";

// Learning-path and schedule updates currently have no public SSE event.
export function PathReadFeedback({
  query,
}: Readonly<{
  query: {
    isLoading: boolean;
    isFetching: boolean;
    error: unknown;
    refetch: () => unknown;
  };
}>) {
  if (!query.isLoading && !query.error) return null;
  return (
    <ConnectionFeedback
      loading={query.isLoading}
      error={query.error}
      retry={query.isFetching ? undefined : query.refetch}
    />
  );
}
