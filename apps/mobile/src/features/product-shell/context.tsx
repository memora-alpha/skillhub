import { createContext, useContext, useState, type ReactNode } from "react";
import type { Href } from "expo-router";
export type PreviewNotification = {
  id: string;
  title: string;
  body: string;
  group: "Học tập" | "Credit" | "Cộng đồng";
  href: Href;
  read: boolean;
};
const initial: PreviewNotification[] = [
  {
    id: "n-proposal",
    title: "Bạn nhận được đề xuất mới",
    body: "Một người chia sẻ muốn trao đổi với bạn về React.",
    group: "Học tập",
    href: "/proposals",
    read: false,
  },
  {
    id: "n-session",
    title: "Buổi học cần xác nhận",
    body: "Cùng đối tác xác nhận sau buổi học để cập nhật tiến độ.",
    group: "Học tập",
    href: "/learning-sessions/active-react-0",
    read: false,
  },
  {
    id: "n-report",
    title: "Báo cáo cần thêm thông tin",
    body: "Bổ sung chi tiết để tiếp tục xem xét báo cáo.",
    group: "Cộng đồng",
    href: "/reports/report-info",
    read: true,
  },
];
const Context = createContext<{
  notifications: PreviewNotification[];
  read: (id?: string) => void;
  enabled: string[];
  toggle: (group: string) => void;
  interests: string[];
  setInterests: (v: string[]) => void;
  timezone: string;
  language: string;
  setLocale: (key: "timezone" | "language", value: string) => void;
} | null>(null);
export function ProductPreviewProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState(initial);
  const [enabled, setEnabled] = useState(["Học tập", "Credit", "Cộng đồng"]);
  const [interests, setInterests] = useState<string[]>([]);
  const [locale, setLocale] = useState({
    timezone: "Asia/Ho_Chi_Minh",
    language: "Tiếng Việt",
  });
  return (
    <Context.Provider
      value={{
        notifications,
        read: (id) =>
          setNotifications((items) =>
            items.map((i) => (!id || i.id === id ? { ...i, read: true } : i)),
          ),
        enabled,
        toggle: (group) =>
          setEnabled((items) =>
            items.includes(group)
              ? items.filter((i) => i !== group)
              : [...items, group],
          ),
        interests,
        setInterests,
        ...locale,
        setLocale: (key, value) => setLocale((v) => ({ ...v, [key]: value })),
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useProductPreview() {
  const v = useContext(Context);
  if (!v) throw new Error("ProductPreviewProvider missing");
  return v;
}
