// Loopback-only fixture for wallet-http.md at 17e3ac1. No Payment endpoints.
// Opaque fixture cursors simulate scope/watermark; they do not prove BE signing.
import { createServer } from "node:http";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import {
  walletModels,
  walletOwners,
  ledgerModel,
  ledgerTypes,
  referenceTypes,
} from "./wallet-model";

type Actor = keyof typeof walletOwners;
type Boundary = {
  owner: Actor;
  type: string | null;
  referenceType: string | null;
  watermark: number;
  before: number;
};
function validHistoryQuery(
  query: URLSearchParams,
  limit: number,
  type: string | null,
  referenceType: string | null,
) {
  return (
    ![...query.keys()].some(
      (key) => !["limit", "cursor", "type", "referenceType"].includes(key),
    ) &&
    Number.isInteger(limit) &&
    limit >= 1 &&
    limit <= 100 &&
    (!type || ledgerTypes.some((code) => code === type)) &&
    (!referenceType || referenceTypes.some((code) => code === referenceType))
  );
}

type LedgerEntry = { sequence: number; row: ReturnType<typeof ledgerModel> };
type SendResponse = (
  status: number,
  data: unknown,
  pagination?: object,
) => void;

function sendHistory(
  url: URL,
  actor: Actor,
  owned: LedgerEntry[],
  cursors: Map<string, Boundary>,
  send: SendResponse,
) {
  const query = url.searchParams;
  const limit = Number(query.get("limit") ?? 20);
  const type = query.get("type"),
    referenceType = query.get("referenceType");
  if (!validHistoryQuery(query, limit, type, referenceType))
    return send(400, "INVALID_QUERY");
  const token = query.get("cursor");
  const boundary = token
    ? cursors.get(token)
    : {
        owner: actor,
        type,
        referenceType,
        watermark: owned.at(-1)?.sequence ?? 0,
        before: Infinity,
      };
  if (
    !boundary ||
    boundary.owner !== actor ||
    boundary.type !== type ||
    boundary.referenceType !== referenceType
  )
    return send(400, "INVALID_LEDGER_CURSOR");
  const visible = owned
    .filter(
      (entry) =>
        entry.sequence <= boundary.watermark &&
        entry.sequence < boundary.before &&
        (!type || entry.row.type === type) &&
        (!referenceType || entry.row.referenceType === referenceType),
    )
    .toReversed();
  const page = visible.slice(0, limit),
    hasMore = visible.length > limit;
  const nextCursor = hasMore ? randomUUID() : null;
  if (nextCursor)
    cursors.set(nextCursor, { ...boundary, before: page.at(-1)!.sequence });
  send(
    200,
    page.map((entry) => entry.row),
    { limit, hasMore, nextCursor },
  );
}

export async function startWalletFixture() {
  const rows = Array.from({ length: 220 }, (_, i) => ({
    sequence: i + 1,
    row: ledgerModel(i + 1),
  }));
  const cursors = new Map<string, Boundary>();
  const denied = new Set<Actor>();
  const events: { method: string; path: string; actor?: Actor }[] = [];
  let failure: number | null = null;
  let paused: {
    path: string;
    started: () => void;
    wait: Promise<void>;
  } | null = null;
  const server = createServer((req, res) => {
    void handle().catch(() => {
      if (!res.destroyed) res.writeHead(500).end();
    });
    async function handle() {
      const url = new URL(req.url ?? "/", "http://127.0.0.1");
      const actor = req.headers.authorization?.replace(
        "Bearer fixture-",
        "",
      ) as Actor | undefined;
      events.push({ method: req.method ?? "GET", path: url.pathname, actor });
      const send = (status: number, data: unknown, pagination?: object) => {
        if (res.destroyed) return;
        res.writeHead(status, {
          "Content-Type": "application/json",
          Connection: "close",
        });
        res.end(
          JSON.stringify(
            status >= 400
              ? { success: false, message: data, statusCode: status }
              : {
                  success: true,
                  message: "Operation completed successfully.",
                  data,
                  ...(pagination ? { meta: { pagination } } : {}),
                },
          ),
        );
      };
      if (req.method !== "GET") return send(405, "METHOD_NOT_ALLOWED");
      if (!actor || !Object.hasOwn(walletOwners, actor))
        return send(401, "UNAUTHORIZED");
      if (paused?.path === url.pathname) {
        const gate = paused;
        paused = null;
        gate.started();
        await gate.wait;
      }
      if (failure) {
        const status = failure;
        failure = null;
        return send(status, "SERVICE_UNAVAILABLE");
      }
      if (denied.has(actor)) return send(403, "SKILL_PERMISSION_REQUIRED");
      if (url.pathname === "/api/v1/me/wallet")
        return send(200, walletModels[actor]);
      const prefix = "/api/v1/me/wallet/transactions";
      const owned = actor === "a" ? rows : [];
      if (url.pathname.startsWith(prefix + "/")) {
        const id = url.pathname.slice(prefix.length + 1);
        if (
          !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(id)
        )
          return send(400, "INVALID_ID");
        const row = owned.find((entry) => entry.row.id === id)?.row;
        return row ? send(200, row) : send(404, "CREDIT_TRANSACTION_NOT_FOUND");
      }
      if (url.pathname !== prefix) return send(404, "NOT_FOUND");
      sendHistory(url, actor, owned, cursors, send);
    }
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Loopback fixture did not bind");
  return {
    url: `http://127.0.0.1:${address.port}/api/v1`,
    events,
    deny: (actor: Actor) => denied.add(actor),
    failNext: (status: number) => {
      failure = status;
    },
    append: () => {
      const sequence = rows.length + 1;
      rows.push({ sequence, row: ledgerModel(sequence) });
    },
    deferNext: (path: string) => {
      let release!: () => void, started!: () => void;
      const wait = new Promise<void>((resolve) => {
        release = resolve;
      });
      const began = new Promise<void>((resolve) => {
        started = resolve;
      });
      paused = { path, started, wait };
      return { release, started: began };
    },
    close: async () => {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    },
  };
}
