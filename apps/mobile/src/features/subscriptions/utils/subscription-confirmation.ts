import type {
  Membership,
  Plan,
  SubscriptionCommand,
  SubscriptionUpdate,
} from "../api/subscription-contracts";
import { planPrice } from "./subscription-presentation";

export type SubscriptionConfirmation = {
  title: string;
  description: string;
  expectedSubscriptionId: string | null;
} & (
  | {
      kind: "charge";
      command: SubscriptionCommand;
      expectedVersion: number | null;
    }
  | { kind: "update"; body: SubscriptionUpdate }
);
export function confirmationChanged(
  confirmation: SubscriptionConfirmation | null,
  membership?: Membership,
  plans?: Plan[],
) {
  if (!confirmation || !membership) return !!confirmation;
  const current = membership.subscription;
  if ((current?.id ?? null) !== confirmation.expectedSubscriptionId)
    return true;
  if (confirmation.kind === "update")
    return current?.version !== confirmation.body.expectedVersion;
  if ((current?.version ?? null) !== confirmation.expectedVersion) return true;
  const { command } = confirmation;
  const plan = plans?.find((row) => row.planCode === command.body.planCode);
  if (!plan || plan.planVersionId !== command.body.expectedPlanVersionId)
    return true;
  return (
    command.kind === "purchase" &&
    planPrice(plan, command.body.interval) !== command.amount
  );
}
