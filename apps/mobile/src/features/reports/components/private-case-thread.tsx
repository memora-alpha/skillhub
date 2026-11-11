import { useState } from "react";
import { Text, View } from "react-native";
import { z } from "zod";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { ReportCopy as Copy, ReportSection as Panel } from "./report-ui";
import { reportStyles as styles } from "./report.styles";
import { reportDate } from "../utils/report-presentation";
import { Icon } from "@/components/Icon";
import { appColors as colors } from "@/constants/theme";
import { CaseEvidencePanel } from "./case-evidence-panel";
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
import { canWriteCase, canSendCaseMessage } from "../utils/case-actions";
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
  const context = useConnectionQuery(
    ["learning-paths", pathId ?? "", "cases", caseId, "thread-context"],
    async (signal) => {
      const row = parse(
        z.object({
          id: uuid,
          status: z.enum([
            "OPEN",
            "UNDER_REVIEW",
            "NEED_MORE_INFO",
            "RESOLVED",
            "REJECTED",
          ]),
        }),
        await runtime.call(
          `/learning-paths/${encodeURIComponent(pathId ?? "")}/cases/${encodeURIComponent(caseId)}/summary`,
          { signal },
        ),
      );
      if (row.id !== caseId) throw new AppError("protocol");
      return row;
    },
    valid && uuid.safeParse(pathId).success,
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
  const ownReports = useConnectionQuery(
    ["reports"],
    (signal) => api.mine(signal),
    valid && status === undefined,
  );
  const command = useConnectionCommand([["reports"], ["learning-paths"]]);
  const [text, setText] = useState("");
  const [waitingForHandler, setWaitingForHandler] = useState(false);
  const ownReport = ownReports.data?.find((row) => row.id === caseId);
  const currentStatus = pathId
    ? context.data?.status
    : (status ?? ownReport?.status);
  const currentHandler =
    handlerId !== undefined ? handlerId : ownReport?.handlerId;
  const writable = canWriteCase(
    currentStatus,
    !valid || !!context.error || !!query.error || !!filesQuery.error,
  );
  const canSend = canSendCaseMessage(
    currentStatus,
    currentHandler,
    !writable || waitingForHandler,
  );
  const awaitingHandler =
    writable && (currentHandler === null || waitingForHandler);
  async function refresh() {
    const results = await Promise.allSettled([
      query.refetch({ throwOnError: true }),
      filesQuery.refetch({ throwOnError: true }),
      ...(pathId ? [context.refetch({ throwOnError: true })] : []),
      ...(status === undefined
        ? [ownReports.refetch({ throwOnError: true })]
        : []),
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
      title="Trao đổi với người xử lý"
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
      <Copy muted>Chỉ bạn và người xử lý được xem nội dung này.</Copy>
      <ConnectionFeedback
        loading={query.isLoading}
        error={
          context.error ??
          query.error ??
          filesQuery.error ??
          (awaitingHandler ? undefined : command.error)
        }
        retry={() => {
          void refresh();
        }}
      />
      <View style={styles.thread}>
        {query.items.map((row) => (
          <View
            key={row.id}
            style={[
              styles.bubble,
              row.senderId === runtime.userId && styles.mine,
            ]}
          >
            <Text style={styles.label}>
              {row.senderId === runtime.userId ? "Bạn" : "Người xử lý"}
            </Text>
            <Copy>{row.text}</Copy>
            <Text style={styles.caption}>{reportDate(row.createdAt)}</Text>
          </View>
        ))}
      </View>
      {!query.isLoading && !query.error && !query.items.length && (
        <Copy muted>Chưa có trao đổi.</Copy>
      )}
      {query.hasNextPage && (
        <Button
          variant="paper"
          disabled={query.isFetching}
          onPress={() => void query.fetchNextPage()}
        >
          Tin nhắn trước
        </Button>
      )}
      {!writable && (
        <Copy muted>
          {currentStatus === "RESOLVED" || currentStatus === "REJECTED"
            ? "Vụ việc đã kết thúc. Bạn vẫn có thể xem trao đổi và bằng chứng."
            : "Chưa thể bổ sung thông tin. Cập nhật trạng thái để tiếp tục."}
        </Copy>
      )}
      {awaitingHandler && (
        <Copy muted>
          Chờ nhân viên tiếp nhận để gửi phản hồi. Bạn vẫn có thể bổ sung bằng
          chứng.
        </Copy>
      )}
      {canSend && (
        <>
          <Input
            label="Nội dung bổ sung"
            value={text}
            onChangeText={setText}
            multiline
            maxLength={4000}
            placeholder="Bổ sung thông tin hoặc trả lời người xử lý…"
            fieldStyle={styles.field}
            style={{ minHeight: 100, textAlignVertical: "top" }}
            editable={!command.pending && !command.uncertain}
          />
          <Button
            variant="craft"
            leadingIcon="send"
            disabled={
              !text.trim() ||
              command.pending ||
              command.uncertain ||
              !!query.error
            }
            onPress={() => {
              void sendMessage();
            }}
          >
            {command.pending ? "Đang gửi…" : "Gửi phản hồi"}
          </Button>
        </>
      )}
      <CaseEvidencePanel caseId={caseId} writable={writable} />
      {command.uncertain && writable && (
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
    </Panel>
  );
}
