import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../../generated/prisma/client";

let prismaSingleton: PrismaClient | undefined;

export function getPrismaClient(): PrismaClient {
  if (prismaSingleton) {
    return prismaSingleton;
  }

  const databaseUrl = Bun.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for Prisma repository mode");
  }

  const adapter = new PrismaPg({
    connectionString: databaseUrl,
  });

  prismaSingleton = new PrismaClient({ adapter });
  return prismaSingleton;
}

export async function disconnectPrismaClient(): Promise<void> {
  if (!prismaSingleton) {
    return;
  }

  await prismaSingleton.$disconnect();
  prismaSingleton = undefined;
}
