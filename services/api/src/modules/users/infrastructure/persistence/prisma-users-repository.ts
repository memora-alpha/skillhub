import { Injectable } from "@nestjs/common";
import { IdentityTx } from "../../../../shared/database/identity-transactions";
import {
  User,
  Profile,
  AvatarAsset,
  RoleCode,
} from "../../../../generated/prisma/client";
import { UserListQuery } from "../../application/contracts/user-list-query";
import { UsersRepository } from "../../application/ports/users-repository";
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
        normalizedEmail: data.email,
        passwordHash: data.passwordHash,
        termsVersion: data.termsVersion,
        termsAcceptedAt: new Date(),
        profile: {
          create: {
            fullName: data.fullName,
            timezone: data.timezone,
            locale: data.locale ?? "vi",
            reputationScore: data.reputationScore,
          },
        },
        roles: { create: { roleId: role.id } },
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
    assignedBy: string | null,
  ): Promise<boolean> {
    const role = await tx.role.findUniqueOrThrow({ where: { code } });
    const before = !!(await tx.userRole.findUnique({
      where: { userId_roleId: { userId, roleId: role.id } },
    }));
    if (add)
      await tx.userRole.upsert({
        where: { userId_roleId: { userId, roleId: role.id } },
        create: { userId, roleId: role.id, assignedBy },
        update: {},
      });
    else await tx.userRole.deleteMany({ where: { userId, roleId: role.id } });
    return before !== add;
  }
  async grants(
    tx: IdentityTx,
    userId: string,
  ): Promise<{ roles: RoleCode[]; permissions: string[] }> {
    const rows = await tx.userRole.findMany({
      where: { userId },
      include: {
        role: { include: { permissions: { include: { permission: true } } } },
      },
    });
    return {
      roles: rows.map((row) => row.role.code),
      permissions: [
        ...new Set(
          rows.flatMap((row) =>
            row.role.permissions.map((grant) => grant.permission.code),
          ),
        ),
      ],
    };
  }
  profile(
    tx: IdentityTx,
    userId: string,
  ): Promise<
    (Profile & { user: User; avatarAsset: AvatarAsset | null }) | null
  > {
    return tx.profile.findUnique({
      where: { userId },
      include: { user: true, avatarAsset: true },
    });
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
  ): Promise<Profile> {
    return tx.profile.update({ where: { userId }, data });
  }
  list(
    tx: IdentityTx,
    query: UserListQuery,
  ): Promise<
    (Pick<User, "id" | "normalizedEmail" | "accountStatus" | "createdAt"> & {
      profile: { fullName: string } | null;
      roles: { role: { code: RoleCode } }[];
    })[]
  > {
    return tx.user.findMany({
      where: {
        accountStatus: query.status,
        ...(query.role
          ? { roles: { some: { role: { code: query.role } } } }
          : {}),
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
        profile: { select: { fullName: true } },
        roles: { select: { role: { select: { code: true } } } },
      },
    });
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
      ...systemAdminPermissions,
      ...Object.values(learningRequestGrants).flat(),
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
