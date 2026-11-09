import { Copy, RouteButton } from "@/components/feature-page";
import { FlowSection as Panel } from "@/components/learning-flow";
import { useConnections } from "@/features/connections";
import { FormNotice } from "@/components/FormNotice";
import type { ApiLearningPath } from "../api/learning-paths-contract";
import { agreementProgress } from "../utils/progression";

export function AgreementProgressPanel({
  path,
  blocked,
  current,
}: Readonly<{
  path: ApiLearningPath;
  blocked: boolean;
  current: string;
}>) {
  const { userId } = useConnections();
  const progress = agreementProgress(path, userId);
  if (progress.stage === "closed")
    return (
      <FormNotice
        tone={path.status === "DISPUTED" ? "warning" : "info"}
        compact
      >
        {progress.description}
      </FormNotice>
    );
  return (
    <Panel title={progress.title.replace(/^Bước \d+ · /, "")} accent>
      {progress.waiting.map((message) => (
        <Copy key={message}>{message}</Copy>
      ))}
      {!progress.waiting.length && <Copy>{progress.description}</Copy>}
      {!blocked && progress.action && progress.action.href !== current && (
        <RouteButton href={progress.action.href}>
          {progress.action.label}
        </RouteButton>
      )}
    </Panel>
  );
}
