import assert from "node:assert/strict";
import test from "node:test";
import { createPasswordRecoveryStore } from "../src/features/auth/utils/password-recovery-flow";
import {
  newPasswordSchema,
  resetPasswordSchema,
} from "../src/features/auth/schemas/auth-schemas";

const proof = () => ({
  resetToken: "a".repeat(43),
  expiresAt: new Date(Date.now() + 300_000).toISOString(),
});

test("recovery starts with normalized email and no verification proof", () => {
  const store = createPasswordRecoveryStore();
  assert.equal(store.getState().begin(" USER@EXAMPLE.COM "), true);
  assert.deepEqual(store.getState().draft, {
    email: "user@example.com",
    proof: null,
  });
});

test("reset authorization requires an existing draft, matching email and valid unexpired token", () => {
  const store = createPasswordRecoveryStore();
  assert.equal(store.getState().authorize("user@example.com", proof()), false);
  store.getState().begin("user@example.com");
  assert.equal(store.getState().authorize("other@example.com", proof()), false);
  for (const resetToken of ["", "000012", "a".repeat(42), "!".repeat(43)])
    assert.equal(
      store
        .getState()
        .authorize("user@example.com", { ...proof(), resetToken }),
      false,
    );
  for (const expiresAt of [
    "invalid",
    new Date(Date.now() - 1000).toISOString(),
  ])
    assert.equal(
      store.getState().authorize("user@example.com", { ...proof(), expiresAt }),
      false,
    );
  assert.equal(store.getState().draft?.proof, null);
  const issued = proof();
  assert.equal(store.getState().authorize(" USER@EXAMPLE.COM ", issued), true);
  assert.deepEqual(store.getState().draft?.proof, issued);
  assert.equal("otpCode" in (store.getState().draft ?? {}), false);
});

test("new recovery request discards the previous reset token", () => {
  const store = createPasswordRecoveryStore();
  store.getState().begin("user@example.com");
  store.getState().authorize("user@example.com", proof());
  store.getState().begin("other@example.com");
  assert.deepEqual(store.getState().draft, {
    email: "other@example.com",
    proof: null,
  });
  assert.equal(store.getState().begin("bad-email"), false);
  assert.equal(store.getState().draft, null);
});

test("resend or invalid reset token preserves email; leaving clears the proof", () => {
  const store = createPasswordRecoveryStore();
  store.getState().begin("user@example.com");
  store.getState().authorize("user@example.com", proof());
  store.getState().clearProof();
  assert.deepEqual(store.getState().draft, {
    email: "user@example.com",
    proof: null,
  });
  store.getState().clear();
  assert.equal(store.getState().draft, null);
});

test("new-password form preserves password and confirmation policies", () => {
  const valid = { newPassword: "Password1!", confirmNewPassword: "Password1!" };
  assert.equal(newPasswordSchema.safeParse(valid).success, true);
  assert.equal(
    newPasswordSchema.safeParse({ ...valid, confirmNewPassword: "Different1!" })
      .success,
    false,
  );
  assert.equal(
    newPasswordSchema.safeParse({
      newPassword: "short",
      confirmNewPassword: "short",
    }).success,
    false,
  );
  assert.equal(
    resetPasswordSchema.safeParse({
      ...valid,
      email: "user@example.com",
      resetToken: proof().resetToken,
    }).success,
    true,
  );
  assert.equal(
    resetPasswordSchema.safeParse({
      ...valid,
      email: "user@example.com",
      otpCode: "000012",
    }).success,
    false,
  );
});
