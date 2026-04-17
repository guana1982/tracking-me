import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const period = await prisma.monthPeriod.findFirst({
    where: { periodKey: '2026-04' },
    include: {
      expenses: { orderBy: { date: 'asc' } },
      budgetRule: true,
    },
  });

  if (!period) {
    console.log('No period 2026-04 found');
    return;
  }

  console.log('=== BudgetRule for 2026-04 ===');
  console.log(JSON.stringify(period.budgetRule, null, 2));

  const nonSavings = period.expenses.filter((e) => e.category !== 'SAVINGS');
  const total = nonSavings.reduce((s, e) => s + e.amount, 0);
  const upTo17 = nonSavings.filter((e) => e.date.getDate() <= 17);
  const upTo17Sum = upTo17.reduce((s, e) => s + e.amount, 0);
  const after17 = nonSavings.filter((e) => e.date.getDate() > 17);
  const after17Sum = after17.reduce((s, e) => s + e.amount, 0);

  console.log('\n=== NEEDS+WANTS totals ===');
  console.log(`Total: ${total.toFixed(2)} € (${nonSavings.length} rows)`);
  console.log(`  date.getDate() <= 17: ${upTo17Sum.toFixed(2)} € (${upTo17.length} rows)`);
  console.log(`  date.getDate() > 17:  ${after17Sum.toFixed(2)} € (${after17.length} rows)`);

  console.log('\n=== Expenses with date.getDate() > 17 (the "missing" 89€) ===');
  for (const e of after17) {
    console.log(
      `  ${e.date.toISOString()} | getDate()=${e.date.getDate()} | ${e.category.padEnd(6)} | ${e.amount.toFixed(2).padStart(8)} € | ${e.description}`
    );
  }

  console.log('\n=== All NEEDS+WANTS expenses (raw dates) ===');
  for (const e of nonSavings) {
    const utcDay = e.date.getUTCDate();
    const localDay = e.date.getDate();
    const flag = utcDay !== localDay ? ' ⚠️ TZ-SHIFT' : '';
    console.log(
      `  ${e.date.toISOString()} | UTC=${utcDay} local=${localDay}${flag} | ${e.category.padEnd(6)} | ${e.amount.toFixed(2).padStart(8)} € | ${e.description}`
    );
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
