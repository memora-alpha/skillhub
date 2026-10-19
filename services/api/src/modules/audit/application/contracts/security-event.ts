import { RoleCode } from "../../../../generated/prisma/client";
export type SecurityEvent = {
  actorId?: string;
  actorRole?: RoleCode;
  action: string;
  targetType: string;
  targetId: string;
  reason?: string;
  before?: { [key: string]: string | number | boolean | null };
  after?: { [key: string]: string | number | boolean | null };
};
