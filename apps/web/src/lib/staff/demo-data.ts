import type {
  AdminTag,
  AdminUser,
  CatalogSkill,
  ModerationRules,
  SkillLevel,
  TagRequest,
} from "./admin-types";
import type { Achievements } from "./achievements";
import type {
  CreditEntry,
  ModeratedMaterial,
  ReputationHistory,
  Wallet,
} from "./account-types";
import type {
  InboxNotification,
  LearningRequest,
  ReportCaseDetail,
  Verification,
} from "./types";

export type DemoData = {
  version: 1;
  users: AdminUser[];
  skills: CatalogSkill[];
  levels: Record<string, SkillLevel[]>;
  tags: AdminTag[];
  tagRequests: TagRequest[];
  verifications: Verification[];
  requests: LearningRequest[];
  reports: ReportCaseDetail[];
  materials: ModeratedMaterial[];
  notifications: InboxNotification[];
  rules: ModerationRules;
  wallet: Wallet;
  ledger: CreditEntry[];
  reputation: ReputationHistory;
  achievements: Achievements;
};

export function demoId(value: number): string {
  return `d${value.toString(16).padStart(7, "0")}-0000-4000-8000-${value.toString(16).padStart(12, "0")}`;
}
const names = [
  "Lập trình React",
  "Thiết kế giao diện",
  "Tiếng Anh giao tiếp",
  "Excel cơ bản",
  "Chụp ảnh sản phẩm",
];
const at = (days: number) =>
  new Date(Date.UTC(2026, 9, 23 - days, 3)).toISOString();

