import { IsOptional, IsString, MaxLength } from "class-validator";

export class LiveKitTokenRequestDto {}

export class ConfirmSessionCompletionDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note = "";
}
