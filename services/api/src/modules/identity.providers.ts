import { SessionsService } from "./auth/application/services/sessions.service";
import { OtpService } from "./auth/application/services/otp.service";
import { ReauthProofService } from "./auth/application/services/reauth-proof.service";
import { UsersService } from "./users/application/services/users.service";
import { ProfileReader } from "./users/application/services/profile-reader.service";
import { AccountModerationService } from "./users/application/services/account-moderation.service";
import { StaffRoleChangeService } from "./users/application/services/staff-role-change.service";
import { IdentityEmailIntentService } from "./notifications/application/services/identity-email-intent.service";
import { AuditService } from "./audit/application/audit.service";
import { RegisterUseCase } from "./auth/application/use-cases/register.use-case";
import { ResendOtpUseCase } from "./auth/application/use-cases/resend-otp.use-case";
import { VerifyEmailUseCase } from "./auth/application/use-cases/verify-email.use-case";
import { LoginUseCase } from "./auth/application/use-cases/login.use-case";
import { ResetPasswordUseCase } from "./auth/application/use-cases/reset-password.use-case";
import { ReauthenticateUseCase } from "./auth/application/use-cases/reauthenticate.use-case";
import { RefreshTokenUseCase } from "./auth/application/use-cases/refresh-token.use-case";
import { LogoutUseCase } from "./auth/application/use-cases/logout.use-case";
import { LogoutAllUseCase } from "./auth/application/use-cases/logout-all.use-case";
import { GetOwnIdentityUseCase } from "./users/application/use-cases/get-own-identity.use-case";
import { UpdateProfileUseCase } from "./users/application/use-cases/update-profile.use-case";
import { GetPublicProfileUseCase } from "./users/application/use-cases/get-public-profile.use-case";
import { ListUsersUseCase } from "./users/application/use-cases/list-users.use-case";
import { LockUserUseCase } from "./users/application/use-cases/lock-user.use-case";
import { UnlockUserUseCase } from "./users/application/use-cases/unlock-user.use-case";
import { AssignStaffUseCase } from "./users/application/use-cases/assign-staff.use-case";
import { RemoveStaffUseCase } from "./users/application/use-cases/remove-staff.use-case";
import { UploadAvatarUseCase } from "./users/application/use-cases/upload-avatar.use-case";
import { GetAvatarStatusUseCase } from "./users/application/use-cases/get-avatar-status.use-case";
import { RemoveAvatarUseCase } from "./users/application/use-cases/remove-avatar.use-case";
import { ProcessAvatarUseCase } from "./users/application/use-cases/process-avatar.use-case";
import { ReconcileAvatarsUseCase } from "./users/application/use-cases/reconcile-avatars.use-case";
import { DeliverIdentityEmailUseCase } from "./notifications/application/use-cases/deliver-identity-email.use-case";
import { ReconcileIdentityEmailsUseCase } from "./notifications/application/use-cases/reconcile-identity-emails.use-case";
import { AuthRepository } from "./auth/application/ports/auth-repository";
import { PrismaAuthRepository } from "./auth/infrastructure/persistence/prisma-auth-repository";
import { UsersRepository } from "./users/application/ports/users-repository";
import { PrismaUsersRepository } from "./users/infrastructure/persistence/prisma-users-repository";
import { AvatarRepository } from "./users/application/ports/avatar-repository";
import { PrismaAvatarRepository } from "./users/infrastructure/persistence/prisma-avatar-repository";
import { IdentityEmailRepository } from "./notifications/application/ports/identity-email-repository";
import { PrismaIdentityEmailRepository } from "./notifications/infrastructure/persistence/prisma-identity-email-repository";
import { AuditRepository } from "./audit/application/ports/audit-repository";
import { PrismaAuditRepository } from "./audit/infrastructure/persistence/prisma-audit-repository";
import {
  AvatarStoragePort,
  AvatarScannerPort,
  AvatarInspector,
  AvatarJobs,
} from "./users/application/ports/avatar-providers";
import {
  IdentityMailer,
  IdentityEmailJobs,
} from "./notifications/application/ports/identity-email-providers";
import { AvatarStorage } from "../infrastructure/storage/avatar-storage";
import { AvatarScanner } from "../infrastructure/storage/avatar-scanner";
import { SmtpAdapter } from "../infrastructure/email/smtp.adapter";
import { SharpAvatarInspector } from "./users/infrastructure/storage/sharp-avatar-inspector";
import { BullAvatarJobs } from "./users/infrastructure/jobs/avatar-jobs";
import { BullIdentityEmailJobs } from "./notifications/infrastructure/jobs/identity-email-jobs";
// Shared by runtime composition and integration fixtures; repositories remain private.
export const IDENTITY_APPLICATION_PROVIDERS = [
  SessionsService,
  OtpService,
  ReauthProofService,
  UsersService,
  ProfileReader,
  AccountModerationService,
  StaffRoleChangeService,
  IdentityEmailIntentService,
  AuditService,
  RegisterUseCase,
  ResendOtpUseCase,
  VerifyEmailUseCase,
  LoginUseCase,
  ResetPasswordUseCase,
  ReauthenticateUseCase,
  RefreshTokenUseCase,
  LogoutUseCase,
  LogoutAllUseCase,
  GetOwnIdentityUseCase,
  UpdateProfileUseCase,
  GetPublicProfileUseCase,
  ListUsersUseCase,
  LockUserUseCase,
  UnlockUserUseCase,
  AssignStaffUseCase,
  RemoveStaffUseCase,
  UploadAvatarUseCase,
  GetAvatarStatusUseCase,
  RemoveAvatarUseCase,
  ProcessAvatarUseCase,
  ReconcileAvatarsUseCase,
  DeliverIdentityEmailUseCase,
  ReconcileIdentityEmailsUseCase,
  { provide: AuthRepository, useClass: PrismaAuthRepository },
  { provide: UsersRepository, useClass: PrismaUsersRepository },
  { provide: AvatarRepository, useClass: PrismaAvatarRepository },
  { provide: IdentityEmailRepository, useClass: PrismaIdentityEmailRepository },
  { provide: AuditRepository, useClass: PrismaAuditRepository },
  SharpAvatarInspector,
  { provide: AvatarStoragePort, useExisting: AvatarStorage },
  { provide: AvatarScannerPort, useExisting: AvatarScanner },
  { provide: AvatarInspector, useExisting: SharpAvatarInspector },
  { provide: AvatarJobs, useClass: BullAvatarJobs },
  { provide: IdentityMailer, useExisting: SmtpAdapter },
  { provide: IdentityEmailJobs, useClass: BullIdentityEmailJobs },
];
