import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import { fixtureId } from "./fixtures/learning-requests-data";

test("manual message recovery reuses the original client ID, text and files and handles both 201 and 202", async () => {
  const local = createRequire(
    new URL(
      "../src/features/messages/hooks/use-message-send.ts",
      import.meta.url,
    ),
  );
  const filename = local.resolve("./use-message-send.ts");
  const slots: unknown[] = [];
  let cursor = 0;
  let previous: ((key: string) => Promise<unknown>) | undefined;
  let fail = true;
  let result: unknown = {
    deliveryStatus: "DELIVERED",
    message: { id: fixtureId(4) },
  };
  const requests: unknown[] = [];
  const remembered: unknown[] = [];
  const command = {
    pending: false,
    uncertain: false,
    run: async (
      _fingerprint: string,
      send: (key: string) => Promise<unknown>,
    ) => {
      previous = send;
      try {
        return await send(fixtureId(90));
      } catch {
        command.uncertain = true;
        return undefined;
      }
    },
    retry: async () => {
      const value = await previous?.(fixtureId(90));
      command.uncertain = false;
      return value;
    },
  };
  const mocks = {
    react: {
      useRef: (value: unknown) => {
        const index = cursor++;
        slots[index] ??= { current: value };
        return slots[index];
      },
      useState: (value: unknown) => {
        const index = cursor++;
        if (!(index in slots)) slots[index] = value;
        return [
          slots[index],
          (next: unknown) => {
            slots[index] = next;
          },
        ];
      },
      useEffect: () => {},
    },
    "@tanstack/react-query": {
      useQueryClient: () => ({ invalidateQueries: async () => {} }),
    },
    "@/features/connections": {
      useConnections: () => ({ key: ["owner"], isCurrent: () => true }),
      useConnectionCommand: () => command,
      useConnectionQuery: () => ({ data: undefined }),
    },
    "./use-messages-api": {
      useMessagesApi: () => ({
        send: async (id: string, body: unknown) => {
          requests.push({ id, body });
          if (fail) throw new Error("lost response");
          return result;
        },
      }),
    },
    "../utils/conversation-preview": {
      rememberLatestMessage: (
        _cache: unknown,
        _key: unknown,
        message: unknown,
      ) => {
        remembered.push(message);
      },
    },
  };
  const contexts = Object.entries(mocks).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
  try {
    delete local.cache[filename];
    const { useMessageSend } = local(
      filename,
    ) as typeof import("../src/features/messages/hooks/use-message-send");
    const render = () => {
      cursor = 0;
      return useMessageSend(fixtureId(1));
    };
    const files = [fixtureId(2)];
    assert.equal(await render().send(" original ", files), false);
    files[0] = fixtureId(3);
    assert.equal(await render().send("changed", files), false);
    assert.equal(requests.length, 1);
    fail = false;
    assert.equal(await render().retryPrevious(), true);
    assert.deepEqual(requests[1], requests[0]);
    assert.deepEqual(requests[0], {
      id: fixtureId(1),
      body: {
        clientMessageId: fixtureId(90),
        messageText: "original",
        attachmentFileIds: [fixtureId(2)],
      },
    });
    assert.equal(remembered.length, 1);
    result = {
      deliveryStatus: "PENDING",
      clientMessageId: fixtureId(90),
      messageId: fixtureId(4),
      statusUrl: "/delivery",
      failureCode: null,
    };
    assert.equal(await render().send("next file", files), true);
    assert.equal(render().processing, true);
    assert.equal(await render().send("do not duplicate", files), false);
    assert.equal(remembered.length, 1, "202 never invents published history");
  } finally {
    delete local.cache[filename];
    for (const context of contexts.reverse()) context.restore();
  }
});
