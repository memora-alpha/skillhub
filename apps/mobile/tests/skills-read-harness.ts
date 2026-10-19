import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { mock, type MockModuleContext } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";
import * as zod from "zod";
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
import * as skillFilter from "../src/features/skills/utils/skill-filter";
import * as verificationState from "../src/features/skills/utils/verification-state";
import * as publicSkill from "../src/features/skills/utils/find-public-skill";
import * as skillTypes from "../src/features/skills/types/skills";
import * as evidenceTime from "../src/features/skills/utils/evidence-time";
import * as ownSkillOrder from "../src/features/skills/utils/own-skill-order";
import * as evidenceProgress from "../src/features/skills/utils/evidence-progress";
import {
  batch,
  harness,
  ids,
  ownSkill,
  paginated,
  success,
} from "./skills-fixtures";

const sourceModules = new Map(
  [
    "hooks/use-private-skill-query.ts",
    "hooks/use-skill-queries.ts",
    "hooks/use-public-skill-queries.ts",
    "hooks/use-public-skill.ts",
    "screens/SkillDetailScreen.tsx",
    "screens/VerificationDetailScreen.tsx",
    "screens/MySkillsScreen.tsx",
    "screens/public-skill-detail-screen.tsx",
    "components/VerificationHistory.tsx",
    "components/VerificationForm.tsx",
    "hooks/use-pending-back.ts",
    "../profile/screens/public-profile-preview-screen.tsx",
  ].map((path) => [
    path,
    new URL(`../src/features/skills/${path}`, import.meta.url),
  ]),
);
const dependencies = new Map<string, unknown>([
  ["zod", zod],
  ["../utils/skill-filter", skillFilter],
  ["../utils/verification-state", verificationState],
  ["../utils/find-public-skill", publicSkill],
  ["../types/skills", skillTypes],
  ["../utils/evidence-time", evidenceTime],
  ["../utils/own-skill-order", ownSkillOrder],
  ["../utils/evidence-progress", evidenceProgress],
]);

export function sourceModule(relative: string, mocks: Record<string, unknown>) {
  const file = sourceModules.get(relative);
  if (!file) throw new Error(`Source module is not allowed: ${relative}`);
  const local = createRequire(file);
  const filename = fileURLToPath(file);
  const source = ts.createSourceFile(
    filename,
    readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  const imported = source.statements.flatMap((statement) => {
    if (
      ts.isImportDeclaration(statement) &&
      !statement.importClause?.isTypeOnly &&
      ts.isStringLiteral(statement.moduleSpecifier)
    )
      return [statement.moduleSpecifier.text];
    if (
      ts.isExportDeclaration(statement) &&
      !statement.isTypeOnly &&
      statement.moduleSpecifier &&
      ts.isStringLiteral(statement.moduleSpecifier)
    )
      return [statement.moduleSpecifier.text];
    return [];
  });
  const replacements = new Map<string, Record<string, unknown>>();
  const jsx = (type: unknown, props: unknown) => ({ type, props });
  replacements.set("react/jsx-runtime", {
    jsx,
    jsxs: jsx,
    Fragment: "Fragment",
  });
  for (const name of imported) {
    let value: unknown;
    if (Object.hasOwn(mocks, name)) value = mocks[name];
    else if (name === "./use-public-skill-queries")
      value = sourceModule("hooks/use-public-skill-queries.ts", mocks);
    else if (dependencies.has(name)) value = dependencies.get(name);
    else throw new Error(`Dependency must be explicitly mocked: ${name}`);
    replacements.set(name, value as Record<string, unknown>);
  }
  const contexts: MockModuleContext[] = [];
  try {
    for (const [name, namedExports] of replacements) {
      contexts.push(
        mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
      );
    }
    delete local.cache[filename];
    return local(filename) as Record<string, (...args: unknown[]) => unknown>;
  } finally {
    delete local.cache[filename];
    for (const context of contexts.reverse()) context.restore();
  }
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
    let payload: ReturnType<typeof success> = paginated([ownSkill]);
    if (path.includes(`/verifications/${ids.verification}`))
      payload = success(batch);
    else if (path.includes("/verifications")) payload = paginated([batch]);
    if (status === 200) return { payload };
    return {
      status,
      payload: {
        success: false,
        statusCode: status,
        message: status === 403 ? "SKILL_PERMISSION_REQUIRED" : "Unavailable",
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
    fetch(key: QueryKey, infinite = false) {
      const o = options.get(JSON.stringify(key))!;
      if (infinite)
        return client.fetchInfiniteQuery(
          o as Parameters<typeof client.fetchInfiniteQuery>[0],
        );
      return client.fetchQuery({ ...o, staleTime: 0 });
    },
  };
}
