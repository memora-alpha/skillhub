import assert from "node:assert/strict";
import test from "node:test";
import {
  createVerificationCooldownStore,
  remainingCooldownSeconds,
} from "../src/features/auth/utils/verification-cooldown";

test("resend is available exactly after 60 seconds", () => {
  const store = createVerificationCooldownStore();
  assert.equal(store.getState().reserve("user@example.com", 1000), true);
  assert.equal(store.getState().reserve("user@example.com", 1000), false);
  assert.equal(store.getState().reserve("user@example.com", 60999), false);
  assert.equal(store.getState().reserve("user@example.com", 61000), true);
});

test("cooldown survives reading the store again and normalizes email", () => {
  const store = createVerificationCooldownStore();
  store.getState().start(" USER@EXAMPLE.COM ", 1000);
  assert.equal(store.getState().reserve("user@example.com", 2000), false);
  assert.equal(store.getState().reserve("other@example.com", 2000), true);
  assert.equal(store.getState().deadlines["user@example.com"], 61000);
});

test("acknowledgment extends the cooldown instead of shortening it", () => {
  const store = createVerificationCooldownStore();
  store.getState().start("user@example.com", 1000);
  store.getState().start("user@example.com", 3000);
  store.getState().start("user@example.com", 2000);
  assert.equal(store.getState().deadlines["user@example.com"], 63000);
});

test("countdown uses elapsed time and never displays a negative value", () => {
  assert.equal(remainingCooldownSeconds(61000, 1000), 60);
  assert.equal(remainingCooldownSeconds(61000, 60999), 1);
  assert.equal(remainingCooldownSeconds(61000, 61000), 0);
  assert.equal(remainingCooldownSeconds(61000, 200000), 0);
});

test("registration and recovery cooldowns do not block each other", () => {
  const registration = createVerificationCooldownStore();
  const recovery = createVerificationCooldownStore();
  registration.getState().start("user@example.com", 1000);
  assert.equal(recovery.getState().reserve("user@example.com", 1000), true);
  assert.equal(
    registration.getState().reserve("user@example.com", 2000),
    false,
  );
  assert.equal(recovery.getState().reserve("user@example.com", 2000), false);
});
