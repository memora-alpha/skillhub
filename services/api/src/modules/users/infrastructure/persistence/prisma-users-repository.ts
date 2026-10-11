import { BadRequestException, Injectable } from "@nestjs/common";
import { IdentityTx } from "../../../../shared/database/identity-transactions";
import {
  User,
  AvatarAsset,
  RoleCode,
} from "../../../../generated/prisma/client";
import { UserListQuery } from "../../application/contracts/user-list-query";
import { UsersRepository } from "../../application/ports/users-repository";
import { SKILL_PERMISSIONS } from "../../../skills/domain/skill-policy";
import type { PermissionCode } from "../../../../shared/authorization/permission.catalog";
@Injectable()
export class PrismaUsersRepository extends UsersRepository {
  byEmail(tx: IdentityTx, normalizedEmail: string): Promise<User | null> {
    return tx.user.findUnique({ where: { normalizedEmail } });
  }
  byId(tx: IdentityTx, id: string): Promise<User | null> {
    return tx.user.findUnique({ where: { id } });
  }
  async create(
    tx: IdentityTx,
    data: {
      id?: string;
      termsAcceptedAt?: Date;
      email: string;
      fullName: string;
      passwordHash: string;
      timezone: string;
      termsVersion: string;
      reputationScore: number | null;
      locale?: "vi" | "en";
    },
  ): Promise<User> {
    const role = await tx.role.findUniqueOrThrow({ where: { code: "USER" } });
    return tx.user.create({
      data: {
        id: data.id,
        normalizedEmail: data.email,
        passwordHash: data.passwordHash,
        termsVersion: data.termsVersion,
        termsAcceptedAt: data.termsAcceptedAt ?? new Date(),
        roleId: role.id,
        fullName: data.fullName,
        timezone: data.timezone,
        locale: data.locale ?? "vi",
        reputationScore: data.reputationScore ?? 50,
        accountStatus: "PENDING_VERIFICATION",
        emailVerified: false,
        securityVersion: 1,
        failedLoginCount: 0,
        verifiedSkillCount: 0,
        completedSessionCount: 0,
      },
    });
  }
  activate(tx: IdentityTx, id: string): Promise<User> {
    return tx.user.update({
      where: { id },
      data: { accountStatus: "ACTIVE", emailVerified: true },
    });
  }
  loginSuccess(tx: IdentityTx, id: string): Promise<User> {
    return tx.user.update({
      where: { id },
      data: { failedLoginCount: 0, lastLoginAt: new Date() },
    });
  }
  loginFailure(tx: IdentityTx, id: string): Promise<User> {
    return tx.user.update({
      where: { id },
      data: { failedLoginCount: { increment: 1 } },
    });
  }
  password(tx: IdentityTx, id: string, hash: string): Promise<User> {
    return tx.user.update({
      where: { id },
      data: {
        passwordHash: hash,
        securityVersion: { increment: 1 },
        failedLoginCount: 0,
      },
    });
  }
  status(
    tx: IdentityTx,
    id: string,
    status: "ACTIVE" | "LOCKED",
  ): Promise<User> {
    return tx.user.update({
      where: { id },
      data: { accountStatus: status, securityVersion: { increment: 1 } },
    });
  }
  async role(
    tx: IdentityTx,
    userId: string,
    code: "STAFF" | "ADMIN",
    add: boolean,
  ): Promise<boolean> {
    const role = await tx.role.findUniqueOrThrow({ where: { code } });
    const user = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      include: { roleIdRecord: true },
    });
    if (code === "STAFF" && user.roleIdRecord.code === "ADMIN") {
      if (add)
        throw new BadRequestException("ADMIN_ROLE_CANNOT_BE_REPLACED_BY_STAFF");
      return false;
    }
    if ((user.roleId === role.id) === add) return false;
    const next = add
      ? role
      : await tx.role.findUniqueOrThrow({ where: { code: "USER" } });
    await tx.user.update({ where: { id: userId }, data: { roleId: next.id } });
    return true;
  }
  async grants(
    tx: IdentityTx,
    userId: string,
  ): Promise<{ roles: RoleCode[]; permissions: string[] }> {
    const user = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        roleIdRecord: {
          include: {
            rolePermissionRoleIdRecords: {
              include: { permissionIdRecord: true },
            },
          },
        },
      },
    });
    return {
      roles: [user.roleIdRecord.code],
      permissions: [
        ...new Set(
          user.roleIdRecord.rolePermissionRoleIdRecords.map(
            (grant) => grant.permissionIdRecord.code,
          ),
        ),
      ],
    };
  }
  async profile(
    tx: IdentityTx,
    userId: string,
  ): Promise<(User & { user: User; avatarAsset: AvatarAsset | null }) | null> {
    const row = await tx.user.findUnique({
      where: { id: userId },
      include: { selectedAvatarRecord: true },
    });
    return row
      ? { ...row, user: row, avatarAsset: row.selectedAvatarRecord }
      : null;
  }
  requiredUser(tx: IdentityTx, id: string): Promise<User> {
    return tx.user.findUniqueOrThrow({ where: { id } });
  }
  updateProfile(
    tx: IdentityTx,
    userId: string,
    data: {
      fullName?: string;
      headline?: string;
      bio?: string;
      timezone?: string;
      locale?: "vi" | "en";
    },
  ): Promise<User> {
    return tx.user.update({ where: { id: userId }, data });
  }
  async list(
    tx: IdentityTx,
    query: UserListQuery,
  ): Promise<
    (Pick<User, "id" | "normalizedEmail" | "accountStatus" | "createdAt"> & {
      profile: { fullName: string } | null;
      roles: { role: { code: RoleCode } }[];
    })[]
  > {
    const rows = await tx.user.findMany({
      where: {
        accountStatus: query.status,
        ...(query.role ? { roleIdRecord: { code: query.role } } : {}),
        ...(query.before
          ? {
              OR: [
                { createdAt: { lt: query.before.date } },
                { createdAt: query.before.date, id: { lt: query.before.id } },
              ],
            }
          : {}),
      },
      take: query.take,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        normalizedEmail: true,
        accountStatus: true,
        createdAt: true,
        fullName: true,
        roleIdRecord: { select: { code: true } },
      },
    });
    return rows.map(({ fullName, roleIdRecord, ...row }) => ({
      ...row,
      profile: { fullName },
      roles: [{ role: roleIdRecord }],
    }));
  }
  async seedRoles(tx: IdentityTx): Promise<void> {
    const roles: RoleCode[] = ["USER", "STAFF", "ADMIN"];
    await tx.role.createMany({
      data: roles.map((code) => ({ code, description: code })),
      skipDuplicates: true,
    });
    const systemAdminPermissions = [
      "users.read",
      "users.lock",
      "users.unlock",
      "roles.staff.assign",
    ];
    const learningRequestGrants = {
      USER: [
        "proposal:create",
        "event:read:self",
        "proposal:read:party",
        "proposal:update:self",
        "proposal:accept:recipient",
        "proposal:reject:recipient",
        "proposal:withdraw:self",
        "conversation:read:participant",
        "message:create:participant",
        "message:delivery:read:self",
        "conversation:read-state:update:self",
        "message:attachment:create:participant",
        "message:attachment:read:participant",
        "learning-request:create",
        "learning-request:read",
        "learning-request:update:self",
        "learning-request:cancel:self",
        "notification:read:self",
        "notification:update:self",
      ],
      STAFF: [
        "learning-request:moderation:read",
        "learning-request:approve",
        "learning-request:reject",
      ],
      ADMIN: [
        "learning-request:moderation:read",
        "learning-request:approve",
        "learning-request:reject",
        "learning-request:moderation:configure",
      ],
    } satisfies Record<RoleCode, readonly PermissionCode[]>;
    const codes = [
      ...new Set([
        ...systemAdminPermissions,
        ...Object.values(learningRequestGrants).flat(),
        ...Object.values(SKILL_PERMISSIONS).flat(),
      ]),
    ];
    await tx.permission.createMany({
      data: codes.map((code) => ({ code, description: code })),
      skipDuplicates: true,
    });
    const permissions = new Map(
      (
        await tx.permission.findMany({
          where: { code: { in: codes } },
        })
      ).map(({ id, code }) => [code, id]),
    );
    const roleIds = new Map<RoleCode, string>(
      (
        await tx.role.findMany({
          where: { code: { in: roles } },
          select: { id: true, code: true },
        })
      ).map(({ code, id }) => [code, id]),
    );
    const assignments = [
      ...systemAdminPermissions.map((permissionCode) => ({
        roleCode: "ADMIN" as const,
        permissionCode,
      })),
      ...Object.entries(learningRequestGrants).flatMap(([roleCode, grants]) =>
        grants.map((permissionCode) => ({
          roleCode: roleCode as RoleCode,
          permissionCode,
        })),
      ),
      ...Object.entries(SKILL_PERMISSIONS).flatMap(([roleCode, grants]) =>
        grants.map((permissionCode) => ({
          roleCode: roleCode as RoleCode,
          permissionCode,
        })),
      ),
    ];
    await tx.rolePermission.createMany({
      data: assignments.map(({ roleCode, permissionCode }) => {
        const roleId = roleIds.get(roleCode);
        const permissionId = permissions.get(permissionCode);
        if (!roleId || !permissionId)
          throw new Error("Permission bootstrap did not persist its catalog");
        return { roleId, permissionId };
      }),
      skipDuplicates: true,
    });
  }
}
