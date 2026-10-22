import { Copy, RouteButton } from "@/components/feature-page";
import { FlowSection as Panel } from "@/components/learning-flow";
import { useConnections } from "@/features/connections";
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
  return (
    <Panel title={progress.title.replace(/^Bước \d+ · /, "")} accent>
      {progress.waiting.map((message) => (
        <Copy key={message}>{message}</Copy>
      ))}
      {!blocked && progress.action && progress.action.href !== current && (
        <RouteButton href={progress.action.href}>
          {progress.action.label}
        </RouteButton>
      )}
    </Panel>
  );
}
