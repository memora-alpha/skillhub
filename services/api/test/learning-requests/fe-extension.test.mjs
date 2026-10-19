import assert from "node:assert/strict";
import { test } from "node:test";
import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { prepareLearningRequestContent } from "../../dist/modules/learning-requests/domain/request-text.policy.js";
import { evaluateModeration } from "../../dist/modules/learning-requests/domain/moderation.policy.js";
import { CreateLearningRequestDto } from "../../dist/modules/learning-requests/presentation/http/learning-requests.dto.js";
import { CreateLearningRequestUseCase } from "../../dist/modules/learning-requests/application/use-cases/create-learning-request.use-case.js";

const ownerId = "11111111-1111-4111-8111-111111111111";
const skillId = "22222222-2222-4222-8222-222222222222";
const sharingId = "33333333-3333-4333-8333-333333333333";
const now = new Date();
const availability = {
  timeZone: "Asia/Ho_Chi_Minh",
  weeklySlots: [
    { weekday: "SAT", startTime: "09:00", endTime: "12:00" },
    { weekday: "MON", startTime: "19:00", endTime: "21:00" },
  ],
};
const input = (patch = {}) => ({
  title: "Learn React fundamentals",
  skillId,
  description: "I want to learn React hooks and component composition.",
  learningGoal: "Build a useful React application.",
  teachingOverview: "I can teach <b>JavaScript</b> fundamentals in exchange.",
  offeredSharingSkillIds: [sharingId],
  desiredCreditPerHour: "50.5",
  preferredAvailability: availability,
  ...patch,
});

test("prepares the approved FE payload with local weekly times and exact Credit units", () => {
  const content = prepareLearningRequestContent(input(), now);
  assert.equal(
    content.teachingOverview,
    "I can teach JavaScript fundamentals in exchange.",
  );
  assert.deepEqual(content.offeredSharingSkillIds, [sharingId]);
  assert.equal(content.desiredCreditPerHour, 5050n);
  assert.deepEqual(content.preferredAvailability, {
    ...availability,
    weeklySlots: [...availability.weeklySlots].reverse(),
  });
  assert.deepEqual(content.preferredSlots, []);
});

test("legacy input remains valid and nullable optional card fields can be cleared", () => {
  const legacy = input();
  for (const key of [
    "teachingOverview",
    "offeredSharingSkillIds",
    "desiredCreditPerHour",
    "preferredAvailability",
  ])
    delete legacy[key];
  const content = prepareLearningRequestContent(legacy, now);
  assert.equal(content.teachingOverview, null);
  assert.equal(content.desiredCreditPerHour, null);
  assert.equal(content.preferredAvailability, null);
  assert.deepEqual(content.offeredSharingSkillIds, []);
  const cleared = prepareLearningRequestContent(
    input({
      teachingOverview: null,
      desiredCreditPerHour: null,
      preferredAvailability: null,
      offeredSharingSkillIds: [],
    }),
    now,
  );
  assert.equal(cleared.desiredCreditPerHour, null);
});

test("rejects malformed/overlapping weekly slots and ambiguous schedule types", () => {
  const slot = availability.weeklySlots[1];
  for (const preferredAvailability of [
    { ...availability, timeZone: "Not/A_TimeZone" },
    { ...availability, weeklySlots: [{ ...slot, weekday: "Monday" }] },
    { ...availability, weeklySlots: [{ ...slot, startTime: "9:00" }] },
    { ...availability, weeklySlots: [{ ...slot, endTime: "24:00" }] },
    { ...availability, weeklySlots: [{ ...slot, endTime: "18:00" }] },
    { ...availability, weeklySlots: [slot, slot] },
    {
      ...availability,
      weeklySlots: [slot, { ...slot, startTime: "20:00", endTime: "22:00" }],
    },
    { ...availability, weeklySlots: Array(6).fill(slot) },
  ])
    assert.throws(
      () =>
        prepareLearningRequestContent(input({ preferredAvailability }), now),
      (e) => e.getStatus() === 400,
    );
  const future = new Date(now.getTime() + 86_400_000);
  assert.throws(() =>
    prepareLearningRequestContent(
      input({
        preferredSlots: [
          {
            startAt: future.toISOString(),
            endAt: new Date(future.getTime() + 3_600_000).toISOString(),
          },
        ],
      }),
      now,
    ),
  );
  assert.doesNotThrow(() =>
    prepareLearningRequestContent(
      input({
        preferredAvailability: {
          ...availability,
          weeklySlots: [
            slot,
            { ...slot, startTime: "21:00", endTime: "22:00" },
          ],
        },
      }),
      now,
    ),
  );
  assert.doesNotThrow(() =>
    prepareLearningRequestContent(
      input({
        preferredAvailability: {
          timeZone: "Europe/Berlin",
          weeklySlots: [slot],
        },
      }),
      now,
    ),
  );
});

