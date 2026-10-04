import { createContext, useContext, useState, type ReactNode } from "react";

export type MockSession = { name: string; email: string; isNew: boolean };
type SessionContextValue = {
  session: MockSession | null;
  enterDemo: (profile: MockSession) => void;
  signOut: () => void;
};
const SessionContext = createContext<SessionContextValue | null>(null);

// UI preview only: credentials are never stored, sent or checked against an account.
export function MockSessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<MockSession | null>(null);
  return (
    <SessionContext.Provider
      value={{
        session,
        enterDemo: setSession,
        signOut: () => setSession(null),
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
