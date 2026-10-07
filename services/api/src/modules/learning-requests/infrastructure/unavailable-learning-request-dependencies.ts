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
  assertAllowed(): Promise<void> {
    return Promise.reject(
      new ServiceUnavailableException("New activity eligibility unavailable"),
    );
  }

  assertActiveSelection(): Promise<never> {
    return Promise.reject(
      new ServiceUnavailableException("Skill Catalog unavailable"),
    );
  }

  readSelections(): Promise<never> {
    return Promise.reject(
      new ServiceUnavailableException("Skill Catalog unavailable"),
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
}
