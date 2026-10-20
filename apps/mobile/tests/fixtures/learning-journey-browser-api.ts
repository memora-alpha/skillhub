import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { startConnectionsBrowserFixture } from "./connections-browser-api";
import { journeyIds as ids, journeyPath } from "./learning-journey-data";
import { fixtureId } from "./learning-requests-data";

// Disposable loopback-only UI fixture. It forwards only to another fake local fixture.
export async function startLearningJourneyBrowserFixture(port = 4391) {
  const base = await startConnectionsBrowserFixture(4326);
  let path = journeyPath();
  let visible = true;
  let failCheck = false;
  const commands: { url: string; body: unknown; key?: string }[] = [];
  const replies = new Map<string, unknown>();
  const server = createServer((req, res) => {
    void handle(req, res).catch(() => send(res, 500, "FIXTURE_ERROR"));
  });
  function send(res: ServerResponse, status: number, data: unknown) {
    res.writeHead(status, {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    });
    res.end(
      JSON.stringify(
        status < 400
          ? { success: true, data }
          : { success: false, message: data, statusCode: status },
      ),
    );
  }
  function refreshConfirmation() {
    path.status =
      path.plans.length ===
        (path.agreement.exchangeType === "TWO_WAY" ? 2 : 1) &&
      path.plans.every((p) => !!p.learnerConfirmedAt) &&
      path.agreement.participantAConfirmedAt &&
      path.agreement.participantBConfirmedAt
        ? "CONFIRMED"
        : "PARTIALLY_CONFIRMED";
  }
  async function handle(req: IncomingMessage, res: ServerResponse) {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const method = req.method ?? "GET";
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Authorization, Content-Type, Idempotency-Key, Last-Event-ID",
    );
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS");
    if (method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const bytes = Buffer.concat(chunks);
    const body = bytes.length ? JSON.parse(bytes.toString()) : {};
    if (url.pathname === "/__journey") {
      if (method === "POST") {
        path = journeyPath(body.stage !== "plans" && body.stage !== "waiting");
        visible = body.stage !== "empty";
        failCheck = body.stage === "check-error";
        if (body.stage === "schedule") path.plans[0]!.schedule = null;
        if (body.stage === "waiting") {
          path.plans = [path.plans[0]!];
          path.agreement.participantAConfirmedAt = new Date().toISOString();
        }
        if (body.stage === "locked") {
          path.lockedVersion = 1;
          path.status = "SCHEDULED";
        }
      }
      send(res, 200, { path, commands });
      return;
    }
    if (url.pathname === "/api/v1/learning-paths/mine") {
      const summary = {
        id: path.id,
        conversationId: ids.conversation,
        counterpartId: ids.other,
        status: path.status,
        exchangeType: path.agreement.exchangeType,
        currentVersion: path.currentVersion,
        lockedVersion: path.lockedVersion,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      send(res, 200, visible ? [summary] : []);
      return;
    }
    if (
      url.pathname === `/api/v1/learning-paths/${ids.path}` &&
      method === "GET"
    ) {
      send(res, 200, path);
      return;
    }
    if (
      url.pathname.startsWith("/api/v1/learning-paths") ||
      url.pathname.startsWith("/api/v1/learning-plans") ||
      url.pathname.startsWith("/api/v1/schedule-proposals")
    ) {
      const key = req.headers["idempotency-key"] as string | undefined;
      commands.push({ url: url.pathname, body, key });
      if (url.pathname.endsWith("/final-validation")) {
        send(
          res,
          failCheck ? 409 : 200,
          failCheck
            ? "INSUFFICIENT_AVAILABLE_CREDIT"
            : {
                pathId: path.id,
                version: path.currentVersion,
                exchangeType: path.agreement.exchangeType,
                planCount: path.plans.length,
                scheduleCount: path.plans.length,
                ready: true,
              },
        );
        return;
      }
      if (url.pathname.endsWith("/finalize")) {
        if (key && replies.has(key)) {
          send(res, 200, replies.get(key));
          return;
        }
        path.lockedVersion = path.currentVersion;
        path.status = "SCHEDULED";
        const sessions = path.plans.flatMap((p, i) =>
          p.schedule!.items.map((item) => ({
            ...item,
            id: fixtureId(750 + i),
            planId: p.id,
          })),
        );
        const result = {
          pathId: path.id,
          version: path.currentVersion,
          status: path.status,
          sessions,
        };
        if (key) replies.set(key, result);
        send(res, 200, result);
        return;
      }
      if (url.pathname.endsWith("/confirm")) {
        const target = url.pathname.split("/").at(-2);
        const plan = path.plans.find((p) => p.id === target);
        const schedule = path.plans.find(
          (p) => p.schedule?.id === target,
        )?.schedule;
        if (plan) {
          plan.learnerConfirmedAt = new Date().toISOString();
          plan.status = "CONFIRMED";
          refreshConfirmation();
          send(res, 200, {
            id: plan.id,
            version: plan.version,
            status: plan.status,
          });
          return;
        }
        if (schedule) {
          schedule.participantAConfirmedAt = new Date().toISOString();
          send(res, 200, {
            id: schedule.id,
            version: schedule.version,
            status: schedule.status,
            bothConfirmed: !!schedule.participantBConfirmedAt,
          });
          return;
        }
        path.agreement.participantAConfirmedAt = new Date().toISOString();
        refreshConfirmation();
        send(res, 200, {
          id: path.id,
          currentVersion: path.currentVersion,
          status: path.status,
        });
        return;
      }
      if (url.pathname.endsWith("/schedule-proposals")) {
        const plan = path.plans.find(
          (p) => p.id === url.pathname.split("/").at(-2),
        )!;
        plan.schedule = {
          id: fixtureId(710),
          version: 1,
          appliedVersion: null,
          status: "PROPOSED",
          participantAConfirmedAt: null,
          participantBConfirmedAt: null,
          items: body.items,
        };
        send(res, 200, {
          id: plan.schedule.id,
          version: 1,
          status: "PROPOSED",
        });
        return;
      }
      if (url.pathname === "/api/v1/learning-paths") {
        visible = true;
        path = journeyPath();
        path.plans = [];
        send(res, 201, { id: path.id, version: 1, status: path.status });
        return;
      }
      send(res, 404, "FIXTURE_ROUTE_NOT_IMPLEMENTED");
      return;
    }
    const upstream = await fetch(`${base.url}${req.url}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: req.headers.authorization ?? "",
      },
      ...(bytes.length ? { body: bytes } : {}),
    });
    res.writeHead(upstream.status, {
      "Content-Type":
        upstream.headers.get("content-type") ?? "application/json",
    });
    if (upstream.headers.get("content-type")?.includes("text/event-stream")) {
      const reader = upstream.body!.getReader();
      req.on("close", () => {
        void reader.cancel();
      });
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        res.write(chunk.value);
      }
      res.end();
      return;
    }
    res.end(Buffer.from(await upstream.arrayBuffer()));
  }
  await new Promise<void>((resolve) =>
    server.listen(port, "127.0.0.1", resolve),
  );
  return {
    url: `http://127.0.0.1:${port}`,
    stop: async () => {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await base.stop();
    },
  };
}
if (process.argv[1]?.endsWith("learning-journey-browser-api.ts")) {
  void startLearningJourneyBrowserFixture().then((fixture) => {
    console.log(`Learning journey UI fixture: ${fixture.url}`);
    process.once("SIGINT", () => {
      void fixture.stop();
    });
  });
}
