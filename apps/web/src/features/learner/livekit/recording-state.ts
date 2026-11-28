import type { SessionRecording, SessionRecordingStatus } from "../types";

export const RECORDING_START_NOTICE_MS = 4000;
export const RECORDING_STATUS_NOTICE_MS = 5000;

export const RECORDING_NOTICE_TEXT = {
  partnerAcceptedStarting:
    "Đối phương đã đồng ý ghi hình. Hệ thống đang khởi tạo bản ghi.",
  selfAcceptedStarting: "Đã đồng ý ghi hình. Hệ thống đang khởi tạo bản ghi.",
  started: "Bắt đầu ghi hình buổi học.",
  selfDeclined: "Đã từ chối yêu cầu ghi hình.",
  partnerDeclined: "Đối phương đã từ chối yêu cầu ghi hình.",
  expired: "Yêu cầu ghi hình đã hết hạn.",
  stopping:
    "Đang dừng ghi hình. Bản ghi sẽ xuất hiện trong chi tiết buổi học sau khi xử lý xong.",
  stopped: "Đã dừng ghi hình. Bản ghi sẽ xuất hiện trong chi tiết buổi học.",
  startFailed: "Không thể khởi tạo bản ghi. Vui lòng thử lại.",
  failed: "Quá trình ghi hình gặp sự cố. Vui lòng thử lại sau.",
} as const;

export type RecordingNotice = {
  text: string;
  autoHideMs?: number;
};

export type RecordingTransitionEffect = {
  notice?: RecordingNotice | null;
  error?: string | null;
};

export type RecordingTracker = {
  itemsHydrated: boolean;
  wasRecording: boolean;
  announcedStartId: string | null;
  statuses: Record<string, SessionRecordingStatus>;
};

const ACTIVE_PRE_TERMINAL = new Set<SessionRecordingStatus>([
  "STARTING",
  "RECORDING",
  "STOPPING",
]);

const TERMINAL_STATUSES = new Set<SessionRecordingStatus>([
  "DECLINED",
  "REQUEST_EXPIRED",
  "READY",
  "FAILED",
  "EXPIRED",
  "DELETED",
]);

export function createRecordingTracker(): RecordingTracker {
  return {
    itemsHydrated: false,
    wasRecording: false,
    announcedStartId: null,
    statuses: {},
  };
}

export function upsertRecordingItem(
  items: SessionRecording[],
  item: SessionRecording,
): SessionRecording[] {
  const index = items.findIndex((existing) => existing.id === item.id);
  if (index === -1) return [item, ...items];
  return items.map((existing, i) => (i === index ? item : existing));
}

function mapStatuses(
  items: SessionRecording[],
): Record<string, SessionRecordingStatus> {
  const result: Record<string, SessionRecordingStatus> = {};
  for (const item of items) {
    result[item.id] = item.status;
  }
  return result;
}

function isStaleTerminalLiveMeta(
  liveRecordingId: string | null,
  statuses: Record<string, SessionRecordingStatus>,
): boolean {
  if (!liveRecordingId) return false;
  const status = statuses[liveRecordingId];
  return Boolean(status && TERMINAL_STATUSES.has(status));
}

export function seedLiveRecording(
  tracker: RecordingTracker,
  liveRecording: boolean,
  liveRecordingId: string | null,
): RecordingTracker {
  return {
    ...tracker,
    wasRecording: tracker.wasRecording || liveRecording,
    announcedStartId:
      liveRecording && liveRecordingId
        ? liveRecordingId
        : tracker.announcedStartId,
  };
}

export function reconcileLiveRecording(
  tracker: RecordingTracker,
  liveRecording: boolean,
  liveRecordingId: string | null,
  items: SessionRecording[],
): { tracker: RecordingTracker; effect: RecordingTransitionEffect } {
  const statuses = mapStatuses(items);
  const hasRecordingItem = items.some((item) => item.status === "RECORDING");
  const hasStoppingItem = items.some((item) => item.status === "STOPPING");

  if (!liveRecording || isStaleTerminalLiveMeta(liveRecordingId, statuses)) {
    return {
      tracker: {
        ...tracker,
        wasRecording: hasRecordingItem,
      },
      effect: {},
    };
  }

  const candidateId =
    liveRecordingId ??
    items.find((item) =>
      ["RECORDING", "STARTING", "REQUESTED"].includes(item.status),
    )?.id ??
    null;

  const alreadyAnnounced =
    tracker.wasRecording ||
    hasStoppingItem ||
    (candidateId !== null && candidateId === tracker.announcedStartId);

  const nextTracker: RecordingTracker = {
    ...tracker,
    wasRecording: true,
    announcedStartId: candidateId ?? tracker.announcedStartId,
  };

  if (alreadyAnnounced) {
    return { tracker: nextTracker, effect: {} };
  }

  return {
    tracker: nextTracker,
    effect: {
      notice: {
        text: RECORDING_NOTICE_TEXT.started,
        autoHideMs: RECORDING_START_NOTICE_MS,
      },
      error: null,
    },
  };
}

