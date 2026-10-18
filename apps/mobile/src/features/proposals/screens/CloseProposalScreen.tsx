import { useLocalSearchParams } from "expo-router";
import { ApiCloseProposalScreen } from "./ApiCloseProposalScreen";
import { ProposalUnavailable } from "../components/ProposalUnavailable";
import { proposalId } from "../utils/proposal-route";
export function CloseProposalScreen() {
  const params = useLocalSearchParams();
  const id = proposalId(params.id),
    action = params.action;
  return id && (action === "reject" || action === "withdraw") ? (
    <ApiCloseProposalScreen key={`${id}:${action}`} id={id} action={action} />
  ) : (
    <ProposalUnavailable />
  );
}
