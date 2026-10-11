import { useMutation } from "@tanstack/react-query";
import { useAuthSession } from "../context/AuthSession";
import type { RegisterInput, ResetInput } from "../api/auth-contracts";
import { useToast } from "@/providers/ToastProvider";
import { errorMessage } from "@/lib/http/errors";
import {
  OTP_REQUEST_ACKNOWLEDGMENT,
  isResetOutcomeUncertain,
  RESET_UNCERTAIN_GUIDANCE,
} from "../utils/otp-feedback";
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
      showToast(OTP_REQUEST_ACKNOWLEDGMENT, "success");
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
    mutationFn: (input: ResetInput) => runtime.controller.resetPassword(input),
    onError: (error) =>
      showToast(
        isResetOutcomeUncertain(error)
          ? RESET_UNCERTAIN_GUIDANCE
          : errorMessage(error),
        "error",
      ),
  });
  const verifyRecovery = useMutation({
    ...feedback,
    mutationFn: ({ email, otpCode }: { email: string; otpCode: string }) =>
      runtime.api.verifyRecovery(email, otpCode),
  });
  const logoutAll = useMutation({
    ...feedback,
    mutationFn: runtime.controller.signOutAll,
    retry: false,
  });
  return {
    login,
    register,
    verify,
    resend,
    forgot,
    verifyRecovery,
    reset,
    logoutAll,
  };
}
