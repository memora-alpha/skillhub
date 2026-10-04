import { Transform } from "class-transformer";
import {
  Equals,
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Length,
  Matches,
  registerDecorator,
  ValidationArguments,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  normalizeEmail,
  validFullName,
  validPassword,
  validTimezone,
} from "../../../users/domain/profile-policy";

export function Policy(check: (value: string) => boolean): PropertyDecorator {
  return (object, propertyName) =>
    registerDecorator({
      name: "policy",
      target: object.constructor,
      propertyName: String(propertyName),
      validator: {
        validate: (value: unknown) => typeof value === "string" && check(value),
        defaultMessage: () => `${String(propertyName)} is invalid`,
      },
    });
}
function SameAs(field: string): PropertyDecorator {
  return (object, propertyName) =>
    registerDecorator({
      name: "sameAs",
      target: object.constructor,
      propertyName: String(propertyName),
      validator: {
        validate: (value: unknown, args: ValidationArguments) =>
          value === (args.object as Record<string, unknown>)[field],
      },
    });
}
export class EmailDto {
  @ApiProperty({ format: "email", minLength: 5, maxLength: 254 })
  @Transform(({ value }) =>
    typeof value === "string" ? normalizeEmail(value) : value,
  )
  @IsEmail()
  @Length(5, 254)
  @Matches(/^\S+$/)
  email!: string;
}
export class RegisterDto extends EmailDto {
  @ApiProperty({ minLength: 2, maxLength: 100 })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @Policy(validFullName)
  fullName!: string;
  @ApiProperty({ minLength: 8, maxLength: 64, writeOnly: true })
  @Policy(validPassword)
  password!: string;
  @ApiProperty({ writeOnly: true })
  @IsString()
  @SameAs("password")
  confirmPassword!: string;
  @ApiProperty({ enum: [true] }) @Equals(true) agreeTerms!: boolean;
  @ApiPropertyOptional() @IsOptional() @Policy(validTimezone) timezone?: string;
  @ApiPropertyOptional({ enum: ["vi", "en"] })
  @IsOptional()
  @IsIn(["vi", "en"])
  locale?: "vi" | "en";
}
export class VerifyDto extends EmailDto {
  @ApiProperty({ pattern: "^\\d{6}$", writeOnly: true })
  @IsString()
  @Matches(/^\d{6}$/)
  otpCode!: string;
}
export class LoginDto extends EmailDto {
  @ApiProperty({ writeOnly: true })
  @IsString()
  @Length(1, 64)
  password!: string;
  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;
}
export class RefreshDto {
  @ApiProperty({ writeOnly: true })
  @IsString()
  @Length(1, 1024)
  refreshToken!: string;
}
export class ResetDto extends VerifyDto {
  @ApiProperty({ minLength: 8, maxLength: 64, writeOnly: true })
  @Policy(validPassword)
  newPassword!: string;
  @ApiProperty({ writeOnly: true })
  @IsString()
  @SameAs("newPassword")
  confirmNewPassword!: string;
}
export class ReauthDto {
  @ApiProperty({ writeOnly: true })
  @IsString()
  @Length(1, 64)
  password!: string;
  @ApiProperty({ enum: ["STAFF_ROLE_CHANGE"] })
  @Equals("STAFF_ROLE_CHANGE")
  purpose!: string;
}
export class EmptyDto {}
export class TokenPairDto {
  @ApiProperty() accessToken!: string;
  @ApiProperty() refreshToken!: string;
  @ApiProperty({ enum: ["Bearer"] }) tokenType!: string;
  @ApiProperty() expiresIn!: number;
  @ApiProperty({ format: "date-time" }) refreshExpiresAt!: string;
}
export class ReauthResponseDto {
  @ApiProperty() reauthToken!: string;
  @ApiProperty({ format: "date-time" }) expiresAt!: string;
}
