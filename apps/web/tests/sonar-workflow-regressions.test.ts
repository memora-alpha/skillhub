import assert from "node:assert/strict";
import { test } from "node:test";
import { readCursorSnapshot } from "../src/features/learner/api/cursor-snapshot";
import { UserApiError } from "../src/features/learner/api/client";
import { sessionPresentation } from "../src/features/learner/sessions/session-detail-presentation";
import type {
  LearningPath,
  LearningSession,
} from "../src/features/learner/types";
import { keyedFinanceItems } from "../src/lib/staff/finance-presentation";
import * as webText from "../src/lib/system-text";
import * as mobileText from "../../mobile/src/constants/system-text";

const page = (data: { id: string }[], nextCursor: string | null = null) => ({
  data,
  meta: { pagination: { hasMore: nextCursor !== null, nextCursor } },
});

test("cursor snapshots follow cursors and deduplicate IDs without losing order", async () => {
  const paths: string[] = [];
  const result = await readCursorSnapshot(async (path) => {
    paths.push(path);
    return paths.length === 1
      ? page([{ id: "first" }, { id: "shared" }], "next")
      : page([{ id: "shared" }, { id: "last" }]);
  }, "items?limit=2");
  assert.deepEqual(
    result.map((item) => item.id),
    ["first", "shared", "last"],
  );
  assert.equal(paths.length, 2);
  assert.equal(
    new URL(paths[1]!, "https://example.test").searchParams.get("cursor"),
    "next",
  );
});

test("cursor snapshots fail closed for malformed pagination or repeated cursors", async () => {
  const invalid = [
    { data: [{ id: "item" }] },
    {
      data: [{ id: "item" }],
      meta: { pagination: { hasMore: true, nextCursor: null } },
    },
    {
      data: [{ id: "item" }],
      meta: { pagination: { hasMore: false, nextCursor: "next" } },
    },
    {
      data: [{ id: "item" }],
      meta: { pagination: { hasMore: true, nextCursor: "" } },
    },
  ];
  for (const response of invalid)
    await assert.rejects(
      readCursorSnapshot(async () => response, "items"),
      (error: unknown) =>
        error instanceof UserApiError && error.code === "API_RESPONSE_INVALID",
    );
  await assert.rejects(
    readCursorSnapshot(async () => page([{ id: "item" }], "same"), "items"),
    UserApiError,
  );
});

test("authoritative matches stop paging, and cancellation never returns a partial snapshot", async () => {
  let reads = 0;
  const result = await readCursorSnapshot(
    async () => {
      reads++;
      return page([{ id: "match" }], "next");
    },
    "items",
    undefined,
    (item) => item.id === "match",
  );
  assert.equal(reads, 1);
  assert.deepEqual(result, [{ id: "match" }]);
  const controller = new AbortController();
  await assert.rejects(
    readCursorSnapshot(
      async () => {
        controller.abort();
        return page([{ id: "partial" }]);
      },
      "items",
      controller.signal,
    ),
    { name: "AbortError" },
  );
});

function session(overrides: Partial<LearningSession> = {}): LearningSession {
  return {
    id: "session",
    pathId: "path",
    planId: "plan",
    teacherId: "teacher",
    learnerId: "learner",
    startAt: "2026-11-10T01:00:00.000Z",
    endAt: "2026-11-10T02:00:00.000Z",
    status: "COMPLETED",
    teacherConfirmationStatus: null,
    learnerConfirmationStatus: null,
    ...overrides,
  };
}

function path(overrides: Partial<LearningPath> = {}): LearningPath {
  return {
    id: "path",
    conversationId: "conversation",
    status: "ACTIVE",
    participantAId: "teacher",
    participantBId: "learner",
    currentVersion: 1,
    lockedVersion: 1,
    settledAt: null,
    agreement: {
      version: 1,
      exchangeType: "ONE_WAY",
      teacherId: "teacher",
      learnerId: "learner",
      negotiatedCredit: "100",
      totalCreditPerUser: null,
      participantAConfirmedAt: null,
      participantBConfirmedAt: null,
    },
    plans: [],
    ...overrides,
  };
}
const now = Date.parse("2026-11-10T03:00:00.000Z");

