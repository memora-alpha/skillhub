import { createServer, type ServerResponse } from "node:http";
import { startLearningRequestsFixture } from "./learning-requests-api";
import { fixtureId, fixtureUsers } from "./learning-requests-data";
import type { Proposal } from "../../src/features/proposals/api/proposals-api";
import type {
  ApiConversation,
  ApiMessage,
} from "../../src/features/messages/api/messages-api";

// Disposable browser fixture. All identities and tokens are fake; never proxies to production.
export async function startConnectionsBrowserFixture(port = 4326) {
  const base = await startLearningRequestsFixture();
  const me = fixtureUsers[0].id,
    other = fixtureUsers[1].id;
  const proposalId = fixtureId(500),
    conversationId = fixtureId(600);
  const timestamp = new Date().toISOString();
  let proposals: Proposal[] = [
    {
      id: proposalId,
      sourceType: "LEARNING_REQUEST",
      learningRequestId: fixtureId(100),
      proposerId: other,
      recipientId: me,
      skillId: fixtureId(10),
      message: "Mình có thể hướng dẫn React theo dự án thực hành.",
      exchangeTypeHint: "TWO_WAY",
      proposedCredit: "40.00",
      proposedDurationMinutes: 90,
      initialSessionCount: 2,
      candidateSlots: null,
      status: "PENDING",
      version: 1,
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  ];
  let conversations: ApiConversation[] = [];
  let messages: ApiMessage[] = [];
  const streams = new Set<ServerResponse>(),
    replays = new Map<string, { body: string; data: unknown }>();
  const deliveries = new Map<string, ApiMessage>();
  let sequence = 0,
    eventSequence = 0;
  const broadcast = (event: string, data: object) => {
    const id = ++eventSequence;
    const frame = `id: fixture-cursor-${id}\nevent: ${event}\ndata: ${JSON.stringify({ eventId: fixtureId(900 + id), version: 1, occurredAt: new Date().toISOString(), data })}\n\n`;
    streams.forEach((stream) => stream.write(frame));
  };
  const server = createServer((req, res) => {
    void handle(req, res).catch(() => {
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            success: false,
            message: "FIXTURE_FAILED",
            statusCode: 500,
          }),
        );
      }
    });
  });
  async function handle(
    req: import("node:http").IncomingMessage,
    res: ServerResponse,
  ) {
    const url = new URL(req.url ?? "/", "http://127.0.0.1"),
      path = url.pathname;
    const method = req.method ?? "GET";
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Authorization, Content-Type, Idempotency-Key, Last-Event-ID",
    );
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET, POST, PATCH, DELETE, OPTIONS",
    );
    if (method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }
    const isConnection =
      /\/api\/v1\/(proposals|conversations|events)(?:\/|$)/.test(path);
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const raw = Buffer.concat(chunks).toString();
    if (!isConnection) {
      const headers: Record<string, string> = {};
      if (req.headers.authorization)
        headers.Authorization = req.headers.authorization;
      if (req.headers["content-type"])
        headers["Content-Type"] = req.headers["content-type"];
      const upstream = await fetch(`${base.url}${req.url}`, {
        method,
        headers,
        body: ["GET", "HEAD"].includes(method) ? undefined : raw,
      });
      res.writeHead(upstream.status, { "Content-Type": "application/json" });
      res.end(await upstream.text());
      return;
    }
    const actor = fixtureUsers.find(
      (user) => `Bearer ${user.token}` === req.headers.authorization,
    );
    const send = (status: number, data: unknown, pagination?: object) => {
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify(
          status >= 400
            ? { success: false, message: data, statusCode: status }
            : {
                success: true,
                message: "Fixture",
                data,
                ...(pagination ? { meta: { pagination } } : {}),
              },
        ),
      );
    };
    if (!actor) {
      send(401, "UNAUTHENTICATED");
      return;
    }
    if (path === "/api/v1/events") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      res.write(
        `id: fixture-cursor-${eventSequence}\nevent: stream.ready\ndata: {}\n\n`,
      );
      streams.add(res);
      const timer = setInterval(() => res.write(": heartbeat\n\n"), 5000);
      req.once("close", () => {
        clearInterval(timer);
        streams.delete(res);
      });
      return;
    }
    const pagination = { limit: 20, hasMore: false, nextCursor: null };
    const body = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    if (path === "/api/v1/proposals" && method === "GET") {
      send(
        200,
        proposals.filter(
          (p) =>
            (url.searchParams.get("direction") === "sent"
              ? p.proposerId
              : p.recipientId) === actor.id &&
            (!url.searchParams.get("status") ||
              p.status === url.searchParams.get("status")),
        ),
        pagination,
      );
      return;
    }
    const id = path.split("/")[4],
      action = path.split("/")[5];
    if (path.startsWith("/api/v1/proposals")) {
      const replayKey = `${actor.id}:${method}:${path}:${req.headers["idempotency-key"]}`;
      const replay = replays.get(replayKey);
      if (method !== "GET" && replay) {
        send(
          replay.body === raw ? 200 : 409,
          replay.body === raw ? replay.data : "IDEMPOTENCY_CONFLICT",
        );
        return;
      }
      if (path === "/api/v1/proposals" && method === "POST") {
        const created: Proposal = {
          ...proposals[0]!,
          ...body,
          id: fixtureId(501 + proposals.length),
          proposerId: actor.id,
          recipientId: actor.id === me ? other : me,
          learningRequestId:
            typeof body.learningRequestId === "string"
              ? body.learningRequestId
              : null,
          status: "PENDING",
          version: 1,
          conversationId: undefined,
        } as Proposal;
        proposals = [created, ...proposals];
        replays.set(replayKey, { body: raw, data: created });
        send(201, created);
        broadcast("proposal.created", { proposalId: created.id });
        return;
      }
      const item = proposals.find(
        (p) => p.id === id && [p.proposerId, p.recipientId].includes(actor.id),
      );
      if (!item) {
        send(404, "NOT_FOUND");
        return;
      }
      if (method === "GET") {
        send(200, item);
        return;
      }
      if (item.status !== "PENDING" || item.version !== body.expectedVersion) {
        send(409, "PROPOSAL_VERSION_CONFLICT");
        return;
      }
      if (method === "PATCH")
        Object.assign(item, body, { version: item.version + 1 });
      else if (action === "accept" && item.recipientId === actor.id) {
        item.status = "ACCEPTED";
        item.version++;
        item.conversationId = conversationId;
        const conversation: ApiConversation = {
          id: conversationId,
          proposalId: item.id,
          learningRequestId: item.learningRequestId,
          participantAId: item.proposerId,
          participantBId: item.recipientId,
          createdAt: timestamp,
        };
        conversations = [conversation];
        messages = [
          {
            id: fixtureId(701),
            conversationId,
            senderId: other,
            messageText:
              "Chào bạn, cùng thống nhất mục tiêu và nội dung học nhé!",
            messageType: "TEXT",
            attachments: [],
            sequence: String(++sequence),
            sentAt: timestamp,
            readAt: null,
          },
        ];
        const result = { proposal: item, conversation };
        replays.set(replayKey, { body: raw, data: result });
        send(200, result);
        broadcast("proposal.accepted", { proposalId: item.id });
        return;
      } else if (action === "reject" && item.recipientId === actor.id) {
        item.status = "REJECTED";
        item.version++;
      } else if (action === "withdraw" && item.proposerId === actor.id) {
        item.status = "WITHDRAWN";
        item.version++;
      } else {
        send(403, "FORBIDDEN");
        return;
      }
      replays.set(replayKey, { body: raw, data: item });
      send(200, item);
      broadcast("proposal.updated", { proposalId: item.id });
      return;
    }
    if (path === "/api/v1/conversations") {
      send(
        200,
        conversations.filter((c) =>
          [c.participantAId, c.participantBId].includes(actor.id),
        ),
        pagination,
      );
      return;
    }
    const c = conversations.find(
      (item) =>
        item.id === id &&
        [item.participantAId, item.participantBId].includes(actor.id),
    );
    if (!c) {
      send(404, "NOT_FOUND");
      return;
    }
    if (!action) {
      send(200, c);
      return;
    }
    if (action === "messages" && method === "GET") {
      send(
        200,
        messages.filter(
          (m) =>
            m.conversationId === id &&
            (!url.searchParams.get("afterSequence") ||
              BigInt(m.sequence) >
                BigInt(url.searchParams.get("afterSequence")!)),
        ),
        pagination,
      );
      return;
    }
    if (action === "messages" && method === "POST") {
      const clientId = String(body.clientMessageId),
        old = deliveries.get(clientId);
      const message: ApiMessage = old ?? {
        id: fixtureId(701 + ++sequence),
        conversationId: id!,
        senderId: actor.id,
        messageText: String(body.messageText ?? ""),
        messageType: "TEXT",
        attachments: [],
        sequence: String(sequence),
        sentAt: new Date().toISOString(),
        readAt: null,
      };
      if (!old) {
        messages.push(message);
        deliveries.set(clientId, message);
      }
      send(201, { deliveryStatus: "DELIVERED", message });
      broadcast("chat.message.created", {
        conversationId: id,
        messageId: message.id,
        messageSequence: message.sequence,
      });
      return;
    }
    if (action === "message-deliveries") {
      const m = deliveries.get(path.split("/")[6]!);
      send(
        m ? 200 : 404,
        m ? { deliveryStatus: "DELIVERED", message: m } : "NOT_FOUND",
      );
      return;
    }
    if (action === "read") {
      const m = messages.find((item) => item.id === body.messageId);
      send(
        m ? 200 : 404,
        m
          ? { lastReadSequence: m.sequence, lastReadAt: timestamp }
          : "NOT_FOUND",
      );
      return;
    }
    send(404, "NOT_FOUND");
  }
  await new Promise<void>((resolve) =>
    server.listen(port, "127.0.0.1", resolve),
  );
  return {
    url: `http://127.0.0.1:${port}`,
    stop: async () => {
      streams.forEach((stream) => stream.end());
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await base.stop();
    },
  };
}
if (process.argv[1]?.endsWith("connections-browser-api.ts")) {
  void startConnectionsBrowserFixture().then((fixture) => {
    console.log(
      `Connections TEST fixture: ${fixture.url} (fake accounts only)`,
    );
    process.once("SIGINT", () => {
      void fixture.stop();
    });
    process.once("SIGTERM", () => {
      void fixture.stop();
    });
  });
}
