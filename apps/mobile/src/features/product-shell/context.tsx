import { createContext, useContext, useState, type ReactNode } from "react";
const Context = createContext<{
  enabled: string[];
  toggle: (group: string) => void;
  interests: string[];
  setInterests: (v: string[]) => void;
  timezone: string;
  language: string;
  setLocale: (key: "timezone" | "language", value: string) => void;
} | null>(null);
export function ProductPreviewProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(["Học tập", "Credit", "Cộng đồng"]);
  const [interests, setInterests] = useState<string[]>([]);
  const [locale, setLocale] = useState({
    timezone: "Asia/Ho_Chi_Minh",
    language: "Tiếng Việt",
  });
  return (
    <Context.Provider
      value={{
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
