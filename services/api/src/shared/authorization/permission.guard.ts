import {
  CanActivate,
  ExecutionContext,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AccessControlService } from "./access-control.service";
import {
  AUTHENTICATED_ACCESS,
  PUBLIC_ACCESS,
  REQUIRED_PERMISSIONS,
} from "./access.decorators";
import type { AuthorizedRequest } from "./authorization.types";
import type { PermissionCode } from "./permission.catalog";

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly access: AccessControlService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    const isPublic = targets.some((target) =>
      this.reflector.get<boolean>(PUBLIC_ACCESS, target),
    );
    const authenticated = targets.some((target) =>
      this.reflector.get<boolean>(AUTHENTICATED_ACCESS, target),
    );
    const declarations = targets.map((target) =>
      this.reflector.get<PermissionCode[]>(REQUIRED_PERMISSIONS, target),
    );
    const required = declarations.flatMap((codes) => codes ?? []);
    if (
      declarations.some((codes) => codes?.length === 0) ||
      (isPublic && (authenticated || required.length > 0)) ||
      (!isPublic && !authenticated && required.length === 0)
    ) {
      throw new InternalServerErrorException("Invalid access policy");
    }
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthorizedRequest>();
    if (!request.authenticatedIdentity) throw new UnauthorizedException();
    const actor = await this.access.loadActor(
      request.authenticatedIdentity,
      new Date(),
    );
    this.access.assertPermissions(actor, required);
    request.actor = actor;
    return true;
  }
}
