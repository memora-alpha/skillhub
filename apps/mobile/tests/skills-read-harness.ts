import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import {
  QueryClient,
  QueryObserver,
  InfiniteQueryObserver,
} from "@tanstack/react-query";
import type {
  QueryKey,
  QueryObserverOptions,
  InfiniteQueryObserverOptions,
} from "@tanstack/react-query";
import { createSkillReadAccess } from "../src/features/skills/utils/skill-read-access";
import { AppError } from "../src/lib/http/errors";
import {
  batch,
  harness,
  ids,
  ownSkill,
  paginated,
  success,
} from "./skills-fixtures";

const local = createRequire(import.meta.url);
export function sourceModule(relative: string, mocks: Record<string, unknown>) {
  const source = readFileSync(
    new URL(`../src/features/skills/${relative}`, import.meta.url),
    "utf8",
  );
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  });
  const exports: Record<string, (...args: unknown[]) => unknown> = {};
  runInNewContext(outputText, {
    exports,
    require: (name: string) => {
      if (Object.hasOwn(mocks, name)) return mocks[name];
      if (name === "react/jsx-runtime")
        return {
          jsx: (type: unknown, props: unknown) => ({ type, props }),
          jsxs: (type: unknown, props: unknown) => ({ type, props }),
        };
      if (name === "./use-public-skill-queries")
        return sourceModule("hooks/use-public-skill-queries.ts", mocks);
      if (name.startsWith("../utils/"))
        return local(`../src/features/skills/utils/${name.slice(9)}`);
      if (name.startsWith("../types/"))
        return local(`../src/features/skills/types/${name.slice(9)}`);
      return local(name);
    },
  });
  return exports;
}

export function readHarness() {
  let status = 200,
    current = true;
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  const scope = ["skills", 1, ids.user] as const;
  const transport = harness((config) => {
    const path = config.url ?? "";
    const payload = path.includes(`/verifications/${ids.verification}`)
      ? success(batch)
      : path.includes("/verifications")
        ? paginated([batch])
        : paginated([ownSkill]);
    return status === 200
      ? { payload }
      : {
          status,
          payload: {
            success: false,
            statusCode: status,
            message:
              status === 403 ? "SKILL_PERMISSION_REQUIRED" : "Unavailable",
          },
        };
  });
  const privateReads = createSkillReadAccess(client, scope, () => current);
  const runtime = {
    api: transport.api,
    scope,
    userId: ids.user,
    privateReads,
    isCurrent: () => current,
    assertCurrent() {
      if (!current) throw new AppError("session");
    },
    deletedSkillIds: new Set<string>(),
    submittedVerifications: new Map(),
    recentlyCreatedSkills: new Map(),
    observeCreatedSkills() {},
    observeVerifications() {},
  };
  const options = new Map<string, QueryObserverOptions>();
  const query = (o: QueryObserverOptions) => {
    options.set(JSON.stringify(o.queryKey), o);
    return new QueryObserver(client, o).getCurrentResult();
  };
  const mocks: Record<string, unknown> = {
    "@tanstack/react-query": {
      useQuery: query,
      useInfiniteQuery: (o: QueryObserverOptions) => {
        options.set(JSON.stringify(o.queryKey), o);
        return new InfiniteQueryObserver(
          client,
          o as InfiniteQueryObserverOptions,
        ).getCurrentResult();
      },
      useQueryClient: () => client,
    },
    "../context/SkillsProvider": { useSkills: () => runtime },
    "./use-skill-read-focus": { useSkillReadFocus() {} },
    react: {
      useEffect() {},
      useSyncExternalStore: (_subscribe: unknown, get: () => unknown) => get(),
    },
  };
  const wrapper = sourceModule("hooks/use-private-skill-query.ts", mocks);
  mocks["./use-private-skill-query"] = wrapper;
  const hooks = sourceModule("hooks/use-skill-queries.ts", mocks);
  Object.assign(hooks, sourceModule("hooks/use-public-skill.ts", mocks));
  return {
    client,
    runtime,
    hooks,
    status: (next: number) => {
      status = next;
    },
    endSession: () => {
      current = false;
    },
    async fetch(key: QueryKey, infinite = false) {
      const o = options.get(JSON.stringify(key))!;
      if (infinite)
        return client.fetchInfiniteQuery(
          o as Parameters<typeof client.fetchInfiniteQuery>[0],
        );
      return client.fetchQuery({ ...o, staleTime: 0 });
    },
  };
}
