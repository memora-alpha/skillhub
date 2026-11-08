import { Injectable, ServiceUnavailableException } from "@nestjs/common";

export type ReviewSummary = {
  reviewCount: number;
  averageRating: number | null;
  ratingDistribution: Record<string, number>;
};
@Injectable()
export class PublicReviewReader {
  private reader?: (userId: string) => Promise<ReviewSummary>;
  register(reader: (userId: string) => Promise<ReviewSummary>) {
    this.reader = reader;
  }
  read(userId: string) {
    if (!this.reader)
      throw new ServiceUnavailableException("REVIEWS_UNAVAILABLE");
    return this.reader(userId);
  }
}
