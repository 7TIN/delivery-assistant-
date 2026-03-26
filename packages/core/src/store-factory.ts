import { getPrismaClient } from "./db";
import { PrismaStore } from "./prisma-store";
import { InMemoryStore, type OrderStore } from "./store";

export type RepositoryDriver = "memory" | "prisma";

export function resolveRepositoryDriver(): RepositoryDriver {
  const configured = Bun.env.REPOSITORY_DRIVER?.trim().toLowerCase();

  if (configured === "prisma") {
    return "prisma";
  }

  if (configured === "memory") {
    return "memory";
  }

  if (configured && configured.length > 0) {
    console.warn(`[store] Unknown REPOSITORY_DRIVER='${configured}', using auto mode`);
  }

  return Bun.env.DATABASE_URL ? "prisma" : "memory";
}

export function createOrderStore(): OrderStore {
  const driver = resolveRepositoryDriver();
  console.info(`[store] Repository driver selected: ${driver}`);

  if (driver === "prisma") {
    return new PrismaStore(getPrismaClient());
  }

  return new InMemoryStore();
}
