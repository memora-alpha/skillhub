import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { AppError } from "@/lib/http/errors";

type Denial = { at: number; error: AppError; target: QueryKey };
const privateKinds = new Set(["own", "detail", "history", "verification"]);
const readKinds = new Set([...privateKinds, "public", "public-detail"]);

// One instance per session. Denials outlive query GC and only a fresh read of
// the same query may restore access. Writes never grant read authority.
export function createSkillReadAccess(
  client: QueryClient,
  scope: QueryKey,
  isCurrent: () => boolean,
  onDenied: (target: QueryKey) => void = () => {},
) {
  let clock = 0;
  let revision = 0;
  const denials = new Map<string, Denial>();
  const approvals = new Map<string, number>();
  const listeners = new Set<() => void>();
  const relative = (key: QueryKey) => key.slice(scope.length);
  const matches = (target: QueryKey, key: QueryKey) =>
    (target[0] === "own" && privateKinds.has(String(key[0]))) ||
    (target[0] === "public"
      ? (key[0] === "public" || key[0] === "public-detail") &&
        key[1] === target[1]
      : target[0] === "history"
        ? (key[0] === "history" || key[0] === "verification") &&
          key[1] === target[1]
        : target.every((part, index) => key[index] === part));
  function latest(key: QueryKey) {
    return [...denials.values()].reduce<Denial | undefined>(
      (last, denial) =>
        matches(denial.target, relative(key)) && (!last || denial.at > last.at)
          ? denial
          : last,
      undefined,
    );
  }
  function denied(key: QueryKey) {
    const last = latest(key);
    return last && last.at >= (approvals.get(JSON.stringify(key)) ?? 0)
      ? last.error
      : undefined;
  }
  function notify() {
    revision++;
    listeners.forEach((listener) => listener());
  }
  function reject(key: QueryKey, error: AppError) {
    const source = relative(key);
    const target =
      source[0] === "public" || source[0] === "public-detail"
        ? ["public", source[1]]
        : source[0] === "own" ||
            source[0] === "detail" ||
            error.code === "SKILL_PERMISSION_REQUIRED"
          ? ["own"]
          : source;
    denials.set(JSON.stringify(target), { at: ++clock, error, target });
    onDenied(target);
    for (const query of client.getQueryCache().findAll({ queryKey: scope })) {
      const resource = relative(query.queryKey);
      if (readKinds.has(String(resource[0])) && matches(target, resource))
        query.setState({ data: undefined, dataUpdatedAt: 0 });
    }
    notify();
  }
  return {
    denied,
    snapshot: () => revision,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    async read<T>(key: QueryKey, load: () => Promise<T>): Promise<T> {
      const ticket = ++clock;
      if (!isCurrent()) throw new AppError("session");
      try {
        const value = await load();
        if (!isCurrent() || ticket <= (latest(key)?.at ?? 0))
          throw new AppError("session");
        const wasDenied = !!denied(key);
        approvals.set(JSON.stringify(key), ticket);
        if (wasDenied) notify();
        return value;
      } catch (error) {
        if (!isCurrent()) throw new AppError("session");
        if (error instanceof AppError && [403, 404].includes(error.status))
          reject(key, error);
        throw error;
      }
    },
  };
}
