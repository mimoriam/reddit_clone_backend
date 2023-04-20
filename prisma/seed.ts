import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
// Run this file by:
// "prisma": {
//     "seed": "dotenv -e .env.development -- ts-node --compiler-options {\"module\":\"CommonJS\"} prisma/seed.ts"
//   },
// npx prisma db seed

const prisma = new PrismaClient();

async function main() {
  try {
    await prisma.user.deleteMany();

    console.log('Seeding...');

    const password = await bcrypt.hash('123456', 13);

    const users = [
      {
        username: 'John Doe',
        email: 'john@gmail.com',
        role: Role.USER,
        password,
      },
      {
        username: 'John Doe2',
        email: 'john2@gmail.com',
        role: Role.USER,
        password,
      },
      {
        username: 'John Doe3',
        email: 'john3@gmail.com',
        role: Role.USER,
        password,
      },
    ];

    await Promise.all(
      users.map((user) => {
        return prisma.user.create({
          data: user,
        });
      }),
    );
  } catch (err) {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  }
}

main().finally(async () => {
  await prisma.$disconnect();
});
