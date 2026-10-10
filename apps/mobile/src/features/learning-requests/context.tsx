import { createContext, useContext, useState, type ReactNode } from "react";
import type { PreferredSlot } from "./preferred-slots";
export type OwnRequest = {
  id: string;
  title: string;
  skill: string;
  skillId?: string;
  tags?: string[];
  preferredSlots?: PreferredSlot[];
  description: string;
  goal: string;
  level: string;
  status:
    | "DRAFT"
    | "PENDING_MODERATION"
    | "OPEN"
    | "REJECTED"
    | "NEGOTIATING"
    | "MATCHED"
    | "CANCELLED"
    | "EXPIRED";
  reason?: string;
};
const initial: OwnRequest[] = [
  {
    id: "my-react",
    title: "Học React để xây dựng ứng dụng",
    skill: "React",
    description:
      "Tôi đã biết JavaScript cơ bản và muốn thực hành React qua một dự án nhỏ.",
    goal: "Tự xây dựng ứng dụng quản lý công việc với React.",
    level: "BEGINNER",
    status: "OPEN",
  },
  {
    id: "request-rejected",
    title: "Tìm người hướng dẫn thiết kế",
    skill: "UI/UX",
    description: "Muốn cải thiện quy trình thiết kế giao diện sản phẩm.",
    goal: "Thiết kế một bộ giao diện mobile nhất quán.",
    level: "BEGINNER",
    status: "REJECTED",
    reason:
      "Vui lòng bỏ thông tin quảng cáo ngoài nền tảng và mô tả rõ mục tiêu học tập.",
  },
  {
    id: "request-matched",
    title: "Luyện tiếng Anh giao tiếp",
    skill: "Tiếng Anh",
    description:
      "Luyện giao tiếp tiếng Anh cho các tình huống công việc thực tế.",
    goal: "Thuyết trình một dự án bằng tiếng Anh.",
    level: "INTERMEDIATE",
    status: "MATCHED",
  },
];
const Context = createContext<{
  requests: OwnRequest[];
  save: (request: OwnRequest) => void;
} | null>(null);
export function RequestsPreviewProvider({ children }: { children: ReactNode }) {
  const [requests, setRequests] = useState(initial);
  return (
    <Context.Provider
      value={{
        requests,
        save: (request) =>
          setRequests((items) => [
            request,
            ...items.filter((i) => i.id !== request.id),
          ]),
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useRequestsPreview() {
  const value = useContext(Context);
  if (!value) throw new Error("RequestsPreviewProvider missing");
  return value;
}
