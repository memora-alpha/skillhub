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
import { useReports } from "../hooks/use-reports";
import { uiLabel } from "@/constants/ui-copy";

export function ReportsScreen() {
  const query = useReports(),
    [filter, setFilter] = useState("Tất cả");
  const items =
    query.data?.filter((row) => filter === "Tất cả" || row.status === filter) ??
    [];
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
        options={[
          "Tất cả",
          "OPEN",
          "UNDER_REVIEW",
          "NEED_MORE_INFO",
          "RESOLVED",
          "REJECTED",
        ]}
        value={filter}
        onChange={setFilter}
      />
      <ConnectionFeedback
        loading={query.isLoading}
        error={query.error}
        retry={query.refetch}
      />
      {items.map((row) => (
        <Panel key={row.id} title={"Báo cáo " + row.id}>
          <Badge label={row.status} />
          <Copy>{row.description}</Copy>
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
  const { id } = useLocalSearchParams<{ id: string }>(),
    query = useReports();
  const report = query.data?.find((row) => row.id === id);
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
          <Panel title={"Báo cáo " + report.id}>
            <Badge label={report.status} />
            <Copy>
              {uiLabel(report.reasonCode)} · {report.targetId}
            </Copy>
            <Copy>{report.description}</Copy>
            {report.resolutionNote && (
              <Copy>Phản hồi: {report.resolutionNote}</Copy>
            )}
            {report.reportEvidenceCaseIdRecords.map((file) => (
              <Copy key={file.id}>
                Bằng chứng riêng tư · {file.mimeType} · {file.fileSizeBytes}{" "}
                byte
              </Copy>
            ))}
            {report.status === "NEED_MORE_INFO" && (
              <Copy>
                Nhân viên yêu cầu bổ sung thông tin. Hiện API chưa có thao tác
                gửi bổ sung từ ứng dụng.
              </Copy>
            )}
          </Panel>
          {report.relatedPathId && (
            <RouteButton secondary href={`/paths/${report.relatedPathId}`}>
              Xem lộ trình liên quan
            </RouteButton>
          )}
        </>
      )}
      {query.data && !report && (
        <EmptyState
          title="Không tìm thấy báo cáo"
          description="Báo cáo không tồn tại hoặc không thuộc tài khoản này."
        />
      )}
    </FeaturePage>
  );
}
