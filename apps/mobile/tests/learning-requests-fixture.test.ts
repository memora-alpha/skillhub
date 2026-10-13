import assert from "node:assert/strict";
import test from "node:test";
import { startLearningRequestsFixture } from "./fixtures/learning-requests-api";
import { fixtureId, fixtureUsers } from "./fixtures/learning-requests-data";

test("fixture routing preserves authentication, public projections and unknown-route envelopes", async (t) => {
  const fixture = await startLearningRequestsFixture();
  t.after(() => fixture.stop());
  const request = (path: string, options?: RequestInit) =>
    fetch(`${fixture.url}/api/v1${path}`, options);
  const preflight = await request("/unknown", { method: "OPTIONS" });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get("Access-Control-Allow-Origin"), "*");
  const unauthorized = await request("/skills");
  assert.equal(unauthorized.status, 401);
  assert.equal((await unauthorized.json()).message, "UNAUTHENTICATED");
  const post = (path: string, body: object) =>
    request(path, { method: "POST", body: JSON.stringify(body) });
  assert.equal(
    (await post("/auth/login", { email: "unknown@example.test" })).status,
    401,
  );
  const login = await post("/auth/login", { email: fixtureUsers[0].email });
  assert.equal(login.status, 200);
  const tokens = (await login.json()).data;
  assert.equal(tokens.accessToken, fixtureUsers[0].token);
  const refresh = await post("/auth/refresh", {
    refreshToken: tokens.refreshToken,
  });
  assert.equal((await refresh.json()).data.accessToken, tokens.accessToken);
  const authenticated = (path: string) =>
    request(path, {
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
    });
  const missing = await authenticated("/unknown");
  assert.equal(missing.status, 404);
  assert.deepEqual(await missing.json(), {
    success: false,
    message: "NOT_FOUND",
    statusCode: 404,
  });
  assert.equal((await authenticated(`/skills/${fixtureId(9999)}`)).status, 404);
  const profile = await authenticated(`/profiles/${fixtureUsers[1].id}`);
  assert.equal((await profile.json()).data.userId, fixtureUsers[1].id);
  const skills = await authenticated(`/profiles/${fixtureUsers[1].id}/skills`);
  const publicSkills = await skills.json();
  assert.equal(publicSkills.data.length, 2);
  assert.equal(publicSkills.meta.pagination.hasMore, false);
  assert.equal((await post("/auth/logout", {})).status, 200);
  const event = fixture.events.find(
    (item) => item.path === "/api/v1/unknown" && item.status === 404,
  );
  assert.equal(event?.actor, fixtureUsers[0].id);
});
