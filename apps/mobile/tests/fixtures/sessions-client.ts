import axios from "axios";
import {
  createHttpClient,
  type RequestOptions,
} from "../../src/lib/http/client";
import { AppError } from "../../src/lib/http/errors";
import { createSessionsApi } from "../../src/features/sessions/api/sessions-api";

export const teacherId = "10000000-0000-4000-8000-000000000001";
export const learnerId = "10000000-0000-4000-8000-000000000002";
export const sessionId = "20000000-0000-4000-8000-000000000001";
export const now = Date.parse("2026-10-14T06:00:00Z");
type FixtureHandler = (
  path: string,
  method: string,
  body: unknown,
) => Promise<unknown>;
export const sessionRecord = () => ({
  id: sessionId,
  pathId: "30000000-0000-4000-8000-000000000001",
  planId: "40000000-0000-4000-8000-000000000001",
  teacherId,
  learnerId,
  startAt: "2026-10-14T02:00:00Z",
  endAt: "2026-10-14T03:00:00Z",
  status: "CONFIRMED",
  teacherConfirmationStatus: null as string | null,
  learnerConfirmationStatus: null as string | null,
  role: "TEACHER",
});

export function sessionsFixture() {
  let generation = 1;
  let token = "fixture-access";
  const calls: { path: string; method: string; body: unknown }[] = [];
  const handler: FixtureHandler = (path, method) => {
    if (method === "GET")
      return Promise.resolve(
        path.startsWith("/sessions/mine") ? [fixture.record] : fixture.record,
      );
    fixture.record = {
      ...fixture.record,
      teacherConfirmationStatus: "CONFIRMED",
      status:
        fixture.record.learnerConfirmationStatus === "CONFIRMED"
          ? "COMPLETED"
          : "AWAITING_CONFIRMATION",
    };
    return Promise.resolve({ id: sessionId, status: fixture.record.status });
  };
  const fixture = {
    record: sessionRecord(),
    calls,
    get generation() {
      return generation;
    },
    changeAccount() {
      generation++;
    },
    handler,
  };
  const client = createHttpClient(
    () => "https://fixture.invalid/api/v1",
    axios.create({
      adapter: async (config) => {
        const path = config.url!;
        const method = String(config.method).toUpperCase();
        const body = config.data ? JSON.parse(config.data) : undefined;
        calls.push({ path, method, body });
        const data = await fixture.handler(path, method, body);
        return {
          config,
          status: 200,
          statusText: "OK",
          headers: {},
          data: { success: true, data },
        };
      },
    }),
  );
  client.bindSession({
    get generation() {
      return generation;
    },
    getToken: () => Promise.resolve(token),
    renew: () => {
      token = "fixture-renewed";
      return Promise.resolve();
    },
    expire: () => {
      generation++;
      return Promise.resolve();
    },
  });
  const initial = generation;
  return {
    ...fixture,
    get generation() {
      return generation;
    },
    get record() {
      return fixture.record;
    },
    set record(value) {
      fixture.record = value;
    },
    get handler() {
      return fixture.handler;
    },
    set handler(value) {
      fixture.handler = value;
    },
    api: createSessionsApi(client, teacherId, () => generation === initial),
    request: (path: string, options: RequestOptions) =>
      client.request(path, options),
  };
}

export const httpError = (status: number) => new AppError("http", status);
