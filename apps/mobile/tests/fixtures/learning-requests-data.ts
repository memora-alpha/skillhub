import type {
  OwnerRequest,
  PublicRequestDetail,
} from "../../src/features/learning-requests/types";

export const fixtureId = (n: number) =>
  `10000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;
export const fixtureUsers = [
  {
    id: fixtureId(1),
    email: "learner-a@example.test",
    name: "Người học A",
    token: "fixture-a",
  },
  {
    id: fixtureId(2),
    email: "learner-b@example.test",
    name: "Người học B",
    token: "fixture-b",
  },
] as const;
export const fixtureSkills = [
  { id: fixtureId(10), name: "React", status: "ACTIVE" },
  { id: fixtureId(11), name: "Python", status: "ACTIVE" },
] as const;
export type FixtureUser = (typeof fixtureUsers)[number];
export type FixtureRequest = { actor: string; request: OwnerRequest };

export function fixtureRequest(
  overrides: Partial<OwnerRequest> = {},
  now = Date.now(),
): OwnerRequest {
  const iso = (offset: number) => new Date(now + offset).toISOString();
  return {
    id: fixtureId(100),
    skillId: fixtureSkills[0].id,
    title: "Học React từ căn bản",
    description: "Muốn học React để xây dựng một ứng dụng di động.",
    learningGoal: "Tự xây dựng ứng dụng React đầu tiên",
    currentLevel: null,
    verifiedTeacherOnly: false,
    tagIds: [fixtureId(20)],
    teachingOverview: null,
    desiredCreditPerHour: null,
    preferredAvailability: null,
    offeredSharingSkillIds: [],
    offeredSharingSkills: [],
    preferredSlots: [{ startAt: iso(172_800_123), endAt: iso(176_400_123) }],
    status: "OPEN",
    moderationStatus: "NOT_REQUIRED",
    moderationRejectReason: null,
    version: 1,
    requestedExpiresAt: null,
    expiresAt: iso(86_400_000),
    publishedAt: iso(-3_600_000),
    createdAt: iso(-3_600_000),
    updatedAt: iso(-3_600_000),
    ...overrides,
  };
}

export function createFixtureData(now = Date.now()): FixtureRequest[] {
  return fixtureUsers.flatMap((user, actorIndex) =>
    Array.from({ length: 25 }, (_, index) => {
      const draft = actorIndex === 0 && index === 2;
      const rejected = actorIndex === 0 && index === 1;
      let status: OwnerRequest["status"] = "OPEN";
      if (draft) status = "DRAFT";
      else if (rejected) status = "REJECTED";
      return {
        actor: user.id,
        request: fixtureRequest(
          {
            id: fixtureId(100 + actorIndex * 100 + index),
            title: `Học ${index % 2 ? "Python" : "React"} thực hành ${index + 1}`,
            skillId: fixtureSkills[index % 2]!.id,
            createdAt: new Date(now - index * 3_600_000).toISOString(),
            status,
            moderationStatus: rejected ? "REJECTED" : "NOT_REQUIRED",
            moderationRejectReason: rejected
              ? "Cần mô tả mục tiêu rõ hơn."
              : null,
            publishedAt: draft ? null : new Date(now - 3_600_000).toISOString(),
            expiresAt: draft ? null : new Date(now + 86_400_000).toISOString(),
          },
          now,
        ),
      };
    }),
  );
}

export function publicFixture(entry: FixtureRequest): PublicRequestDetail {
  const request = entry.request;
  const user = fixtureUsers.find((item) => item.id === entry.actor)!;
  const skill = fixtureSkills.find((item) => item.id === request.skillId)!;
  return {
    id: request.id,
    title: request.title,
    description: request.description,
    learningGoal: request.learningGoal,
    currentLevel: request.currentLevel,
    verifiedTeacherOnly: request.verifiedTeacherOnly,
    status: request.status,
    createdAt: request.createdAt,
    expiresAt: request.expiresAt,
    preferredSlots: request.preferredSlots,
    teachingOverview: request.teachingOverview,
    desiredCreditPerHour: request.desiredCreditPerHour,
    preferredAvailability: request.preferredAvailability,
    offeredSharingSkills: request.offeredSharingSkills,
    version: request.version,
    skill: { id: skill.id, name: skill.name },
    owner: { id: user.id, displayName: user.name },
    tags: request.tagIds.map((id) => ({ id, label: "Thực hành" })),
  };
}

export function fixtureIdentity(user: FixtureUser) {
  return {
    userId: user.id,
    email: user.email,
    emailVerified: true,
    accountStatus: "ACTIVE",
    roles: ["USER"],
    profile: {
      userId: user.id,
      fullName: user.name,
      headline: "Học cùng nhau",
      bio: "Tài khoản fixture.",
      timezone: "Asia/Ho_Chi_Minh",
      locale: "vi",
      avatarUrl: null,
      reputationScore: 50,
      verifiedSkillCount: 0,
      completedSessionCount: 0,
    },
  };
}
