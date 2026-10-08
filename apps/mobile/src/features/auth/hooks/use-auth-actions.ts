import { useMutation } from "@tanstack/react-query";
import { useAuthSession } from "../context/AuthSession";
import type { RegisterInput, ResetInput } from "../api/auth-contracts";

export function useAuthActions() {
  const { runtime } = useAuthSession();
  const login = useMutation({ mutationFn: runtime.controller.login });
  const register = useMutation({
    mutationFn: (input: RegisterInput) => runtime.api.register(input),
  });
  const verify = useMutation({
    mutationFn: ({ email, otpCode }: { email: string; otpCode: string }) =>
      runtime.api.verify(email, otpCode),
  });
  const resend = useMutation({
    mutationFn: (email: string) => runtime.api.resend(email),
  });
  const forgot = useMutation({
    mutationFn: (email: string) => runtime.api.forgot(email),
  });
  const reset = useMutation({
    mutationFn: (input: ResetInput) => runtime.api.reset(input),
  });
  return { login, register, verify, resend, forgot, reset };
}
