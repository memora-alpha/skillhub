import { OtpStore } from "../../dist/modules/auth/application/ports/otp-store.js";
import { RedisService } from "../../dist/infrastructure/cache/redis.service.js";
import { Test } from "@nestjs/testing";
import { IDENTITY_APPLICATION_PROVIDERS } from "../../dist/modules/identity.providers.js";
import { PrismaService } from "../../dist/infrastructure/database/prisma.service.js";
import { IdentityConfig } from "../../dist/configs/identity.config.js";
import { AvatarStorage } from "../../dist/infrastructure/storage/avatar-storage.js";
import { AvatarScanner } from "../../dist/infrastructure/storage/avatar-scanner.js";
import { SmtpAdapter } from "../../dist/infrastructure/email/smtp.adapter.js";
import { AvatarJobs } from "../../dist/modules/users/application/ports/avatar-providers.js";
import { IdentityEmailJobs } from "../../dist/modules/notifications/application/ports/identity-email-providers.js";
import { UsersService } from "../../dist/modules/users/application/services/users.service.js";
import { SessionsService } from "../../dist/modules/auth/application/services/sessions.service.js";
import { ProfileReader } from "../../dist/modules/users/application/services/profile-reader.service.js";
import { IdentityEmailIntentService } from "../../dist/modules/notifications/application/services/identity-email-intent.service.js";
import { AuditService } from "../../dist/modules/audit/application/audit.service.js";
import { RegisterUseCase } from "../../dist/modules/auth/application/use-cases/register.use-case.js";
import { ResendOtpUseCase } from "../../dist/modules/auth/application/use-cases/resend-otp.use-case.js";
import { VerifyEmailUseCase } from "../../dist/modules/auth/application/use-cases/verify-email.use-case.js";
import { LoginUseCase } from "../../dist/modules/auth/application/use-cases/login.use-case.js";
import { ResetPasswordUseCase } from "../../dist/modules/auth/application/use-cases/reset-password.use-case.js";
import { ReauthenticateUseCase } from "../../dist/modules/auth/application/use-cases/reauthenticate.use-case.js";
import { RefreshTokenUseCase } from "../../dist/modules/auth/application/use-cases/refresh-token.use-case.js";
import { LogoutUseCase } from "../../dist/modules/auth/application/use-cases/logout.use-case.js";
import { LogoutAllUseCase } from "../../dist/modules/auth/application/use-cases/logout-all.use-case.js";
import { GetOwnIdentityUseCase } from "../../dist/modules/users/application/use-cases/get-own-identity.use-case.js";
import { UpdateProfileUseCase } from "../../dist/modules/users/application/use-cases/update-profile.use-case.js";
import { ListUsersUseCase } from "../../dist/modules/users/application/use-cases/list-users.use-case.js";
import { LockUserUseCase } from "../../dist/modules/users/application/use-cases/lock-user.use-case.js";
import { UnlockUserUseCase } from "../../dist/modules/users/application/use-cases/unlock-user.use-case.js";
import { AssignStaffUseCase } from "../../dist/modules/users/application/use-cases/assign-staff.use-case.js";
import { RemoveStaffUseCase } from "../../dist/modules/users/application/use-cases/remove-staff.use-case.js";
import { UploadAvatarUseCase } from "../../dist/modules/users/application/use-cases/upload-avatar.use-case.js";
import { GetAvatarStatusUseCase } from "../../dist/modules/users/application/use-cases/get-avatar-status.use-case.js";
import { RemoveAvatarUseCase } from "../../dist/modules/users/application/use-cases/remove-avatar.use-case.js";
import { ProcessAvatarUseCase } from "../../dist/modules/users/application/use-cases/process-avatar.use-case.js";
import { ReconcileAvatarsUseCase } from "../../dist/modules/users/application/use-cases/reconcile-avatars.use-case.js";
import { DeliverIdentityEmailUseCase } from "../../dist/modules/notifications/application/use-cases/deliver-identity-email.use-case.js";

// Resolve the same application provider graph as production, substituting only
// controlled external resources. Facades below keep journey tests readable;
// HTTP controllers receive the real use cases from this compiled graph.
export async function createIdentityFixture({
  db,
  redis,
  otpStore,
  config,
  storage,
  scanner,
  smtp,
  queue,
  audit: overrideAudit,
}) {
  const builder = Test.createTestingModule({
    providers: [
      ...IDENTITY_APPLICATION_PROVIDERS,
      { provide: PrismaService, useValue: db },
      { provide: RedisService, useValue: redis ?? {} },
      { provide: IdentityConfig, useValue: config },
      { provide: AvatarStorage, useValue: storage },
      { provide: AvatarScanner, useValue: scanner },
      { provide: SmtpAdapter, useValue: smtp },
    ],
  });
  builder
    .overrideProvider(AvatarJobs)
    .useValue({ enqueue: (id) => queue.add("scan", { id }) });
  builder.overrideProvider(IdentityEmailJobs).useValue({
    enqueue: (id, attempts, payload) =>
      queue.add("deliver", { id, payload }, { jobId: id + "-" + attempts }),
  });
  if (overrideAudit)
    builder.overrideProvider(AuditService).useValue(overrideAudit);
  if (otpStore) builder.overrideProvider(OtpStore).useValue(otpStore);
  const module = await builder.compile();
  const get = (type) => module.get(type);
  const execute = (type) => get(type).execute.bind(get(type));
  const users = Object.assign(Object.create(get(UsersService)), {
    profile: get(ProfileReader).profile.bind(get(ProfileReader)),
    own: execute(GetOwnIdentityUseCase),
    updateProfile: execute(UpdateProfileUseCase),
  });
  const sessions = Object.assign(Object.create(get(SessionsService)), {
    refresh: execute(RefreshTokenUseCase),
    logout: execute(LogoutUseCase),
    logoutAll: execute(LogoutAllUseCase),
  });
  const email = Object.assign(Object.create(get(IdentityEmailIntentService)), {
    deliver: execute(DeliverIdentityEmailUseCase),
  });
  const auth = {
    register: execute(RegisterUseCase),
    resend: execute(ResendOtpUseCase),
    verify: execute(VerifyEmailUseCase),
    login: execute(LoginUseCase),
    reset: execute(ResetPasswordUseCase),
    reauthenticate: execute(ReauthenticateUseCase),
  };
  const admin = {
    list: execute(ListUsersUseCase),
    status: (actor, id, locked, reason) =>
      execute(locked ? LockUserUseCase : UnlockUserUseCase)(actor, id, reason),
    staff: (actor, id, add, proof, reason) =>
      execute(add ? AssignStaffUseCase : RemoveStaffUseCase)(
        actor,
        id,
        proof,
        reason,
      ),
  };
  const avatars = {
    upload: (userId, file) =>
      execute(UploadAvatarUseCase)(
        userId,
        file
          ? { bytes: file.buffer, mime: file.mimetype, size: file.size }
          : undefined,
      ),
    status: execute(GetAvatarStatusUseCase),
    clear: execute(RemoveAvatarUseCase),
    process: execute(ProcessAvatarUseCase),
    reconcile: execute(ReconcileAvatarsUseCase),
  };
  const providers = IDENTITY_APPLICATION_PROVIDERS.map((provider) => ({
    provide: typeof provider === "function" ? provider : provider.provide,
    useValue: get(typeof provider === "function" ? provider : provider.provide),
  }));
  return {
    module,
    providers,
    users,
    sessions,
    email,
    auth,
    admin,
    avatars,
    audit: get(AuditService),
  };
}
