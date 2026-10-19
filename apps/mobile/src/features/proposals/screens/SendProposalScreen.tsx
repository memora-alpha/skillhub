import { useLocalSearchParams } from "expo-router";
import { ApiSendProposalScreen } from "./ApiSendProposalScreen";
import { ProposalUnavailable } from "../components/ProposalUnavailable";
import { proposalSource } from "../utils/proposal-route";
export function SendProposalScreen() {
  const params = useLocalSearchParams();
  const source = proposalSource(params);
  return source ? (
    <ApiSendProposalScreen key={JSON.stringify(source)} {...source} />
  ) : (
    <ProposalUnavailable />
  );
}
