import { IdentityEmailKind } from "../../../../generated/prisma/client";
export abstract class IdentityMailer {
  abstract send(
    id: string,
    recipient: string,
    kind: IdentityEmailKind,
    code: string | null,
  ): Promise<string>;
}
export abstract class IdentityEmailJobs {
  abstract enqueue(id: string, attempts: number): Promise<void>;
}
