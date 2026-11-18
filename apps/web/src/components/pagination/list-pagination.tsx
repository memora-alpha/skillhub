"use client";
import { PageNavigation } from "./page-navigation";

export function ListPagination({
  query,
}: Readonly<{
  query: {
    pageNumber: number;
    totalPages?: number;
    hasNext: boolean;
    loading: boolean;
    goToPage: (page: number) => unknown;
  };
}>) {
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
