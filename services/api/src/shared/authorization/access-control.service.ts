import {
  ForbiddenException,
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import type { AuthenticatedIdentity } from "../authentication/authenticated-identity";
import {
  AUTHORIZATION_READER,
  type Actor,
  type AuthorizationReader,
} from "./authorization.types";
import type { PermissionCode } from "./permission.catalog";

@Injectable()
export class AccessControlService {
  constructor(
    @Inject(AUTHORIZATION_READER) private readonly reader: AuthorizationReader,
  ) {}

  async loadActor(identity: AuthenticatedIdentity, now: Date): Promise<Actor> {
    if (!identity?.userId || !identity.sessionId) {
      throw new UnauthorizedException();
    }
    let actor: Actor | null;
    try {
      actor = await this.reader.loadActor(identity.userId, now);
    } catch {
      throw new ServiceUnavailableException();
    }
    if (!actor || actor.userId !== identity.userId) {
      throw new UnauthorizedException();
    }
    return actor;
  }

  assertPermissions(actor: Actor, required: readonly PermissionCode[]): void {
    if (
      actor.accountStatus !== "ACTIVE" ||
      required.some(
        (permission) =>
          !actor.permissions.has(permission) ||
          actor.blockedPermissions.has(permission),
      )
    ) {
      throw new ForbiddenException();
    }
  }
}
