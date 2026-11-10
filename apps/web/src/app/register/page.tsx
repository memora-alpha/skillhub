import type { Metadata } from "next";
import { AccountScreen } from "@/features/auth/account-screen";
import "../login/login.css";
export const metadata: Metadata = { title: "Đăng ký | SkillHub" };
export default function Page() {
  return <AccountScreen mode="register" />;
}
