import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import { AppError } from "../src/lib/http/errors";
import { readPayload } from "../src/lib/http/response";

type Element = { type: unknown; props: Record<string, unknown> };
function elements(value: unknown): Element[] {
  if (Array.isArray(value)) return value.flatMap(elements);
  if (!value || typeof value !== "object" || !("props" in value)) return [];
  const element = value as Element;
  return [element, ...elements(element.props.children)];
}
test("rate limits have calm inline feedback without retry; other failures keep a small retry", () => {
  const local = createRequire(
    new URL("../src/features/connections/components.tsx", import.meta.url),
  );
  const filename = local.resolve("./components.tsx");
  const jsx = (type: unknown, props: Record<string, unknown>) => ({
    type,
    props,
  });
  const stubs = {
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "react-native": {
      View: "View",
      Text: "Text",
      Pressable: "Pressable",
      StyleSheet: { create: (value: unknown) => value },
    },
    "@/components/Icon": { Icon: "Icon" },
    "@/components/FormNotice": { FormNotice: "Notice" },
    "@/components/LoadingIndicator": { LoadingIndicator: "Spinner" },
  };
  const mocks = Object.entries(stubs).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
  try {
    delete local.cache[filename];
    const { ConnectionFeedback, connectionError } = local(
      filename,
    ) as typeof import("../src/features/connections/components");
    let retries = 0;
    const retry = () => {
      retries++;
    };
    const limited = elements(
      ConnectionFeedback({ error: new AppError("http", 429), retry }),
    );
    assert.equal(
      limited.some((item) => item.type === "Pressable"),
      false,
    );
    assert.ok(
      limited.some(
        (item) =>
          item.props.children ===
          "Tạm thời có nhiều yêu cầu. Vui lòng đợi một lát.",
      ),
    );
    const button = elements(
      ConnectionFeedback({ error: new AppError("network"), retry }),
    ).find((item) => item.type === "Pressable")!;
    (button.props.onPress as () => void)();
    assert.equal(retries, 1);
    const pending = elements(
      ConnectionFeedback({
        loading: true,
        error: new AppError("network"),
        retry,
      }),
    ).find((item) => item.type === "Pressable")!;
    (pending.props.onPress as () => void)();
    assert.equal(retries, 1);
    assert.equal(ConnectionFeedback({}), null);
    for (const status of [409, 429, 503]) {
      const notice = elements(
        ConnectionFeedback({
          error: new AppError("http", status),
          errorPresentation: "notice",
        }),
      ).find((item) => item.type === "Notice")!;
      assert.equal(notice.props.tone, status === 429 ? "warning" : "error");
    }
    assert.doesNotMatch(
      connectionError(new AppError("protocol")) ?? "",
      /hợp đồng|protocol/,
    );
    assert.match(
      connectionError(
        new AppError("http", 409, "COMMAND_RECONCILE_REQUIRED"),
      ) ?? "",
      /kiểm tra trạng thái trước khi gửi tiếp/,
    );
    for (const [code, expected] of [
      [
        "ACTIVE_SESSION_REPORT_EXISTS",
        "Bạn đã có báo cáo đang xử lý cho buổi này. Mở danh sách báo cáo để theo dõi.",
      ],
      [
        "ACTIVE_MATERIAL_REPORT_EXISTS",
        "Bạn đã có báo cáo đang xử lý cho tài liệu này.",
      ],
      ["DISPUTE_WINDOW_CLOSED", "Đã hết thời hạn gửi báo cáo buổi học."],
      [
        "SESSION_NOT_REPORTABLE",
        "Buổi học đã bị hủy nên không thể gửi báo cáo.",
      ],
    ]) {
      assert.throws(
        () => readPayload(409, { success: false, message: code }),
        (error) => {
          assert.ok(error instanceof AppError);
          assert.equal(connectionError(error), expected);
          return true;
        },
      );
    }
    assert.equal(
      connectionError(new AppError("http", 409, "UNKNOWN_CONFLICT")),
      "Trạng thái đã thay đổi. Tải lại trước khi thao tác.",
    );
    assert.equal(
      connectionError(
        new AppError("http", 403, "ACTIVE_SESSION_REPORT_EXISTS"),
      ),
      "Nội dung không còn khả dụng hoặc bạn không có quyền truy cập.",
    );
  } finally {
    delete local.cache[filename];
    mocks.reverse().forEach((item) => item.restore());
  }
});
