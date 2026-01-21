import { PrismaClient, Category } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Get current date
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-indexed

  // Create current month period
  const periodKey = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;

  const monthPeriod = await prisma.monthPeriod.upsert({
    where: { periodKey },
    update: {},
    create: {
      year: currentYear,
      month: currentMonth,
      periodKey,
    },
  });

  console.log(`✅ Created month period: ${periodKey}`);

  // Create default budget rule (65/25/10)
  const budgetRule = await prisma.budgetRule.upsert({
    where: { monthPeriodId: monthPeriod.id },
    update: {},
    create: {
      monthPeriodId: monthPeriod.id,
      needsPct: 65,
      wantsPct: 25,
      savingsPct: 10,
      cutoffDay: 26,
      autoReallocateNeedsRemainder: true,
    },
  });

  console.log(`✅ Created budget rule: 65/25/10`);

  // Create sample incomes
  const incomes = await Promise.all([
    prisma.income.create({
      data: {
        monthPeriodId: monthPeriod.id,
        label: 'Stipendio',
        amount: 1950,
      },
    }),
    prisma.income.create({
      data: {
        monthPeriodId: monthPeriod.id,
        label: 'Ticket',
        amount: 140,
      },
    }),
  ]);

  console.log(`✅ Created ${incomes.length} income entries`);

  // Create sample expenses
  const expenses = await Promise.all([
    // NEEDS
    prisma.expense.create({
      data: {
        monthPeriodId: monthPeriod.id,
        date: new Date(currentYear, currentMonth - 1, 3),
        category: Category.NEEDS,
        label: 'Coop Spesa',
        amount: 12,
      },
    }),
    prisma.expense.create({
      data: {
        monthPeriodId: monthPeriod.id,
        date: new Date(currentYear, currentMonth - 1, 5),
        category: Category.NEEDS,
        label: 'Diesel',
        amount: 12.5,
      },
    }),
    prisma.expense.create({
      data: {
        monthPeriodId: monthPeriod.id,
        date: new Date(currentYear, currentMonth - 1, 7),
        category: Category.NEEDS,
        label: 'Pulizie Roberta (fisso)',
        amount: 40,
      },
    }),
    prisma.expense.create({
      data: {
        monthPeriodId: monthPeriod.id,
        date: new Date(currentYear, currentMonth - 1, 8),
        category: Category.NEEDS,
        label: 'Tim Mobile (fisso)',
        amount: 20,
      },
    }),
    prisma.expense.create({
      data: {
        monthPeriodId: monthPeriod.id,
        date: new Date(currentYear, currentMonth - 1, 9),
        category: Category.NEEDS,
        label: 'Wind Internet (fisso)',
        amount: 33,
      },
    }),
    prisma.expense.create({
      data: {
        monthPeriodId: monthPeriod.id,
        date: new Date(currentYear, currentMonth - 1, 10),
        category: Category.NEEDS,
        label: 'Mutuo (meta con Francesca)',
        amount: 342,
      },
    }),
    prisma.expense.create({
      data: {
        monthPeriodId: monthPeriod.id,
        date: new Date(currentYear, currentMonth - 1, 12),
        category: Category.NEEDS,
        label: 'LIDL spesa',
        amount: 25,
      },
    }),
    prisma.expense.create({
      data: {
        monthPeriodId: monthPeriod.id,
        date: new Date(currentYear, currentMonth - 1, 15),
        category: Category.NEEDS,
        label: 'Google Drive Spazio (fisso)',
        amount: 2.99,
      },
    }),

    // WANTS
    prisma.expense.create({
      data: {
        monthPeriodId: monthPeriod.id,
        date: new Date(currentYear, currentMonth - 1, 4),
        category: Category.WANTS,
        label: 'Umami Pranzo fuori centro',
        amount: 23.5,
      },
    }),
    prisma.expense.create({
      data: {
        monthPeriodId: monthPeriod.id,
        date: new Date(currentYear, currentMonth - 1, 6),
        category: Category.WANTS,
        label: 'Netflix (fisso)',
        amount: 14,
      },
    }),
    prisma.expense.create({
      data: {
        monthPeriodId: monthPeriod.id,
        date: new Date(currentYear, currentMonth - 1, 11),
        category: Category.WANTS,
        label: 'Cinema Gab',
        amount: 9,
      },
    }),
    prisma.expense.create({
      data: {
        monthPeriodId: monthPeriod.id,
        date: new Date(currentYear, currentMonth - 1, 14),
        category: Category.WANTS,
        label: 'Pizza con amici',
        amount: 13.5,
      },
    }),

    // SAVINGS
    prisma.expense.create({
      data: {
        monthPeriodId: monthPeriod.id,
        date: new Date(currentYear, currentMonth - 1, 1),
        category: Category.SAVINGS,
        label: 'BBVA Fondo Emergenza',
        amount: 200,
      },
    }),
  ]);

  console.log(`✅ Created ${expenses.length} expense entries`);

  // Summary
  const totalIncome = incomes.reduce((sum, i) => sum + i.amount, 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  console.log('\n📊 Summary:');
  console.log(`   Total Income: €${totalIncome.toFixed(2)}`);
  console.log(`   Total Expenses: €${totalExpenses.toFixed(2)}`);
  console.log(`   Budget Rule: ${budgetRule.needsPct}/${budgetRule.wantsPct}/${budgetRule.savingsPct}`);
  console.log('\n✨ Seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
