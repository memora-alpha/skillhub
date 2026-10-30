import { ConflictException, Injectable } from "@nestjs/common";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
import { fingerprintCommand } from "../../../../infrastructure/idempotency/idempotency.service";
import type { JsonValue } from "../../../../infrastructure/idempotency/idempotency.types";
import { SharingSkillsService } from "../../../sharing-skills/application/services/sharing-skills.service";
import { UsersService } from "../../../users/application/services/users.service";
import { VerificationsRepository } from "../../infrastructure/persistence/verifications.repository";
import {
  aiSnapshotSchema,
  type AiSnapshot,
} from "../../domain/verification-ai.types";

export function aiInputHash(snapshot: AiSnapshot): string {
  return fingerprintCommand(snapshot as JsonValue);
}

/** Use owner application contracts; never reach into another module's repository. */
@Injectable()
export class VerificationAiContext {
  constructor(
    private readonly verifications: VerificationsRepository,
    private readonly sharing: SharingSkillsService,
    private readonly users: UsersService,
  ) {}

  async read(tx: TransactionContext, verificationId: string) {
    const verification = await this.verifications.get(verificationId, tx);
    const shared = await this.sharing.read(verification.sharingSkillId, tx);
    const user = await this.users.byId(tx, shared.userId);
    const snapshot = aiSnapshotSchema.safeParse({
      verificationId,
      verificationVersion: verification.version,
      sharingVersion: shared.version,
      applicant: {
        fullName: user?.fullName ?? "",
        nameSource: "SELF_DECLARED_PROFILE",
      },
      skill: {
        id: shared.skillId,
        name: shared.skillIdRecord.name,
        description: shared.skillIdRecord.description,
        sharingDescription: shared.description,
        declaredLevel: shared.levelIdRecord?.name ?? shared.level,
        levelDescription: shared.levelIdRecord?.description ?? null,
      },
      reviewPolicy: null,
      files: verification.skillEvidenceSubmissionRecords.map((file) => ({
        evidenceId: file.id,
        storedFileId: file.storedFileId,
        checksum: file.checksum,
        mimeType: file.mimeType,
        sizeBytes: Number(file.fileSizeBytes),
        title: file.title,
        description: file.description,
      })),
    });
    if (!snapshot.success)
      throw new ConflictException("AI_EVIDENCE_UNAVAILABLE");
    return {
      snapshot: snapshot.data,
      eligible:
        verification.status === "PENDING" &&
        !shared.archivedAt &&
        shared.skillIdRecord.status === "ACTIVE" &&
        user?.accountStatus === "ACTIVE" &&
        !!user.emailVerified,
    };
  }
}
