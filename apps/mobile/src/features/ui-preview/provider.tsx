import type { ReactNode } from "react";
import { useAuthSession } from "@/features/auth";
import { RequestsProvider } from "@/features/learning-requests";
import { PathsPreviewProvider } from "@/features/learning-paths";
import { SessionsPreviewProvider } from "@/features/sessions";
import { MaterialsPreviewProvider } from "@/features/materials";
import { ReportsPreviewProvider } from "@/features/reports";
import { ProductPreviewProvider } from "@/features/product-shell";
export function UiPreviewProvider({ children }: { children: ReactNode }) {
  const { session } = useAuthSession();
  return (
    <RequestsProvider key={session?.userId ?? "guest"}>
      <PathsPreviewProvider>
        <SessionsPreviewProvider>
          <MaterialsPreviewProvider>
            <ReportsPreviewProvider>
              <ProductPreviewProvider>{children}</ProductPreviewProvider>
            </ReportsPreviewProvider>
          </MaterialsPreviewProvider>
        </SessionsPreviewProvider>
      </PathsPreviewProvider>
    </RequestsProvider>
  );
}
