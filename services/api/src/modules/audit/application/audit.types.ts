import type {
  Actor,
  RoleCode,
} from "../../../shared/authorization/authorization.types";
import type { RequestContext } from "../../../shared/http/request-context";
import type { AuditAction } from "../domain/audit-action.catalog";

export type AuditActor =
  | { kind: "HUMAN"; userId: string; roles: readonly RoleCode[] }
  | { kind: "SYSTEM"; name: string };

export type AuditSnapshot = Readonly<Record<string, unknown>>;

export type AuditInput = {
  actor: AuditActor;
  action: AuditAction;
  target: { type: string; id: string };
  before?: AuditSnapshot;
  after?: AuditSnapshot;
  reason: string;
  context: RequestContext;
};

/** Use only after an authenticated request's Actor has been loaded by authorization. */
export function auditActorFromActor(actor: Actor): AuditActor {
  return { kind: "HUMAN", userId: actor.userId, roles: [...actor.roles] };
}
