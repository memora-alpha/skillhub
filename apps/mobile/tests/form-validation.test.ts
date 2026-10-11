import assert from "node:assert/strict";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { createFormControl } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  forgotPasswordSchema,
  registerSchema,
} from "../src/features/auth/schemas/auth-schemas";
import { formValidationOptions } from "../src/utils/form-validation";

test("validates email on first blur, then clears the error when corrected", async () => {
  const form = createFormControl({
    ...formValidationOptions,
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });
  const unsubscribe = form.subscribe({
    formState: { errors: true, touchedFields: true },
    callback: () => {},
  });
  try {
    const field = form.register("email");
    await field.onChange({
      target: { name: "email", value: "invalid" },
      type: "change",
    });
    assert.equal(form.getFieldState("email").error, undefined);
    await field.onBlur({
      target: { name: "email", value: "invalid" },
      type: "blur",
    });
    await delay(formValidationOptions.delayError + 30);
    assert.ok(form.getFieldState("email").error);
    await field.onChange({
      target: { name: "email", value: "user@example.com" },
      type: "change",
    });
    assert.equal(form.getFieldState("email").error, undefined);
  } finally {
    unsubscribe();
  }
});

test("submitting untouched empty email still blocks the API action", async () => {
  const form = createFormControl({
    ...formValidationOptions,
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });
  form.register("email");
  let submitted = false;
  await form.handleSubmit(() => {
    submitted = true;
  })();
  assert.equal(submitted, false);
  assert.ok(form.getFieldState("email").error);
});

test("changing a password can revalidate an already-touched confirmation", async () => {
  const form = createFormControl({
    ...formValidationOptions,
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: "Lan Anh",
      email: "user@example.com",
      password: "Password1!",
      confirmPassword: "Password1!",
      agreeTerms: true,
    },
  });
  const confirmation = form.register("confirmPassword");
  await confirmation.onBlur({
    target: { name: "confirmPassword", value: "Password1!" },
    type: "blur",
  });
  assert.equal(form.getFieldState("confirmPassword").isTouched, true);
  form.setValue("password", "Different1!");
  assert.equal(await form.trigger("confirmPassword"), false);
  assert.ok(form.getFieldState("confirmPassword").error);
});
