import { StaffApiError, type ApiOptions, type PortalApi } from "./client";
import { createDemoData, type DemoData } from "./demo-data";
import { validateRules } from "./moderation-rules";
import type { ApiEnvelope } from "./types";

type Storage = Pick<globalThis.Storage, "getItem" | "setItem" | "removeItem">;
const storageKey = (actorId: string) => `skillhub:admin-demo:v1:${actorId}`;

export function resetDemoData(actorId: string, storage: Storage) {
  storage.removeItem(storageKey(actorId));
}

function readData(actorId: string, storage: Storage): DemoData {
  const raw = storage.getItem(storageKey(actorId));
  if (!raw) return createDemoData(actorId);
  try {
    const data = JSON.parse(raw) as DemoData;
    if (
      data.version !== 1 ||
      ![
        data.users,
        data.skills,
        data.tags,
        data.tagRequests,
        data.verifications,
        data.requests,
        data.reports,
        data.materials,
        data.notifications,
        data.ledger,
      ].every(Array.isArray)
    )
      throw new Error("Invalid demo data");
    return data;
  } catch {
    throw new StaffApiError(400, "DEMO_DATA_INVALID");
  }
}

function required<T>(items: T[], matches: (item: T) => boolean): T {
  const item = items.find(matches);
  if (!item) throw new StaffApiError(404, "DEMO_ITEM_NOT_FOUND");
  return item;
}
function expectVersion(
  item: { version?: number; listingVersion?: number },
  body: Record<string, unknown>,
) {
  const expected = body.expectedVersion ?? body.expectedListingVersion;
  if (expected !== (item.version ?? item.listingVersion))
    throw new StaffApiError(409, "DEMO_VERSION_CONFLICT");
}
function text(value: unknown, minimum = 1): string {
  if (typeof value !== "string" || value.trim().length < minimum)
    throw new StaffApiError(400, "INVALID_DEMO_INPUT");
  return value.trim();
}
function paginated<T>(items: T[], params: URLSearchParams): ApiEnvelope<T[]> {
  const limit = Number(params.get("limit") ?? 20);
  const cursor = params.get("cursor");
  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 100 ||
    (cursor && !/^demo:\d+$/.test(cursor))
  )
    throw new StaffApiError(400, "INVALID_DEMO_INPUT");
  const offset = cursor ? Number(cursor.slice(5)) : 0;
  const data = items.slice(offset, offset + limit);
  const nextCursor =
    offset + limit < items.length ? `demo:${offset + limit}` : null;
  return {
    success: true,
    data,
    meta: { pagination: { limit, nextCursor, hasMore: nextCursor !== null } },
  };
}

