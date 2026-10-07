import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import type {
  NewActivityEligibilityReader,
  RequestLockReader,
  RequestOwnerReader,
  SharingSkillReader,
  SkillCatalogReader,
} from "../application/ports/learning-request-dependencies";

@Injectable()
export class UnavailableLearningRequestDependencies
  implements
    NewActivityEligibilityReader,
    SkillCatalogReader,
    RequestLockReader,
    RequestOwnerReader,
    SharingSkillReader
{
  async assertAllowed(): Promise<void> {
    throw new ServiceUnavailableException(
      "New activity eligibility unavailable",
    );
  }

  async assertActiveSelection(): Promise<never> {
    throw new ServiceUnavailableException("Skill Catalog unavailable");
  }

  async readSelections(): Promise<never> {
    throw new ServiceUnavailableException("Skill Catalog unavailable");
  }

  async assertNotLocked(): Promise<never> {
    throw new ServiceUnavailableException(
      "Path/Schedule lock state unavailable",
    );
  }

  async readPublicOwners(): Promise<never> {
    throw new ServiceUnavailableException(
      "Public owner projection unavailable",
    );
  }

  async getMatchingSnapshot(): Promise<never> {
    throw new ServiceUnavailableException("Sharing Skill snapshot unavailable");
  }
}
