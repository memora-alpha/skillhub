import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { ModuleRef, Reflector } from "@nestjs/core";
import { REQUIRED_PERMISSIONS } from "./access.decorators";
import type { AuthorizedRequest } from "./authorization.types";
import {
  RESOURCE_POLICY,
  type ResourceAccessResolver,
  type ResourcePolicy,
} from "./check-resource.decorator";
import type { PermissionCode } from "./permission.catalog";

const resourceIdPattern =
  /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[0-9A-HJKMNP-TV-Z]{26})$/i;

@Injectable()
export class ResourceAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly moduleRef: ModuleRef,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    const declarations = targets
      .map((target) =>
        this.reflector.get<ResourcePolicy>(RESOURCE_POLICY, target),
      )
      .filter((value): value is ResourcePolicy => value !== undefined);
    if (declarations.length > 1) {
      throw new InternalServerErrorException("Conflicting resource policies");
    }
    const policy = declarations[0];
    if (!policy) return true;
    const required = targets.flatMap(
      (target) =>
        this.reflector.get<PermissionCode[]>(REQUIRED_PERMISSIONS, target) ??
        [],
    );
    if (!required.includes(policy.operation)) {
      throw new InternalServerErrorException("Missing resource permission");
    }
    const request = context.switchToHttp().getRequest<AuthorizedRequest>();
    if (!request.actor) throw new UnauthorizedException();
    const id = request.params?.[policy.idParam];
    if (!id || !resourceIdPattern.test(id)) throw new BadRequestException();

    let resolver: ResourceAccessResolver;
    try {
      resolver = this.moduleRef.get(policy.resolver, { strict: false });
    } catch {
      throw new InternalServerErrorException("Missing resource resolver");
    }
    if (!resolver) {
      throw new InternalServerErrorException("Missing resource resolver");
    }
    let decision: Awaited<ReturnType<ResourceAccessResolver["check"]>>;
    try {
      decision = await resolver.check({
        actor: request.actor,
        resourceId: id,
        operation: policy.operation,
      });
    } catch {
      throw new ServiceUnavailableException();
    }
    if (decision !== "allow") throw new NotFoundException();
    return true;
  }
}
