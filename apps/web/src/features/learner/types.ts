export type Identity = {
  userId: string;
  email: string;
  roles: string[];
  profile: { fullName: string; avatarUrl: string | null };
};
export type Pagination = {
  page?: number;
  total?: number;
  limit: number;
  hasMore: boolean;
  nextCursor: string | null;
};
export type Reply<T> = {
  success: true;
  data: T;
  meta?: { pagination?: Pagination };
};
export type Skill = { id: string; name: string; status?: string };
export type SharingSkill = {
  version: number;
  experienceYears?: string | null;
  verificationStatus?: string;
  id: string;
  skill: Skill;
  level: string;
  levelId: string;
  description: string;
  isVisible: boolean;
  archivedAt: string | null;
};
export type Post = {
  tagIds?: string[];
  tags?: { id: string; label: string }[];
  proposedTags?: string[];
  offeredSharingSkillIds?: string[];
  offeredSharingSkills?: {
    id: string;
    skill: Skill;
    level: string;
    verificationStatus: string;
    skillLevel?: { name: string } | null;
  }[];
  teachingOverview?: string | null;
  preferredAvailability?: {
    timeZone: string;
    weeklySlots: { weekday: string; startTime: string; endTime: string }[];
  } | null;
  preferredSlots?: { startAt: string; endAt: string }[];
  verifiedTeacherOnly?: boolean;
  expiresAt?: string | null;
  requestedExpiresAt?: string | null;
  publishedAt?: string | null;
  id: string;
  ownerId?: string;
  owner?: { id: string; displayName: string; avatarUrl: string | null };
  skillId: string;
  skill?: Skill;
  title: string;
  description?: string;
  learningGoal: string;
  currentLevel: string | null;
  status: string;
  effectiveStatus?: string;
  moderationStatus?: string;
  version: number;
  desiredCreditPerHour: string | null;
  moderationRejectReason?: string | null;
  createdAt: string;
};
export type Proposal = {
  learningRequestTitle?: string | null;
  conversationId?: string;
  proposedDurationMinutes?: number | null;
  initialSessionCount?: number | null;
  id: string;
  sourceType: "LEARNING_REQUEST" | "DIRECT_SEARCH";
  proposerId: string;
  recipientId: string;
  learningRequestId: string | null;
  skillId: string;
  message: string;
  status: string;
  version: number;
  exchangeTypeHint: string | null;
  proposedCredit: string | null;
  candidateSlots: string | null;
  createdAt: string;
};
export type Conversation = {
  id: string;
  proposalId: string;
  learningRequestId: string | null;
  participantAId: string;
  participantBId: string;
  createdAt: string;
};
export type Message = {
  id: string;
  senderId: string;
  messageText: string;
  messageType: string;
  sentAt: string;
  sequence: string;
  attachments: {
    attachmentId: string;
    fileId?: string;
    filename: string;
    fileSizeBytes?: number;
  }[];
  objectType?: string;
  objectId?: string;
};
export type ScheduleItem = {
  sessionNo: number;
  startAt: string;
  endAt: string;
};
export type Schedule = {
  id: string;
  version: number;
  appliedVersion: number | null;
  status: string;
  participantAConfirmedAt: string | null;
  participantBConfirmedAt: string | null;
  items: ScheduleItem[];
};
export type Plan = {
  id: string;
  version: number;
  status: string;
  skillId: string;
  teacherId: string;
  learnerId: string;
  learningGoal: string;
  totalSessions: number;
  learnerConfirmedAt: string | null;
  sessionOutline: { sessionNo: number; content: string }[];
  schedule: Schedule | null;
  sessions: (ScheduleItem & { id: string; status: string })[];
};
export type LearningPath = {
  id: string;
  conversationId: string;
  status: string;
  participantAId: string;
  participantBId: string;
  currentVersion: number;
  lockedVersion: number | null;
  settledAt: string | null;
  agreement: {
    version: number;
    exchangeType: "ONE_WAY" | "TWO_WAY";
    teacherId: string | null;
    learnerId: string | null;
    negotiatedCredit: string | null;
    totalCreditPerUser: string | null;
    participantAConfirmedAt: string | null;
    participantBConfirmedAt: string | null;
  };
  plans: Plan[];
};
export type PathSummary = Pick<
  LearningPath,
  "id" | "conversationId" | "status" | "currentVersion" | "lockedVersion"
> & { counterpartId: string; createdAt: string; exchangeType: string | null };
export type SessionAction =
  | "JOIN"
  | "CONFIRM_COMPLETION"
  | "SUBMIT_EXCUSE"
  | "DECIDE_EXCUSE"
  | "REPORT_NO_SHOW"
  | "PROPOSE_MAKEUP";
export type LearningSession = {
  id: string;
  pathId: string;
  planId: string;
  teacherId: string;
  learnerId: string;
  startAt: string;
  endAt: string;
  originalStartAt?: string | null;
  rescheduleCount?: number;
  makeupCount?: number;
  makeupUserIds?: string[];
  makeupQuota?: {
    userId: string;
    totalSessions: number;
    limit: number;
    used: number;
    remaining: number;
    requiresReview: boolean;
    reason: string | null;
  };
  status: string;
  role?: string;
  teacherConfirmationStatus: string | null;
  learnerConfirmationStatus: string | null;
  join?: {
    canJoin: boolean;
    opensAt: string | null;
    closesAt: string | null;
    reason: string | null;
  };
  allowedActions?: SessionAction[];
  attendance?: {
    state: string | null;
    teacher?: {
      verdict: string | null;
      seconds: string;
      late?: boolean;
      firstJoinedAt?: string | null;
    };
    learner?: {
      verdict: string | null;
      seconds: string;
      late?: boolean;
      firstJoinedAt?: string | null;
    };
    determinedAt?: string | null;
    case?: string | null;
  };
  deadlines?: {
    confirmBy: string | null;
    excuseOrReportBy: string | null;
    makeupBy: string | null;
  };
  excuse?: { status: string; reason: string; absentUserId: string } | null;
};
export type LiveKitCredentials = {
  serverUrl: string;
  participantToken: string;
  roomName: string;
  participantIdentity: string;
  expiresAt: string;
  joinOpensAt: string;
  joinClosesAt: string;
};
