import type { ApiLearningPath } from "@/features/learning-paths";
import { AppError } from "@/lib/http/errors";
import type { SessionsApi } from "../api/sessions-api";
import type { RescheduleInput } from "../api/reschedule-api";
import type { LearningSession } from "../types";
import { isRescheduleEligible } from "./reschedule-form";
import { rescheduleSnapshot } from "./reschedule-snapshot";
import { resolveSessionContext } from "./session-context";

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
type Intent = {
  kind: "propose" | "confirm";
  scheduleId: string;
  version: number;
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
      const snapshot = fresh.snapshot;
      if (
        snapshot.scheduleId !== request.scheduleId ||
        snapshot.version !== request.version
      )
        throw new AppError("http", 409, "STALE_SCHEDULE_VERSION");
      if (
        !isRescheduleEligible(fresh.detail, (options.now ?? Date.now)()) ||
        !["SCHEDULED", "ACTIVE"].includes(fresh.path.status)
      )
        throw new AppError("http", 409, "SESSION_CANNOT_BE_RESCHEDULED");
      if (request.kind === "propose") {
        if (snapshot.hasPending)
          throw new AppError("http", 409, "RESCHEDULE_ALREADY_PENDING");
        if (!input || Date.parse(input.startAt) <= (options.now ?? Date.now)())
          throw new AppError("http", 400, "RESCHEDULE_START_NOT_FUTURE");
        if (
          Date.parse(input.startAt) === Date.parse(fresh.detail.startAt) &&
          Date.parse(input.endAt) === Date.parse(fresh.detail.endAt)
        )
          throw new AppError("http", 400, "RESCHEDULE_UNCHANGED");
      } else if (!snapshot.pending || snapshot.ownConfirmed) {
        throw new AppError("http", 409, "RESCHEDULE_NOT_CONFIRMABLE");
      }
      intent = request;
      dispatched = true;
      const receipt =
        request.kind === "propose"
          ? await options.api.proposeReschedule(options.sessionId, input!)
          : await options.api.confirmReschedule(
              request.scheduleId,
              request.version,
            );
      if (!live()) return;
      if (receipt.id !== request.scheduleId) throw new AppError("protocol");
      acknowledged = true;
      intent = undefined;
      update({
        blocked: true,
        uncertain: false,
        message:
          request.kind === "propose"
            ? "Đã gửi đề nghị. Cả bạn và đối tác cần xác nhận lịch mới; lịch cũ vẫn có hiệu lực."
            : "Đã ghi nhận xác nhận của bạn. Giờ học có hiệu lực được cập nhật từ máy chủ.",
      });
      await read(ticket);
      if (!live()) return;
      update({ blocked: false });
    } catch (error) {
      if (!live()) return;
      const uncertain =
        dispatched &&
        !acknowledged &&
        (!(error instanceof AppError) ||
          error.kind === "network" ||
          error.kind === "protocol" ||
          error.status === 408 ||
          error.status >= 500);
      if (!uncertain) intent = undefined;
      update({ error, blocked: dispatched, uncertain });
      if (dispatched) {
        try {
          const fresh = await read(ticket);
          if (live()) reconcile(fresh);
        } catch {
          if (live()) update({ blocked: true });
        }
      }
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
