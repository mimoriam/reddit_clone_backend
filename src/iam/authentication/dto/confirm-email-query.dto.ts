import { IsOptional, IsString } from 'class-validator';

export class ConfirmEmailQueryDto {
  @IsOptional()
  @IsString()
  readonly token: string;
}
