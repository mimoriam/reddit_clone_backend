import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { authenticator } from 'otplib';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class OtpAuthenticationService {
  constructor(
    private readonly configService: ConfigService,
    private prisma: PrismaService,
  ) {}

  async generateSecret(email: string) {
    const secret = authenticator.generateSecret();
    const appName = this.configService.getOrThrow('TFA_APP_NAME');
    const uri = authenticator.keyuri(email, appName, secret);
    return { uri, secret };
  }

  verifyCode(code: string, secret: string) {
    return authenticator.verify({
      token: code,
      secret,
    });
  }

  async enableTfaForUser(email: string, secret: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: {
        email: email,
      },
      select: {
        id: true,
      },
    });

    await this.prisma.user.update({
      where: {
        email: email,
      },
      data: {
        // Ideally we want to encrypt the "secret" instead of storing in plaintext
        // Use encryption here instead of hashing
        tfaSecret: secret,
        isTfaEnabled: true,
      },
    });
  }
}
