import { PrismaClient, Category } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Importing January 2026 expenses...');

  // Find the user (assuming there's only one user or using the first one)
  const user = await prisma.user.findFirst();

  if (!user) {
    console.error('❌ No user found in database. Please login first.');
    process.exit(1);
  }

  console.log(`👤 Found user: ${user.name} (${user.email})`);

  // Find or create January 2026 period
  const periodKey = '2026-01';

  let monthPeriod = await prisma.monthPeriod.findFirst({
    where: { userId: user.id, periodKey },
  });

  if (!monthPeriod) {
    monthPeriod = await prisma.monthPeriod.create({
      data: {
        userId: user.id,
        year: 2026,
        month: 1,
        periodKey,
      },
    });
    console.log(`✅ Created month period: ${periodKey}`);
  } else {
    console.log(`📅 Found existing month period: ${periodKey}`);
  }

  // Delete existing expenses for this period (to avoid duplicates)
  const deleted = await prisma.expense.deleteMany({
    where: { monthPeriodId: monthPeriod.id },
  });
  console.log(`🗑️  Deleted ${deleted.count} existing expenses`);

  // NEEDS expenses
  const needsExpenses = [
    { label: 'Coop Spesa', amount: 12 },
    { label: 'Diesel', amount: 12.5 },
    { label: 'Gab Teatro', amount: 3.5 },
    { label: 'Gab Regalo', amount: 25 },
    { label: 'Gab Vestiti', amount: 8.5 },
    { label: 'Pulizie Roberta (fisso)', amount: 40 },
    { label: 'Tim Mobile (fisso)', amount: 20 },
    { label: 'Wind Internet (fisso)', amount: 30.96 },
    { label: 'BPER competenze ed oneri', amount: 9.6 },
    { label: 'OpenAI - GPT (fisso)', amount: 21.28 },
    { label: 'Google Drive Spazio (fisso)', amount: 2.99 },
    { label: 'LIDL spesa', amount: 25 },
    { label: 'Gab retta Asilo gennaio (fisso)', amount: 169 },
    { label: 'Oki gola - Farmacia', amount: 12.5 },
    { label: 'Diesel', amount: 15 },
    { label: 'Creatina', amount: 40 },
    { label: 'Pizza ospedale Terni per Fra', amount: 11.7 },
    { label: 'Colazione bar Terni', amount: 3 },
    { label: 'Pranzo ospedale Terni', amount: 7.8 },
    { label: 'Cena McDonald Terni ospedale', amount: 9.9 },
    { label: 'Cena bar Terni ospedale', amount: 6.5 },
    { label: 'Cena Conad vicino ospedale Terni', amount: 18.48 },
    { label: 'Diesel', amount: 30 },
    { label: 'Mutuo (metà con Francesca) (fisso)', amount: 342 },
    { label: 'Fermenti Beatrice Farmacia', amount: 10.75 },
    { label: 'Coop (latte soia e pannolini)', amount: 9.65 },
    { label: 'Termometro (metà Fra)', amount: 5.45 },
    { label: 'Magnesio Bislicinato (2 mesi)', amount: 14.99 },
    { label: 'Gab Pizza Compleanno + ticket (metà)', amount: 16.5 },
    { label: 'Coop (spesa fatta da Fra)', amount: 39 },
    { label: 'Cordone ombelicale (da Fra)', amount: 5 },
    { label: 'Tiralatte (metà) tricount', amount: 17 },
    { label: 'Farmacia per Bea (metà) tricount', amount: 15 },
    { label: 'Claude PRO (fisso)', amount: 21.96 },
    { label: 'Wind tre commissioni', amount: 2 },
    { label: 'Trade Republic - Nuova carta Classic', amount: 5 },
    { label: 'Farmacia tricount (Fra)', amount: 13 },
    { label: 'Spesa tricount (Fra)', amount: 15 },
    { label: 'Farmacia test streptococco', amount: 15 },
    { label: 'Farmacia mascherine', amount: 2.5 },
    { label: 'Spesa Coop (Fra Tricount)', amount: 25 },
    { label: 'Compleanno Gab (Fra tricount)', amount: 15 },
    { label: 'Farmacia (Fra Tricount)', amount: 25 },
    { label: 'Spesa (Fra Tricount)', amount: 28.5 },
  ];

  // WANTS expenses
  const wantsExpenses = [
    { label: 'Umami Pranzo fuori centro', amount: 23.5 },
    { label: 'Anello Francesca', amount: 350 },
    { label: 'Netflix (fisso)', amount: 14 },
    { label: 'Pizza bianca zero 27 (metà Fra)', amount: 13.5 },
    { label: 'Cinema Gab (metà Fra)', amount: 9 },
    { label: 'Cinema - parcheggio', amount: 3 },
  ];

  // SAVINGS expenses
  const savingsExpenses = [
    { label: 'BBVA Fondo Emergenza', amount: 200 },
    { label: 'TRADE Republic (Vacanze&Extra)', amount: 95 },
    { label: 'TRADE Republic (chiusura mese)', amount: 290 },
  ];

  // Create all expenses with distributed dates throughout January
  const allExpenses: { label: string; amount: number; category: Category; day: number }[] = [];

  // Distribute NEEDS across the month (days 1-28)
  needsExpenses.forEach((expense, index) => {
    const day = Math.min(1 + Math.floor((index / needsExpenses.length) * 28), 28);
    allExpenses.push({ ...expense, category: Category.NEEDS, day });
  });

  // Distribute WANTS across the month
  wantsExpenses.forEach((expense, index) => {
    const day = Math.min(2 + Math.floor((index / wantsExpenses.length) * 26), 28);
    allExpenses.push({ ...expense, category: Category.WANTS, day });
  });

  // SAVINGS typically at the beginning of the month
  savingsExpenses.forEach((expense, index) => {
    allExpenses.push({ ...expense, category: Category.SAVINGS, day: 1 + index * 5 });
  });

  // Insert all expenses
  const created = await Promise.all(
    allExpenses.map((expense) =>
      prisma.expense.create({
        data: {
          monthPeriodId: monthPeriod!.id,
          date: new Date(2026, 0, expense.day), // January 2026
          category: expense.category,
          label: expense.label,
          amount: expense.amount,
        },
      })
    )
  );

  console.log(`✅ Created ${created.length} expenses`);

  // Summary
  const needsTotal = needsExpenses.reduce((sum, e) => sum + e.amount, 0);
  const wantsTotal = wantsExpenses.reduce((sum, e) => sum + e.amount, 0);
  const savingsTotal = savingsExpenses.reduce((sum, e) => sum + e.amount, 0);

  console.log('\n📊 Summary:');
  console.log(`   NEEDS (Necessità): €${needsTotal.toFixed(2)} (${needsExpenses.length} voci)`);
  console.log(`   WANTS (Svago): €${wantsTotal.toFixed(2)} (${wantsExpenses.length} voci)`);
  console.log(`   SAVINGS (Risparmi): €${savingsTotal.toFixed(2)} (${savingsExpenses.length} voci)`);
  console.log(`   TOTALE: €${(needsTotal + wantsTotal + savingsTotal).toFixed(2)}`);
  console.log('\n✨ Import completed!');
}

main()
  .catch((e) => {
    console.error('❌ Import failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
