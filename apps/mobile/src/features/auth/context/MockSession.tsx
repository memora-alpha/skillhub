import { createContext, useContext, useState, type ReactNode } from "react";

export type MockSession = {
  name: string;
  email: string;
  isNew: boolean;
  bio?: string;
  website?: string;
};
type SessionContextValue = {
  session: MockSession | null;
  enterDemo: (profile: MockSession) => void;
  signOut: () => void;
  updateProfile: (
    changes: Pick<MockSession, "name" | "bio" | "website">,
  ) => void;
};
const SessionContext = createContext<SessionContextValue | null>(null);

// UI preview only: credentials are never stored, sent or checked against an account.
export function MockSessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<MockSession | null>(null);
  const updateProfile = (
    changes: Pick<MockSession, "name" | "bio" | "website">,
  ) => setSession((current) => (current ? { ...current, ...changes } : null));
  return (
    <SessionContext.Provider
      value={{
        session,
        enterDemo: setSession,
        signOut: () => setSession(null),
        updateProfile,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}
export function useMockSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error("MockSessionProvider is required.");
  return value;
}
