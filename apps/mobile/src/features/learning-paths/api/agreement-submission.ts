import { AppError } from "@/lib/http/errors";

type SavedAgreement = { id: string; version: number };

// Keep a known save within the exact command intent: retry only confirmation.
export function agreementSubmission<T extends SavedAgreement>(
  save: () => Promise<T>,
  confirm: (id: string, version: number) => Promise<unknown>,
  isCurrent: () => boolean,
  onConfirmed?: (saved: T, clientMessageId: string) => void,
  needsConfirmation: (saved: T) => boolean = () => true,
) {
  let saved: T | undefined;
  const assertCurrent = () => {
    if (!isCurrent()) throw new AppError("session");
  };
  return {
    get saved() {
      return saved;
    },
    async send(clientMessageId?: string) {
      assertCurrent();
      saved ??= await save();
      assertCurrent();
      if (!needsConfirmation(saved)) return saved;
      await confirm(saved.id, saved.version);
      assertCurrent();
      if (clientMessageId) onConfirmed?.(saved, clientMessageId);
      return saved;
    },
  };
}
