import { PrismaClient } from "@prisma/client";

// Single shared Prisma client. Import from here only — never instantiate elsewhere.
export const prisma = new PrismaClient();
