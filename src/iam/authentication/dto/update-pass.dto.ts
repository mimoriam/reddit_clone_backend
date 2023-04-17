import { IsString } from 'class-validator';

export class UpdatePassDto {
  @IsString()
  readonly currentPassword: string;

  @IsString()
  readonly newPassword: string;
}
