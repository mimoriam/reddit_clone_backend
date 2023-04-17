import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  Scope,
  ForbiddenException,
} from '@nestjs/common';
import { HashingService } from '../hashing/hashing.service';
import { SignUpDto } from './dto/sign-up.dto';
import { PrismaService } from '../../prisma.service';
import { Prisma, User } from '@prisma/client';
import { SignInDto } from './dto/sign-in.dto';
import { JwtService } from '@nestjs/jwt';
import jwtConfig from '../config/jwt.config';
import { ConfigType } from '@nestjs/config';
import { randomUUID, randomBytes, createHash } from 'crypto';
import { ActiveUserData } from '../interfaces/active-user-data.interface';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { createTransport } from 'nodemailer';
import { ConfirmEmailQueryDto } from './dto/confirm-email-query.dto';
import {
  InvalidateRefreshTokenError,
  RefreshTokenIdsStorage,
} from './refresh-token-ids.storage/refresh-token-ids.storage';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ForgotPassDto } from './dto/forgot-pass.dto';
import { ResetPassDto } from './dto/reset-pass.dto';
import { UpdatePassDto } from './dto/update-pass.dto';
import { OtpAuthenticationService } from './otp-authentication.service';
import { UpdateDetailsDto } from './dto/update-details.dto';

@Injectable({ scope: Scope.REQUEST })
export class AuthenticationService {
  constructor(
    private prisma: PrismaService,
    private readonly hashingService: HashingService,
    private readonly jwtService: JwtService,
    @Inject(jwtConfig.KEY)
    private readonly jwtConfiguation: ConfigType<typeof jwtConfig>,
    private readonly refreshTokenIdsStorage: RefreshTokenIdsStorage,
    @Inject(REQUEST)
    private readonly req: Request,
    private readonly otpAuthService: OtpAuthenticationService,
  ) {}

