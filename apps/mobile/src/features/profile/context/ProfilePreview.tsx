import { createContext, useContext, type ReactNode } from "react";
import { useAuthSession } from "@/features/auth";
import { toOwnProfilePreview } from "../utils/public-profile";
import type { PublicProfile } from "../types/profile";

type PreviewContext = {
  profile: PublicProfile | null;
};
const ProfileContext = createContext<PreviewContext | null>(null);

export function ProfilePreviewProvider({ children }: { children: ReactNode }) {
  const { account } = useAuthSession();
  const profile = account ? toOwnProfilePreview(account.profile) : null;
  return (
    <ProfileContext.Provider value={{ profile }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfilePreview(): PreviewContext {
  const value = useContext(ProfileContext);
  if (!value) throw new Error("ProfilePreviewProvider is required.");
  return value;
}
