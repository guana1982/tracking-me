import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany();
  console.log('👥 Users in database:');
  users.forEach(u => console.log(`   - ID: ${u.id} | Name: ${u.name} | Email: ${u.email}`));

  const periods = await prisma.monthPeriod.findMany({
    where: { periodKey: '2026-01' },
    include: { user: true, _count: { select: { expenses: true } } }
  });
  console.log('\n📅 January 2026 periods:');
  periods.forEach(p => console.log(`   - Period ID: ${p.id} | User: ${p.user.name} (${p.user.email}) | Expenses: ${p._count.expenses}`));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
