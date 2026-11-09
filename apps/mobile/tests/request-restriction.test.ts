import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import { AppError } from "../src/lib/http/errors";
import {
  isRequestActivityRestricted,
  requestError,
} from "../src/features/learning-requests/utils/request-policy";
import {
  draftToInput,
  requestDefaults,
} from "../src/features/learning-requests/schemas/request-form";
import { startLearningRequestsFixture } from "./fixtures/learning-requests-api";
import { fixtureClient } from "./fixtures/learning-requests-client";
import { fixtureId, fixtureRequest } from "./fixtures/learning-requests-data";
import { mutationNeedsReconcile } from "../src/features/learning-requests/utils/request-recovery";

test("create and publish restriction responses explain reputation without replaying the mutation", async (t) => {
  const fixture = await startLearningRequestsFixture();
  t.after(fixture.stop);
  const api = fixtureClient(fixture.url);
  const draft = requestDefaults(fixtureRequest());
  const snapshot = structuredClone(draft);
  for (const command of ["create", "publish"] as const) {
    const path =
      command === "create"
        ? "/api/v1/learning-requests"
        : `/api/v1/learning-requests/${fixtureId(100)}/publish`;
    await fixture.control({
      rules: [
        {
          kind: "http",
          method: "POST",
          path,
          status: 403,
          code: "NEW_ACTIVITY_RESTRICTED",
        },
      ],
    });
    const before = fixture.events.length;
    await assert.rejects(
      () =>
        command === "create"
          ? api.create(draftToInput(draft))
          : api.action(fixtureId(100), "publish", 1),
      (error: unknown) => {
        assert.equal(isRequestActivityRestricted(error), true);
        const message = requestError(error, true);
        assert.match(message, /chưa thể tạo hoặc đăng yêu cầu học/);
        assert.match(message, /chính sách uy tín/);
        assert.match(message, /lý do và thời hạn/);
        assert.match(message, /Tăng điểm không tự gỡ/);
        assert.doesNotMatch(message, /NEW_ACTIVITY_RESTRICTED/);
        return true;
      },
    );
    assert.equal(fixture.events.length, before + 1);
    assert.deepEqual(draft, snapshot);
  }
});

test("generic permission, network and service errors do not become reputation restrictions", () => {
  for (const error of [
    new AppError("http", 403),
    new AppError("http", 403, "FORBIDDEN"),
    new AppError("http", 503, "NEW_ACTIVITY_RESTRICTED"),
    new AppError("network"),
    new Error("NEW_ACTIVITY_RESTRICTED"),
  ]) {
    assert.equal(isRequestActivityRestricted(error), false);
    assert.doesNotMatch(requestError(error, true), /chính sách uy tín/);
  }
});

test("explicit catalog and account rejections explain the cause and leave the draft editable", () => {
  const codes = {
    TAG_NOT_ACTIVE: /tag.*không còn hoạt động/,
    SKILL_NOT_ACTIVE: /Kỹ năng đã chọn không còn hoạt động/,
    SHARING_SKILL_CHANGED: /kỹ năng có thể dạy đã thay đổi/,
    SHARING_SKILL_ARCHIVED: /kỹ năng có thể dạy đã được lưu trữ/,
    SHARING_SKILL_NOT_VISIBLE: /kỹ năng có thể dạy không còn công khai/,
    CONNECTION_PARTY_UNAVAILABLE: /xác minh email.*trạng thái tài khoản/,
  };
  for (const [code, expected] of Object.entries(codes)) {
    const error = new AppError("http", 409, code);
    assert.match(requestError(error, true), expected);
    assert.doesNotMatch(requestError(error, true), /Yêu cầu đã thay đổi/);
    assert.equal(mutationNeedsReconcile(error), false);
    assert.equal(isRequestActivityRestricted(error), false);
  }
  for (const error of [
    new AppError("http", 409),
    new AppError("http", 409, "VERSION_CONFLICT"),
    new AppError("network"),
    new AppError("protocol"),
    new AppError("http", 500),
  ])
    assert.equal(mutationNeedsReconcile(error), true);
  assert.doesNotMatch(
    requestError(new AppError("http", 500, "TAG_NOT_ACTIVE"), true),
    /tag.*không còn hoạt động/,
  );
});

type Element = { type: unknown; props: Record<string, unknown> };
function elements(tree: unknown): Element[] {
  if (Array.isArray(tree)) return tree.flatMap(elements);
  if (!tree || typeof tree !== "object" || !("props" in tree)) return [];
  const el = tree as Element;
  if (typeof el.type === "function") return elements(el.type(el.props));
  return [el, ...elements(el.props.children)];
}

test("restricted publish opens the policy gate; other failures retain the normal refresh action", () => {
  const local = createRequire(
    new URL(
      "../src/features/learning-requests/components/request-detail-actions.tsx",
      import.meta.url,
    ),
  );
  const filename = local.resolve("./request-detail-actions.tsx");
  const noticeFile = local.resolve("./request-restriction-notice.tsx");
  const routes: unknown[] = [];
  let refreshed = 0;
  const jsx = (type: unknown, props: unknown) => ({ type, props });
  const contexts = Object.entries({
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "react-native": {
      Text: "Text",
      View: "View",
      StyleSheet: { create: (value: unknown) => value },
    },
    "expo-router": {
      useRouter: () => ({ push: (route: unknown) => routes.push(route) }),
    },
    "@/components/Button": { Button: "Button" },
    "@/components/FormNotice": { FormNotice: "Notice" },
    "@/components/Icon": { Icon: "Icon" },
    "@/components/feature-page": { Copy: "Copy" },
    "@/features/community/policy": {
      ReputationPolicyGate: "PolicyGate",
      useReputationPolicy: () => {},
      canCreateRequest: () => false,
    },
    "./request-publish-policy": { RequestPublishPolicy: "PublishPolicy" },
    "./request-section": { RequestSection: "Section" },
  }).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
  try {
    delete local.cache[filename];
    delete local.cache[noticeFile];
    const { RequestActionError } = local(
      filename,
    ) as typeof import("../src/features/learning-requests/components/request-detail-actions");
    const restricted = new AppError("http", 403, "NEW_ACTIVITY_RESTRICTED");
    const render = (error: unknown, pending = false) =>
      elements(
        RequestActionError({
          error,
          pending,
          refresh: () => {
            refreshed++;
          },
        }),
      );
    const restrictedNodes = render(restricted);
    const gate = restrictedNodes.find((el) => el.type === "PolicyGate")!;
    assert.equal(gate.props.message, requestError(restricted, true));
    assert.equal(gate.props.pending, false);
    assert.deepEqual(routes, []);
    assert.equal(refreshed, 0);
    assert.equal(
      render(restricted, true).find((el) => el.type === "PolicyGate")?.props
        .pending,
      true,
    );
    const fallback = render(new AppError("http", 403));
    const retry = fallback.find((el) => el.type === "Button")!;
    assert.equal(retry.props.children, "Thử kiểm tra lại");
    (retry.props.onPress as () => void)();
    assert.equal(refreshed, 1);
  } finally {
    delete local.cache[filename];
    delete local.cache[noticeFile];
    contexts.reverse().forEach((context) => context.restore());
  }
});
