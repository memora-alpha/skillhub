import { Panel } from "@/components/feature-page";
import { FormNotice } from "@/components/FormNotice";
import { Button } from "@/components/Button";
import { ConnectionFeedback } from "@/features/connections";

export function ProposalRecovery<T>({
  command,
  onRecovered,
}: Readonly<{
  command: {
    uncertain: boolean;
    pending: boolean;
    originalError: unknown;
    error: unknown;
    retry: () => Promise<T | undefined>;
  };
  onRecovered: (result: T) => void;
}>) {
  if (!command.uncertain) return null;
  return (
    <Panel title="Kiểm tra thao tác trước">
      <FormNotice tone="info">
        Chưa xác định được kết quả. Kiểm tra lại thao tác trước để tránh gửi
        trùng.
      </FormNotice>
      <ConnectionFeedback error={command.originalError} />
      {command.error !== command.originalError && (
        <ConnectionFeedback error={command.error} />
      )}
      <Button
        variant="craft"
        disabled={command.pending}
        onPress={() => {
          void command.retry().then((result) => {
            if (result) onRecovered(result);
          });
        }}
      >
        {command.pending ? "Đang kiểm tra..." : "Kiểm tra lại thao tác trước"}
      </Button>
    </Panel>
  );
}
