import assert from "node:assert/strict";
import test from "node:test";
import {
  ownerSchema,
  publicSchema,
} from "../src/features/learning-requests/types";
import {
  availabilitySchema,
  creditSchema,
} from "../src/features/learning-requests/schemas/request-preferences";
import {
  draftToInput,
  requestDefaults,
  requestFormSchema,
} from "../src/features/learning-requests/schemas/request-form";
import { requestPatch } from "../src/features/learning-requests/utils/request-policy";
import {
  compareRequestDraft,
  rebaseRequestDraft,
} from "../src/features/learning-requests/utils/request-recovery";
import {
  fixtureId,
  fixtureRequest,
  publicFixture,
  fixtureUsers,
} from "./fixtures/learning-requests-data";
import { fixtureClient } from "./fixtures/learning-requests-client";
import { startLearningRequestsFixture } from "./fixtures/learning-requests-api";

const weekly = {
  timeZone: "America/New_York",
  weeklySlots: [
    { weekday: "MON" as const, startTime: "19:00", endTime: "21:00" },
  ],
};
test("weekly reopen keeps timezone across devices, no-change omits PATCH, clear is explicit null", () => {
  const initial = fixtureRequest({
    preferredSlots: [],
    preferredAvailability: weekly,
  });
  const draft = requestDefaults(initial);
  assert.equal(draft.timeZone, weekly.timeZone);
  assert.equal(requestPatch(initial, draftToInput(draft, initial)), null);
  assert.deepEqual(
    requestPatch(
      initial,
      draftToInput({ ...draft, weeklyAvailability: "" }, initial),
    ),
    { expectedVersion: 1, preferredAvailability: null },
  );
  assert.equal(
    draftToInput({ ...draft, timeZone: "Asia/Ho_Chi_Minh" }, initial)
      .preferredAvailability?.weeklySlots[0]?.startTime,
    "19:00",
  );
  const empty = fixtureRequest({
    preferredSlots: [],
    preferredAvailability: { ...weekly, weeklySlots: [] },
  });
  assert.equal(
    requestPatch(empty, draftToInput(requestDefaults(empty), empty)),
    null,
  );
});
test("weekly API parser rejects invalid timezone/overnight/overlap and sorts adjacent slots", () => {
  for (const timeZone of ["+07:00", "Mars/Base", ""])
    assert.equal(
      availabilitySchema.safeParse({ ...weekly, timeZone }).success,
      false,
    );
  assert.equal(
    availabilitySchema.safeParse({
      ...weekly,
      weeklySlots: [
        { ...weekly.weeklySlots[0], startTime: "23:00", endTime: "01:00" },
      ],
    }).success,
    false,
  );
  assert.equal(
    availabilitySchema.safeParse({
      ...weekly,
      weeklySlots: [
        ...weekly.weeklySlots,
        { ...weekly.weeklySlots[0], startTime: "20:00" },
      ],
    }).success,
    false,
  );
  const rows = [
    { ...weekly.weeklySlots[0]!, startTime: "21:00", endTime: "22:00" },
    weekly.weeklySlots[0]!,
  ];
  assert.equal(
    availabilitySchema.parse({ ...weekly, weeklySlots: rows }).weeklySlots[0]
      ?.startTime,
    "19:00",
  );
});
test("hourly budget keeps decimal precision, rejects zero/sign/exponent/fraction overflow", () => {
  for (const invalid of [
    "0",
    "0.00",
    "-1",
    "+1",
    "1e2",
    "1.001",
    "10000000000",
    "01",
    "1,5",
  ])
    assert.equal(creditSchema.safeParse(invalid).success, false, invalid);
  const initial = fixtureRequest({ desiredCreditPerHour: "9999999999.99" });
  assert.equal(
    requestPatch(initial, draftToInput(requestDefaults(initial), initial)),
    null,
  );
  const draft = { ...requestDefaults(initial), desiredCreditPerHour: "50" };
  assert.equal(draftToInput(draft, initial).desiredCreditPerHour, "50.00");
  assert.equal(
    draftToInput({ ...draft, desiredCreditPerHour: "" }, initial)
      .desiredCreditPerHour,
    null,
  );
});
test("overview is optional plain text and offerings survive unknown labels, clear and unchanged selection order", () => {
  const initial = fixtureRequest({
    teachingOverview: "Tôi có thể hướng dẫn Python căn bản.",
    offeredSharingSkillIds: [fixtureId(50), fixtureId(51)],
  });
  const draft = requestDefaults(initial);
  assert.equal(
    requestPatch(
      initial,
      draftToInput(
        {
          ...draft,
          offeredSharingSkillIds: [...draft.offeredSharingSkillIds].reverse(),
        },
        initial,
      ),
    ),
    null,
  );
  assert.deepEqual(
    requestPatch(
      initial,
      draftToInput(
        { ...draft, offeredSharingSkillIds: [], teachingOverview: "  " },
        initial,
      ),
    ),
    { expectedVersion: 1, teachingOverview: null, offeredSharingSkillIds: [] },
  );
  assert.equal(
    requestFormSchema(initial).safeParse({
      ...draft,
      teachingOverview: "Quá ngắn",
    }).success,
    false,
  );
  assert.equal(
    draftToInput(
      { ...draft, teachingOverview: "<b>" + "😀".repeat(20) + "</b>" },
      initial,
    ).teachingOverview?.startsWith("<b>"),
    true,
  );
});
test("new fields participate in conflict comparison and only changed choices override latest snapshot", () => {
  const initial = fixtureRequest(),
    draft = requestDefaults(initial);
  const latest = {
    ...initial,
    version: 2,
    tagIds: [fixtureId(21)],
    offeredSharingSkillIds: [fixtureId(50)],
    preferredSlots: [],
    preferredAvailability: weekly,
    desiredCreditPerHour: "50.00",
  };
  const next = rebaseRequestDraft(
    initial,
    { ...draft, teachingOverview: "Tôi có thể dạy React từ cơ bản." },
    latest,
  );
  assert.deepEqual(next.tagIds, latest.tagIds);
  assert.deepEqual(next.offeredSharingSkillIds, latest.offeredSharingSkillIds);
  assert.equal(next.timeZone, weekly.timeZone);
  assert.equal(
    requestPatch(latest, draftToInput(next, latest))?.teachingOverview,
    "Tôi có thể dạy React từ cơ bản.",
  );
  assert.ok(
    compareRequestDraft(initial, latest).some(
      (change) => change.field === "weeklyAvailability",
    ),
  );
});
test("public parser keeps BE card preferences and strips private offering/owner fields", () => {
  const offering = {
    id: fixtureId(50),
    skill: { id: fixtureId(10), name: "React", email: "private" },
    level: "EXPERT" as const,
    verificationStatus: "VERIFIED",
    ownerId: fixtureUsers[0].id,
  };
  const publicItem = publicFixture({
    actor: fixtureUsers[0].id,
    request: fixtureRequest({
      preferredAvailability: weekly,
      preferredSlots: [],
      offeredSharingSkills: [offering],
    }),
  });
  const result = publicSchema.parse({
    ...publicItem,
    offeredSharingSkillIds: [offering.id],
    moderationRejectReason: "private",
  });
  assert.equal(result.preferredAvailability?.timeZone, weekly.timeZone);
  assert.equal("ownerId" in result.offeredSharingSkills[0]!, false);
  assert.equal("email" in result.offeredSharingSkills[0]!.skill, false);
  assert.equal("offeredSharingSkillIds" in result, false);
  assert.equal(
    ownerSchema.safeParse({
      ...fixtureRequest(),
      preferredAvailability: { ...weekly, timeZone: "Invalid" },
    }).success,
    false,
  );
});
test("fixture HTTP create/reopen/publish/public/edit/clear round-trips all new preferences", async (t) => {
  const fixture = await startLearningRequestsFixture();
  t.after(() => fixture.stop());
  const owner = fixtureClient(fixture.url),
    other = fixtureClient(fixture.url, 1);
  const draft = {
    ...requestDefaults(fixtureRequest()),
    preferredSlots: "",
    weeklyAvailability: JSON.stringify(weekly.weeklySlots),
    timeZone: weekly.timeZone,
    teachingOverview: "Tôi có thể dạy React từ cơ bản.",
    desiredCreditPerHour: "50",
    offeredSharingSkillIds: [fixtureId(50)],
  };
  const created = await owner.create(draftToInput(draft));
  assert.equal(created.status, "DRAFT");
  assert.equal(created.desiredCreditPerHour, "50.00");
  const reopened = await owner.detail(created.id);
  assert.equal(reopened.preferredAvailability?.timeZone, weekly.timeZone);
  assert.equal(
    requestPatch(created, draftToInput(requestDefaults(created), created)),
    null,
  );
  const published = await owner.action(created.id, "publish", created.version);
  const detail = await other.detail(created.id);
  assert.equal(detail.offeredSharingSkills[0]?.skill.name, "React");
  assert.equal("offeredSharingSkillIds" in detail, false);
  const feed = await other.list("feed");
  assert.equal(
    feed.items.find((item) => item.id === created.id)?.desiredCreditPerHour,
    "50.00",
  );
  const cleared = await owner.edit(
    published.id,
    requestPatch(
      published,
      draftToInput(
        {
          ...requestDefaults(published),
          weeklyAvailability: "",
          teachingOverview: "",
          desiredCreditPerHour: "",
          offeredSharingSkillIds: [],
        },
        published,
      ),
    )!,
  );
  assert.equal(cleared.preferredAvailability, null);
  assert.deepEqual(cleared.offeredSharingSkills, []);
  assert.equal(cleared.teachingOverview, null);
  assert.equal(cleared.desiredCreditPerHour, null);
});
