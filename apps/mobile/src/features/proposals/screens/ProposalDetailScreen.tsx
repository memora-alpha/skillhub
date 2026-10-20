import { useLocalSearchParams } from "expo-router";
import { ApiProposalDetailScreen } from "./ApiProposalDetailScreen";
import { ProposalUnavailable } from "../components/ProposalUnavailable";
import { proposalId } from "../utils/proposal-route";
export function ProposalDetailScreen() {
  const params = useLocalSearchParams();
  const id = proposalId(params.id);
  return id ? (
    <ApiProposalDetailScreen key={id} id={id} />
  ) : (
    <ProposalUnavailable />
  );
}
