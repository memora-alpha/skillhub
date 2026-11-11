import { reportDescriptionText } from "@/constants/system-text";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Icon } from "@/components/Icon";
import { Button } from "@/components/Button";
import { FormNotice } from "@/components/FormNotice";
import { appColors as colors } from "@/constants/theme";
import { ConnectionFeedback } from "@/features/connections";
import { useReport, useReports, useCaseEvidence } from "../hooks/use-reports";
import { uiLabel } from "@/constants/ui-copy";
import { PrivateCaseThread } from "../components/private-case-thread";
import {
  ReportPage,
  ReportSection,
  ReportStatus,
  ReportCopy,
  ReportLink,
} from "../components/report-ui";
import { ReportCard } from "../components/report-card";
import { reportStyles as s } from "../components/report.styles";
import {
  reportDate,
  reportReasonIcon,
  reportStatuses,
  reportStatusLabel,
  statusDescriptions,
} from "../utils/report-presentation";

export function ReportsScreen() {
  const query = useReports(),
    [filter, setFilter] = useState("ALL");
  const items =
    query.data?.filter((row) => filter === "ALL" || row.status === filter) ??
    [];
  return (
    <ReportPage
      title="Báo cáo của tôi"
      back="/profile"
      refreshing={query.isFetching}
      onRefresh={() => {
        void query.refetch();
      }}
    >
      <View style={s.hero}>
        <View style={s.row}>
          <View style={s.heroIcon}>
            <Icon name="shield" size={22} color={colors.forest} />
          </View>
          <View style={s.grow}>
            <Text style={s.heading}>Theo dõi yêu cầu hỗ trợ</Text>
            <Text style={s.meta}>
              Xem phản hồi và bổ sung thông tin tại đây.
            </Text>
          </View>
        </View>
        {query.data && (
          <Text style={s.filterLabel}>{query.data.length} báo cáo đã gửi</Text>
        )}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.filters}
        accessibilityLabel="Lọc trạng thái báo cáo"
      >
        {["ALL", ...reportStatuses].map((code) => (
          <Pressable
            key={code}
            accessibilityRole="button"
            accessibilityState={{ selected: filter === code }}
            aria-selected={filter === code}
            accessibilityLabel={
              code === "ALL" ? "Tất cả" : reportStatusLabel(code)
            }
            onPress={() => setFilter(code)}
            style={({ pressed }) => [
              s.chip,
              filter === code && s.chipActive,
              pressed && { opacity: 0.8 },
            ]}
          >
            <Text style={[s.chipText, filter === code && s.chipActiveText]}>
              {code === "ALL" ? "Tất cả" : reportStatusLabel(code)}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      <ConnectionFeedback
        loading={query.isLoading}
        error={query.error}
        retry={query.refetch}
      />
      {items.map((row) => (
        <ReportCard key={row.id} report={row} />
      ))}
      {query.data && !query.isLoading && !items.length && (
        <View style={s.empty}>
          <View style={s.heroIcon}>
            <Icon name="flag" size={26} color={colors.forest} />
          </View>
          <Text style={s.heading}>
            {filter === "ALL"
              ? "Chưa có báo cáo"
              : "Không có báo cáo ở trạng thái này"}
          </Text>
          <Text style={s.emptyText}>
            Bạn có thể gửi báo cáo từ buổi học hoặc tài liệu cần hỗ trợ.
          </Text>
        </View>
      )}
      <ReportLink
        title="Chọn buổi học cần hỗ trợ"
        href="/calendar"
        icon="calendar"
      />
    </ReportPage>
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
      <ReportPage
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
        {!pathId && (
          <ReportLink
            title="Xem vụ việc trong thỏa thuận"
            href="/my-learning?tab=paths"
            icon="book"
          />
        )}
      </ReportPage>
    );
  return <ReportOwnerDetailScreen />;
}
function ReportDescription({ value }: Readonly<{ value: string }>) {
  const [expanded, setExpanded] = useState(false),
    text = reportDescriptionText(value);
  return (
    <View style={{ gap: 8 }}>
      <Text
        selectable
        style={s.body}
        numberOfLines={!expanded && text.length > 240 ? 4 : undefined}
      >
        {text}
      </Text>
      {text.length > 240 && (
        <Button
          variant="ghost"
          accessibilityLabel={
            expanded
              ? "Thu gọn nội dung báo cáo"
              : "Xem đầy đủ nội dung báo cáo"
          }
          accessibilityState={{ expanded }}
          onPress={() => setExpanded(!expanded)}
        >
          {expanded ? "Thu gọn" : "Xem thêm"}
        </Button>
      )}
    </View>
  );
}
function ReportOwnerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(),
    query = useReport(typeof id === "string" ? id : "");
  const report = query.data;
  const evidence = useCaseEvidence(typeof id === "string" ? id : "", !!report);
  return (
    <ReportPage
      title="Theo dõi báo cáo"
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
          <View style={s.hero}>
            <ReportStatus status={report.status} />
            <Text accessibilityRole="header" style={s.title}>
              {uiLabel(report.reasonCode)}
            </Text>
            <Text style={s.body}>{statusDescriptions[report.status]}</Text>
            <Text style={s.meta}>Đã gửi {reportDate(report.createdAt)}</Text>
          </View>
          {report.blocksSettlement && (
            <FormNotice compact tone="info">
              Quyết toán lộ trình đang tạm giữ trong lúc xử lý báo cáo.
            </FormNotice>
          )}
          {report.resolutionNote && (
            <ReportSection
              title="Phản hồi từ người xử lý"
              icon="check-circle"
              accent
            >
              <ReportCopy>{report.resolutionNote}</ReportCopy>
            </ReportSection>
          )}
          <ReportSection
            title="Nội dung đã gửi"
            icon={reportReasonIcon(report.reasonCode)}
          >
            <ReportDescription key={report.id} value={report.description} />
            {!!evidence.data?.length && (
              <View style={s.row}>
                <Icon name="paperclip" size={16} color={colors.muted} />
                <Text style={s.meta}>
                  {evidence.data!.length} tệp bằng chứng đính kèm
                </Text>
              </View>
            )}
            <ReportLink
              title={
                report.targetType === "SESSION"
                  ? "Xem buổi học liên quan"
                  : "Xem tài liệu liên quan"
              }
              icon={report.targetType === "SESSION" ? "calendar" : "file"}
              href={
                report.targetType === "SESSION"
                  ? `/learning-sessions/${report.relatedSessionId ?? report.targetId}`
                  : `/materials/${report.relatedMaterialId ?? report.targetId}`
              }
            />
          </ReportSection>
          <PrivateCaseThread
            caseId={id}
            status={report.status}
            handlerId={report.handlerId}
            onRefreshStatus={() => query.refetch()}
          />
          {report.relatedPathId && (
            <ReportLink
              title="Xem lộ trình liên quan"
              href={`/paths/${report.relatedPathId}`}
              icon="book"
            />
          )}
        </>
      )}
      {!query.isLoading && !query.error && !report && (
        <View style={s.empty}>
          <Icon name="shield" size={32} color={colors.muted} />
          <Text style={s.heading}>Không tìm thấy báo cáo</Text>
          <Text style={s.emptyText}>
            Báo cáo không tồn tại hoặc không thuộc tài khoản này.
          </Text>
        </View>
      )}
    </ReportPage>
  );
}
