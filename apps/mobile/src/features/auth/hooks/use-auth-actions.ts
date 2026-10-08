import { useMutation } from "@tanstack/react-query";
import { useAuthSession } from "../context/AuthSession";
import type { RegisterInput, ResetInput } from "../api/auth-contracts";
import { useToast } from "@/providers/ToastProvider";
import { errorMessage } from "@/lib/http/errors";
import {
  passwordRecoveryCooldownStore,
  verificationCooldownStore,
} from "../utils/verification-cooldown";

export function useAuthActions() {
  const { runtime } = useAuthSession();
  const { showToast, dismissToast } = useToast();
  const feedback = {
    onMutate: () => dismissToast(),
    onError: (error: Error) => showToast(errorMessage(error), "error"),
  };
  const login = useMutation({
    ...feedback,
    mutationFn: runtime.controller.login,
  });
  const register = useMutation({
    ...feedback,
    mutationFn: (input: RegisterInput) => runtime.api.register(input),
    onSuccess: (_data, input) =>
      verificationCooldownStore.getState().start(input.email),
  });
  const verify = useMutation({
    ...feedback,
    mutationFn: ({ email, otpCode }: { email: string; otpCode: string }) =>
      runtime.api.verify(email, otpCode),
  });
  const resend = useMutation({
    ...feedback,
    mutationFn: (email: string) => runtime.api.resend(email),
    onSuccess: (_data, email) => {
      verificationCooldownStore.getState().start(email);
      showToast("Nếu địa chỉ đủ điều kiện, mã mới đã được gửi.", "success");
    },
  });
  const forgot = useMutation({
    ...feedback,
    mutationFn: (email: string) => runtime.api.forgot(email),
    onSuccess: (_data, email) =>
      passwordRecoveryCooldownStore.getState().start(email),
  });
  const reset = useMutation({
    ...feedback,
    mutationFn: (input: ResetInput) => runtime.api.reset(input),
  });
  return { login, register, verify, resend, forgot, reset };
}
