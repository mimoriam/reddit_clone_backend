import { IsString } from 'class-validator';

export class UpdateDetailsDto {
  @IsString()
  readonly username: string;
}
