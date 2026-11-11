import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import { sessionPath } from "./fixtures/session-path";
import { resolveSessionContext } from "../src/features/sessions/utils/session-context";
import { createRescheduleAction } from "../src/features/sessions/utils/reschedule-action";

test("fresh permission, deadline and schedule version block outdated makeup submissions before POST", async () => {
  const now = Date.parse("2030-01-01T00:00:00Z");
  for (const reason of ["permission", "deadline", "version", "path"] as const) {
    const { session, path, schedule } = sessionPath();
    session.status = "MAKEUP_REQUIRED";
    session.allowedActions = reason === "permission" ? [] : ["PROPOSE_MAKEUP"];
    session.deadlines = {
      confirmBy: null,
      excuseOrReportBy: null,
      makeupBy: new Date(
        now + (reason === "deadline" ? 0 : 60_000),
      ).toISOString(),
    };
    if (reason === "path") path.status = "DISPUTED";
    const version = schedule.version;
    if (reason === "version") schedule.version++;
    let posts = 0;
    const action = createRescheduleAction({
      api: {
        detail: async () => ({ ...session, role: "TEACHER" as const }),
        proposeReschedule: async () => {
          posts++;
          throw new Error("Must not POST");
        },
        confirmReschedule: async () => {
          posts++;
          throw new Error("Must not POST");
        },
      },
      sessionId: session.id,
      pathId: path.id,
      userId: session.teacherId,
      isCurrent: () => true,
      now: () => now,
      readPath: async () => path,
      onRead: async () => {},
    });
    await action.propose(schedule.id, {
      expectedVersion: version,
      startAt: "2030-01-03T10:00:00Z",
      endAt: "2030-01-03T11:00:00Z",
    });
    assert.equal(posts, 0, reason);
    assert.ok(action.getSnapshot().error, reason);
    assert.equal(action.getSnapshot().pending, false, reason);
  }
});

test("backgrounding cancels a reschedule preflight and foregrounding does not replay it", async () => {
  const local = createRequire(
    new URL(
      "../src/features/sessions/hooks/use-session-reschedule.ts",
      import.meta.url,
    ),
  );
  const filename = local.resolve("./use-session-reschedule.ts");
  const { session, path, schedule } = sessionPath();
  session.status = "MAKEUP_REQUIRED";
  session.allowedActions = ["PROPOSE_MAKEUP"];
  session.deadlines = {
    confirmBy: null,
    excuseOrReportBy: null,
    makeupBy: "2099-01-01T00:00:00Z",
  };
  const input = {
    expectedVersion: schedule.version,
    startAt: "2090-01-01T10:00:00Z",
    endAt: "2090-01-01T11:00:00Z",
  };
  let releaseRead: (() => void) | undefined,
    posts = 0,
    reads = 0,
    removed = false;
  let onChange: (state: string) => void = () => {};
  const cleanup: (() => void)[] = [];
  const AppState = {
    currentState: "active",
    addEventListener: (_event: string, listener: typeof onChange) => {
      onChange = listener;
      return {
        remove: () => {
          removed = true;
        },
      };
    },
  };
  const api = {
    detail: async () => {
      reads++;
      if (reads === 1)
        await new Promise<void>((resolve) => {
          releaseRead = resolve;
        });
      return session;
    },
    proposeReschedule: async () => {
      posts++;
      schedule.version++;
      schedule.status = "NEEDS_REVISION";
      schedule.items[0] = {
        ...schedule.items[0]!,
        startAt: input.startAt,
        endAt: input.endAt,
      };
      return {
        id: schedule.id,
        version: schedule.version,
        status: "NEEDS_REVISION",
      };
    },
  };
  const mocks = Object.entries({
    react: {
      useCallback: (value: unknown) => value,
      useMemo: (build: () => unknown) => build(),
      useRef: (value: unknown) => ({ current: value }),
      useSyncExternalStore: (_subscribe: unknown, snapshot: () => unknown) =>
        snapshot(),
    },
    "expo-router": {
      useFocusEffect: (effect: () => () => void) => cleanup.push(effect()),
    },
    "react-native": { AppState },
    "@tanstack/react-query": {
      useQueryClient: () => ({
        cancelQueries: async () => {},
        setQueryData() {},
        invalidateQueries: async () => {},
      }),
    },
    "@/features/learning-paths/state": {
      useRefreshLearningPath: () => async () => {},
    },
    "../runtime": {
      useSessionsRuntime: () => ({
        api,
        userId: session.teacherId,
        key: ["sessions", session.teacherId, 1],
        enabled: true,
        isCurrent: () => true,
      }),
    },
    "./use-session-context": {
      useSessionContext: () => ({
        context: resolveSessionContext(session, path),
        refetch: async () => ({ data: path }),
      }),
    },
  }).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
  try {
    delete local.cache[filename];
    const { useSessionReschedule } = local(filename);
    const action = useSessionReschedule(session);
    const pending = action.propose(schedule.id, input);
    assert.ok(releaseRead);
    AppState.currentState = "background";
    onChange("background");
    AppState.currentState = "active";
    onChange("active");
    releaseRead();
    await pending;
    assert.equal(posts, 0);
    assert.equal(reads, 1);
    await action.propose(schedule.id, input);
    assert.equal(posts, 1, "only a new explicit submission sends a proposal");
    cleanup.forEach((dispose) => dispose());
    assert.equal(removed, true);
    await action.propose(schedule.id, {
      ...input,
      expectedVersion: schedule.version,
    });
    assert.equal(posts, 1, "blurred screens cannot submit");
  } finally {
    mocks.forEach((handle) => handle.restore());
    delete local.cache[filename];
  }
});
