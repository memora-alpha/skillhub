import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  createParamDecorator,
} from "@nestjs/common";
import { Request } from "express";
import {
  Principal,
  SessionsService,
} from "../../modules/auth/application/services/sessions.service";
export type IdentityRequest = Request & { principal: Principal };
@Injectable()
export class IdentityGuard implements CanActivate {
  constructor(private readonly sessions: SessionsService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<IdentityRequest>();
    const [scheme, token, extra] =
      request.headers.authorization?.split(" ") ?? [];
    if (scheme !== "Bearer" || !token || extra)
      throw new UnauthorizedException();
    request.principal = await this.sessions.principal(token);
    return true;
  }
}
export const CurrentIdentity = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Principal =>
    ctx.switchToHttp().getRequest<IdentityRequest>().principal,
);
