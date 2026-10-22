import { AppError } from "@/lib/http/errors";

/** A timed-out POST may have committed. Only a successful read unlocks another attempt. */
export function createReviewSubmission() {
  let state: "ready" | "sending" | "check" | "submitted" = "ready";
  return {
    get state() {
      return state;
    },
    async send<T>(post: () => Promise<T>, isCurrent: () => boolean) {
      if (state !== "ready" || !isCurrent()) return undefined;
      state = "sending";
      try {
        const result = await post();
        if (!isCurrent()) return undefined;
        state = "submitted";
        return result;
      } catch (error) {
        if (isCurrent()) {
          const rejected =
            error instanceof AppError &&
            error.kind === "http" &&
            [400, 403, 404, 409, 429].includes(error.status);
          state = rejected ? "ready" : "check";
          if (
            error instanceof AppError &&
            error.code === "REVIEW_ALREADY_SUBMITTED"
          )
            state = "submitted";
        }
        throw error;
      }
    },
    observed(alreadySubmitted: boolean) {
      if (state === "sending") return;
      if (alreadySubmitted) state = "submitted";
      else if (state !== "submitted") state = "ready";
    },
  };
}
