import {
  ConflictException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { InjectConnection } from "@nestjs/mongoose";
import { Connection } from "mongoose";
export type CaseMessage = {
  _id: string;
  caseId: string;
  partyId: string;
  senderId: string;
  digest: string;
  text: string;
  createdAt: Date;
};
@Injectable()
export class CaseMessageRepository {
  constructor(@InjectConnection() private readonly connection: Connection) {}
  private get collection() {
    if (!this.connection.db)
      throw new ServiceUnavailableException("CASE_MESSAGES_UNAVAILABLE");
    return this.connection.db.collection<CaseMessage>("report_case_messages");
  }
  async stage(message: CaseMessage) {
    try {
      await this.collection.updateOne(
        { _id: message._id },
        { $setOnInsert: message },
        { upsert: true },
      );
      const row = await this.collection.findOne({ _id: message._id });
      if (!row || row.digest !== message.digest)
        throw new ConflictException("CASE_MESSAGE_ID_REUSED");
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      throw new ServiceUnavailableException("CASE_MESSAGES_UNAVAILABLE");
    }
  }
  async read(ids: string[]): Promise<CaseMessage[]> {
    try {
      return await this.collection.find({ _id: { $in: ids } }).toArray();
    } catch {
      throw new ServiceUnavailableException("CASE_MESSAGES_UNAVAILABLE");
    }
  }
}
