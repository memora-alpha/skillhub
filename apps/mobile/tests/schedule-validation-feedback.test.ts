import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import { AppError } from "../src/lib/http/errors";
import { scheduleTimeDetails } from "./fixtures/invalid-schedule-details";
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

test("schedule rejection identifies each teacher and session with a clear reason and next action", () => {
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
    "react-native": { View: "View", Text: "Text" },
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
    assert.match(render(), /Buổi 1.*giờ bắt đầu đã qua.*An dạy/s);
    assert.match(render(), /Buổi 1.*30 phút.*Bình dạy/s);
    assert.match(render(), /Sửa lịch của bạn/);
    assert.match(render(), /nhờ đối tác sửa/);
    namesAvailable = false;
    assert.match(render(), /bạn dạy/);
    assert.match(render(), /đối tác dạy/);
    path.plans = [];
    assert.match(render(), /Chưa xác định được buổi cần sửa/);
    assert.doesNotMatch(render(), /An dạy|Bình dạy|undefined|Invalid Date/);

    namesAvailable = true;
    const serverPath = withConfirmedSchedules(agreementPath(true));
    const details = scheduleTimeDetails(serverPath);
    // Only the other teacher's schedule is rejected. Device time must not add
    // a problem for the viewer's schedule or replace the server's reason.
    details.invalidItems = [details.invalidItems[1]!];
    const error = new AppError(
      "http",
      409,
      "INVALID_SCHEDULE_ITEMS",
      0,
      details,
    );
    const renderServer = (snapshotCurrent = true) =>
      text(
        ScheduleValidationFeedback({
          path: serverPath,
          userId: teacherId,
          error,
          snapshotCurrent,
        }),
      );
    assert.match(renderServer(), /Buổi 1.*giờ bắt đầu đã qua.*Bình dạy/s);
    assert.doesNotMatch(
      renderServer(),
      /An dạy|Sửa lịch của bạn|60 đến 180|máy chủ|giờ thiết bị|phiên bản/,
    );
    assert.match(renderServer(false), /Lịch đã thay đổi.*tải lại/s);
    assert.doesNotMatch(renderServer(false), /Bình dạy|Sửa lịch|nhờ đối tác/);
    serverPath.plans[1]!.schedule!.version++;
    assert.match(renderServer(), /Lịch đã thay đổi/);
    assert.doesNotMatch(renderServer(), /Bình dạy|Sửa lịch|nhờ đối tác/);
  } finally {
    delete local.cache[filename];
    for (const context of mocks.reverse()) context.restore();
  }
});
