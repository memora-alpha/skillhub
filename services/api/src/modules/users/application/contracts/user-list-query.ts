import { AccountStatus, RoleCode } from "../../../../generated/prisma/client";
export type UserListQuery = {
  status?: AccountStatus;
  role?: RoleCode;
  before?: { date: Date; id: string };
  take: number;
};
