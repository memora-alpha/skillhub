import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

// In-memory subset of the Prisma client used by the learning-platform services.
// relation name -> [target model, [[local field, target field], ...], isList]
const relations = {
  learningPath: {
    learningPathVersionPathIdRecords: [
      "learningPathVersion",
      [["id", "pathId"]],
      true,
    ],
  },
  achievement: {
    userAchievementAchievementIdRecords: [
      "userAchievement",
      [["id", "achievementId"]],
      true,
    ],
  },
  reportCase: {
    reportEvidenceCaseIdRecords: ["reportEvidence", [["id", "caseId"]], true],
  },
  learningPlan: {
    pathIdRecord: ["learningPath", [["pathId", "id"]], false],
    learningPlanVersionPlanIdRecords: [
      "learningPlanVersion",
      [["id", "planId"]],
      true,
    ],
  },
  learningPlanVersion: {
    planSessionOutlinePlanVersionRecords: [
      "planSessionOutline",
      [
        ["planId", "planId"],
        ["versionNo", "planVersion"],
      ],
      true,
    ],
  },
  pathVersionPlan: {
    ownedPlanRecord: ["learningPlan", [["planId", "id"]], false],
    planVersionRecord: [
      "learningPlanVersion",
      [
        ["planId", "planId"],
        ["planVersion", "versionNo"],
      ],
      false,
    ],
  },
  scheduleProposal: {
    scheduleVersionProposalRecords: [
      "scheduleVersion",
      [
        ["id", "scheduleProposalId"],
        ["pathId", "pathId"],
      ],
      true,
    ],
    pathIdRecord: ["learningPath", [["pathId", "id"]], false],
  },
  scheduleVersion: {
    proposalRecord: [
      "scheduleProposal",
      [
        ["scheduleProposalId", "id"],
        ["pathId", "pathId"],
      ],
      false,
    ],
    scheduleItemScheduleVersionRecords: [
      "scheduleItem",
      [
        ["scheduleProposalId", "scheduleProposalId"],
        ["versionNo", "scheduleVersion"],
      ],
      true,
    ],
  },
  scheduleItem: {
    scheduleVersionRecord: [
      "scheduleVersion",
      [
        ["scheduleProposalId", "scheduleProposalId"],
        ["scheduleVersion", "versionNo"],
      ],
      false,
    ],
  },
  sessionScheduleHistory: {
    sessionIdRecord: ["session", [["sessionId", "id"]], false],
    scheduleItemIdRecord: ["scheduleItem", [["scheduleItemId", "id"]], false],
  },
};

