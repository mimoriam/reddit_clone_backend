import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

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
  providers: [],
})
export class AppModule {}
