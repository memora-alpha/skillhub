// Test-only loopback server. Never imported by the mobile runtime.
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { setTimeout as delay } from "node:timers/promises";
import {
  fixtureId,
  fixtureUsers,
  fixtureSkills,
  fixtureRequest,
  fixtureIdentity,
  createFixtureData,
  publicFixture,
} from "./learning-requests-data";
import type { FixtureRequest } from "./learning-requests-data";
import type { OwnerRequest } from "../../src/features/learning-requests/types";

export type FixtureRule = {
  method?: string;
  path?: string;
  actor?: string;
  cursor?: boolean;
  kind:
    "http" | "network" | "delay" | "conflict" | "wrong-id" | "unknown-commit";
  status?: number;
  code?: string;
  delayMs?: number;
  times?: number;
};
type Event = {
  method: string;
  path: string;
  actor: string | null;
  status: number;
};
type Control = {
  reset?: boolean;
  rules?: FixtureRule[];
  matchingVersion?: number;
  update?: Partial<OwnerRequest> & { id: string };
};
async function readBody(
  req: IncomingMessage,
): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {};
}
export async function startLearningRequestsFixture({
  port = 0,
  now = Date.now,
}: { port?: number; now?: () => number } = {}) {
  let data = createFixtureData(now());
  let rules: FixtureRule[] = [];
  let matchingVersion = 1;
  let nextId = 1_000;
  const events: Event[] = [];
  const server = createServer((req, res) => {
    void handle(req, res).catch(() => {
      if (!res.headersSent && !res.destroyed) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            success: false,
            message: "INVALID_FIXTURE_INPUT",
            statusCode: 400,
          }),
        );
      }
    });
  });
  const ownerRead = (entry: FixtureRequest) => ({
    ...entry.request,
    effectiveStatus:
      ["OPEN", "PENDING_MODERATION"].includes(entry.request.status) &&
      entry.request.expiresAt &&
      Date.parse(entry.request.expiresAt) <= now()
        ? "EXPIRED"
        : entry.request.status,
  });
  async function handle(req: IncomingMessage, res: ServerResponse) {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const path = url.pathname;
    const method = req.method ?? "GET";
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS");
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-store");
    if (method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }
    const user = fixtureUsers.find(
      (item) => req.headers.authorization === `Bearer ${item.token}`,
    );
    const event: Event = {
      method,
      path: `${path}${url.search}`,
      actor: user?.id ?? null,
      status: 0,
    };
    if (!path.startsWith("/__fixture")) events.push(event);
    const send = (status: number, value: unknown, pagination?: object) => {
      event.status = status;
      res.writeHead(status);
      res.end(
        JSON.stringify(
          status >= 400
            ? { success: false, message: value, statusCode: status }
            : {
                success: true,
                data: value,
                ...(pagination ? { meta: { pagination } } : {}),
              },
        ),
      );
    };
    const loseResponse = async (status: number) => {
      // Send response bytes first: a zero-byte socket drop can cause Chromium
      // to replay a POST on a reused connection before the application sees it.
      event.status = -1;
      res.writeHead(status);
      res.write('{"success":true,"data":');
      await delay(50);
      res.destroy();
    };
    if (path === "/__fixture") {
      if (method === "POST") {
        const control = (await readBody(req)) as Control;
        if (control.reset) {
          data = createFixtureData(now());
          rules = [];
          matchingVersion = 1;
          nextId = 1_000;
          events.length = 0;
        }
        if (control.rules) rules = structuredClone(control.rules);
        if (control.matchingVersion) matchingVersion = control.matchingVersion;
        if (control.update) {
          const entry = data.find(
            (item) => item.request.id === control.update!.id,
          );
          if (entry) Object.assign(entry.request, control.update);
        }
      }
      send(200, {
        events,
        matchingVersion,
        requests: data.map((entry) => ({
          actor: entry.actor,
          ...ownerRead(entry),
        })),
      });
      return;
    }
    if (path === "/api/v1/auth/login" || path === "/api/v1/auth/refresh") {
      const body = await readBody(req);
      const login = fixtureUsers.find(
        (item) =>
          item.email === body.email ||
          `refresh-${item.token}` === body.refreshToken,
      );
      if (!login) {
        send(401, "INVALID_CREDENTIALS");
        return;
      }
      send(200, {
        accessToken: login.token,
        refreshToken: `refresh-${login.token}`,
        tokenType: "Bearer",
        expiresIn: 3_600,
        refreshExpiresAt: new Date(now() + 86_400_000).toISOString(),
      });
      return;
    }
    if (path.startsWith("/api/v1/auth/logout")) {
      send(200, {});
      return;
    }
    if (!user) {
      send(401, "UNAUTHENTICATED");
      return;
    }
    if (path === "/api/v1/me") {
      send(200, fixtureIdentity(user));
      return;
    }
    const rule = rules.find(
      (item) =>
        (item.times ?? 1) > 0 &&
        (!item.method || item.method === method) &&
        (!item.path || item.path === path) &&
        (!item.actor || item.actor === user.id) &&
        (item.cursor === undefined ||
          item.cursor === url.searchParams.has("cursor")),
    );
    if (rule) {
      rule.times = (rule.times ?? 1) - 1;
      if (rule.kind === "delay") await delay(rule.delayMs ?? 500);
      if (rule.kind === "network") {
        event.status = -1;
        req.socket.destroy();
        return;
      }
      if (rule.kind === "http") {
        send(rule.status ?? 503, rule.code ?? "DEPENDENCY_UNAVAILABLE");
        return;
      }
    }
    if (path.startsWith("/api/v1/skills")) {
      const id = path.split("/")[4];
      if (id) {
        const skill = fixtureSkills.find((item) => item.id === id);
        send(skill ? 200 : 404, skill ?? "NOT_FOUND");
      } else {
        const q = (url.searchParams.get("q") ?? "").toLocaleLowerCase("vi");
        const items = fixtureSkills.filter((item) =>
          item.name.toLocaleLowerCase("vi").includes(q),
        );
        send(200, items, { limit: 20, hasMore: false, nextCursor: null });
      }
      return;
    }
    const prefix = "/api/v1/learning-requests";
    if (!path.startsWith(prefix)) {
      send(404, "NOT_FOUND");
      return;
    }
    const suffix = path.slice(prefix.length);
    if (method === "GET" && ["", "/mine", "/recommended"].includes(suffix)) {
      const scope = suffix || "/feed";
      const filters = new URLSearchParams(url.searchParams);
      filters.delete("cursor");
      const signature = JSON.stringify([
        scope,
        user.id,
        filters.toString(),
        scope === "/recommended" ? matchingVersion : 0,
      ]);
      let offset = 0;
      const cursor = url.searchParams.get("cursor");
      if (cursor) {
        try {
          const parsed = JSON.parse(
            Buffer.from(cursor, "base64url").toString(),
          );
          if (
            parsed.signature !== signature ||
            !Number.isInteger(parsed.offset)
          )
            throw Error();
          offset = parsed.offset;
        } catch {
          send(400, "INVALID_REQUEST_CURSOR");
          return;
        }
      }
      const keyword = (url.searchParams.get("keyword") ?? "")
        .normalize("NFKC")
        .trim()
        .toLocaleLowerCase("vi");
      if ([...keyword].length > 120) {
        send(400, "INVALID_REQUEST_QUERY");
        return;
      }
      const selected = data
        .filter((entry) => {
          const request = entry.request;
          if (
            scope === "/mine"
              ? entry.actor !== user.id
              : ownerRead(entry).effectiveStatus !== "OPEN"
          )
            return false;
          if (scope === "/recommended" && entry.actor === user.id) return false;
          if (
            url.searchParams.get("status") &&
            ownerRead(entry).effectiveStatus !== url.searchParams.get("status")
          )
            return false;
          if (
            url.searchParams.get("skillId") &&
            request.skillId !== url.searchParams.get("skillId")
          )
            return false;
          return (
            !keyword ||
            [request.title, request.description, request.learningGoal]
              .join(" ")
              .toLocaleLowerCase("vi")
              .includes(keyword)
          );
        })
        .sort(
          (a, b) =>
            b.request.createdAt.localeCompare(a.request.createdAt) ||
            b.request.id.localeCompare(a.request.id),
        );
      const limit = Math.min(
        100,
        Math.max(1, Number(url.searchParams.get("limit") ?? 20)),
      );
      const page = selected.slice(offset, offset + limit);
      const hasMore = offset + limit < selected.length;
      send(
        200,
        page.map((entry) =>
          scope === "/mine"
            ? ownerRead(entry)
            : {
                ...publicFixture(entry),
                ...(scope === "/recommended" ? { matchScore: 0.8 } : {}),
              },
        ),
        {
          limit,
          hasMore,
          nextCursor: hasMore
            ? Buffer.from(
                JSON.stringify({ signature, offset: offset + limit }),
              ).toString("base64url")
            : null,
        },
      );
      return;
    }
    const body = method === "GET" ? {} : await readBody(req);
    if (method === "POST" && !suffix) {
      const request = fixtureRequest(
        {
          ...body,
          id: fixtureId(nextId++),
          status: "DRAFT",
          publishedAt: null,
          expiresAt: null,
          preferredSlots: Array.isArray(body.preferredSlots)
            ? body.preferredSlots
            : [],
          tagIds: [],
          requestedExpiresAt:
            typeof body.expiresAt === "string" ? body.expiresAt : null,
        } as Partial<OwnerRequest>,
        now(),
      );
      data.unshift({ actor: user.id, request });
      if (rule?.kind === "unknown-commit") {
        await loseResponse(201);
        return;
      }
      send(201, request);
      return;
    }
    const [, id, action] = suffix.split("/");
    const entry = data.find((item) => item.request.id === id);
    if (
      !entry ||
      (entry.actor !== user.id &&
        (method !== "GET" || ownerRead(entry).effectiveStatus !== "OPEN"))
    ) {
      send(404, "NOT_FOUND");
      return;
    }
    if (method === "GET") {
      send(
        200,
        entry.actor === user.id ? ownerRead(entry) : publicFixture(entry),
      );
      return;
    }
    if (rule?.kind === "conflict") {
      entry.request.version++;
      entry.request.learningGoal = "Mục tiêu mới từ thiết bị khác";
    }
    if (body.expectedVersion !== entry.request.version) {
      send(409, "REQUEST_VERSION_CONFLICT");
      return;
    }
    if (ownerRead(entry).effectiveStatus === "EXPIRED") {
      send(409, "REQUEST_EXPIRED");
      return;
    }
    if (method === "PATCH") {
      Object.assign(entry.request, body);
      if ("expiresAt" in body)
        entry.request.requestedExpiresAt = body.expiresAt as string | null;
      delete (entry.request as OwnerRequest & { expectedVersion?: number })
        .expectedVersion;
      if (entry.request.status === "REJECTED") entry.request.status = "DRAFT";
      entry.request.moderationRejectReason = null;
      entry.request.moderationStatus = "NOT_REQUIRED";
    } else if (action === "publish") {
      entry.request.status = "OPEN";
      entry.request.moderationStatus = "NOT_REQUIRED";
      entry.request.moderationRejectReason = null;
      entry.request.publishedAt = new Date(now()).toISOString();
      entry.request.expiresAt =
        entry.request.requestedExpiresAt ??
        new Date(now() + 30 * 86_400_000).toISOString();
    } else if (action === "cancel") entry.request.status = "CANCELLED";
    else {
      send(404, "NOT_FOUND");
      return;
    }
    entry.request.version++;
    entry.request.updatedAt = new Date(now()).toISOString();
    if (rule?.kind === "unknown-commit") {
      await loseResponse(200);
      return;
    }
    send(
      200,
      rule?.kind === "wrong-id"
        ? { ...entry.request, id: fixtureId(9_999) }
        : entry.request,
    );
  }
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string")
    throw Error("No fixture address");
  const url = `http://127.0.0.1:${address.port}`;
  return {
    url,
    events,
    control: async (value: Control) => {
      const response = await fetch(`${url}/__fixture`, {
        method: "POST",
        body: JSON.stringify(value),
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) throw Error("Fixture control failed");
    },
    stop: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}
if (process.argv[1]?.endsWith("learning-requests-api.ts")) {
  void startLearningRequestsFixture({
    port: Number(process.env.LR_FIXTURE_PORT ?? 4315),
  }).then((fixture) => {
    console.log(
      `Learning Request TEST fixture: ${fixture.url} (fake accounts only)`,
    );
    const stop = () => void fixture.stop();
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
  });
}
