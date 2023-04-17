import { Role } from '@prisma/client';

export interface ActiveUserData {
  // The subject of the token or userId:
  sub: number | string;
  email: string;
  role: Role;
}
