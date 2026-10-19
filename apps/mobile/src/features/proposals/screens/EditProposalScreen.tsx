import { useLocalSearchParams } from "expo-router";
import { ApiEditProposalScreen } from "./ApiEditProposalScreen";
import { ProposalUnavailable } from "../components/ProposalUnavailable";
import { proposalId } from "../utils/proposal-route";
export function EditProposalScreen() {
  const params = useLocalSearchParams();
  const id = proposalId(params.id);
  return id ? (
    <ApiEditProposalScreen key={id} id={id} />
  ) : (
    <ProposalUnavailable />
  );
}
