import { createContext, useContext, useState, type ReactNode } from "react";
const Context = createContext<{
  interests: string[];
  setInterests: (v: string[]) => void;
} | null>(null);
export function ProductPreviewProvider({ children }: { children: ReactNode }) {
  const [interests, setInterests] = useState<string[]>([]);
  return (
    <Context.Provider
      value={{
        interests,
        setInterests,
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
