import { CreateUserDto } from './create-user.dto';
import { PartialType } from '@nestjs/mapped-types';

// TODO: Change PartialType from mapped-types to swagger-ui
export class UpdateUserDto extends PartialType(CreateUserDto) {}