  async signUp(signUpDto: SignUpDto) {
    try {
      const { username, email, role } = signUpDto;

      if (role === 'ADMIN') {
        throw new ForbiddenException();
      }

      const hashedPassword = await this.hashingService.hash(signUpDto.password);

      const user = await this.prisma.user.create({
        data: {
          username,
          email,
          role,
          password: hashedPassword,
        },
      });

      // Grab token and send to email:
      const confirmEmailToken = await this.generateEmailConfirmToken(user);

      // Create reset url
      const confirmEmailURL = `${this.req.protocol}://${this.req.get(
        'host',
      )}/api/v1/auth/confirmemail?token=${confirmEmailToken}`;

      const message = `You are receiving this email because you need to confirm your email address. Please make a GET request to: \n\n ${confirmEmailURL}`;

      const transporter = createTransport({
        host: '0.0.0.0',
        port: 1025,
      });

      try {
        await transporter.sendMail({
          from: 'from@example.com',
          to: signUpDto.email,
          subject: 'Email Confirm token',
          text: message,
          html: `Click <a href="${confirmEmailURL}">here</a> to confirm your account!`,
        });

        return {
          message: 'Confirmation Email Sent!',
        };
      } catch (err) {
        await this.prisma.user.update({
          where: {
            email: email,
          },
          data: {
            confirmEmailToken: null,
            isEmailConfirmed: false,
          },
        });

        throw new UnauthorizedException(`Email could not be sent`);
      }
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2000'
      ) {
        // throw new ConflictException(`Email ${signUpDto.email} already in use.`);
        // We should never tell the user what property is a dupe:
        throw new ConflictException();
      } else if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new NotFoundException(`Resource could not be found.`);
      } else if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2025'
      ) {
        throw new BadRequestException(`Bad Request`);
      } else if (err instanceof ForbiddenException) {
        throw new ForbiddenException();
      }
      throw new Error(err);
    }
  }

  async confirmEmail(confirmEmailQueryDto: ConfirmEmailQueryDto) {
    const token = confirmEmailQueryDto.token;

    if (!token) {
      throw new UnauthorizedException(`Invalid`);
    }

    const splitToken = token.split('.')[0];

    const confirmEmailToken = createHash('sha256')
      .update(splitToken)
      .digest('hex');

    const user = await this.prisma.user.findFirst({
      where: {
        AND: [
          { confirmEmailToken: confirmEmailToken },
          { isEmailConfirmed: false },
        ],
      },
    });

    if (!user) {
      throw new UnauthorizedException(`Invalid`);
    }

    await this.prisma.user.update({
      where: { email: user.email },
      data: {
        confirmEmailToken: null,
        isEmailConfirmed: true,
      },
    });

    return {
      message: 'Email confirmed',
    };
  }

  async signIn(signInDto: SignInDto) {
    const user = await this.prisma.user.findUnique({
      where: {
        email: signInDto.email,
      },
    });

    if (!user) {
      throw new UnauthorizedException();
    }

    const isEqual = await this.hashingService.compare(
      signInDto.password,
      user.password,
    );

    if (!isEqual) {
      throw new UnauthorizedException(`Wrong email or password.`);
    }

    if (user.isTfaEnabled) {
      const isValid = this.otpAuthService.verifyCode(
        signInDto.tfaCode,
        user.tfaSecret,
      );

      if (!isValid) {
        throw new UnauthorizedException('Invalid 2FA code');
      }
    }

    return await this.generateTokens(user);
  }

  async getMe(user: ActiveUserData) {
    const user_in_db = await this.prisma.user.findUnique({
      where: {
        id: user.sub.toString(),
      },

      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        isEmailConfirmed: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException(`User does not exist`);
    }

    return user_in_db;
  }

  async forgotPass(forgotPassDto: ForgotPassDto) {
    const user = await this.prisma.user.findUnique({
      where: {
        email: forgotPassDto.email,
      },
    });

    const resetToken = randomBytes(20).toString('hex');
    const resetPasswordToken = createHash('sha256')
      .update(resetToken)
      .digest('hex');

    // This one is for the un-hashed token version:
    // const resetToken = Math.random().toString(20).substring(2, 12);
    // user.resetPasswordToken = resetToken;

    const resetPasswordExpire = new Date(Date.now() + 10 * 60 * 1000);

    await this.prisma.user.update({
      where: {
        email: user.email,
      },
      data: {
        resetPasswordToken: resetPasswordToken,
        resetPasswordExpire: resetPasswordExpire,
      },
    });

    const transporter = createTransport({
      host: '0.0.0.0',
      port: 1025,
    });

    const resetUrl = `${this.req.protocol}://${this.req.get(
      'host',
    )}/api/v1/auth/resetpassword/${resetToken}`;

    const message = `You are receiving this email because you (or someone else) has requested the reset of a password. Please make a PUT request to: \n\n ${resetUrl}`;

    try {
      await transporter.sendMail({
        from: 'from@example.com',
        to: forgotPassDto.email,
        subject: 'Password reset token',
        text: message,
        html: `Click <a href="${resetUrl}">here</a> to reset your password!`,
      });

      return {
        message: 'Email sent!',
      };
    } catch (err) {
      await this.prisma.user.update({
        where: {
          email: user.email,
        },
        data: {
          resetPasswordToken: null,
          resetPasswordExpire: null,
        },
      });
      throw new UnauthorizedException(`Email could not be sent`);
    }
  }

  async resetPass(resetPassDto: ResetPassDto, resetToken: string) {
    const resetPasswordToken = createHash('sha256')
      .update(resetToken)
      .digest('hex');

    const user = await this.prisma.user.findFirst({
      where: {
        AND: [
          { resetPasswordToken: resetPasswordToken },
          { resetPasswordExpire: { gt: new Date(Date.now()) } },
        ],
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid Token');
    }

    const hashedPassword = await this.hashingService.hash(
      resetPassDto.password,
    );

    await this.prisma.user.update({
      where: { email: user.email },
      data: {
        password: hashedPassword,
        resetPasswordToken: null,
        resetPasswordExpire: null,
      },
    });

    return {
      message: 'Password resetted!',
    };
  }

  async updatePass(updatePassDto: UpdatePassDto, user: ActiveUserData) {
    const user_in_db = await this.prisma.user.findUnique({
      where: {
        email: user.email,
      },
    });

    if (!user_in_db) {
      throw new UnauthorizedException(`User does not exist`);
    }

    const isEqual = await this.hashingService.compare(
      updatePassDto.currentPassword,
      user_in_db.password,
    );

    if (!isEqual) {
      throw new UnauthorizedException(`Password does not match`);
    }

    const hashedPassword = await this.hashingService.hash(
      updatePassDto.newPassword,
    );

    await this.prisma.user.update({
      where: {
        email: user_in_db.email,
      },
      data: {
        password: hashedPassword,
      },
    });

    return {
      message: 'Password updated!',
    };
  }

  async updateDetails(
    updateDetailsDto: UpdateDetailsDto,
    user: ActiveUserData,
  ) {
    const user_in_db = await this.prisma.user.findUnique({
      where: {
        email: user.email,
      },
    });

    if (!user_in_db) {
      throw new UnauthorizedException();
    }

    await this.prisma.user.update({
      where: {
        email: user.email,
      },
      data: {
        username: updateDetailsDto.username,
      },
    });

    return {
      message: 'Details updated',
    };
  }

  async refreshToken(refreshTokenDto: RefreshTokenDto) {
    try {
      const { sub, refreshTokenId } = await this.jwtService.verifyAsync<
        Pick<ActiveUserData, 'sub'> & { refreshTokenId: string }
      >(refreshTokenDto.refreshToken, {
        secret: this.jwtConfiguation.secret,
        audience: this.jwtConfiguation.audience,
        issuer: this.jwtConfiguation.issuer,
      });

      // const user = await this.userRepository.findOneByOrFail({
      //   id: sub.toString(),
      // });

      const user = await this.prisma.user.findUniqueOrThrow({
        where: {
          id: sub.toString(),
        },
      });

      const isValid = await this.refreshTokenIdsStorage.validate(
        parseInt(user.id),
        refreshTokenId,
      );

      if (isValid) {
        await this.refreshTokenIdsStorage.invalidate(parseInt(user.id));
      } else {
        throw new Error(`Refresh token is invalid`);
      }

      return await this.generateTokens(user);
    } catch (err) {
      if (err instanceof InvalidateRefreshTokenError) {
        // Take action: Notify user that his refresh token may have been stolen
        throw new UnauthorizedException(`Access denied`);
      }
      throw new UnauthorizedException();
    }
  }

  public async generateTokens(user: User) {
    const refreshTokenId = randomUUID();

    const [accessToken, refreshToken] = await Promise.all([
      this.signToken<Partial<ActiveUserData>>(
        user.id,
        this.jwtConfiguation.accessTokenTtl,
        { email: user.email, role: user.role },
      ),
      this.signToken(user.id, this.jwtConfiguation.refreshTokenTtl, {
        refreshTokenId,
      }),
    ]);

    await this.refreshTokenIdsStorage.insert(parseInt(user.id), refreshTokenId);
    return {
      accessToken,
      refreshToken,
    };
  }

  private async signToken<T>(userId: string, expiresIn: number, payload: T) {
    return await this.jwtService.signAsync(
      {
        sub: userId,
        ...payload,
      },
      {
        audience: this.jwtConfiguation.audience,
        issuer: this.jwtConfiguation.issuer,
        secret: this.jwtConfiguation.secret,
        expiresIn,
      },
    );
  }

  private async generateEmailConfirmToken(user: User) {
    const confirmationToken = randomBytes(20).toString('hex');

    const confirmEmailToken = createHash('sha256')
      .update(confirmationToken)
      .digest('hex');

    await this.prisma.user.update({
      where: { email: user.email },
      data: {
        confirmEmailToken: confirmEmailToken,
      },
    });

    const confirmTokenExtend = randomBytes(100).toString('hex');
    return `${confirmationToken}.${confirmTokenExtend}`;
  }
}
