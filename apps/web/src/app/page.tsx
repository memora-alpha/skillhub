import type { Metadata } from "next";
import { LandingPage } from "@/features/landing/landing-page";
import "@/features/landing/landing.css";
export const metadata: Metadata = {
  title: "SkillHub — Chia sẻ điều bạn biết. Học điều bạn muốn.",
  description:
    "Kết nối và học kỹ năng trực tuyến 1:1. Trao đổi kỹ năng, học cùng người hướng dẫn và khám phá tài liệu số trên SkillHub.",
};

export default function HomePage() {
  return <LandingPage />;
}