test("completion and settlement remain separate, with disputes taking precedence", () => {
  assert.equal(sessionPresentation(session(), "learner", now).step, 2);
  const settled = path({
    status: "COMPLETED",
    settledAt: "2026-11-10T02:30:00.000Z",
  });
  assert.equal(sessionPresentation(session(), "learner", now, settled).step, 4);
  const disputed = sessionPresentation(
    session(),
    "learner",
    now,
    path({ status: "DISPUTED" }),
  );
  assert.equal(disputed.tone, "danger");
  assert.equal(disputed.room, "Chưa thể vào phòng");
});

test("completion confirmation reflects the current user's side", () => {
  const item = session({
    status: "AWAITING_CONFIRMATION",
    teacherConfirmationStatus: "CONFIRMED",
    allowedActions: ["CONFIRM_COMPLETION"],
  });
  assert.equal(
    sessionPresentation(item, "teacher", now).title,
    "Đã ghi nhận xác nhận của bạn",
  );
  assert.equal(
    sessionPresentation(item, "learner", now).title,
    "Vui lòng xác nhận sau buổi học",
  );
  assert.equal(
    sessionPresentation({ ...item, allowedActions: [] }, "learner", now).title,
    "Đang chờ máy chủ cập nhật kết quả",
  );
});

test("both-absent and makeup views preserve the deadline boundary", () => {
  const deadlines = {
    confirmBy: null,
    excuseOrReportBy: "2026-11-10T04:00:00.000Z",
    makeupBy: "2026-11-10T04:00:00.000Z",
  };
  const absent = session({
    status: "NO_SHOW",
    attendance: {
      state: "READY",
      case: "BOTH_ABSENT",
      outcomeStatus: "PROVISIONAL",
    },
    deadlines,
  });
  assert.match(
    sessionPresentation(absent, "learner", now).description,
    /thời hạn phản hồi/,
  );
  assert.match(
    sessionPresentation(absent, "learner", now + 3600000).description,
    /Đang chờ máy chủ chốt/,
  );
  const makeup = session({ status: "MAKEUP_REQUIRED", deadlines });
  assert.equal(
    sessionPresentation(makeup, "learner", now).title,
    "Cùng đối tác thống nhất lịch học bù",
  );
  assert.equal(
    sessionPresentation(makeup, "learner", now + 3600000).title,
    "Đã hết hạn chốt lịch học bù",
  );
});

test("finance list keys follow identity or content through reordering", () => {
  const first = { id: "first", amount: "1" },
    second = { id: "second", amount: "2" };
  const keys = keyedFinanceItems([first, second]);
  assert.equal(keyedFinanceItems([second, first])[0]!.key, keys[1]!.key);
  assert.equal(
    keyedFinanceItems([{ ...first, amount: "3" }])[0]!.key,
    keys[0]!.key,
  );
  assert.equal(
    keyedFinanceItems(["one", "two"])[0]!.key,
    keyedFinanceItems(["two", "one"])[1]!.key,
  );
  assert.equal(
    new Set(keyedFinanceItems(["same", "same"]).map((item) => item.key)).size,
    2,
  );
});

test("shared labels preserve both platforms' fallbacks and participants' wording", () => {
  for (const text of [webText, mobileText]) {
    assert.equal(
      text.systemCodeLabel("SESSION_COMPLETED"),
      "Hoàn thành buổi học",
    );
    assert.equal(text.systemCodeLabel("unknown", "Fallback"), "Fallback");
    assert.equal(text.knownSystemMessage("toString"), undefined);
    assert.equal(
      text.reportDescriptionText("Nội dung do tôi nhập"),
      "Nội dung do tôi nhập",
    );
    assert.equal(
      text.reportDescriptionText(
        "No makeup time was agreed before the makeup deadline.",
      ),
      "Hai bên chưa thống nhất lịch học bù trước khi hết hạn.",
    );
  }
  assert.match(webText.systemCodeLabel("INVALID_FEE_REPORT_RANGE"), /366 ngày/);
});
