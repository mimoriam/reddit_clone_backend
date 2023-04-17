import { IsEmail } from 'class-validator';

export class ForgotPassDto {
  @IsEmail()
  readonly email: string;
}
