import {
  ConflictException,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { IdentityConfig } from "../../../../configs/identity.config";
import { PrismaService } from "../../../../infrastructure/database/prisma.service";
import {
  lockEmail,
  lockUsers,
  transaction,
} from "../../../../shared/database/identity-transactions";
import { AuditService } from "../../../audit/application/services/audit.service";
import { ReauthProofService } from "../../../auth/application/services/reauth-proof.service";
import {
  Principal,
  SessionsService,
} from "../../../auth/application/services/sessions.service";
import { normalizeEmail } from "../../domain/profile-policy";
import { UsersService } from "../services/users.service";

@Injectable()
export class CreateStaffUseCase {
  constructor(
    private readonly db: PrismaService,
    private readonly config: IdentityConfig,
    private readonly users: UsersService,
    private readonly sessions: SessionsService,
    private readonly reauth: ReauthProofService,
    private readonly audit: AuditService,
  ) {}

  private assertAdmin(actor: Principal) {
    if (
      !actor.roles.includes("ADMIN") ||
      !actor.permissions.includes("roles.staff.assign")
    )
      throw new ForbiddenException();
  }

  async execute(
    actor: Principal,
    data: {
      email: string;
      fullName: string;
      password: string;
      reauthToken: string;
    },
  ) {
    this.assertAdmin(actor);
    const email = normalizeEmail(data.email);
    const passwordHash = await this.config.crypto.hashPassword(data.password);
    return transaction(this.db, async (tx) => {
      // Match registration verification's email lock, then serialize Admin proof use.
      await lockEmail(tx, email);
      await lockUsers(tx, [actor.userId]);
      const live = await this.sessions.assertLive(tx, actor);
      this.assertAdmin(live);
      if (await this.users.byEmail(tx, email))
        throw new ConflictException("EMAIL_ALREADY_EXISTS");
      await this.reauth.consumeReauth(tx, live, data.reauthToken);
      const user = await this.users.create(tx, {
        email,
        fullName: data.fullName,
        passwordHash,
      });
      await this.users.role(tx, user.id, "STAFF", true, live.userId);
      // Trusted Admin provisioning attests the email, like operator Admin creation.
      await this.users.activate(tx, user.id);
      await this.audit.append(tx, {
        actorId: live.userId,
        actorRole: "ADMIN",
        action: "STAFF_CREATED",
        targetType: "User",
        targetId: user.id,
        after: {
          created: true,
          role: "STAFF",
          accountStatus: "ACTIVE",
          emailVerified: true,
        },
      });
      return { userId: user.id };
    });
  }
}
