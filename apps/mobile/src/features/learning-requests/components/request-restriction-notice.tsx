import { ReputationPolicyGate } from "@/features/community/policy";
import { requestError } from "../utils/request-policy";

export function RequestRestrictionNotice({
  error,
  pending,
}: Readonly<{ error: unknown; pending: boolean }>) {
  return (
    <ReputationPolicyGate
      message={requestError(error, true)}
      pending={pending}
    />
  );
}
