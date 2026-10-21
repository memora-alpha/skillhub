import { AppError } from "@/lib/http/errors";

export function confirmAndShare<T>(
  confirm: () => Promise<T>,
  share: (result: T, clientMessageId: string) => void,
  isCurrent: () => boolean,
) {
  return async (clientMessageId: string) => {
    const result = await confirm();
    if (!isCurrent()) throw new AppError("session");
    share(result, clientMessageId);
    return result;
  };
}
