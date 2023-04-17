import { IsEmail, IsString, MinLength } from 'class-validator';
import { Role } from '@prisma/client';

export class SignUpDto {
  @IsString()
  readonly username: string;

  @IsEmail()
  readonly email: string;

  @IsString()
  readonly role: Role;

  @MinLength(5)
  readonly password: string;
}