test("validates teaching text, distinct skill IDs and decimal hourly credit", () => {
  for (const patch of [
    { teachingOverview: "short" },
    { teachingOverview: "x".repeat(3001) },
    { offeredSharingSkillIds: [sharingId, sharingId] },
    { offeredSharingSkillIds: [ownerId, "invalid"] },
    ...[0, 50, "0", "-1", "1e2", "1.001", "10000000000", "NaN"].map(
      (desiredCreditPerHour) => ({ desiredCreditPerHour }),
    ),
  ])
    assert.throws(
      () => prepareLearningRequestContent(input(patch), now),
      (e) => e.getStatus() === 400,
    );
  assert.equal(
    prepareLearningRequestContent(input({ desiredCreditPerHour: "0.01" }), now)
      .desiredCreditPerHour,
    1n,
  );
});

test("the new teaching overview participates in moderation", () => {
  const result = evaluateModeration(
    {
      title: "Learn React",
      description: "Normal learning description",
      learningGoal: "Build components",
      tags: [],
      teachingOverview: "A prohibited teaching offer",
    },
    {
      version: 1,
      ruleSet: { rules: [{ pattern: "prohibited", category: "TEST" }] },
    },
  );
  assert.equal(result.flagged, true);
});

test("HTTP accepts nested FE inputs and rejects unknown nested properties", async () => {
  const pipe = new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  const metadata = { type: "body", metatype: CreateLearningRequestDto };
  const value = await pipe.transform(input(), metadata);
  assert.deepEqual(
    value.preferredAvailability.weeklySlots.map((s) => s.weekday),
    ["SAT", "MON"],
  );
  await assert.rejects(() =>
    pipe.transform(
      input({
        preferredAvailability: {
          ...availability,
          weeklySlots: [{ ...availability.weeklySlots[0], offset: "+07:00" }],
        },
      }),
      metadata,
    ),
  );
});

test("offered UUIDs are canonicalized before uniqueness checks and projection", async () => {
  const lower = "abcdefab-abcd-4abc-8abc-abcdefabcdef";
  const upper = lower.toUpperCase();
  assert.deepEqual(
    prepareLearningRequestContent(
      input({ offeredSharingSkillIds: [upper] }),
      now,
    ).offeredSharingSkillIds,
    [lower],
  );
  assert.throws(
    () =>
      prepareLearningRequestContent(
        input({ offeredSharingSkillIds: [lower, upper] }),
        now,
      ),
    (e) => e.getStatus() === 400,
  );
  const pipe = new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  await assert.rejects(() =>
    pipe.transform(input({ offeredSharingSkillIds: [lower, upper] }), {
      type: "body",
      metatype: CreateLearningRequestDto,
    }),
  );
});

test("weekly availability requires an IANA timezone rather than a fixed UTC offset", async () => {
  const payload = input({
    preferredAvailability: { ...availability, timeZone: "+07:00" },
  });
  assert.throws(
    () => prepareLearningRequestContent(payload, now),
    (e) => e.getStatus() === 400,
  );
  const pipe = new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  await assert.rejects(() =>
    pipe.transform(payload, {
      type: "body",
      metatype: CreateLearningRequestDto,
    }),
  );
  assert.doesNotThrow(() =>
    prepareLearningRequestContent(
      input({
        preferredAvailability: { ...availability, timeZone: "Etc/GMT+7" },
      }),
      now,
    ),
  );
});

test("creation persists FE content and checks offered skills under the live owner before writing", async () => {
  const checked = [];
  let stored;
  const useCase = new CreateLearningRequestUseCase(
    { run: async (work) => work({ $queryRaw: async () => [] }) },
    { assertUserAction: async (_tx, actor) => actor },
    { assertAllowed: async () => {} },
    {
      assertActiveSelection: async (_tx, s) => ({
        skillId: s.skillId,
        tags: [],
      }),
    },
    {
      databaseNow: async () => now,
      create: async (_tx, data) => {
        stored = data;
        return {
          ...data,
          id: ownerId,
          status: "DRAFT",
          moderationStatus: "NOT_REQUIRED",
          tagLinks: [],
          offeringLinks: data.offeredSharingSkillIds.map((sharingSkillId) => ({
            sharingSkillId,
          })),
          version: 1,
        };
      },
    },
    {
      assertRequestOfferings: async (_tx, userId, ids) =>
        checked.push({ userId, ids }),
      readRequestOfferings: async () => [],
    },
  );
  const result = await useCase.execute({ userId: ownerId }, input());
  assert.deepEqual(checked, [{ userId: ownerId, ids: [sharingId] }]);
  assert.equal(stored.desiredCreditPerHour, 5050n);
  assert.equal(result.desiredCreditPerHour, "50.50");
  assert.deepEqual(result.offeredSharingSkillIds, [sharingId]);
});
