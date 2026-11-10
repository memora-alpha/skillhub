import { useState } from "react";
import { Button } from "@/components/Button";
import { ChoiceGroup } from "@/components/choice-group";
import {
  FeaturePage,
  Panel,
  Copy,
  RouteButton,
} from "@/components/feature-page";
import { ConnectionFeedback, useConnections } from "@/features/connections";
import {
  tagRequestLabels,
  tagRequestStatuses,
  type TagRequestStatus,
} from "../api/tag-requests-api";
import { TagRequestContent } from "../components/tag-request-content";
import { TagRequestForm } from "../components/tag-request-form";
import { useTagRequests } from "../hooks/use-tag-requests";

export function TagRequestsScreen() {
  const runtime = useConnections();
  return <TagRequestsContent key={runtime.key.join(":")} />;
}
function TagRequestsContent() {
  const [status, setStatus] = useState<TagRequestStatus>();
  const query = useTagRequests(status);
  return (
    <FeaturePage
      title="Đề xuất tag của tôi"
      back="/my-skills"
      demo={false}
      refreshing={query.isRefetching && !query.isFetchingNextPage}
      onRefresh={() => void query.refetch()}
    >
      <TagRequestForm disabled={!!query.denied} />
      <ChoiceGroup
        label="Trạng thái đề xuất"
        options={[
          "Tất cả",
          ...tagRequestStatuses.map((value) => tagRequestLabels[value]),
        ]}
        value={status ? tagRequestLabels[status] : "Tất cả"}
        onChange={(label) =>
          setStatus(
            tagRequestStatuses.find(
              (value) => tagRequestLabels[value] === label,
            ),
          )
        }
      />
      <Button
        variant="paper"
        disabled={query.isFetching}
        onPress={() => void query.refetch()}
      >
        Tải lại trạng thái duyệt
      </Button>
      <ConnectionFeedback
        loading={query.isLoading}
        error={query.error}
        retry={query.refetch}
      />
      {query.data && !query.items.length && !query.error && (
        <Copy>Chưa có đề xuất trong mục này.</Copy>
      )}
      {query.items.map((row) => (
        <Panel key={row.id} title={row.label}>
          <TagRequestContent request={row} />
          <RouteButton
            secondary
            href={{ pathname: "/tag-requests/[id]", params: { id: row.id } }}
          >
            Chi tiết đề xuất
          </RouteButton>
        </Panel>
      ))}
      {query.hasNextPage && !query.denied && (
        <Button
          variant="paper"
          disabled={query.isFetching}
          onPress={() => void query.fetchNextPage()}
        >
          {query.isFetchingNextPage ? "Đang tải…" : "Xem thêm đề xuất"}
        </Button>
      )}
    </FeaturePage>
  );
}