function transitionEffectForItem(
  item: SessionRecording,
  prevStatus: SessionRecordingStatus | undefined,
  effectiveRecording: boolean,
  wasRecording: boolean,
  actorUserId: string,
): RecordingTransitionEffect | null {
  if (prevStatus === item.status) return null;

  if (item.status === "STARTING") {
    if (effectiveRecording) return null;
    const isRequester = item.requestedByUserId === actorUserId;
    return {
      notice: {
        text: isRequester
          ? RECORDING_NOTICE_TEXT.partnerAcceptedStarting
          : RECORDING_NOTICE_TEXT.selfAcceptedStarting,
      },
    };
  }

  if (item.status === "STOPPING") {
    return {
      notice: { text: RECORDING_NOTICE_TEXT.stopping },
    };
  }

  if (item.status === "READY") {
    const wasActive =
      (prevStatus !== undefined && ACTIVE_PRE_TERMINAL.has(prevStatus)) ||
      (prevStatus === "REQUESTED" && wasRecording);
    if (!wasActive) return null;
    return {
      notice: {
        text: RECORDING_NOTICE_TEXT.stopped,
        autoHideMs: RECORDING_STATUS_NOTICE_MS,
      },
    };
  }

  if (item.status === "DECLINED" && prevStatus === "REQUESTED") {
    const isRequester = item.requestedByUserId === actorUserId;
    return {
      notice: {
        text: isRequester
          ? RECORDING_NOTICE_TEXT.partnerDeclined
          : RECORDING_NOTICE_TEXT.selfDeclined,
        autoHideMs: isRequester
          ? RECORDING_STATUS_NOTICE_MS
          : RECORDING_START_NOTICE_MS,
      },
    };
  }

  if (
    item.status === "REQUEST_EXPIRED" &&
    prevStatus === "REQUESTED" &&
    item.requestedByUserId === actorUserId
  ) {
    return {
      notice: {
        text: RECORDING_NOTICE_TEXT.expired,
        autoHideMs: RECORDING_STATUS_NOTICE_MS,
      },
    };
  }

  if (
    item.status === "FAILED" &&
    prevStatus !== undefined &&
    (prevStatus === "REQUESTED" || ACTIVE_PRE_TERMINAL.has(prevStatus))
  ) {
    return {
      notice: null,
      error:
        prevStatus === "REQUESTED" || prevStatus === "STARTING"
          ? RECORDING_NOTICE_TEXT.startFailed
          : RECORDING_NOTICE_TEXT.failed,
    };
  }

  return null;
}

function transitionPriority(status: SessionRecordingStatus): number {
  switch (status) {
    case "STOPPING":
      return 5;
    case "STARTING":
      return 4;
    case "FAILED":
      return 3;
    case "READY":
      return 2;
    case "DECLINED":
    case "REQUEST_EXPIRED":
      return 1;
    default:
      return 0;
  }
}

export function reconcileRecordingItems(
  tracker: RecordingTracker,
  items: SessionRecording[],
  liveRecording: boolean,
  liveRecordingId: string | null,
  actorUserId: string,
): { tracker: RecordingTracker; effect: RecordingTransitionEffect } {
  const statuses = mapStatuses(items);
  const recordingItem = items.find((item) => item.status === "RECORDING");
  const stoppingItem = items.find((item) => item.status === "STOPPING");
  const liveValid =
    liveRecording && !isStaleTerminalLiveMeta(liveRecordingId, statuses);
  const effectiveRecording = liveValid || Boolean(recordingItem);
  const activeRecordingId =
    (liveValid ? liveRecordingId : null) ?? recordingItem?.id ?? null;

  if (!tracker.itemsHydrated) {
    return {
      tracker: {
        itemsHydrated: true,
        wasRecording: tracker.wasRecording || effectiveRecording,
        announcedStartId:
          effectiveRecording && activeRecordingId
            ? activeRecordingId
            : tracker.announcedStartId,
        statuses,
      },
      effect: {},
    };
  }

  const startId =
    activeRecordingId ??
    items.find((item) => item.status === "STARTING")?.id ??
    null;

  if (effectiveRecording && !stoppingItem) {
    const alreadyAnnounced =
      tracker.wasRecording ||
      (startId !== null && startId === tracker.announcedStartId);

    if (!alreadyAnnounced) {
      return {
        tracker: {
          itemsHydrated: true,
          wasRecording: true,
          announcedStartId: startId ?? tracker.announcedStartId,
          statuses,
        },
        effect: {
          notice: {
            text: RECORDING_NOTICE_TEXT.started,
            autoHideMs: RECORDING_START_NOTICE_MS,
          },
          error: null,
        },
      };
    }
  }

  const hasFreshRequest = items.some(
    (item) =>
      item.status === "REQUESTED" && tracker.statuses[item.id] === undefined,
  );

  let bestEffect: RecordingTransitionEffect = {};
  let bestPriority = 0;

  for (const item of items) {
    const prevStatus = tracker.statuses[item.id];
    const candidate = transitionEffectForItem(
      item,
      prevStatus,
      effectiveRecording,
      tracker.wasRecording,
      actorUserId,
    );
    if (!candidate) continue;
    if (
      hasFreshRequest &&
      (item.status === "DECLINED" || item.status === "REQUEST_EXPIRED")
    ) {
      continue;
    }
    const priority = transitionPriority(item.status);
    if (priority > bestPriority) {
      bestPriority = priority;
      bestEffect = candidate;
    }
  }

  if (bestPriority === 0 && hasFreshRequest) {
    bestEffect = { notice: null };
  }

  return {
    tracker: {
      itemsHydrated: true,
      wasRecording: effectiveRecording,
      announcedStartId:
        effectiveRecording && startId ? startId : tracker.announcedStartId,
      statuses,
    },
    effect: bestEffect,
  };
}