// This adapter is selected explicitly by the signed-in Admin. It never fetches,
// reads cookies, or writes real records, even for buttons that normally mutate BE.
export function createDemoApi(actorId: string, storage: Storage): PortalApi {
  return async <T>(
    path: string,
    options: ApiOptions = {},
  ): Promise<ApiEnvelope<T>> => {
    options.signal?.throwIfAborted();
    const data = readData(actorId, storage);
    const url = new URL(path, "https://demo.invalid/");
    const [root, id, action, nestedId] = url.pathname.slice(1).split("/");
    const method = options.method ?? "GET";
    const body = options.body ?? {};
    const params = url.searchParams;
    const now = new Date().toISOString();
    const response = (value: unknown): ApiEnvelope<T> => ({
      success: true,
      data: structuredClone(value) as T,
    });
    const save = (value: unknown = null) => {
      options.signal?.throwIfAborted();
      try {
        storage.setItem(storageKey(actorId), JSON.stringify(data));
      } catch {
        throw new StaffApiError(400, "DEMO_STORAGE_UNAVAILABLE");
      }
      return response(value);
    };
    const page = <Row>(items: Row[]) =>
      paginated(items, params) as ApiEnvelope<T>;
    const filtered = <
      Row extends { status?: string; label?: string; name?: string },
    >(
      items: Row[],
    ) =>
      items.filter(
        (item) =>
          (!params.get("status") || item.status === params.get("status")) &&
          `${item.label ?? item.name ?? ""}`
            .toLocaleLowerCase("vi")
            .includes((params.get("q") ?? "").toLocaleLowerCase("vi")),
      );

    if (root === "materials") {
      if (method === "GET" && !id)
        return response(
          data.materials
            .filter(
              (item) =>
                item.status === (params.get("status") ?? "PENDING_REVIEW"),
            )
            .slice(0, 100),
        );
      const item = required(data.materials, (row) => row.id === id);
      if (
        method === "POST" &&
        ["approve", "reject", "hide", "unhide"].includes(action ?? "")
      ) {
        expectVersion(item, body);
        const valid =
          action === "approve" || action === "reject"
            ? item.status === "PENDING_REVIEW"
            : action === "hide"
              ? item.status === "PUBLISHED"
              : item.status === "HIDDEN";
        if (!valid) throw new StaffApiError(409, "MATERIAL_TRANSITION_INVALID");
        if (
          (action === "approve" || action === "unhide") &&
          item.ownerId === actorId
        )
          throw new StaffApiError(403, "MATERIAL_SELF_REVIEW_FORBIDDEN");
        const reason =
          action === "approve" ? String(body.reason ?? "") : text(body.reason);
        item.status =
          action === "hide"
            ? "HIDDEN"
            : action === "reject"
              ? "REJECTED"
              : "PUBLISHED";
        item.moderationStatus = action === "reject" ? "REJECTED" : "APPROVED";
        if (action === "reject") item.rejectReason = reason;
        item.reviewedAt = now;
        item.updatedAt = now;
        return save(item);
      }
    }
    if (root === "wallet" && method === "GET") {
      if (!id) return response(data.wallet);
      if (id === "transactions") {
        if (action)
          return response(required(data.ledger, (row) => row.id === action));
        return page(
          data.ledger.filter(
            (row) =>
              (!params.get("type") || row.type === params.get("type")) &&
              (!params.get("referenceType") ||
                row.referenceType === params.get("referenceType")),
          ),
        );
      }
    }
    if (root === "reputation" && method === "GET")
      return response(data.reputation);
    if (root === "notifications") {
      if (method === "GET" && !id) return page(data.notifications);
      if (method === "PATCH" && action === "read") {
        required(data.notifications, (row) => row.id === id).readAt = now;
        return save();
      }
    }
    if (root === "achievements") {
      if (method === "GET" && !id) return response(data.achievements);
      if (method === "PATCH" && id === "selected-title") {
        if (
          body.code != null &&
          !data.achievements.items.some((item) => item.code === body.code)
        )
          throw new StaffApiError(409, "TITLE_NOT_UNLOCKED");
        data.achievements.selectedTitle =
          data.achievements.items.find((item) => item.code === body.code)
            ?.title ?? null;
        return save({ selectedTitle: data.achievements.selectedTitle });
      }
    }
    if (root === "moderation-rules") {
      if (method === "GET") return response(data.rules);
      if (method === "PUT") {
        expectVersion(data.rules, body);
        if (!Array.isArray(body.rules))
          throw new StaffApiError(400, "INVALID_DEMO_INPUT");
        const rules = body.rules.map(
          (rule: { category?: unknown; pattern?: unknown }) => ({
            category: text(rule.category),
            pattern: text(rule.pattern),
          }),
        );
        if (validateRules(rules))
          throw new StaffApiError(400, "INVALID_DEMO_INPUT");
        text(body.reason, 10);
        data.rules = { rules, version: data.rules.version + 1, readAt: now };
        return save(data.rules);
      }
    }
    if (root === "reauthenticate" && method === "POST") {
      text(body.password);
      // A local proof belongs only to this sandbox and never goes to the API.
      return response({ reauthToken: "demo-only-proof" });
    }
    if (root === "users") {
      if (method === "GET" && !id)
        return page(
          data.users.filter(
            (user) =>
              (!params.get("status") ||
                user.accountStatus === params.get("status")) &&
              (!params.get("role") || user.roles.includes(params.get("role")!)),
          ),
        );
      const user = required(data.users, (row) => row.userId === id);
      if (user.userId === actorId || user.roles.includes("ADMIN"))
        throw new StaffApiError(403, "ADMIN_ROLE_CANNOT_BE_REPLACED_BY_STAFF");
      if (method === "POST" && (action === "lock" || action === "unlock")) {
        text(body.reason);
        if (
          (action === "lock" && user.accountStatus !== "ACTIVE") ||
          (action === "unlock" && user.accountStatus !== "LOCKED")
        )
          throw new StaffApiError(409, "DEMO_VERSION_CONFLICT");
        user.accountStatus = action === "lock" ? "LOCKED" : "ACTIVE";
        return save();
      }
      if (
        action === "roles" &&
        nestedId === "staff" &&
        ["PUT", "DELETE"].includes(method)
      ) {
        text(body.reason);
        if (body.reauthToken !== "demo-only-proof")
          throw new StaffApiError(400, "INVALID_DEMO_INPUT");
        user.roles = [method === "PUT" ? "STAFF" : "USER"];
        return save();
      }
    }
    if (root === "skills") {
      if (id && action === "levels") {
        required(data.skills, (skill) => skill.id === id);
        const levels = (data.levels[id] ??= []);
        if (method === "GET") return page(levels);
        if (method === "POST") {
          const code = text(body.code);
          if (levels.some((level) => level.code === code))
            throw new StaffApiError(409, "SKILL_LEVEL_DUPLICATE");
          const level = {
            id: crypto.randomUUID(),
            skillId: id,
            code,
            name: text(body.name, 2),
            description: String(body.description ?? ""),
            sortOrder: Number(body.sortOrder),
            status:
              body.status === "INACTIVE"
                ? ("INACTIVE" as const)
                : ("ACTIVE" as const),
            version: 1,
          };
          levels.push(level);
          return save(level);
        }
        if (method === "PATCH") {
          const level = required(levels, (row) => row.id === nestedId);
          expectVersion(level, body);
          Object.assign(level, {
            name: text(body.name, 2),
            description: body.description,
            sortOrder: body.sortOrder,
            status: body.status,
            version: level.version + 1,
          });
          return save(level);
        }
      }
      if (method === "GET" && !id) return page(filtered(data.skills));
      if (method === "POST" && !id) {
        const name = text(body.name, 2);
        if (data.skills.some((skill) => skill.name === name))
          throw new StaffApiError(409, "SKILL_LEVEL_DUPLICATE");
        const skill = {
          id: crypto.randomUUID(),
          name,
          slug: String(body.slug ?? `test-${Date.now()}`),
          description: String(body.description ?? ""),
          categoryId:
            typeof body.categoryId === "string" ? body.categoryId : null,
          status:
            body.status === "INACTIVE"
              ? ("INACTIVE" as const)
              : ("ACTIVE" as const),
          version: 1,
          createdAt: now,
          updatedAt: now,
        };
        data.skills.unshift(skill);
        data.levels[skill.id] = [];
        return save(skill);
      }
      const skill = required(data.skills, (row) => row.id === id);
      if (
        method === "PATCH" ||
        (method === "POST" && (action === "archive" || action === "restore"))
      ) {
        expectVersion(skill, body);
        if (method === "PATCH")
          Object.assign(skill, {
            name: text(body.name, 2),
            slug: body.slug ?? skill.slug,
            description: body.description,
            categoryId: body.categoryId,
            status: body.status ?? skill.status,
          });
        else
          skill.status =
            action === "archive"
              ? "ARCHIVED"
              : body.status === "INACTIVE"
                ? "INACTIVE"
                : "ACTIVE";
        skill.version++;
        skill.updatedAt = now;
        return save(skill);
      }
    }
    if (root === "tags") {
      if (method === "GET" && !id) return page(filtered(data.tags));
      if (method === "POST" && !id) {
        const label = text(body.label);
        if (
          data.tags.some(
            (tag) =>
              tag.label.toLocaleLowerCase("vi") ===
              label.toLocaleLowerCase("vi"),
          )
        )
          throw new StaffApiError(409, "TAG_ALREADY_EXISTS");
        const tag = {
          id: crypto.randomUUID(),
          label,
          status: "ACTIVE" as const,
          version: 1,
          createdAt: now,
          updatedAt: now,
        };
        data.tags.unshift(tag);
        return save(tag);
      }
      if (method === "PATCH") {
        const tag = required(data.tags, (row) => row.id === id);
        expectVersion(tag, body);
        if (body.label !== undefined) tag.label = text(body.label);
        if (body.status === "ACTIVE" || body.status === "INACTIVE")
          tag.status = body.status;
        tag.version++;
        tag.updatedAt = now;
        return save(tag);
      }
    }
    if (root === "tag-requests") {
      if (method === "GET")
        return id
          ? response(required(data.tagRequests, (row) => row.id === id))
          : page(filtered(data.tagRequests));
      if (method === "POST" && (action === "approve" || action === "reject")) {
        const request = required(data.tagRequests, (row) => row.id === id);
        expectVersion(request, body);
        if (request.status !== "PENDING")
          throw new StaffApiError(409, "TAG_REQUEST_NOT_PENDING");
        request.status = action === "approve" ? "APPROVED" : "REJECTED";
        request.reviewedAt = now;
        request.reviewedByUserId = actorId;
        request.version++;
        if (action === "reject") request.rejectReason = text(body.reason);
        else {
          const tag = data.tags.find((row) => row.label === request.label) ?? {
            id: crypto.randomUUID(),
            label: request.label,
            status: "ACTIVE" as const,
            version: 1,
            createdAt: now,
            updatedAt: now,
          };
          if (!data.tags.some((row) => row.id === tag.id)) data.tags.push(tag);
          request.resultTagId = tag.id;
        }
        return save(request);
      }
    }
    if (root === "verifications") {
      if (method === "GET")
        return id
          ? response(required(data.verifications, (row) => row.id === id))
          : page(filtered(data.verifications));
      if (method === "POST" && (action === "approve" || action === "reject")) {
        const item = required(data.verifications, (row) => row.id === id);
        expectVersion(item, body);
        if (item.status !== "PENDING")
          throw new StaffApiError(409, "DEMO_VERSION_CONFLICT");
        item.status = action === "approve" ? "APPROVED" : "REJECTED";
        item.reviewerId = actorId;
        item.reviewedAt = now;
        item.note = String(body.note ?? "");
        item.rejectReason =
          action === "reject"
            ? text(body.rejectReason ?? body.reason ?? body.note)
            : null;
        item.version++;
        return save(item);
      }
    }
    if (root === "learning-requests") {
      if (method === "GET")
        return page(
          data.requests.filter((item) => item.moderationStatus === "PENDING"),
        );
      if (method === "POST" && (action === "approve" || action === "reject")) {
        const item = required(data.requests, (row) => row.id === id);
        expectVersion(item, body);
        item.status = action === "approve" ? "OPEN" : "REJECTED";
        item.moderationStatus = action === "approve" ? "APPROVED" : "REJECTED";
        item.moderationRejectReason =
          action === "reject" ? text(body.reason ?? body.note) : null;
        item.version++;
        return save(item);
      }
    }
    if (root === "reports") {
      if (method === "GET")
        return id
          ? response(required(data.reports, (row) => row.id === id))
          : response(
              data.reports.filter(
                (item) => !["RESOLVED", "REJECTED"].includes(item.status),
              ),
            );
      if (method === "POST") {
        const item = required(data.reports, (row) => row.id === id);
        if (
          [body.violations, body.creditAdjustments, body.reversals].some(
            (value) => Array.isArray(value) && value.length > 0,
          ) ||
          body.restriction !== undefined
        )
          throw new StaffApiError(400, "DEMO_RESOLUTION_UNSUPPORTED");
        if (action === "claim") {
          if (item.status !== "OPEN")
            throw new StaffApiError(409, "DEMO_VERSION_CONFLICT");
          item.handlerId = actorId;
          item.status = "UNDER_REVIEW";
          return save(item);
        }
        if (item.handlerId !== actorId)
          throw new StaffApiError(403, "REPORT_CASE_NOT_ASSIGNED_TO_CALLER");
        if (!["UNDER_REVIEW", "NEED_MORE_INFO"].includes(item.status))
          throw new StaffApiError(409, "DEMO_VERSION_CONFLICT");
        item.resolutionNote = text(body.note);
        if (action === "need-more-info") item.status = "NEED_MORE_INFO";
        else if (action === "resolve" || action === "reject") {
          item.status = action === "resolve" ? "RESOLVED" : "REJECTED";
          item.resolvedAt = now;
          item.blocksSettlement = false;
        } else throw new StaffApiError(404, "DEMO_ROUTE_UNAVAILABLE");
        return save(item);
      }
    }
    throw new StaffApiError(404, "DEMO_ROUTE_UNAVAILABLE");
  };
}
