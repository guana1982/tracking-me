import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Transferring January 2026 expenses to Daniele Regno...');

  // Find source period (Dati Migrati)
  const sourcePeriod = await prisma.monthPeriod.findFirst({
    where: { periodKey: '2026-01', userId: 'default-migration-user' },
  });

  if (!sourcePeriod) {
    console.error('❌ Source period not found');
    return;
  }

  // Find target period (Daniele Regno)
  const targetPeriod = await prisma.monthPeriod.findFirst({
    where: { periodKey: '2026-01', userId: 'cmkuylgtp0000w248uezfmc7q' },
  });

  if (!targetPeriod) {
    console.error('❌ Target period not found');
    return;
  }

  console.log(`📤 Source: ${sourcePeriod.id}`);
  console.log(`📥 Target: ${targetPeriod.id}`);

  // Delete existing expenses in target period (if any)
  const deleted = await prisma.expense.deleteMany({
    where: { monthPeriodId: targetPeriod.id },
  });
  console.log(`🗑️  Deleted ${deleted.count} existing expenses from target`);

  // Move expenses from source to target
  const moved = await prisma.expense.updateMany({
    where: { monthPeriodId: sourcePeriod.id },
    data: { monthPeriodId: targetPeriod.id },
  });

  console.log(`✅ Moved ${moved.count} expenses to Daniele Regno's account`);
  console.log('\n✨ Transfer completed! Refresh your dashboard.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
