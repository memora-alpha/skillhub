import { useState } from "react";
import { Linking } from "react-native";
import { z } from "zod";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Copy, Panel } from "@/components/feature-page";
import { ServerFilePicker } from "@/components/server-file-picker";
import type { UploadedFile } from "@/lib/http/file-upload";
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
import { useReportsApi } from "../hooks/use-reports";
import { canWriteCase } from "../utils/case-actions";
import { AppError } from "@/lib/http/errors";
const message = z.object({
  id: z.string().regex(/^[a-f0-9]{64}$/),
  senderId: uuid,
  text: z.string(),
  createdAt: timestamp,
});
const evidence = z.object({
  id: uuid,
  mimeType: z.string(),
  fileSizeBytes: z.string(),
  uploadedAt: timestamp,
});
type CaseThreadProps = Readonly<{
  caseId: string;
  status?: string;
  pathId?: string;
}>;
export function PrivateCaseThread({ caseId, status, pathId }: CaseThreadProps) {
  const runtime = useConnections();
  return (
    <PrivateCaseThreadContent
      key={JSON.stringify([runtime.key, caseId])}
      caseId={caseId}
      status={status}
      pathId={pathId}
    />
  );
}
function PrivateCaseThreadContent({ caseId, status, pathId }: CaseThreadProps) {
  const runtime = useConnections();
  const api = useReportsApi();
  const root = `/reports/support/cases/${encodeURIComponent(caseId)}/parties/${encodeURIComponent(runtime.userId ?? "")}`;
  const valid = uuid.safeParse(caseId).success && !!runtime.userId;
  const context = useConnectionQuery(
    ["learning-paths", pathId ?? "", "cases", caseId],
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
  const filesQuery = useConnectionQuery(
    ["reports", caseId, "private-evidence"],
    async (signal) =>
      parse(
        z.array(evidence),
        await runtime.call(`${root}/evidence`, { signal }),
      ),
    valid,
  );
  const command = useConnectionCommand([["reports"], ["learning-paths"]]);
  const download = useConnectionCommand([]);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [open, setOpen] = useState(false);
  const currentStatus = pathId ? context.data?.status : status;
  const writable = canWriteCase(
    currentStatus,
    !valid || !!context.error || !!query.error || !!filesQuery.error,
  );
  return (
    <Panel title="Trao đổi riêng với người xử lý">
      <Copy muted>Chỉ bạn và người xử lý được xem nội dung này.</Copy>
      <Button
        variant="paper"
        disabled={query.isFetching || filesQuery.isFetching}
        onPress={() => {
          void query.refetch();
          void filesQuery.refetch();
          if (pathId) void context.refetch();
        }}
      >
        Cập nhật trao đổi
      </Button>
      <ConnectionFeedback
        loading={query.isLoading}
        error={
          context.error ??
          query.error ??
          filesQuery.error ??
          command.error ??
          download.error
        }
        retry={() => {
          void query.refetch();
          void filesQuery.refetch();
          if (pathId) void context.refetch();
        }}
      />
      {query.items.map((row) => (
        <Panel
          key={row.id}
          title={row.senderId === runtime.userId ? "Bạn" : "Người xử lý"}
        >
          <Copy>{row.text}</Copy>
          <Copy muted>{new Date(row.createdAt).toLocaleString("vi-VN")}</Copy>
        </Panel>
      ))}
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
            ? "Vụ việc đã kết thúc. Bạn vẫn có thể xem lịch sử và bằng chứng."
            : "Chưa xác nhận được trạng thái vụ việc. Mở từ lộ trình hoặc cập nhật lại trước khi bổ sung."}
        </Copy>
      )}
      {writable && (
        <>
          <Input
            label="Nội dung bổ sung"
            value={text}
            onChangeText={setText}
            multiline
            maxLength={4000}
            editable={!command.pending && !command.uncertain}
          />
          <Button
            disabled={
              !text.trim() ||
              command.pending ||
              command.uncertain ||
              !!query.error
            }
            onPress={() =>
              void command.run(
                `message:${text.trim()}`,
                async (clientMessageId) => {
                  const result = await runtime.call(`${root}/messages`, {
                    method: "POST",
                    body: { clientMessageId, text: text.trim() },
                    replayAfterRenewal: false,
                  });
                  if (runtime.isCurrent()) setText("");
                  return result;
                },
              )
            }
          >
            Gửi phản hồi
          </Button>
        </>
      )}
      <Button variant="paper" onPress={() => setOpen(!open)}>
        {open
          ? "Thu gọn bằng chứng"
          : writable
            ? "Xem / bổ sung bằng chứng"
            : "Xem bằng chứng"}
      </Button>
      {open && (
        <>
          {filesQuery.data?.map((file) => (
            <Button
              key={file.id}
              variant="paper"
              onPress={() =>
                void download.run(`download:${file.id}`, async () => {
                  const result = parse(
                    z.object({ url: z.url(), expiresAt: timestamp }),
                    await runtime.call(`${root}/evidence/${file.id}/download`),
                  );
                  if (runtime.isCurrent()) await Linking.openURL(result.url);
                  return result;
                })
              }
            >
              Xem bằng chứng · {file.mimeType}
            </Button>
          ))}
          {writable && (
            <>
              <ServerFilePicker
                files={files}
                onChange={setFiles}
                upload={api.upload}
                status={api.fileStatus}
                isCurrent={runtime.isCurrent}
                disabled={command.pending || command.uncertain}
                maxCount={Math.max(0, 5 - (filesQuery.data?.length ?? 0))}
              />
              {files.map(
                (file) =>
                  file.state === "READY" && (
                    <Button
                      key={file.fileId}
                      disabled={command.pending || command.uncertain}
                      onPress={() =>
                        void command.run(
                          `evidence:${file.fileId}`,
                          async () => {
                            const result = await runtime.call(
                              `${root}/evidence`,
                              {
                                method: "POST",
                                body: { fileId: file.fileId },
                                replayAfterRenewal: false,
                              },
                            );
                            if (runtime.isCurrent())
                              setFiles((current) =>
                                current.filter(
                                  (item) => item.fileId !== file.fileId,
                                ),
                              );
                            return result;
                          },
                        )
                      }
                    >
                      Gửi {file.name}
                    </Button>
                  ),
              )}
            </>
          )}
        </>
      )}
      {download.uncertain && (
        <Button
          variant="paper"
          disabled={download.pending}
          onPress={() => void download.retry()}
        >
          Thử mở lại bằng chứng
        </Button>
      )}
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
