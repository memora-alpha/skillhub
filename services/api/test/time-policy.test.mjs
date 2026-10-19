import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { test } from "node:test";
import {
  isAtLeastMinutesBefore,
  parseAbsoluteTimestamp,
  validateTimeZone,
} from "../dist/shared/time/timestamp.policy.js";

test("absolute timestamps preserve an instant across offsets", () => {
  assert.equal(
    parseAbsoluteTimestamp("2026-10-05T09:30:00+07:00").toISOString(),
    "2026-10-05T02:30:00.000Z",
  );
  assert.equal(
    parseAbsoluteTimestamp("2026-10-05T02:30:00Z").getTime(),
    parseAbsoluteTimestamp("2026-10-05T09:30:00+07:00").getTime(),
  );
});

test("rejects local, normalized, ambiguous and excessive precision times", () => {
  for (const input of [
    "2026-10-05T09:30:00",
    "2026-02-30T12:00:00Z",
    "2026-10-05T24:00:00Z",
    "2026-10-05T09:30:60Z",
    "2026-10-05T09:30:00+25:00",
    "2026-10-05T09:30:00.1234Z",
    "2026-10-05",
  ]) {
    assert.throws(() => parseAbsoluteTimestamp(input), TypeError, input);
  }
});

test("validates IANA zones and 60-minute cutoff at millisecond boundary", () => {
  assert.equal(validateTimeZone("Asia/Ho_Chi_Minh"), "Asia/Ho_Chi_Minh");
  assert.throws(() => validateTimeZone("Invalid/Mars"), TypeError);
  const start = parseAbsoluteTimestamp("2026-10-05T10:00:00Z");
  assert.equal(
    isAtLeastMinutesBefore(start, new Date("2026-10-05T09:00:00Z"), 60),
    true,
  );
  assert.equal(
    isAtLeastMinutesBefore(start, new Date("2026-10-05T09:00:00.001Z"), 60),
    false,
  );
});

test("timestamp parsing is independent of process timezone", () => {
  const code =
    'const {parseAbsoluteTimestamp}=require("./dist/shared/time/timestamp.policy.js");process.stdout.write(parseAbsoluteTimestamp("2026-10-05T09:30:00+07:00").toISOString())';
  for (const tz of ["UTC", "Asia/Ho_Chi_Minh", "America/New_York"]) {
    assert.equal(
      execFileSync(process.execPath, ["-e", code], {
        cwd: process.cwd(),
        env: { ...process.env, TZ: tz },
        encoding: "utf8",
      }),
      "2026-10-05T02:30:00.000Z",
    );
  }
});
