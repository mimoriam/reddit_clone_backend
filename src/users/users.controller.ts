import { Controller, Get, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { Auth } from '../iam/authentication/decorators/auth.decorator';
import { AuthType } from '../iam/authentication/enums/auth-type.enum';
import { RolesGuard } from '../iam/authorization/guards/roles.guard';
import { Roles } from '../iam/authorization/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('users')
@UseGuards(RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Auth(AuthType.Bearer)
  @Roles(Role.ADMIN)
  async checkForAuthorization() {
    return {
      message: 'Authorized',
    };
  }
}
