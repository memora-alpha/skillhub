import { useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { Badge } from "@/components/Badge";
import { EmptyState } from "@/components/EmptyState";
import { ChoiceGroup } from "@/components/choice-group";
import {
  FeaturePage,
  Panel,
  Copy,
  RouteButton,
} from "@/components/feature-page";
import { ConnectionFeedback } from "@/features/connections";
import { useReport, useReports } from "../hooks/use-reports";
import { uiLabel } from "@/constants/ui-copy";
import { PrivateCaseThread } from "../components/private-case-thread";
const reportFilters = [
  "Tất cả",
  "Đã tiếp nhận",
  "Đang xem xét",
  "Cần bổ sung",
  "Đã giải quyết",
  "Bị từ chối",
];
const reportFilterCodes = [
  "Tất cả",
  "OPEN",
  "UNDER_REVIEW",
  "NEED_MORE_INFO",
  "RESOLVED",
  "REJECTED",
];

export function ReportsScreen() {
  const query = useReports(),
    [filter, setFilter] = useState("Tất cả");
  const items =
    query.data?.filter(
      (row) =>
        filter === "Tất cả" ||
        row.status === reportFilterCodes[reportFilters.indexOf(filter)],
    ) ?? [];
  return (
    <FeaturePage
      demo={false}
      title="Báo cáo của tôi"
      back="/profile"
      refreshing={query.isFetching}
      onRefresh={() => {
        void query.refetch();
      }}
    >
      <ChoiceGroup
        label="Trạng thái"
        options={reportFilters}
        value={filter}
        onChange={setFilter}
      />
      <ConnectionFeedback
        loading={query.isLoading}
        error={query.error}
        retry={query.refetch}
      />
      {items.map((row) => (
        <Panel key={row.id} title={uiLabel(row.reasonCode)}>
          <Badge
            label={row.status === "OPEN" ? "Đã tiếp nhận" : uiLabel(row.status)}
          />
          <Copy>{row.description}</Copy>
          <Copy>
            {row.createdAt
              ? new Date(row.createdAt).toLocaleString("vi-VN")
              : "Chưa ghi nhận thời điểm gửi"}
          </Copy>
          <RouteButton secondary href={`/reports/${row.id}`}>
            Theo dõi báo cáo
          </RouteButton>
        </Panel>
      ))}
      {query.data && !items.length && (
        <EmptyState
          title="Không có báo cáo"
          description="Gửi báo cáo từ chi tiết buổi học hoặc tài liệu liên quan."
        />
      )}
      <RouteButton secondary href="/calendar">
        Chọn buổi học cần báo cáo
      </RouteButton>
    </FeaturePage>
  );
}
export function ReportDetailScreen() {
  const { id, support, pathId } = useLocalSearchParams<{
    id: string;
    support?: string;
    pathId?: string;
  }>();
  if (support === "1")
    return (
      <FeaturePage
        demo={false}
        title="Hỗ trợ vụ việc"
        back={
          typeof pathId === "string" && /^[0-9a-f-]{36}$/i.test(pathId)
            ? `/paths/${pathId}?cases=1`
            : "/reports"
        }
      >
        <PrivateCaseThread
          caseId={typeof id === "string" ? id : ""}
          pathId={typeof pathId === "string" ? pathId : undefined}
        />
      </FeaturePage>
    );
  return <ReportOwnerDetailScreen />;
}
function ReportOwnerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(),
    query = useReport(typeof id === "string" ? id : "");
  const report = query.data;
  return (
    <FeaturePage
      demo={false}
      title="Theo dõi báo cáo"
      back="/reports"
      refreshing={query.isFetching}
      onRefresh={() => {
        void query.refetch();
      }}
    >
      <ConnectionFeedback
        loading={query.isLoading}
        error={query.error}
        retry={query.refetch}
      />
      {report && (
        <>
          <Panel title={uiLabel(report.reasonCode)}>
            <Badge
              label={
                report.status === "OPEN"
                  ? "Đã tiếp nhận"
                  : uiLabel(report.status)
              }
            />
            <Copy>{report.description}</Copy>
            <Copy>
              {report.createdAt
                ? new Date(report.createdAt).toLocaleString("vi-VN")
                : "Chưa ghi nhận thời điểm gửi"}
            </Copy>
            {report.blocksSettlement && (
              <Copy>Báo cáo đang giữ quyết toán lộ trình liên quan.</Copy>
            )}
            {report.resolutionNote && (
              <Copy>Phản hồi: {report.resolutionNote}</Copy>
            )}
            {report.reportEvidenceCaseIdRecords.map((file) => (
              <Copy key={file.id}>
                Bằng chứng riêng tư · {file.mimeType} · {file.fileSizeBytes}{" "}
                byte
              </Copy>
            ))}
          </Panel>
          {report.relatedPathId && (
            <RouteButton secondary href={`/paths/${report.relatedPathId}`}>
              Xem lộ trình liên quan
            </RouteButton>
          )}
        </>
      )}
      {!query.isLoading && !query.error && !report && (
        <EmptyState
          title="Không tìm thấy báo cáo"
          description="Báo cáo không tồn tại hoặc không thuộc tài khoản này."
        />
      )}
      {typeof id === "string" && report && (
        <PrivateCaseThread caseId={id} status={report.status} />
      )}
    </FeaturePage>
  );
}
