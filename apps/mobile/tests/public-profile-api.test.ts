import assert from "node:assert/strict";
import test from "node:test";
import { QueryClient } from "@tanstack/react-query";
import { createHttpClient, type HttpClient } from "../src/lib/http/client";
import { AppError } from "../src/lib/http/errors";
import { createPublicProfileApi } from "../src/features/profile/api/public-profile-api";
import { createSkillsApi } from "../src/features/skills/api/skills-api";
import { startLearningRequestsFixture } from "./fixtures/learning-requests-api";
import {
  fixtureUsers,
  fixtureIdentity,
} from "./fixtures/learning-requests-data";

const target = fixtureUsers[1];
const mock = (request: HttpClient["request"]): HttpClient => ({
  ...createHttpClient(() => "https://fixture.test/api/v1"),
  request,
});

test("public profile validates target and strips private/nested fields", async () => {
  let calls = 0;
  const api = createPublicProfileApi(
    mock(async (path, options) => {
      calls++;
      assert.equal(path, `/profiles/${target.id}`);
      assert.equal(options?.authenticated, true);
      return {
        ...fixtureIdentity(target).profile,
        email: target.email,
        sharingSkills: [{ privateEvidence: "secret" }],
      };
    }),
  );
  await assert.rejects(api.get("demo-mentor-an"), AppError);
  assert.equal(calls, 0);
  const profile = await api.get(target.id);
  assert.equal(profile?.fullName, target.name);
  assert.equal(profile?.userId, target.id);
  assert.equal("email" in profile!, false);
  assert.equal("timezone" in profile!, false);
  assert.equal("locale" in profile!, false);
  assert.deepEqual(profile?.sharingSkills, []);
});

test("wrong target, malformed counts and malformed projection are protocol errors", async () => {
  for (const value of [
    fixtureIdentity(fixtureUsers[0]).profile,
    { ...fixtureIdentity(target).profile, verifiedSkillCount: -1 },
    { ...fixtureIdentity(target).profile, bio: null },
  ]) {
    const api = createPublicProfileApi(mock(async () => value));
    await assert.rejects(
      api.get(target.id),
      (error) => error instanceof AppError && error.kind === "protocol",
    );
  }
});

test("stale sessions cannot start or complete a profile read", async () => {
  let current = false,
    calls = 0;
  const api = createPublicProfileApi(
    mock(async () => {
      calls++;
      current = false;
      return fixtureIdentity(target).profile;
    }),
    () => current,
  );
  await assert.rejects(
    api.get(target.id),
    (error) => error instanceof AppError && error.kind === "session",
  );
  assert.equal(calls, 0);
  current = true;
  await assert.rejects(
    api.get(target.id),
    (error) => error instanceof AppError && error.kind === "session",
  );
});

test("real HTTP public profile/skills use target; denial clears cache and 503 cannot restore it", async (t) => {
  const fixture = await startLearningRequestsFixture();
  t.after(() => fixture.stop());
  const http = createHttpClient(() => `${fixture.url}/api/v1`);
  http.bindSession({
    generation: 1,
    getToken: async () => fixtureUsers[0].token,
    renew: async () => {},
    expire: async () => {},
  });
  const api = createPublicProfileApi(http);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  t.after(() => client.clear());
  const options = {
    queryKey: ["public-profile", fixtureUsers[0].id, 1, target.id],
    staleTime: 0,
    queryFn: () => api.get(target.id),
  };
  assert.equal((await client.fetchQuery(options))?.fullName, target.name);
  const skills = await createSkillsApi(http).publicSkills(target.id);
  assert.equal(skills.data.length, 2);
  assert.equal("isVisible" in skills.data[0]!, false);
  for (const status of [404, 403]) {
    await fixture.control({
      rules: [{ path: `/api/v1/profiles/${target.id}`, kind: "http", status }],
    });
    assert.equal(await client.fetchQuery(options), null);
    await fixture.control({
      rules: [
        { path: `/api/v1/profiles/${target.id}`, kind: "http", status: 503 },
      ],
    });
    await assert.rejects(client.fetchQuery(options), AppError);
    assert.equal(client.getQueryData(options.queryKey), null);
    assert.equal((await client.fetchQuery(options))?.userId, target.id);
  }
});
