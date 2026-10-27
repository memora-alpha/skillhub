import assert from "node:assert/strict";
import test from "node:test";
import axios from "axios";
import { createHttpClient } from "../src/lib/http/client";
import { AppError } from "../src/lib/http/errors";
import { readPayload } from "../src/lib/http/response";
import {
  createRequestsApi,
  parsePage,
  queryString,
} from "../src/features/learning-requests/api/requests-api";
import {
  ownerSchema,
  publicSchema,
} from "../src/features/learning-requests/types";
import {
  requestDefaults,
  requestFormSchema,
  draftToInput,
} from "../src/features/learning-requests/schemas/request-form";
import {
  requestPatch,
  requestState,
  editableRequest,
  requestError,
} from "../src/features/learning-requests/utils/request-policy";
import { parsePreferredSlots } from "../src/features/learning-requests/preferred-slots";

const request = ownerSchema.parse({
  id: "12345678-1234-4234-8234-123456789012",
  skillId: "12345678-1234-4234-8234-123456789013",
  title: "Học React căn bản",
  description: "Muốn học React từ cơ bản để xây dựng ứng dụng.",
  learningGoal: "Tự xây dựng một ứng dụng React",
  currentLevel: null,
  verifiedTeacherOnly: false,
  tagIds: ["12345678-1234-4234-8234-123456789014"],
  preferredSlots: [
    { startAt: "2020-01-01T12:30:45.123Z", endAt: "2020-01-01T14:30:45.123Z" },
  ],
  status: "OPEN",
  moderationStatus: "NOT_REQUIRED",
  moderationRejectReason: null,
  version: 7,
  requestedExpiresAt: "2035-01-01T12:30:45.123Z",
  expiresAt: "2035-01-01T12:30:45.123Z",
  publishedAt: "2020-01-01T10:00:00.000Z",
  createdAt: "2020-01-01T10:00:00.000Z",
  updatedAt: "2020-01-01T10:00:00.000Z",
});

test("preserves HTTP metadata only for paginated consumers", () => {
  const envelope = {
    success: true,
    data: [request],
    meta: { pagination: { limit: 20, nextCursor: null, hasMore: false } },
  };
  assert.deepEqual(readPayload(200, envelope), [request]);
  assert.deepEqual(parsePage(ownerSchema, readPayload(200, envelope, true)), {
    items: [request],
    nextCursor: null,
    hasMore: false,
  });
  assert.throws(
    () =>
      parsePage(ownerSchema, {
        data: [request],
        meta: { pagination: { limit: 20, nextCursor: null, hasMore: true } },
      }),
    AppError,
  );
  assert.throws(() => parsePage(ownerSchema, { data: [request] }), AppError);
});

test("encodes keyword, repeated tag IDs and opaque cursor without altering them", () => {
  const params = new URLSearchParams(
    queryString({
      keyword: "React & TypeScript",
      tagIds: ["one", "two"],
      cursor: "a+b/=",
      skillId: request.skillId,
    }),
  );
  assert.equal(params.get("keyword"), "React & TypeScript");
  assert.deepEqual(params.getAll("tagIds"), ["one", "two"]);
  assert.equal(params.get("cursor"), "a+b/=");
  assert.equal(params.get("skillId"), request.skillId);
});

test("public projections strip private fields and targeted reads reject mismatched IDs", async () => {
  const publicItem = publicSchema.parse({
    ...request,
    owner: {
      id: request.id,
      displayName: "Người học",
      avatarUrl: null,
      email: "private@example.test",
    },
    skill: { id: request.skillId, name: "React" },
    tags: [],
    budget: 50,
  });
  assert.equal("email" in publicItem.owner, false);
  assert.equal("tagIds" in publicItem, false);
  assert.equal("moderationRejectReason" in publicItem, false);
  assert.equal("budget" in publicItem, false);
  const api = createRequestsApi({
    request: async () => ({ ...request, id: request.skillId }),
    bindSession: () => {},
  });
  await assert.rejects(
    api.detail(request.id),
    (error: unknown) => error instanceof AppError && error.kind === "protocol",
  );
  assert.throws(
    () =>
      parsePage(ownerSchema, {
        data: [],
        meta: { pagination: { limit: 20, nextCursor: "", hasMore: true } },
      }),
    AppError,
  );
});