// Column defaults read from the real schema, so rows look like Prisma's:
// @default(...) and @updatedAt applied, nullable columns null when unset.
const schemaText = readFileSync(
  new URL("../../prisma/schema.prisma", import.meta.url),
  "utf8",
);
const modelNames = new Set(
  [...schemaText.matchAll(/^model (\w+) \{/gm)].map(([, name]) => name),
);
const columnDefaults = new Map();
for (const [, modelName, body] of schemaText.matchAll(
  /^model (\w+) \{([\s\S]*?)^\}/gm,
)) {
  const columns = [];
  for (const line of body.split("\n")) {
    const field = /^\s+(\w+)\s+(\w+)(\[\])?(\?)?(\s.*)?$/.exec(line);
    if (!field || modelNames.has(field[2])) continue;
    const [, name, type, isList, optional, attributes = ""] = field;
    const explicit = /@default\((.*?)\)(?:\s|$)/.exec(attributes)?.[1];
    let value;
    if (attributes.includes("@updatedAt") || explicit === "now()") {
      value = (now) => now();
    } else if (explicit === "uuid()") {
      value = () => randomUUID();
    } else if (explicit !== undefined && /^-?\d+$/.test(explicit)) {
      value = () => (type === "BigInt" ? BigInt(explicit) : Number(explicit));
    } else if (explicit === "true" || explicit === "false") {
      value = () => explicit === "true";
    } else if (explicit !== undefined && /^\w+$/.test(explicit)) {
      value = () => explicit; // enum literal
    } else if (optional && !isList) {
      value = () => null;
    } else {
      continue;
    }
    columns.push([name, value]);
  }
  const clientName = modelName[0].toLowerCase() + modelName.slice(1);
  columnDefaults.set(clientName, columns);
}

// FOR UPDATE lock queries: table -> [model, key field]
const lockTables = {
  learning_paths: ["learningPath", "id"],
  schedule_proposals: ["scheduleProposal", "id"],
  sessions: ["session", "id"],
  credit_wallets: ["creditWallet", "userId"],
  users: ["user", "id"],
};

const operators = new Set([
  "equals",
  "not",
  "in",
  "notIn",
  "gt",
  "gte",
  "lt",
  "lte",
]);

const isPlain = (value) =>
  value !== null &&
  typeof value === "object" &&
  !(value instanceof Date) &&
  !Array.isArray(value);

const scalar = (value) => (value instanceof Date ? value.getTime() : value);

const same = (left, right) => scalar(left) === scalar(right);

function matchValue(value, condition) {
  if (!isPlain(condition)) {
    return condition === null ? value == null : same(value, condition);
  }
  return Object.entries(condition).every(([operator, argument]) => {
    switch (operator) {
      case "equals":
        return matchValue(value, argument);
      case "not":
        return !matchValue(value, argument);
      case "in":
        return argument.some((item) => same(value, item));
      case "notIn":
        return !argument.some((item) => same(value, item));
      case "gt":
        return value != null && scalar(value) > scalar(argument);
      case "gte":
        return value != null && scalar(value) >= scalar(argument);
      case "lt":
        return value != null && scalar(value) < scalar(argument);
      case "lte":
        return value != null && scalar(value) <= scalar(argument);
      default:
        throw new Error(`Unsupported operator ${operator}`);
    }
  });
}

function compare(left, right) {
  if (scalar(left) < scalar(right)) return -1;
  return scalar(left) > scalar(right) ? 1 : 0;
}

export function createFakeDb({ now = () => new Date() } = {}) {
  const tables = new Map();
  const locks = [];
  const rows = (model) => {
    if (!tables.has(model)) tables.set(model, []);
    return tables.get(model);
  };

  function related(model, row, name) {
    const [target, keys, isList] = relations[model][name];
    const found = rows(target).filter((other) =>
      keys.every(([local, foreign]) => same(row[local], other[foreign])),
    );
    return isList ? found : (found[0] ?? null);
  }

  function matches(model, row, where = {}) {
    return Object.entries(where).every(([key, condition]) => {
      if (condition === undefined) return true;
      if (key === "OR")
        return condition.some((part) => matches(model, row, part));
      if (key === "AND") {
        return [condition].flat().every((part) => matches(model, row, part));
      }
      if (key === "NOT") return !matches(model, row, condition);
      const relation = relations[model]?.[key];
      if (relation) {
        const value = related(model, row, key);
        const [target] = relation;
        if (condition.some) {
          return value.some((item) => matches(target, item, condition.some));
        }
        if (condition.is)
          return value !== null && matches(target, value, condition.is);
        throw new Error(`Unsupported relation filter on ${model}.${key}`);
      }
      if (
        isPlain(condition) &&
        !Object.keys(condition).some((k) => operators.has(k))
      ) {
        return matches(model, row, condition); // compound unique key
      }
      return matchValue(row[key], condition);
    });
  }

  function shape(model, row, { include, select } = {}) {
    if (!row) return row;
    const output = select
      ? Object.fromEntries(
          Object.entries(select)
            .filter(([, wanted]) => wanted)
            .map(([key, wanted]) => [
              key,
              relations[model]?.[key]
                ? shapeRelation(model, row, key, wanted)
                : row[key],
            ]),
        )
      : { ...row };
    for (const [name, options] of Object.entries(include ?? {})) {
      if (options) output[name] = shapeRelation(model, row, name, options);
    }
    return output;
  }

  function shapeRelation(model, row, name, options) {
    const [target, , isList] = relations[model][name];
    const args = options === true ? {} : options;
    const value = related(model, row, name);
    return isList ? query(target, value, args) : shape(target, value, args);
  }

  function query(model, list, { where, orderBy, take, include, select } = {}) {
    let result = list.filter((row) => matches(model, row, where));
    for (const order of [orderBy ?? []].flat().reverse()) {
      const [[field, direction]] = Object.entries(order);
      result = [...result].sort(
        (left, right) =>
          compare(left[field], right[field]) * (direction === "desc" ? -1 : 1),
      );
    }
    if (take !== undefined) result = result.slice(0, take);
    return result.map((row) => shape(model, row, { include, select }));
  }

  function insert(model, data) {
    const row = {};
    const nested = [];
    for (const [key, value] of Object.entries(data)) {
      if (relations[model]?.[key]) nested.push([key, value]);
      else if (value !== undefined) row[key] = value;
    }
    for (const [name, value] of columnDefaults.get(model) ?? []) {
      if (!(name in row)) row[name] = value(now);
    }
    rows(model).push(row);
    for (const [name, value] of nested) {
      const [target, keys] = relations[model][name];
      for (const child of [value.create ?? []].flat()) {
        insert(target, {
          ...child,
          ...Object.fromEntries(
            keys.map(([local, foreign]) => [foreign, row[local]]),
          ),
        });
      }
    }
    return row;
  }

  function apply(row, data) {
    for (const [key, value] of Object.entries(data)) {
      if (value === undefined) continue;
      row[key] =
        isPlain(value) && "increment" in value
          ? row[key] + value.increment
          : value;
    }
    row.updatedAt = now();
  }

  function model(name) {
    const find = (where) => rows(name).find((row) => matches(name, row, where));
    return {
      findUnique: ({ where, ...args }) =>
        shape(name, find(where) ?? null, args),
      findUniqueOrThrow: ({ where, ...args }) => {
        const row = find(where);
        if (!row) throw new Error(`${name} not found`);
        return shape(name, row, args);
      },
      findFirst: (args = {}) => query(name, rows(name), args)[0] ?? null,
      findMany: (args = {}) => query(name, rows(name), args),
      count: ({ where } = {}) =>
        rows(name).filter((row) => matches(name, row, where)).length,
      create: ({ data, ...args }) => shape(name, insert(name, data), args),
      createMany: ({ data }) => ({
        count: [data].flat().map((item) => insert(name, item)).length,
      }),
      update: ({ where, data, ...args }) => {
        const row = find(where);
        if (!row) throw new Error(`${name} not found`);
        apply(row, data);
        return shape(name, row, args);
      },
      upsert: ({ where, create, update, ...args }) => {
        const row = find(where);
        if (!row) return shape(name, insert(name, create), args);
        apply(row, update);
        return shape(name, row, args);
      },
      updateMany: ({ where, data }) => {
        const hits = rows(name).filter((row) => matches(name, row, where));
        hits.forEach((row) => apply(row, data));
        return { count: hits.length };
      },
    };
  }

  const models = new Map();
  const base = {
    rows,
    locks,
    seed: (name, data) => insert(name, data),
    $queryRaw(strings, ...values) {
      const sql = strings.join("?");
      if (sql.includes("CURRENT_TIMESTAMP")) return [{ now: now() }];
      if (sql.includes("SELECT DISTINCT p.path_id")) {
        return rows("learningPath")
          .filter((path) => {
            const conversation = rows("conversation").find(
              (c) => c.id === path.conversationId,
            );
            const proposal = rows("proposal").find(
              (p) => p.id === conversation?.proposalId,
            );
            if (
              conversation?.requestId !== values[0] &&
              proposal?.requestId !== values[0]
            )
              return false;
            return (
              path.lockedVersion != null ||
              path.settledAt != null ||
              ["SCHEDULED", "ACTIVE", "COMPLETED"].includes(path.status) ||
              rows("scheduleProposal").some(
                (s) =>
                  s.pathId === path.id &&
                  (s.status === "LOCKED" || s.appliedVersion != null),
              ) ||
              rows("session").some((s) => s.pathId === path.id) ||
              rows("heldCreditAllocation").some((h) => h.pathId === path.id)
            );
          })
          .sort((a, b) => a.id.localeCompare(b.id))
          .slice(0, 2)
          .map(({ id }) => ({ id }));
      }
      const table = Object.keys(lockTables).find((candidate) =>
        sql.includes(`FROM ${candidate}`),
      );
      if (!table) throw new Error(`Unsupported raw query: ${sql}`);
      const [lockModel, key] = lockTables[table];
      locks.push(`${table}:${values[0]}`);
      return rows(lockModel)
        .filter((row) => row[key] === values[0])
        .map((row) => ({ id: row[key] }));
    },
  };
  return new Proxy(base, {
    get(target, property) {
      if (property in target) return target[property];
      if (!models.has(property)) models.set(property, model(property));
      return models.get(property);
    },
  });
}

export const runner = (db) => ({ run: (work) => work(db) });
