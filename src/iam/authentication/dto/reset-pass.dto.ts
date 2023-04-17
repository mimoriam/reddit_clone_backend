import { IsString } from 'class-validator';

export class ResetPassDto {
  @IsString()
  readonly password: string;
}
