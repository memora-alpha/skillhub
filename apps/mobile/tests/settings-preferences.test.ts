import assert from "node:assert/strict";
import test from "node:test";
import { createNotificationPreferencesApi } from "../src/features/settings/api/notification-preferences-api";
import {
  validTimezone,
  timezoneSample,
} from "../src/features/settings/utils/preferences";
import { AppError } from "../src/lib/http/errors";

test("notification preferences read and patch server settings without changing other groups", async () => {
  let stored = { learning: true, credit: true, community: false };
  const controller = new AbortController();
  const api = createNotificationPreferencesApi(async (path, options) => {
    assert.equal(path, "/me/notification-preferences");
    if (options?.method === "PATCH") {
      assert.deepEqual(options.body, { credit: false });
      stored = { ...stored, ...(options.body as Partial<typeof stored>) };
    } else assert.equal(options?.signal, controller.signal);
    return stored;
  });
  assert.deepEqual(await api.read(controller.signal), stored);
  assert.deepEqual(await api.update({ credit: false }), {
    learning: true,
    credit: false,
    community: false,
  });
});

test("malformed preferences never become enabled defaults or a successful save", async () => {
  for (const value of [
    null,
    {},
    { learning: "true", credit: true, community: false },
  ]) {
    const api = createNotificationPreferencesApi(async () => value);
    await assert.rejects(
      api.read(),
      (error) => error instanceof AppError && error.kind === "protocol",
    );
    await assert.rejects(api.update({ learning: false }), AppError);
  }
});

test("timezone supports saved/custom IANA zones and rejects values that would break the sample clock", () => {
  for (const zone of ["Asia/Ho_Chi_Minh", "Australia/Sydney", "UTC"]) {
    assert.equal(validTimezone(zone), true);
    assert.equal(typeof timezoneSample(zone), "string");
  }
  for (const zone of ["", "Mars/Olympus", "+07:00"]) {
    assert.equal(validTimezone(zone), false);
    assert.equal(timezoneSample(zone), null);
  }
});