test("untouched editor preserves expired slots, seconds and tags; patch sends only changes", () => {
  const draft = requestDefaults(request);
  assert.equal(requestFormSchema(request).safeParse(draft).success, true);
  const input = draftToInput(draft, request);
  assert.deepEqual(input.preferredSlots, request.preferredSlots);
  assert.equal(input.expiresAt, request.requestedExpiresAt);
  assert.equal(requestPatch(request, input), null);
  assert.deepEqual(
    requestPatch(request, {
      ...input,
      learningGoal: "Mục tiêu mới để học React",
    }),
    { expectedVersion: 7, learningGoal: "Mục tiêu mới để học React" },
  );
  assert.deepEqual(input.tagIds, request.tagIds);
  assert.equal(
    "tagIds" in
      (requestPatch(request, { ...input, title: "Một tiêu đề mới đủ dài" }) ??
        {}),
    false,
  );
});

test("optional fields can be cleared explicitly without resetting other fields", () => {
  const input = draftToInput(
    {
      ...requestDefaults(request),
      preferredSlots: "",
      expiresAt: "",
      currentLevel: "",
      verifiedTeacherOnly: "Không",
    },
    request,
  );
  assert.deepEqual(requestPatch(request, input), {
    expectedVersion: 7,
    preferredSlots: [],
    expiresAt: null,
  });
});

test("normalizes Unicode and counts code points rather than UTF-16 units", () => {
  const draft = {
    ...requestDefaults(),
    skillId: request.skillId,
    title: "  " + "😀".repeat(120) + "  ",
    description: "Một mô tả nhu cầu đủ dài để học React",
    learningGoal: "Ｈọc React để xây dựng ứng dụng",
  };
  const parsed = requestFormSchema().parse(draft);
  assert.equal([...parsed.title].length, 120);
  assert.equal(parsed.learningGoal.startsWith("Học"), true);
  assert.equal(
    requestFormSchema().safeParse({ ...draft, title: "😀".repeat(121) })
      .success,
    false,
  );
  assert.equal(
    requestFormSchema().safeParse({ ...draft, skillId: "catalog-react" })
      .success,
    false,
  );
});

test("rejects invalid, past, reversed and excessive availability slots", () => {
  const now = new Date(2026, 0, 1).getTime();
  assert.equal(
    parsePreferredSlots("2025-01-01T10:00 → 2025-01-01T11:00", now),
    undefined,
  );
  assert.equal(
    parsePreferredSlots("2027-02-30T10:00 → 2027-02-30T11:00", now),
    undefined,
  );
  assert.equal(
    parsePreferredSlots("2027-01-01T11:00 → 2027-01-01T10:00", now),
    undefined,
  );
  assert.equal(
    parsePreferredSlots(
      Array(6).fill("2027-01-01T10:00 → 2027-01-01T11:00").join("\n"),
      now,
    ),
    undefined,
  );
  assert.equal(
    parsePreferredSlots("2027-01-01 10:00 → 2027-01-01 11:00", now)?.length,
    1,
  );
});

test("uses effectiveStatus so stale OPEN records cannot be edited after expiry", () => {
  const expired = { ...request, effectiveStatus: "EXPIRED" as const };
  assert.equal(requestState(expired), "EXPIRED");
  assert.equal(editableRequest(expired), false);
});

test("does not retry mutations or hide dependency 503 behind fixture data", async () => {
  let calls = 0;
  const http = axios.create({
    adapter: async (config) => {
      calls++;
      return {
        config,
        data: { success: false, message: "DEPENDENCY_UNAVAILABLE" },
        status: 503,
        statusText: "",
        headers: {},
      };
    },
  });
  const client = createHttpClient(
    () => "https://api.example.test/api/v1",
    http,
  );
  client.bindSession({
    generation: 1,
    getToken: async () => "test-token",
    renew: async () => {},
    expire: async () => {},
  });
  const api = createRequestsApi(client);
  await assert.rejects(
    api.create(draftToInput(requestDefaults(request), request)),
    (error: unknown) => error instanceof AppError && error.status === 503,
  );
  assert.equal(calls, 1);
  assert.match(requestError(new AppError("http", 503), true), /chưa khả dụng/);
  assert.match(requestError(new AppError("network"), true), /Chưa xác nhận/);
});

test("rejects late results from a previous session and invalid route IDs before HTTP", async () => {
  let current = true;
  let calls = 0;
  const client = {
    request: async () => {
      calls++;
      current = false;
      return request;
    },
    bindSession: () => {},
  };
  const api = createRequestsApi(client, () => current);
  await assert.rejects(api.detail("demo-id"), AppError);
  assert.equal(calls, 0);
  await assert.rejects(
    api.detail(request.id),
    (error: unknown) => error instanceof AppError && error.kind === "session",
  );
  assert.equal(calls, 1);
  await assert.rejects(api.detail(request.id), AppError);
  assert.equal(calls, 1);
});
