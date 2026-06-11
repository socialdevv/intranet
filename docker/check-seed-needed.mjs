import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

try {
  const userCount = await prisma.user.count();
  process.exit(userCount === 0 ? 0 : 1);
} catch (error) {
  console.error("Failed to check whether database seeding is required.", error);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
