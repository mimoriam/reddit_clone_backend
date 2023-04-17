import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from './prisma.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: ['.env.development'],
      isGlobal: true,
      expandVariables: true,
      cache: true,
    }),
  ],
  controllers: [],
  providers: [PrismaService],
})
export class AppModule {}
