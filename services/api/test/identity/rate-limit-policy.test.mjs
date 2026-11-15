import assert from "node:assert/strict";
import test from "node:test";
import {
  requestRateDimensions,
  requestRiskGroup,
} from "../../dist/shared/auth/request-rate-limit.policy.js";

const request = (patch = {}) => ({
  method: "GET",
  originalUrl: "/api/v1/materials",
  url: "/api/v1/materials",
  ip: "203.0.113.10",
  headers: { "user-agent": "Example Browser/1.0" },
  ...patch,
});

test("endpoint groups use bounded risk quotas", () => {
  assert.equal(requestRiskGroup("POST", "/api/v1/auth/login"), "AUTH");
  assert.equal(requestRiskGroup("POST", "/api/v1/payments"), "PAYMENT");
  assert.equal(
    requestRiskGroup("POST", "/api/v1/me/materials/files"),
    "UPLOAD",
  );
  assert.equal(requestRiskGroup("GET", "/api/v1/materials"), "DEFAULT");
});

test("network, session and device dimensions are isolated without raw user agent", () => {
  const token = [
    Buffer.from('{"alg":"HS256"}').toString("base64url"),
    Buffer.from('{"sid":"session-a"}').toString("base64url"),
    "signature",
  ].join(".");
  const result = requestRateDimensions(
    request({
      headers: {
        authorization: `Bearer ${token}`,
        "user-agent": "Secret Browser",
      },
    }),
    { requestLimit: 100, deviceHmacKey: "x".repeat(32) },
  );
  assert.deepEqual(
    result.dimensions.map(({ kind, limit }) => ({ kind, limit })),
    [
      { kind: "network", limit: 1000 },
      { kind: "session", limit: 100 },
      { kind: "device", limit: 200 },
    ],
  );
  const device = result.dimensions.find(({ kind }) => kind === "device")?.value;
  assert.match(device, /^ua:[a-f0-9]{64}$/u);
  assert.ok(!device.includes("Secret Browser"));
});

test("explicit device IDs are bounded visible ASCII", () => {
  const options = { requestLimit: 100, deviceHmacKey: "x".repeat(32) };
  const valid = requestRateDimensions(
    request({ headers: { "x-device-id": "device-123" } }),
    options,
  );
  assert.equal(valid.dimensions.at(-1)?.value, "device-123");
  assert.throws(
    () =>
      requestRateDimensions(
        request({ headers: { "x-device-id": "bad device\n" } }),
        options,
      ),
    /DEVICE_ID_INVALID/,
  );
});
