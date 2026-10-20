import { isEmail } from "class-validator";
import { IdentityConfig } from "../../../configs/identity.config";
import { PrismaService } from "../../../infrastructure/database/prisma.service";
import {
  lockEmail,
  transaction,
} from "../../../shared/database/identity-transactions";
import { AuditService } from "../../audit/application/services/audit.service";
import {
  normalizeEmail,
  validFullName,
  validPassword,
} from "../domain/profile-policy";
import { UsersService } from "./services/users.service";

export type AdminAccountInput = {
  email: string;
  fullName: string;
  password: string;
  reason: string;
};

export class AdminAccountError extends Error {}

export function adminAccountInputFromEnvironment(
  env: Record<string, string | undefined>,
): AdminAccountInput {
  if (!env.BOOTSTRAP_ADMIN_EMAIL || !env.BOOTSTRAP_ADMIN_PASSWORD)
    throw new AdminAccountError(
      "Set BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD in the runtime environment.",
    );
  return validateInput({
    email: env.BOOTSTRAP_ADMIN_EMAIL,
    password: env.BOOTSTRAP_ADMIN_PASSWORD,
    fullName: env.BOOTSTRAP_ADMIN_NAME?.trim() || "SkillHub Admin",
    reason:
      env.BOOTSTRAP_ADMIN_REASON?.trim() ||
      "Create Admin account from operator environment",
  });
}

function validateInput(input: AdminAccountInput): AdminAccountInput {
  const email = normalizeEmail(input.email);
  const fullName = input.fullName.trim().normalize("NFC");
  const reason = input.reason.trim();
  if (email.length > 254 || !isEmail(email))
    throw new AdminAccountError(
      "Enter a valid email address (maximum 254 characters).",
    );
  if (!validFullName(fullName))
    throw new AdminAccountError(
      "Enter a valid full name (2-100 characters, letters, spaces, apostrophes or hyphens).",
    );
  if (!validPassword(input.password))
    throw new AdminAccountError(
      "Password must contain 8-64 characters, uppercase, lowercase, a digit and a special character.",
    );
  if (!reason || reason.length > 1000)
    throw new AdminAccountError(
      "Enter a nonblank operator reason (maximum 1000 characters).",
    );
  return { email, fullName, password: input.password, reason };
}

/** Operator-only provisioning. Never promotes or resets an existing account. */
export async function createAdminAccount(
  db: PrismaService,
  users: UsersService,
  audit: AuditService,
  config: IdentityConfig,
  input: AdminAccountInput,
): Promise<{ userId: string }> {
  const data = validateInput(input);
  const passwordHash = await config.crypto.hashPassword(data.password);
  return transaction(db, async (tx) => {
    await lockEmail(tx, data.email);
    if (await users.byEmail(tx, data.email))
      throw new AdminAccountError(
        "Email already exists. No account, role or password was changed.",
      );
    const user = await users.create(tx, {
      email: data.email,
      fullName: data.fullName,
      passwordHash,
    });
    // This trusted operator action attests the email; public registration still requires OTP.
    await users.activate(tx, user.id);
    await users.role(tx, user.id, "ADMIN", true, null);
    await audit.append(tx, {
      action: "ADMIN_BOOTSTRAP",
      targetType: "User",
      targetId: user.id,
      reason: data.reason,
      after: { created: true, role: "ADMIN", accountStatus: "ACTIVE" },
    });
    return { userId: user.id };
  });
}
