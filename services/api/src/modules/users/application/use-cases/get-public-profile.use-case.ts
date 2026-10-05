import { Injectable } from "@nestjs/common";
import { ProfileReader } from "../services/profile-reader.service";
@Injectable()
export class GetPublicProfileUseCase {
  constructor(private readonly profiles: ProfileReader) {}
  execute(userId: string) {
    return this.profiles.profile(userId, true);
  }
}
