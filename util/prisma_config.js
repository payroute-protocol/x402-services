import * as Prisma from '@prisma/client';
export const prisma = new Prisma.PrismaClient({
    log: ['warn', 'error'],
}); 