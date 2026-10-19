"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  AUDIT,
  DISPUTES,
  USERS,
  type AdminUser,
  type AuditEntry,
  type Dispute,
  type RoleCode,
} from "@/lib/console/data";

export type DisputeOutcome = "RESOLVE" | "REJECT" | "ESCALATE";
const OUTCOME_STATUS = {
  RESOLVE: "RESOLVED",
  REJECT: "REJECTED",
  ESCALATE: "UNDER_REVIEW",
} as const;

export type Portal = "admin" | "staff";

// Permissions are checked per action, never inferred from role: Staff is a separate role,
// not a subset of Admin. Replace with the principal's real permission set once auth lands.
const PERMISSIONS: Record<Portal, readonly string[]> = {
  admin: [
    "user.lock",
    "user.role",
    "skill.manage",
    "content.hide",
    "credit.adjust",
    "reputation.adjust",
    "review.hide",
    "config.update",
    "audit.read",
    "evidence.review",
    "moderation.review",
    "dispute.chat",
    "dispute.decide",
  ],
  staff: [
    "evidence.review",
    "moderation.review",
    "dispute.chat",
    "dispute.decide",
  ],
};

const ACTORS: Record<Portal, { name: string; role: RoleCode }> = {
  admin: { name: "Đặng Hoàng Nam", role: "ADMIN" },
  staff: { name: "Trần Quốc Bảo", role: "STAFF" },
};

type Ctx = {
  portal: Portal;
  actor: { name: string; role: RoleCode };
  can: (permission: string) => boolean;
  audit: AuditEntry[];
  /** Appends an audit entry (session-local until the API exists) and confirms with a toast. */
  record: (
    entry: Pick<
      AuditEntry,
      "action" | "target" | "reason" | "before" | "after"
    >,
  ) => void;
  toast: (message: string) => void;
  disputes: Dispute[];
  decideDispute: (id: string, outcome: DisputeOutcome, reason: string) => void;
  users: AdminUser[];
  updateUser: (id: string, patch: Partial<AdminUser>) => void;
};

const ConsoleContext = createContext<Ctx | null>(null);

export function useConsole() {
  const ctx = useContext(ConsoleContext);
  if (!ctx) throw new Error("useConsole must be used inside <ConsoleProvider>");
  return ctx;
}

export function ConsoleProvider({
  portal,
  children,
}: {
  portal: Portal;
  children: ReactNode;
}) {
  const [audit, setAudit] = useState<AuditEntry[]>(AUDIT);
  const [disputes, setDisputes] = useState<Dispute[]>(DISPUTES);
  const [users, setUsers] = useState<AdminUser[]>(USERS);
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const toast = useCallback((text: string) => {
    clearTimeout(timer.current);
    setMessage(text);
    timer.current = setTimeout(() => setMessage(null), 4500);
  }, []);

  const value = useMemo<Ctx>(() => {
    const actor = ACTORS[portal];
    const granted = new Set(PERMISSIONS[portal]);
    const record: Ctx["record"] = (entry) => {
      setAudit((prev) => [
        {
          ...entry,
          id: `au_${Date.now()}`,
          at: new Date().toISOString(),
          actor: actor.name,
          role: actor.role,
        },
        ...prev,
      ]);
      toast(`Đã ghi Audit log: ${entry.action}`);
    };
    return {
      portal,
      actor,
      can: (permission) => granted.has(permission),
      audit,
      record,
      toast,
      users,
      updateUser: (id, patch) =>
        setUsers((prev) =>
          prev.map((u) => (u.id === id ? { ...u, ...patch } : u)),
        ),
      disputes,
      decideDispute: (id, outcome, reason) => {
        const current = disputes.find((d) => d.id === id);
        if (!current) return;
        const status = OUTCOME_STATUS[outcome];
        setDisputes((prev) =>
          prev.map((d) =>
            d.id === id
              ? {
                  ...d,
                  status,
                  escalated: d.escalated || outcome === "ESCALATE",
                  decision: { outcome, reason },
                }
              : d,
          ),
        );
        record({
          action:
            outcome === "ESCALATE" ? "REPORT_CASE_UPDATE" : "DISPUTE_RESOLVE",
          target: `REPORT:${id}`,
          reason,
          before: current.status,
          after: outcome === "ESCALATE" ? "ESCALATED" : status,
        });
      },
    };
  }, [portal, audit, disputes, users, toast]);

  return (
    <ConsoleContext.Provider value={value}>
      {children}
      <div className="toast-region" role="status" aria-live="polite">
        {message && <div className="toast">{message}</div>}
      </div>
    </ConsoleContext.Provider>
  );
}
