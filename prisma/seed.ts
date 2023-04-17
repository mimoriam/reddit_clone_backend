import { PrismaClient } from '@prisma/client';
// Run this file by:
// ts-node prisma/seed.ts

const prisma = new PrismaClient();

async function main() {
  // Delete any and all models before seeding:
  await prisma.user.deleteMany();

  console.log('Seeding...');

  // Seeding logic here:
}

main()
  .catch((err) => console.error(err))
  .finally(async () => {
    await prisma.$disconnect();
  });
