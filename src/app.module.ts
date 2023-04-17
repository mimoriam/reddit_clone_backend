import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from './prisma.service';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: ['.env.development'],
      isGlobal: true,
      expandVariables: true,
      cache: true,
    }),
    UsersModule,
  ],
  controllers: [],
  providers: [PrismaService],
})
export class AppModule {}
