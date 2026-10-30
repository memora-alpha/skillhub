import { ReauthenticateUseCase } from "../../application/use-cases/reauthenticate.use-case";
import { ResetPasswordUseCase } from "../../application/use-cases/reset-password.use-case";
import { VerifyPasswordResetOtpUseCase } from "../../application/use-cases/verify-password-reset-otp.use-case";
import { LogoutAllUseCase } from "../../application/use-cases/logout-all.use-case";
import { LogoutUseCase } from "../../application/use-cases/logout.use-case";
import { RefreshTokenUseCase } from "../../application/use-cases/refresh-token.use-case";
import { LoginUseCase } from "../../application/use-cases/login.use-case";
import { VerifyEmailUseCase } from "../../application/use-cases/verify-email.use-case";
import { ResendOtpUseCase } from "../../application/use-cases/resend-otp.use-case";
import { RegisterUseCase } from "../../application/use-cases/register.use-case";
import {
  Body,
  Controller,
  Header,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { Request } from "express";
import { success } from "../../../../shared/http/response";
import {
  ApiSuccessResponse,
  ApiErrorResponse,
} from "../../../../shared/http/api-response.decorators";

import { Principal } from "../../application/services/sessions.service";
import {
  CurrentIdentity,
  IdentityGuard,
} from "../../../../shared/auth/identity.guard";
import { IdentityThrottle } from "../../../../shared/auth/identity-throttle";
import {
  EmailDto,
  EmptyDto,
  LoginDto,
  ReauthDto,
  ReauthResponseDto,
  RefreshDto,
  RegisterDto,
  ResetDto,
  PasswordResetProofDto,
  TokenPairDto,
  VerifyDto,
} from "./auth.dto";

@ApiTags("auth")
@ApiErrorResponse(400, "Invalid input or invalid/expired proof")
@ApiErrorResponse(429, "Shared identity rate limit exceeded")
@ApiErrorResponse(503, "Required storage unavailable")
@ApiErrorResponse(500, "Internal server error")
@Controller({ path: "auth", version: "1" })
export class AuthController {
  constructor(
    private readonly registerAccount: RegisterUseCase,
    private readonly resendOtp: ResendOtpUseCase,
    private readonly verifyEmail: VerifyEmailUseCase,
    private readonly signIn: LoginUseCase,
    private readonly refreshToken: RefreshTokenUseCase,
    private readonly logoutSession: LogoutUseCase,
    private readonly logoutEverySession: LogoutAllUseCase,
    private readonly resetPassword: ResetPasswordUseCase,
    private readonly verifyPasswordResetOtp: VerifyPasswordResetOtpUseCase,
    private readonly reauthenticate: ReauthenticateUseCase,
    private readonly throttle: IdentityThrottle,
  ) {}
  private rate(req: Request, purpose: string, email: string) {
    return this.throttle.check(
      purpose,
      email,
      req.ip ?? "unknown",
      req.headers["user-agent"] ?? "unknown",
    );
  }
  @Post("register")
  @HttpCode(202)
  @ApiOperation({
    summary:
      "Stage registration in Redis and send OTP; no account is created yet",
  })
  @ApiSuccessResponse(202, null)
  async register(@Body() body: RegisterDto, @Req() req: Request) {
    await this.rate(req, "register", body.email);
    const result = await this.registerAccount.execute(body);
    return success(null, result.message);
  }
  @Post("verification/resend")
  @HttpCode(202)
  @ApiOperation({
    summary: "Resend registration OTP subject to cooldown and hourly limit",
  })
  @ApiSuccessResponse(202, null)
  async resend(@Body() body: EmailDto, @Req() req: Request) {
    await this.rate(req, "register", body.email);
    const result = await this.resendOtp.execute(body.email, "REGISTER");
    return success(null, result.message);
  }
  @Post("verification/verify")
  @HttpCode(204)
  @ApiOperation({ summary: "Verify OTP and create an active account once" })
  @ApiResponse({ status: 204 })
  async verify(@Body() body: VerifyDto, @Req() req: Request) {
    await this.rate(req, "verify", body.email);
    await this.verifyEmail.execute(body.email, body.otpCode);
  }
  @Post("login")
  @HttpCode(200)
  @ApiOperation({ summary: "Sign in an ACTIVE account" })
  @ApiSuccessResponse(200, TokenPairDto)
  @ApiErrorResponse(401)
  @ApiErrorResponse(403)
  @Header("Cache-Control", "no-store")
  async login(@Body() body: LoginDto, @Req() req: Request) {
    await this.rate(req, "login", body.email);
    return success(
      await this.signIn.execute(body.email, body.password, body.rememberMe),
      "Signed in successfully.",
    );
  }
  @Post("refresh")
  @HttpCode(200)
  @ApiOperation({ summary: "Rotate renewal credential; replay revokes family" })
  @ApiSuccessResponse(200, TokenPairDto)
  @ApiErrorResponse(401)
  @Header("Cache-Control", "no-store")
  async refresh(@Body() body: RefreshDto, @Req() req: Request) {
    // The limiter HMACs this opaque credential; never use a shared literal subject.
    await this.rate(req, "refresh", body.refreshToken);
    return success(
      await this.refreshToken.execute(body.refreshToken),
      "Tokens refreshed.",
    );
  }
  @Post("logout")
  @HttpCode(204)
  @ApiOperation({ summary: "Idempotently revoke supplied renewal family" })
  @ApiResponse({ status: 204 })
  async logout(@Body() body: RefreshDto) {
    await this.logoutSession.execute(body.refreshToken);
  }
  @Post("logout-all")
  @HttpCode(204)
  @UseGuards(IdentityGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Revoke every current user session" })
  @ApiResponse({ status: 204 })
  @ApiErrorResponse(401)
  async logoutAll(
    @Body() _body: EmptyDto,
    @CurrentIdentity() principal: Principal,
  ) {
    await this.logoutEverySession.execute(principal.userId);
  }
  @Post("password/forgot")
  @HttpCode(202)
  @ApiOperation({ summary: "Request password recovery; neutral response" })
  @ApiSuccessResponse(202, null)
  async forgot(@Body() body: EmailDto, @Req() req: Request) {
    await this.rate(req, "forgot", body.email);
    const result = await this.resendOtp.execute(body.email, "RESET_PASSWORD");
    return success(null, result.message);
  }
  @Post("password/verify-otp")
  @HttpCode(200)
  @Header("Cache-Control", "no-store")
  @ApiOperation({
    summary: "Verify recovery OTP and issue a one-use reset token",
  })
  @ApiSuccessResponse(200, PasswordResetProofDto)
  async verifyRecovery(@Body() body: VerifyDto, @Req() req: Request) {
    await this.rate(req, "reset-verify", body.email);
    return success(
      await this.verifyPasswordResetOtp.execute(body.email, body.otpCode),
      "OTP verified. You can reset your password.",
    );
  }
  @Post("password/reset")
  @HttpCode(204)
  @ApiOperation({
    summary:
      "Consume verified reset token, preserve status and revoke all sessions",
  })
  @ApiResponse({ status: 204 })
  async reset(@Body() body: ResetDto, @Req() req: Request) {
    await this.rate(req, "reset", body.email);
    await this.resetPassword.execute(
      body.email,
      body.resetToken,
      body.newPassword,
    );
  }
  @Post("reauthenticate")
  @HttpCode(200)
  @UseGuards(IdentityGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Admin obtains session-bound one-use STAFF change proof",
  })
  @ApiSuccessResponse(200, ReauthResponseDto)
  @ApiErrorResponse(401)
  @ApiErrorResponse(403)
  @Header("Cache-Control", "no-store")
  async reauth(
    @Body() body: ReauthDto,
    @CurrentIdentity() principal: Principal,
    @Req() req: Request,
  ) {
    await this.rate(req, "reauth", principal.userId);
    return success(
      await this.reauthenticate.execute(principal, body.password),
      "Reauthentication completed.",
    );
  }
}
