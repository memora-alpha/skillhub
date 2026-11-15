import { randomUUID } from "node:crypto";
import { createMaterialFixture } from "./materials/fixture.mjs";

export async function createAdminOperationsFixture() {
  return createMaterialFixture();
}

export async function explainAdminQuery(client, label, sql) {
  const { rows } = await client.query(
    `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${sql}`,
  );
  const evidence = rows[0]?.["QUERY PLAN"]?.[0];
  if (!evidence?.Plan) throw new Error(`Missing query plan for ${label}`);
  const summary = {
    label,
    nodeType: evidence.Plan["Node Type"],
    planRows: evidence.Plan["Plan Rows"],
    planningMs: evidence["Planning Time"],
    executionMs: evidence["Execution Time"],
  };
  console.log(`ADMIN_QUERY_PLAN ${JSON.stringify(summary)}`);
  return summary;
}

export async function createHistoricalPath(f, participantA, participantB) {
  const request = await f.db.learningRequest.create({
    data: {
      ownerId: participantB.user.id,
      skillId: f.skill.id,
      title: "Admin operations fixture request",
      description: "A request used by the isolated admin integration fixture",
      learningGoal: "Verify historical administrative projections",
      currentLevel: "BEGINNER",
      status: "OPEN",
      publishedAt: new Date("2026-11-01T00:00:00.000Z"),
      expiresAt: new Date("2027-01-01T00:00:00.000Z"),
    },
  });
  const proposal = await f.db.proposal.create({
    data: {
      sourceType: "LEARNING_REQUEST",
      requestId: request.id,
      proposerId: participantA.user.id,
      recipientId: participantB.user.id,
      skillId: f.skill.id,
      message: "Admin operations fixture proposal",
      status: "ACCEPTED",
      expiresAt: new Date("2027-01-01T00:00:00.000Z"),
    },
  });
  const conversation = await f.db.conversation.create({
    data: {
      proposalId: proposal.id,
      requestId: request.id,
      participantAId: participantA.user.id,
      participantBId: participantB.user.id,
    },
  });
  const path = await f.db.learningPath.create({
    data: {
      conversationId: conversation.id,
      participantAId: participantA.user.id,
      participantBId: participantB.user.id,
      currentVersion: 2,
      lockedVersion: 2,
      status: "ACTIVE",
      createdAt: new Date("2026-11-02T00:00:00.000Z"),
      updatedAt: new Date("2026-11-09T00:00:00.000Z"),
    },
  });
  await f.db.learningPathVersion.createMany({
    data: [
      {
        pathId: path.id,
        versionNo: 1,
        exchangeType: "ONE_WAY",
        negotiatedCredit: 1000n,
        teacherId: participantA.user.id,
        learnerId: participantB.user.id,
        createdByUserId: participantA.user.id,
        createdAt: new Date("2026-11-03T00:00:00.000Z"),
      },
      {
        pathId: path.id,
        versionNo: 2,
        exchangeType: "ONE_WAY",
        negotiatedCredit: 1200n,
        teacherId: participantA.user.id,
        learnerId: participantB.user.id,
        createdByUserId: participantB.user.id,
        createdAt: new Date("2026-11-04T00:00:00.000Z"),
      },
    ],
  });
  const plan = await f.db.learningPlan.create({
    data: {
      pathId: path.id,
      teacherId: participantA.user.id,
      learnerId: participantB.user.id,
      createdByUserId: participantA.user.id,
      currentVersion: 2,
      status: "CONFIRMED",
    },
  });
  await f.db.learningPlanVersion.createMany({
    data: [
      {
        planId: plan.id,
        versionNo: 1,
        skillId: f.skill.id,
        learningGoal: "Historical goal version one",
        totalSessions: 1,
        learnerConfirmedAt: new Date("2026-11-03T00:00:00.000Z"),
      },
      {
        planId: plan.id,
        versionNo: 2,
        skillId: f.skill.id,
        learningGoal: "Historical goal version two",
        totalSessions: 1,
        learnerConfirmedAt: new Date("2026-11-04T00:00:00.000Z"),
      },
    ],
  });
  await f.db.planSessionOutline.createMany({
    data: [
      {
        planId: plan.id,
        planVersion: 1,
        sessionNo: 1,
        content: "Historical outline version one",
      },
      {
        planId: plan.id,
        planVersion: 2,
        sessionNo: 1,
        content: "Historical outline version two",
      },
    ],
  });
  await f.db.pathVersionPlan.createMany({
    data: [
      {
        pathId: path.id,
        pathVersion: 1,
        planId: plan.id,
        planVersion: 1,
      },
      {
        pathId: path.id,
        pathVersion: 2,
        planId: plan.id,
        planVersion: 2,
      },
    ],
  });
  const sessions = await Promise.all(
    [
      {
        planVersion: 1,
        status: "COMPLETED",
        startAt: new Date("2026-11-05T00:00:00.000Z"),
      },
      {
        planVersion: 2,
        status: "SCHEDULED",
        startAt: new Date("2026-11-12T00:00:00.000Z"),
      },
    ].map(({ planVersion, status, startAt }) =>
      f.db.session.create({
        data: {
          id: randomUUID(),
          pathId: path.id,
          planId: plan.id,
          planVersion,
          outlineSessionNo: 1,
          teacherId: participantA.user.id,
          learnerId: participantB.user.id,
          startAt,
          originalStartAt: startAt,
          endAt: new Date(startAt.getTime() + 3_600_000),
          status,
          ...(status === "COMPLETED"
            ? {
                teacherFirstJoinedAt: startAt,
                learnerFirstJoinedAt: startAt,
                teacherAttendanceSeconds: 3600n,
                learnerAttendanceSeconds: 3600n,
              }
            : {}),
        },
      }),
    ),
  );
  return { request, proposal, conversation, path, plan, sessions };
}
