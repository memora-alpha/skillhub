import { IdentityTx } from "../../../../shared/database/identity-transactions";
import {
  User,
  Profile,
  AvatarAsset,
  RoleCode,
} from "../../../../generated/prisma/client";
import { UserListQuery } from "../../application/contracts/user-list-query";
export abstract class UsersRepository {
  abstract byEmail(
    tx: IdentityTx,
    normalizedEmail: string,
  ): Promise<User | null>;
  abstract byId(tx: IdentityTx, id: string): Promise<User | null>;
  abstract create(
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
  ): Promise<User>;
  abstract activate(tx: IdentityTx, id: string): Promise<User>;
  abstract loginSuccess(tx: IdentityTx, id: string): Promise<User>;
  abstract loginFailure(tx: IdentityTx, id: string): Promise<User>;
  abstract password(tx: IdentityTx, id: string, hash: string): Promise<User>;
  abstract status(
    tx: IdentityTx,
    id: string,
    status: "ACTIVE" | "LOCKED",
  ): Promise<User>;
  abstract role(
    tx: IdentityTx,
    userId: string,
    code: "STAFF" | "ADMIN",
    add: boolean,
    assignedBy: string | null,
  ): Promise<boolean>;
  abstract grants(
    tx: IdentityTx,
    userId: string,
  ): Promise<{ roles: RoleCode[]; permissions: string[] }>;
  abstract profile(
    tx: IdentityTx,
    userId: string,
  ): Promise<
    (Profile & { user: User; avatarAsset: AvatarAsset | null }) | null
  >;
  abstract requiredUser(tx: IdentityTx, id: string): Promise<User>;
  abstract updateProfile(
    tx: IdentityTx,
    userId: string,
    data: {
      fullName?: string;
      headline?: string;
      bio?: string;
      timezone?: string;
      locale?: "vi" | "en";
    },
  ): Promise<Profile>;
  abstract list(
    tx: IdentityTx,
    query: UserListQuery,
  ): Promise<
    (Pick<User, "id" | "normalizedEmail" | "accountStatus" | "createdAt"> & {
      profile: { fullName: string } | null;
      roles: { role: { code: RoleCode } }[];
    })[]
  >;
  abstract seedRoles(tx: IdentityTx): Promise<void>;
}
