import type { ReactNode } from "react";
import { InboxLayout } from "@/features/learner/messages/inbox-layout";
export default function Layout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return <InboxLayout>{children}</InboxLayout>;
}
