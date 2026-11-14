import type { ReactNode } from "react";
import { useAuthSession } from "@/features/auth";
import { RequestsProvider } from "@/features/learning-requests";

export function LearningProviders({
  children,
}: Readonly<{ children: ReactNode }>) {
  const { session } = useAuthSession();
  return (
    <RequestsProvider key={session?.userId ?? "guest"}>
      {children}
    </RequestsProvider>
  );
}
