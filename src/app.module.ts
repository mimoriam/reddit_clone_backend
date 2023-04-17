import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from './prisma.service';
import { UsersModule } from './users/users.module';
import { IamModule } from './iam/iam.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: ['.env.development'],
      isGlobal: true,
      expandVariables: true,
      cache: true,
    }),
    UsersModule,
    IamModule,
  ],
  controllers: [],
  providers: [PrismaService],
})
export class AppModule {}
