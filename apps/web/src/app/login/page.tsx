import type { Metadata } from "next";
import { LoginScreen } from "@/features/auth/login-screen";
import "./login.css";
export const metadata: Metadata = { title: "Đăng nhập | SkillHub" };
export default function LoginPage() {
  return <LoginScreen />;
}
