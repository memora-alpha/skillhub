import assert from "node:assert/strict";
import test from "node:test";
import { createPasswordRecoveryStore } from "../src/features/auth/utils/password-recovery-flow";
import {
  newPasswordSchema,
  resetPasswordSchema,
} from "../src/features/auth/schemas/auth-schemas";

test("recovery starts with normalized email and no verification proof", () => {
  const store = createPasswordRecoveryStore();
  assert.equal(store.getState().begin(" USER@EXAMPLE.COM "), true);
  assert.deepEqual(store.getState().draft, {
    email: "user@example.com",
    otpCode: null,
  });
});

test("entering code requires a recovery draft and exactly six digits", () => {
  const store = createPasswordRecoveryStore();
  assert.equal(store.getState().setCode("123456"), false);
  store.getState().begin("user@example.com");
  for (const code of ["", "12345", "1234567", "abcdef", "123 45"])
    assert.equal(store.getState().setCode(code), false);
  assert.equal(store.getState().setCode("123456"), true);
  assert.equal(store.getState().draft?.otpCode, "123456");
  assert.equal("verified" in (store.getState().draft ?? {}), false);
});

test("new recovery request discards the previous code", () => {
  const store = createPasswordRecoveryStore();
  store.getState().begin("user@example.com");
  store.getState().setCode("123456");
  store.getState().begin("other@example.com");
  assert.deepEqual(store.getState().draft, {
    email: "other@example.com",
    otpCode: null,
  });
  assert.equal(store.getState().begin("bad-email"), false);
  assert.equal(store.getState().draft, null);
});

test("invalid code or resend clears only code; leaving clears the draft", () => {
  const store = createPasswordRecoveryStore();
  store.getState().begin("user@example.com");
  store.getState().setCode("123456");
  store.getState().clearCode();
  assert.deepEqual(store.getState().draft, {
    email: "user@example.com",
    otpCode: null,
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
      otpCode: "123456",
    }).success,
    true,
  );
});
