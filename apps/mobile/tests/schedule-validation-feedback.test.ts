import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import {
  agreementPath,
  teacherId,
  withConfirmedSchedules,
} from "./fixtures/learning-agreement";

type Element = { type: unknown; props: Record<string, unknown> };
function text(tree: unknown): string {
  if (typeof tree === "string" || typeof tree === "number") return String(tree);
  if (Array.isArray(tree)) return tree.map(text).join("");
  if (!tree || typeof tree !== "object" || !("props" in tree)) return "";
  const element = tree as Element;
  return typeof element.type === "function"
    ? text(element.type(element.props))
    : text(element.props.children);
}

test("schedule rejection names each teacher, learner and session with a precise reason", () => {
  const local = createRequire(
    new URL(
      "../src/features/learning-paths/components/schedule-validation-feedback.tsx",
      import.meta.url,
    ),
  );
  const filename = local.resolve("./schedule-validation-feedback.tsx");
  let namesAvailable = true;
  const jsx = (type: unknown, props: Record<string, unknown>) => ({
    type,
    props,
  });
  const stubs = {
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "react-native": { View: "View" },
    "@/components/FormNotice": { FormNotice: "Notice" },
    "@/components/feature-page": { Copy: "Copy", RouteButton: "RouteButton" },
    "@/features/connections": {
      useParticipantName: (id: string) => ({
        data: namesAvailable ? (id === teacherId ? "An" : "Bình") : undefined,
      }),
      useCatalogName: () => ({ data: "React" }),
    },
  };
  const mocks = Object.entries(stubs).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
  try {
    delete local.cache[filename];
    const { ScheduleValidationFeedback } = local(
      filename,
    ) as typeof import("../src/features/learning-paths/components/schedule-validation-feedback");
    const path = withConfirmedSchedules(agreementPath(true));
    path.plans[0]!.schedule!.items[0]!.startAt = "2000-01-01T10:00:00Z";
    path.plans[0]!.schedule!.items[0]!.endAt = "2000-01-01T11:00:00Z";
    path.plans[1]!.schedule!.items[0]!.endAt = "2030-01-02T14:30:00Z";
    const render = () =>
      text(ScheduleValidationFeedback({ path, userId: teacherId }));
    assert.match(render(), /An dạy, Bình học.*Buổi 1.*giờ bắt đầu đã qua/s);
    assert.match(render(), /Bình dạy, An học.*Buổi 1.*30 phút/s);
    assert.match(render(), /Sửa lịch bạn dạy/);
    assert.match(render(), /nhờ đối tác sửa/);
    namesAvailable = false;
    assert.match(render(), /bạn dạy, đối tác học/);
    assert.match(render(), /đối tác dạy, bạn học/);
    path.plans = [];
    assert.match(
      render(),
      /Máy chủ chưa trả chi tiết lịch của ai hoặc buổi nào/,
    );
    assert.doesNotMatch(render(), /An dạy|Bình dạy|undefined|Invalid Date/);
  } finally {
    delete local.cache[filename];
    for (const context of mocks.reverse()) context.restore();
  }
});
