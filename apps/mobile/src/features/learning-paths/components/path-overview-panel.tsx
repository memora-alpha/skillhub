import { FlowSection } from "@/components/learning-flow";
import { Copy } from "@/components/feature-page";
import type { ApiLearningPath } from "../api/learning-paths-contract";
import { usePathOverview } from "../hooks/use-path-overview";
import { PathReadFeedback } from "./PathReadFeedback";
import {
  PathOverviewSummary,
  hasOverviewSummary,
} from "./path-overview-summary";

export function PathOverviewPanel({
  path,
}: Readonly<{ path: ApiLearningPath }>) {
  const query = usePathOverview(path.id);
  // A denied endpoint must never fall back to an embedded private snapshot.
  const view = query.denied ? undefined : (query.data ?? path.overview);
  if (!view || (!hasOverviewSummary(view) && !view.attentionCount))
    return <PathReadFeedback query={query} />;
  return (
    <FlowSection title="Tình hình học tập">
      <PathReadFeedback query={query} />
      <PathOverviewSummary overview={view} />
      {view.attentionCount > 0 && (
        <Copy muted size="hint">
          {view.attentionCount} việc cần theo dõi
        </Copy>
      )}
    </FlowSection>
  );
}
