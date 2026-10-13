import axios, { type InternalAxiosRequestConfig } from "axios";
import { createHttpClient } from "../src/lib/http/client";
import { createSkillsApi } from "../src/features/skills/api/skills-api";
export const ids = {
  user: "10000000-0000-4000-8000-000000000001",
  skill: "10000000-0000-4000-8000-000000000002",
  sharing: "10000000-0000-4000-8000-000000000003",
  other: "10000000-0000-4000-8000-000000000004",
  verification: "10000000-0000-4000-8000-000000000005",
  file: "10000000-0000-4000-8000-000000000006",
};
export const catalog = {
  id: ids.skill,
  name: "React",
  status: "ACTIVE",
  description: null,
};
export const ownSkill = {
  id: ids.sharing,
  skill: catalog,
  level: "BEGINNER",
  description: "Hướng dẫn React cơ bản và thực hành UI.",
  experienceYears: "0.0",
  verificationStatus: "UNVERIFIED",
  isVisible: false,
  archivedAt: null,
  version: 1,
  latestVerification: null,
};
export const batch = {
  id: ids.verification,
  sharingSkillId: ids.sharing,
  status: "PENDING",
  version: 1,
  submittedAt: "2026-10-09T00:00:00.000Z",
  reviewedAt: null,
  rejectReason: null,
  note: null,
  files: [],
};
export const success = (data: unknown) => ({
  success: true,
  message: "ok",
  data,
});
export const paginated = (
  data: unknown[],
  nextCursor: string | null = null,
) => ({
  ...success(data),
  meta: { pagination: { limit: 20, hasMore: nextCursor !== null, nextCursor } },
});
export function harness(
  handle: (
    config: InternalAxiosRequestConfig,
    index: number,
  ) =>
    | { status?: number; payload: unknown }
    | Promise<{ status?: number; payload: unknown }>,
) {
  const calls: InternalAxiosRequestConfig[] = [];
  let generation = 1;
  let renewals = 0;
  const http = axios.create({
    adapter: async (config) => {
      calls.push(config);
      const result = await handle(config, calls.length);
      return {
        config,
        data: result.payload,
        status: result.status ?? 200,
        statusText: "",
        headers: {},
      };
    },
  });
  const client = createHttpClient(
    () => "https://skills.example.test/api/v1",
    http,
  );
  client.bindSession({
    get generation() {
      return generation;
    },
    getToken: () => Promise.resolve("test-session"),
    renew: () => {
      renewals++;
      return Promise.resolve();
    },
    expire: () => {
      generation++;
      return Promise.resolve();
    },
  });
  return {
    api: createSkillsApi(client),
    client,
    calls,
    get renewals() {
      return renewals;
    },
    switchAccount: () => {
      generation++;
    },
  };
}
