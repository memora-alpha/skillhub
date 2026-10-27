import type { ApiLearningPath } from "@/features/learning-paths";
import { AppError } from "@/lib/http/errors";
import type { SessionsApi } from "../api/sessions-api";
import type { RescheduleInput } from "../api/reschedule-api";
import type { LearningSession } from "../types";
import { rescheduleSnapshot } from "./reschedule-snapshot";
import { resolveSessionContext } from "./session-context";
import {
  assertRescheduleRequest,
  isUncertainRescheduleError,
  type RescheduleIntent as Intent,
} from "./reschedule-action-policy";

type State = {
  pending: boolean;
  blocked: boolean;
  uncertain: boolean;
  error?: unknown;
  message?: string;
};
type Options = {
  api: Pick<SessionsApi, "detail" | "proposeReschedule" | "confirmReschedule">;
  userId: string;
  sessionId: string;
  pathId: string;
  isCurrent: () => boolean;
  readPath: (pathId: string) => Promise<ApiLearningPath>;
  onRead: (detail: LearningSession) => Promise<void>;
  now?: () => number;
};
const successMessages: Record<Intent["kind"], string> = {
  propose:
    "Đã gửi đề nghị. Cả bạn và đối tác cần xác nhận lịch mới; lịch cũ vẫn có hiệu lực.",
  confirm:
    "Đã ghi nhận xác nhận của bạn. Giờ học có hiệu lực được cập nhật từ máy chủ.",
};

export function createRescheduleAction(options: Options) {
  let state: State = { pending: false, blocked: false, uncertain: false };
  let active = true;
  let epoch = 0;
  let intent: Intent | undefined;
  const listeners = new Set<() => void>();
  const current = () => active && options.isCurrent();
  const update = (patch: Partial<State>) => {
    if (!current()) return;
    state = { ...state, ...patch };
    listeners.forEach((listener) => listener());
  };
  async function read(ticket = epoch) {
    const [detail, path] = await Promise.all([
      options.api.detail(options.sessionId),
      options.readPath(options.pathId),
    ]);
    if (!current() || ticket !== epoch) throw new AppError("session");
    const context = resolveSessionContext(detail, path);
    const snapshot =
      context && rescheduleSnapshot(detail, context, options.userId);
    if (
      detail.id !== options.sessionId ||
      path.id !== options.pathId ||
      !snapshot
    )
      throw new AppError("protocol");
    await options.onRead(detail);
    if (!current() || ticket !== epoch) throw new AppError("session");
    return { detail, path, snapshot };
  }
  function reconcile(fresh: Awaited<ReturnType<typeof read>>) {
    if (!intent) {
      update({ blocked: false, uncertain: false });
      return;
    }
    const snapshot = fresh.snapshot;
    // An unchanged read cannot rule out a POST still committing on the server.
    const resolved =
      snapshot.scheduleId === intent.scheduleId &&
      (snapshot.version > intent.version ||
        (intent.kind === "confirm" &&
          (snapshot.appliedVersion >= intent.version ||
            (snapshot.version === intent.version && snapshot.ownConfirmed))));
    if (!resolved) {
      update({
        blocked: true,
        uncertain: true,
        message:
          "Chưa xác định được kết quả gửi. Hãy kiểm tra trạng thái trước khi thao tác tiếp.",
      });
      return;
    }
    intent = undefined;
    update({
      blocked: false,
      uncertain: false,
      error: undefined,
      message:
        "Đã đọc lại lịch từ máy chủ. Hãy xem đề nghị và trạng thái xác nhận hiện tại.",
    });
  }
  function dispatch(request: Intent, input?: RescheduleInput) {
    if (request.kind === "propose")
      return options.api.proposeReschedule(options.sessionId, input!);
    return options.api.confirmReschedule(request.scheduleId, request.version);
  }
  async function recoverFailure(
    error: unknown,
    dispatched: boolean,
    acknowledged: boolean,
    ticket: number,
    live: () => boolean,
  ) {
    if (!live()) return;
    const uncertain =
      dispatched && !acknowledged && isUncertainRescheduleError(error);
    if (!uncertain) intent = undefined;
    update({ error, blocked: dispatched, uncertain });
    if (!dispatched) return;
    try {
      const fresh = await read(ticket);
      if (live()) reconcile(fresh);
    } catch {
      if (live()) update({ blocked: true });
    }
  }
  async function run(request: Intent, input?: RescheduleInput) {
    if (!current() || state.pending || state.blocked) return;
    const ticket = epoch;
    const live = () => current() && ticket === epoch;
    update({ pending: true, error: undefined, message: undefined });
    let dispatched = false;
    let acknowledged = false;
    try {
      const fresh = await read(ticket);
      if (!live()) return;
      assertRescheduleRequest(fresh, request, input, options.now ?? Date.now);
      intent = request;
      dispatched = true;
      const receipt = await dispatch(request, input);
      if (!live()) return;
      if (receipt.id !== request.scheduleId) throw new AppError("protocol");
      acknowledged = true;
      intent = undefined;
      update({
        blocked: true,
        uncertain: false,
        message: successMessages[request.kind],
      });
      await read(ticket);
      if (!live()) return;
      update({ blocked: false });
    } catch (error) {
      if (!live()) return;
      await recoverFailure(error, dispatched, acknowledged, ticket, live);
    } finally {
      if (live()) update({ pending: false });
    }
  }
  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setActive(value: boolean) {
      if (active === value) return;
      active = value;
      epoch++;
      if (!value && state.pending) {
        state = {
          ...state,
          pending: false,
          blocked: !!intent,
          uncertain: !!intent,
        };
      }
      if (value) listeners.forEach((listener) => listener());
    },
    propose(scheduleId: string, input: RescheduleInput) {
      return run(
        { kind: "propose", scheduleId, version: input.expectedVersion },
        input,
      );
    },
    confirm(scheduleId: string, expectedVersion: number) {
      return run({ kind: "confirm", scheduleId, version: expectedVersion });
    },
    async refresh() {
      if (!current() || state.pending) return;
      const ticket = epoch;
      const live = () => current() && ticket === epoch;
      update({ pending: true, error: undefined });
      try {
        const fresh = await read(ticket);
        if (live()) reconcile(fresh);
      } catch (error) {
        if (live()) update({ error, blocked: true });
      } finally {
        if (live()) update({ pending: false });
      }
    },
  };
}