export function createDemoData(adminId: string): DemoData {
  const five = [0, 1, 2, 3, 4];
  const skills: CatalogSkill[] = five.map((i) => ({
    id: demoId(100 + i),
    name: `[TEST] ${names[i]}`,
    slug: `test-skill-${i + 1}`,
    description: `Kỹ năng mẫu ${i + 1} để thử thêm, sửa và lưu trữ.`,
    categoryId: null,
    status: "ACTIVE",
    version: 1,
    createdAt: at(i),
    updatedAt: at(i),
  }));
  const materialStates = [
    "PENDING_REVIEW",
    "PUBLISHED",
    "REJECTED",
    "HIDDEN",
    "ARCHIVED",
  ] as const;
  const materials: ModeratedMaterial[] = materialStates.flatMap(
    (status, group) =>
      five.map((i) => ({
        id: demoId(1000 + group * 10 + i),
        ownerId: demoId(10 + i),
        skillId: skills[i]!.id,
        title: `[TEST] ${names[i]} — bài ${i + 1}`,
        description: `Tài liệu mẫu cho kỹ năng ${names[i]}. Dùng để thử tìm kiếm, duyệt, từ chối, ẩn và hiện lại.`,
        accessType: i % 2 === 0 ? "FREE" : "PAID",
        priceCredit: i % 2 === 0 ? "0.00" : "25.00",
        listingVersion: 1,
        status,
        scanStatus: "CLEAN",
        moderationStatus:
          status === "PENDING_REVIEW"
            ? "PENDING"
            : status === "REJECTED"
              ? "REJECTED"
              : "APPROVED",
        rejectReason:
          status === "REJECTED"
            ? "[TEST] Cần bổ sung nội dung hướng dẫn."
            : null,
        reviewedAt: status === "PENDING_REVIEW" ? null : at(i),
        distributionRightsConfirmedAt: at(i + 1),
        file: {
          originalFilename: `bai-hoc-mau-${i + 1}.pdf`,
          mimeType: "application/pdf",
          sizeBytes: String(200_000 + i * 1000),
        },
        createdAt: at(i + 1),
        updatedAt: at(i),
      })),
  );
  return {
    version: 1,
    users: [
      {
        userId: adminId,
        fullName: "[TEST] Admin của bạn",
        maskedEmail: "admin***@example.com",
        accountStatus: "ACTIVE",
        roles: ["ADMIN"],
        createdAt: at(0),
      },
      ...five.map((i) => ({
        userId: demoId(10 + i),
        fullName: `[TEST] Người dùng ${i + 1}`,
        maskedEmail: `test${i + 1}***@example.com`,
        accountStatus: i === 4 ? "LOCKED" : "ACTIVE",
        roles: [i === 3 ? "STAFF" : "USER"],
        createdAt: at(i),
      })),
    ],
    skills,
    levels: Object.fromEntries(
      skills.map((skill, index) => [
        skill.id,
        five.map((i) => ({
          id: demoId(200 + index * 10 + i),
          skillId: skill.id,
          code: `TEST_${i + 1}`,
          name: `[TEST] Cấp độ ${i + 1}`,
          description: "Cấp độ mẫu để thử chỉnh sửa.",
          sortOrder: i,
          status: "ACTIVE",
          version: 1,
        })),
      ]),
    ),
    tags: five.map((i) => ({
      id: demoId(300 + i),
      label: `[TEST] ${names[i]}`,
      status: "ACTIVE",
      version: 1,
      createdAt: at(i),
      updatedAt: at(i),
    })),
    tagRequests: five.map((i) => ({
      id: demoId(400 + i),
      label: `[TEST] Đề xuất ${names[i]}`,
      status: "PENDING",
      requestedByUserId: demoId(10 + i),
      reviewedByUserId: null,
      reviewedAt: null,
      resultTagId: null,
      rejectReason: null,
      createdAt: at(i),
      version: 1,
    })),
    verifications: five.map((i) => ({
      id: demoId(500 + i),
      sharingSkillId: demoId(550 + i),
      status: "PENDING",
      submittedAt: at(i),
      reviewerId: null,
      reviewedAt: null,
      note: null,
      rejectReason: null,
      files: [],
      version: 1,
    })),
    requests: five.map((i) => ({
      id: demoId(600 + i),
      ownerId: demoId(10 + i),
      skillId: skills[i]!.id,
      title: `[TEST] Muốn học ${names[i]}`,
      description: `Yêu cầu học mẫu ${i + 1}, dùng để thử hàng đợi kiểm duyệt.`,
      learningGoal: "Hoàn thành một bài thực hành cơ bản.",
      currentLevel: "Mới bắt đầu",
      verifiedTeacherOnly: false,
      teachingOverview: "Có thể chia sẻ kỹ năng giao tiếp cơ bản.",
      desiredCreditPerHour: "20.00",
      preferredAvailability: null,
      preferredSlots: [],
      tagIds: [],
      status: "PENDING_MODERATION",
      moderationStatus: "PENDING",
      flaggedCategories: ["TEST_CONTENT"],
      moderationRejectReason: null,
      version: 1,
      createdAt: at(i),
    })),
    reports: [
      ...five.map<ReportCaseDetail>((i) => ({
        id: demoId(700 + i),
        reporterId: demoId(10 + i),
        targetType: "SESSION",
        targetId: demoId(750 + i),
        relatedSessionId: demoId(750 + i),
        relatedPathId: demoId(800 + i),
        relatedMaterialId: null,
        relatedOrderId: null,
        reasonCode: [
          "NO_SHOW",
          "TECHNICAL_ISSUE",
          "OTHER",
          "SKILL_MISMATCH",
          "CREDIT_ISSUE",
        ][i]!,
        description: `[TEST] Báo cáo mẫu ${i + 1}. Dùng thử nhận xử lý, yêu cầu bổ sung và giải quyết.`,
        status: "OPEN",
        handlerId: null,
        blocksSettlement: true,
        resolutionNote: null,
        createdAt: at(i),
        resolvedAt: null,
        reportEvidenceCaseIdRecords: [],
        session: {
          id: demoId(750 + i),
          planId: demoId(850 + i),
          teacherId: demoId(10 + i),
          learnerId: demoId(20 + i),
          startAt: at(i + 1),
          endAt: new Date(
            new Date(at(i + 1)).getTime() + 3600000,
          ).toISOString(),
          status: "COMPLETED",
          teacherConfirmationStatus: "CONFIRMED",
          learnerConfirmationStatus: "CONFIRMED",
        },
        path: {
          id: demoId(800 + i),
          status: "IN_PROGRESS",
          participantAId: demoId(10 + i),
          participantBId: demoId(20 + i),
          lockedVersion: 1,
          settledAt: null,
        },
      })),
      ...five.map<ReportCaseDetail>((i) => ({
        id: demoId(1400 + i),
        reporterId: demoId(10 + i),
        targetType: "MATERIAL",
        targetId: materials[i]!.id,
        relatedMaterialId: materials[i]!.id,
        relatedOrderId: i % 2 ? demoId(1450 + i) : null,
        relatedSessionId: null,
        relatedPathId: null,
        reasonCode: "INAPPROPRIATE_CONTENT",
        description: `[TEST] Báo cáo tài liệu ${i + 1}. Dùng thử xem đối tượng và đơn mua liên quan.`,
        status: "OPEN",
        handlerId: null,
        blocksSettlement: false,
        resolutionNote: null,
        createdAt: at(i),
        resolvedAt: null,
        reportEvidenceCaseIdRecords: [],
        session: null,
        path: null,
      })),
    ],
    materials,
    notifications: five.map((i) => ({
      id: demoId(900 + i),
      title: `[TEST] Thông báo ${i + 1}`,
      body: `Có tài liệu ${names[i]} cần xem xét. Đây là thông báo mẫu.`,
      type: "SYSTEM",
      readAt: null,
      createdAt: at(i),
    })),
    rules: {
      rules: five.map((i) => ({
        category: `TEST_${i + 1}`,
        pattern: `noi dung thu nghiem ${i + 1}`,
      })),
      version: 1,
      readAt: at(0),
    },
    wallet: {
      availableCredit: "250.00",
      heldCredit: "50.00",
      walletVersion: 1,
    },
    ledger: five.map((i) => ({
      id: demoId(1100 + i),
      operationId: demoId(1150 + i),
      type: ["TOP_UP", "HOLD", "RELEASE", "MATERIAL_SALE", "ADJUSTMENT"][i]!,
      amount: ["100.00", "50.00", "20.00", "24.00", "6.00"][i]!,
      availableDelta: ["100.00", "-50.00", "20.00", "24.00", "6.00"][i]!,
      heldDelta: ["0.00", "50.00", "-20.00", "0.00", "0.00"][i]!,
      availableAfter: ["250.00", "150.00", "200.00", "180.00", "156.00"][i]!,
      heldAfter: ["50.00", "50.00", "0.00", "20.00", "20.00"][i]!,
      status: "SUCCESS",
      referenceType: [
        "PAYMENT",
        "LEARNING_PATH",
        "LEARNING_PATH",
        "MATERIAL_ORDER",
        "SYSTEM",
      ][i]!,
      referenceId: demoId(1200 + i),
      reversesTransactionId: null,
      createdAt: at(i),
    })),
    reputation: {
      reputationScore: 60,
      level: "NORMAL",
      activeRestrictions: [],
      items: five.map((i) => ({
        id: demoId(1300 + i),
        delta: 2,
        scoreBefore: 58 - i * 2,
        scoreAfter: 60 - i * 2,
        reasonCode: "REVIEW_RATING",
        sourceType: "REVIEW",
        sourceId: demoId(1350 + i),
        createdAt: at(i),
      })),
      nextCursor: null,
    },
    achievements: {
      selectedTitle: null,
      items: five.map((i) => ({
        code: `TEST_TITLE_${i + 1}`,
        title: `[TEST] Danh hiệu ${i + 1}`,
        description: `Danh hiệu mẫu ${i + 1} để thử chọn và bỏ chọn.`,
        unlockedAt: at(i),
      })),
    },
  };
}
