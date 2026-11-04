import type { Metadata } from "next";
import { UserSessionProvider } from "@/features/learner/auth/session";
import "./learner.css";
import "./product.css";
import "./product-adapter.css";
export const metadata: Metadata = {
  title: { default: "Học cùng SkillHub", template: "%s | SkillHub" },
};
export default function LearnerLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <UserSessionProvider>{children}</UserSessionProvider>;
}
