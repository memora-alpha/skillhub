import { FlowRedirect } from "@/components/learning-flow";
export function ApiCloseProposalScreen({
  id,
  action,
}: Readonly<{ id: string; action?: string }>) {
  return (
    <FlowRedirect
      href={{
        pathname: "/proposal/[id]",
        params: {
          id,
          closeAction: action === "reject" ? "reject" : "withdraw",
        },
      }}
    />
  );
}
