import {
  IsEmail,
  IsNumberString,
  IsOptional,
  MinLength,
} from 'class-validator';

export class SignInDto {
  @IsEmail()
  readonly email: string;

  @MinLength(5)
  readonly password: string;

  @IsOptional()
  @IsNumberString()
  tfaCode?: string;
}
