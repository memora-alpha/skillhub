"use client";
import { PageNavigation } from "./page-navigation";

export function ListPagination({
  query,
}: Readonly<{
  query: {
    items: readonly unknown[];
    pageNumber: number;
    totalPages?: number;
    hasNext: boolean;
    loading: boolean;
    goToPage: (page: number) => unknown;
  };
}>) {
  // Keep navigation when another page is reachable, including an emptied later page.
  if (!query.items.length && query.pageNumber === 1 && !query.hasNext)
    return null;
  return (
    <PageNavigation
      pageNumber={query.pageNumber}
      totalPages={query.totalPages}
      hasNext={query.hasNext}
      loading={query.loading}
      onPageChange={(page) => {
        void query.goToPage(page);
      }}
    />
  );
}
