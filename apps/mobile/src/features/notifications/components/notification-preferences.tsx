import { z } from "zod";
import { Button } from "@/components/Button";
import { Copy, Panel } from "@/components/feature-page";
import { parse } from "@/lib/http/contracts";
import {
  ConnectionFeedback,
  useConnections,
  useConnectionQuery,
  useConnectionCommand,
} from "@/features/connections";

const preferences = z.object({
  learning: z.boolean(),
  credit: z.boolean(),
  community: z.boolean(),
});
export function NotificationPreferences() {
  const runtime = useConnections();
  const query = useConnectionQuery(
    ["notification-preferences"],
    async (signal) =>
      parse(
        preferences,
        await runtime.call("/me/notification-preferences", { signal }),
      ),
  );
  const command = useConnectionCommand([["notification-preferences"]]);
  return (
    <Panel title="Thông báo tài khoản">
      <ConnectionFeedback
        loading={query.isLoading}
        error={query.error ?? command.error}
        retry={query.refetch}
      />
      {query.data &&
        (
          [
            ["learning", "Học tập"],
            ["credit", "Credit"],
            ["community", "Cộng đồng"],
          ] as const
        ).map(([key, label]) => (
          <Button
            key={key}
            variant="paper"
            disabled={command.pending || command.uncertain || !!query.error}
            onPress={() =>
              void command.run(`${key}:${!query.data![key]}`, async () =>
                parse(
                  preferences,
                  await runtime.call("/me/notification-preferences", {
                    method: "PATCH",
                    body: { [key]: !query.data![key] },
                    replayAfterRenewal: false,
                  }),
                ),
              )
            }
          >
            {label}: {query.data![key] ? "Đang bật" : "Đã tắt"}
          </Button>
        ))}
      {command.uncertain && (
        <Button
          variant="paper"
          disabled={command.pending}
          onPress={() => void command.retry()}
        >
          Lưu lại lựa chọn
        </Button>
      )}
      <Copy muted>Áp dụng cho tài khoản trên mọi thiết bị.</Copy>
    </Panel>
  );
}
