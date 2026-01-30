import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const period = await prisma.monthPeriod.findFirst({
    where: { periodKey: '2026-01' },
    select: {
      periodKey: true,
      isClosed: true,
      closedAt: true,
    },
  });

  console.log('Period status:', JSON.stringify(period, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
