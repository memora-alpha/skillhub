import type { ReactNode } from "react";
import { useAuthSession } from "@/features/auth";
import { RequestsProvider } from "@/features/learning-requests";
import { PathsPreviewProvider } from "@/features/learning-paths";
import { SessionsPreviewProvider } from "@/features/sessions";
import { ReportsPreviewProvider } from "@/features/reports";
import { ProductPreviewProvider } from "@/features/product-shell";
export function UiPreviewProvider({ children }: { children: ReactNode }) {
  const { session } = useAuthSession();
  return (
    <RequestsProvider key={session?.userId ?? "guest"}>
      <PathsPreviewProvider>
        <SessionsPreviewProvider>
          <ReportsPreviewProvider>
            <ProductPreviewProvider>{children}</ProductPreviewProvider>
          </ReportsPreviewProvider>
        </SessionsPreviewProvider>
      </PathsPreviewProvider>
    </RequestsProvider>
  );
}
