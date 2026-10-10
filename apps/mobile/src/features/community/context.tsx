import { createContext, useContext, useState, type ReactNode } from "react";
const Context = createContext<{
  badge: string;
  setBadge: (value: string) => void;
} | null>(null);
export function CommunityPreviewProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [badge, setBadge] = useState("Người mới gia nhập");
  return (
    <Context.Provider value={{ badge, setBadge }}>{children}</Context.Provider>
  );
}
export function useCommunityPreview() {
  const v = useContext(Context);
  if (!v) throw new Error("CommunityPreviewProvider missing");
  return v;
}
