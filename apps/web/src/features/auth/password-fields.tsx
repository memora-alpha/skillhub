"use client";
import { useState } from "react";
import { passwordRequirements } from "./password-policy";
import { PasswordInput } from "@/components/password-input";
export function PasswordFields({
  registering,
  pending,
}: Readonly<{ registering: boolean; pending: boolean }>) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const prefix = registering ? "account" : "new";
  const rules = passwordRequirements(password);
  return (
    <>
      <label htmlFor={prefix + "-password"}>
        {registering ? "Mật khẩu" : "Mật khẩu mới"}
      </label>
      <PasswordInput
        id={prefix + "-password"}
        name={registering ? "password" : "newPassword"}
        visibilityLabel={registering ? "mật khẩu" : "mật khẩu mới"}
        autoComplete="new-password"
        minLength={8}
        maxLength={64}
        required
        disabled={pending}
        value={password}
        aria-describedby={prefix + "-rules"}
        onChange={(event) => setPassword(event.target.value)}
      />
      <ul
        id={prefix + "-rules"}
        className="auth-password-rules"
        aria-label="Yêu cầu mật khẩu"
      >
        {rules.map((rule) => (
          <li key={rule.label} data-met={rule.met}>
            <span aria-hidden="true">{rule.met ? "✓" : "○"}</span>
            <span className="sr-only">{rule.met ? "Đạt: " : "Chưa đạt: "}</span>
            {rule.label}
          </li>
        ))}
      </ul>
      <label htmlFor={prefix + "-confirm"}>
        {registering ? "Nhập lại mật khẩu" : "Nhập lại mật khẩu mới"}
      </label>
      <PasswordInput
        id={prefix + "-confirm"}
        name={registering ? "confirmPassword" : "confirmNewPassword"}
        visibilityLabel="mật khẩu nhập lại"
        autoComplete="new-password"
        minLength={8}
        maxLength={64}
        required
        disabled={pending}
        value={confirmation}
        aria-describedby={confirmation ? prefix + "-match" : undefined}
        onChange={(event) => setConfirmation(event.target.value)}
      />
      {confirmation && (
        <p
          id={prefix + "-match"}
          className="auth-password-match"
          data-met={confirmation === password}
        >
          {confirmation === password
            ? "✓ Mật khẩu nhập lại đã khớp."
            : "Mật khẩu nhập lại chưa khớp."}
        </p>
      )}
    </>
  );
}
