import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { AuthenticationService } from './authentication.service';
import { SignUpDto } from './dto/sign-up.dto';
import { SignInDto } from './dto/sign-in.dto';
import { AuthType } from './enums/auth-type.enum';
import { Auth } from './decorators/auth.decorator';
import { ConfirmEmailQueryDto } from './dto/confirm-email-query.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ActiveUser } from '../decorators/active-user.decorator';
import { ActiveUserData } from '../interfaces/active-user-data.interface';
import { ForgotPassDto } from './dto/forgot-pass.dto';
import { ResetPassDto } from './dto/reset-pass.dto';
import { UpdatePassDto } from './dto/update-pass.dto';
import { OtpAuthenticationService } from './otp-authentication.service';
import { Response } from 'express';
import { toFileStream } from 'qrcode';
import { UpdateDetailsDto } from './dto/update-details.dto';

@Controller('auth')
export class AuthenticationController {
  constructor(
    private readonly authService: AuthenticationService,
    private readonly otpAuthService: OtpAuthenticationService,
  ) {}

  @Auth(AuthType.None)
  @Post('register')
  async signUp(@Body() signUpDto: SignUpDto) {
    return this.authService.signUp(signUpDto);
  }

  @Auth(AuthType.None)
  @Get('confirmemail')
  async confirmEmail(@Query() confirmEmailQueryDto: ConfirmEmailQueryDto) {
    return this.authService.confirmEmail(confirmEmailQueryDto);
  }

  @Auth(AuthType.None)
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async signIn(
    @Res({ passthrough: true }) response: Response,
    @Body() signInDto: SignInDto,
  ) {
    const { accessToken, refreshToken } = await this.authService.signIn(
      signInDto,
    );

    return {
      accessToken,
      refreshToken,
    };
  }

  @Auth(AuthType.Bearer)
  @Get('me')
  async getMe(@ActiveUser() user: ActiveUserData) {
    return this.authService.getMe(user);
  }

  @Auth(AuthType.None)
  @Post('forgotpassword')
  async forgotPass(@Body() forgotPassDto: ForgotPassDto) {
    return this.authService.forgotPass(forgotPassDto);
  }

  @Auth(AuthType.None)
  @Patch('resetpassword/:resetToken')
  async resetPass(
    @Body() resetPassDto: ResetPassDto,
    @Param('resetToken') resetToken: string,
  ) {
    return this.authService.resetPass(resetPassDto, resetToken);
  }

  @Auth(AuthType.Bearer)
  @Patch('updatepassword')
  async updatePass(
    @Body() updatePassDto: UpdatePassDto,
    @ActiveUser() user: ActiveUserData,
  ) {
    return this.authService.updatePass(updatePassDto, user);
  }

  @Auth(AuthType.Bearer)
  @Patch('updatedetails')
  async updateDetails(
    @Body() updateDetailsDto: UpdateDetailsDto,
    @ActiveUser() user: ActiveUserData,
  ) {
    return this.authService.updateDetails(updateDetailsDto, user);
  }

  @Auth(AuthType.Bearer)
  @HttpCode(HttpStatus.OK)
  @Post('refresh-token')
  async refreshToken(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshToken(refreshTokenDto);
  }

  @Auth(AuthType.Bearer)
  @HttpCode(HttpStatus.OK)
  @Post('2fa/generate')
  async generateQrCode(
    @ActiveUser() user: ActiveUserData,
    @Res() response: Response,
  ) {
    const { secret, uri } = await this.otpAuthService.generateSecret(
      user.email,
    );

    await this.otpAuthService.enableTfaForUser(user.email, secret);

    response.type('png');
    return toFileStream(response, uri);
  }
}
