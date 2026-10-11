export type Actor = "me" | "partner";
export type Slot = { startAt: string; duration: number };
export type Plan = {
  id: string;
  teacher: Actor;
  learner: Actor;
  skill: string;
  goal: string;
  outline: string[];
  version: number;
  learnerVersion?: number;
  revision?: string;
  schedule?: {
    version: number;
    slots: Slot[];
    meVersion?: number;
    partnerVersion?: number;
  };
};
export type LearningPath = {
  id: string;
  title: string;
  partner: string;
  conversationId?: string;
  type: "TWO_WAY" | "ONE_WAY";
  credit: string;
  version: number;
  meVersion?: number;
  partnerVersion?: number;
  status: "PROPOSED" | "ACTIVE" | "COMPLETED" | "DISPUTED" | "CANCELLED";
  plans: Plan[];
  teacher?: Actor;
  completedSessions: number;
  reviewed?: boolean;
  review?: { rating: number; comment: string };
  cancellation?: { actor: Actor; reason: string; at: string };
};
