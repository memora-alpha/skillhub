import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import type {
  NewActivityEligibilityReader,
  RequestLockReader,
  RequestOwnerReader,
  SharingSkillReader,
  SkillCatalogReader,
} from "../../application/ports/learning-request-dependencies";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
import { ReputationService } from "../../../reputation/application/services/reputation.service";

@Injectable()
export class UnavailableLearningRequestDependencies
  implements
    NewActivityEligibilityReader,
    SkillCatalogReader,
    RequestLockReader,
    RequestOwnerReader,
    SharingSkillReader
{
  constructor(private readonly reputation: ReputationService) {}

  async assertAllowed(tx: TransactionContext, userId: string): Promise<void> {
    const [clock] = await tx.$queryRaw<{ now: Date }[]>`
      SELECT CURRENT_TIMESTAMP AS now
    `;
    if (!(clock?.now instanceof Date)) {
      throw new ServiceUnavailableException("Database time unavailable");
    }
    await this.reputation.assertMayCreateActivity(tx, userId, clock.now);
  }

  assertActiveSelection(): Promise<never> {
    return Promise.reject(
      new ServiceUnavailableException("Skill Catalog unavailable"),
    );
  }

  readSelections(): Promise<never> {
    return Promise.reject(
      new ServiceUnavailableException("Skill Catalog selections unavailable"),
    );
  }

  assertNotLocked(): Promise<never> {
    return Promise.reject(
      new ServiceUnavailableException("Path/Schedule lock state unavailable"),
    );
  }

  readPublicOwners(): Promise<never> {
    return Promise.reject(
      new ServiceUnavailableException("Public owner projection unavailable"),
    );
  }

  getMatchingSnapshot(): Promise<never> {
    return Promise.reject(
      new ServiceUnavailableException("Sharing Skill snapshot unavailable"),
    );
  }

  assertRequestOfferings(): Promise<never> {
    return this.readRequestOfferings();
  }

  readRequestOfferings(): Promise<never> {
    return Promise.reject(
      new ServiceUnavailableException("Sharing Skill selections unavailable"),
    );
  }
}
