import { Injectable } from "@nestjs/common";

export interface PublicSkillsPage {
  data: unknown[];
  pagination: { limit: number; hasMore: boolean; nextCursor: string | null };
}
@Injectable()
export class PublicSkillReader {
  private reader?: (userId: string) => Promise<PublicSkillsPage>;
  register(reader: (userId: string) => Promise<PublicSkillsPage>): void {
    this.reader = reader;
  }
  read(userId: string): Promise<PublicSkillsPage> {
    return (
      this.reader?.(userId) ??
      Promise.resolve({
        data: [],
        pagination: { limit: 20, hasMore: false, nextCursor: null },
      })
    );
  }
}
