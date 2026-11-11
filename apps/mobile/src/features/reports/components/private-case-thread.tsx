import { useMemo, useState } from "react";
import { Text, View } from "react-native";
import { z } from "zod";
import { Button } from "@/components/Button";
import { ReportCopy as Copy, ReportSection as Panel } from "./report-ui";
import { reportStyles as styles } from "./report.styles";
import { Icon } from "@/components/Icon";
import { appColors as colors } from "@/constants/theme";
import { CaseEvidencePanel } from "./case-evidence-panel";
import { CaseMessageHistory } from "./case-message-history";
import { CaseMessageComposer } from "./case-message-composer";
import { caseThreadStyles as threadStyles } from "./case-thread.styles";
import {
  parse,
  parsePage,
  pageQuery,
  timestamp,
  uuid,
} from "@/lib/http/contracts";
import {
  ConnectionFeedback,
  useConnections,
  useConnectionList,
  useConnectionQuery,
  useConnectionCommand,
} from "@/features/connections";
import { useReportsApi, useCaseEvidence } from "../hooks/use-reports";
import {
  casePermissions,
  caseBlockedCopy,
  canWriteCase,
} from "../utils/case-actions";
import { caseCapabilities } from "@/lib/http/case-capabilities";
import { AppError } from "@/lib/http/errors";
const message = z.object({
  id: z.string().regex(/^[a-f0-9]{64}$/),
  senderId: uuid,
  text: z.string(),
  createdAt: timestamp,
});
type CaseThreadProps = Readonly<{
  caseId: string;
  status?: string;
  pathId?: string;
  handlerId?: string | null;
  onRefreshStatus?: () => Promise<unknown>;
}>;
export function PrivateCaseThread(props: CaseThreadProps) {
  const runtime = useConnections();
  return (
    <PrivateCaseThreadContent
      key={JSON.stringify([runtime.key, props.caseId])}
      {...props}
    />
  );
}
function PrivateCaseThreadContent({
  caseId,
  status,
  pathId,
  handlerId,
  onRefreshStatus,
}: CaseThreadProps) {
  const runtime = useConnections();
  const api = useReportsApi();
  const root = `/reports/support/cases/${encodeURIComponent(caseId)}/parties/${encodeURIComponent(runtime.userId ?? "")}`;
  const valid = uuid.safeParse(caseId).success && !!runtime.userId;
  const needsOwnReport = valid && status === undefined && !pathId;
  const ownReports = useConnectionQuery(
    ["reports"],
    (signal) => api.mine(signal),
    needsOwnReport,
  );
  const ownReport = needsOwnReport
    ? ownReports.data?.find((row) => row.id === caseId)
    : undefined;
  const resolvedPathId = pathId ?? ownReport?.relatedPathId ?? undefined;
  const context = useConnectionQuery(
    ["learning-paths", resolvedPathId ?? "", "cases", caseId, "thread-context"],
    async (signal) => {
      const row = parse(
        caseCapabilities.extend({
          id: uuid,
          relatedPathId: uuid,
          status: z.enum([
            "OPEN",
            "UNDER_REVIEW",
            "NEED_MORE_INFO",
            "RESOLVED",
            "REJECTED",
          ]),
        }),
        await runtime.call(
          `/learning-paths/${encodeURIComponent(resolvedPathId ?? "")}/cases/${encodeURIComponent(caseId)}/summary`,
          { signal },
        ),
      );
      if (row.id !== caseId || row.relatedPathId !== resolvedPathId)
        throw new AppError("protocol");
      return row;
    },
    valid && uuid.safeParse(resolvedPathId).success,
  );
  const query = useConnectionList(
    ["reports", caseId, "messages"],
    async (cursor, signal) =>
      parsePage(
        message,
        await runtime.call(`${root}/messages?${pageQuery(cursor)}`, {
          signal,
          includeMeta: true,
        }),
      ),
    valid,
  );
  const filesQuery = useCaseEvidence(caseId, valid);
  const historyMessages = useMemo(
    () => query.data?.pages.flatMap((page) => page.items) ?? [],
    [query.data],
  );
  const command = useConnectionCommand([["reports"], ["learning-paths"]]);
  const [text, setText] = useState("");
  const [waitingForHandler, setWaitingForHandler] = useState(false);
  const currentStatus = resolvedPathId
    ? context.data?.status
    : (status ?? ownReport?.status);
  const currentHandler =
    handlerId !== undefined ? handlerId : ownReport?.handlerId;
  const permissions = casePermissions(
    context.data,
    {
      status: currentStatus,
      handlerId: currentHandler,
      evidenceCount: filesQuery.data?.length,
    },
    !valid ||
      !!context.error ||
      !!query.error ||
      !!filesQuery.error ||
      (needsOwnReport && !!ownReports.error) ||
      (!!resolvedPathId && !context.data),
  );
  const canSend = permissions.canSendMessage && !waitingForHandler;
  const awaitingHandler =
    context.data?.messageBlockedReason === "CASE_HANDLER_REQUIRED" ||
    (!resolvedPathId &&
      currentHandler === null &&
      canWriteCase(currentStatus)) ||
    (waitingForHandler && canWriteCase(currentStatus));
  const loadingContext =
    (!!resolvedPathId && context.isLoading) ||
    (needsOwnReport && ownReports.isLoading);
  async function refresh() {
    const results = await Promise.allSettled([
      query.refetch({ throwOnError: true }),
      filesQuery.refetch({ throwOnError: true }),
      ...(resolvedPathId ? [context.refetch({ throwOnError: true })] : []),
      ...(needsOwnReport ? [ownReports.refetch({ throwOnError: true })] : []),
      ...(onRefreshStatus ? [onRefreshStatus()] : []),
    ]);
    if (
      runtime.isCurrent() &&
      results.every((result) => result.status === "fulfilled")
    )
      setWaitingForHandler(false);
  }
  function sendMessage() {
    if (!canSend) return;
    return command.run(`message:${text.trim()}`, async (clientMessageId) => {
      try {
        const result = await runtime.call(`${root}/messages`, {
          method: "POST",
          body: { clientMessageId, text: text.trim() },
          replayAfterRenewal: false,
        });
        if (runtime.isCurrent()) setText("");
        return result;
      } catch (error) {
        if (
          runtime.isCurrent() &&
          error instanceof AppError &&
          error.code === "CASE_HANDLER_REQUIRED"
        )
          setWaitingForHandler(true);
        throw error;
      }
    });
  }
  return (
    <Panel
      title="Trao đổi hỗ trợ"
      subtitle="Riêng tư với nhân viên"
      compact
      icon="message"
      action={
        <Button
          variant="ghost"
          style={styles.iconButton}
          accessibilityLabel="Cập nhật trao đổi"
          disabled={query.isFetching || filesQuery.isFetching}
          onPress={() => {
            void refresh();
          }}
        >
          <Icon name="refresh" size={18} color={colors.forest} />
        </Button>
      }
    >
      <ConnectionFeedback
        loading={query.isLoading || loadingContext}
        error={
          context.error ??
          query.error ??
          filesQuery.error ??
          (needsOwnReport ? ownReports.error : undefined) ??
          (awaitingHandler ? undefined : command.error)
        }
        retry={() => {
          void refresh();
        }}
      />
      <CaseMessageHistory
        messages={historyMessages}
        userId={runtime.userId ?? null}
        hasMore={!!query.hasNextPage}
        loading={query.isFetching}
        onLoadOlder={() => {
          void query.fetchNextPage({ cancelRefetch: false });
        }}
      />
      {!query.isLoading &&
        !query.error &&
        !historyMessages.length &&
        canSend && (
          <Text style={threadStyles.empty}>
            Nhắn tin để bổ sung thông tin cho báo cáo.
          </Text>
        )}
      <View style={threadStyles.footer}>
        {!canSend && !awaitingHandler && !loadingContext && (
          <View style={threadStyles.notice}>
            <Icon name="shield" size={16} color={colors.muted} />
            <Text style={threadStyles.noticeText}>
              {caseBlockedCopy(
                context.data?.messageBlockedReason ??
                  (["RESOLVED", "REJECTED"].includes(currentStatus ?? "")
                    ? "REPORT_CASE_CLOSED"
                    : null),
              )}
            </Text>
          </View>
        )}
        {awaitingHandler && (
          <View style={threadStyles.notice}>
            <Icon name="clock" size={16} color={colors.muted} />
            <Text style={threadStyles.noticeText}>
              {caseBlockedCopy("CASE_HANDLER_REQUIRED")}
            </Text>
          </View>
        )}
        <CaseEvidencePanel
          caseId={caseId}
          writable={permissions.canAttachEvidence}
          ownEvidenceCount={context.data?.ownEvidenceCount}
          blockedReason={context.data?.evidenceBlockedReason}
        />
        {canSend && (
          <CaseMessageComposer
            value={text}
            onChange={setText}
            pending={command.pending}
            uncertain={command.uncertain}
            onSend={() => {
              void sendMessage();
            }}
          />
        )}
        {command.uncertain && canSend && (
          <>
            <Copy muted>
              Chưa rõ kết quả gửi. Kiểm tra hoặc gửi lại cùng nội dung.
            </Copy>
            <Button
              variant="paper"
              disabled={command.pending}
              onPress={() => void command.retry()}
            >
              Kiểm tra / gửi lại
            </Button>
          </>
        )}
      </View>
    </Panel>
  );
}
