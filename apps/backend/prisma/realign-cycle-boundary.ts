import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Realign expenses across the pay-cycle boundary when the cutoffDay changes.
// Use case: cutoffDay moved from 26 → 27. Expenses dated on or before the new
// payday that currently sit in the *next* period should move back to the
// period where the payday actually falls (i.e. expenses dated Mar 27 2026 that
// currently live in the April period should move to the March period).
const SOURCE_PERIOD_KEY = '2026-04';
const TARGET_PERIOD_KEY = '2026-03';
// Expenses with date <= CUTOFF_DATE (inclusive) move from SOURCE → TARGET.
const CUTOFF_DATE = new Date(Date.UTC(2026, 2, 27, 23, 59, 59, 999)); // Mar 27 2026 UTC end-of-day

// Flip to false (or run with APPLY=1) to actually write. Default = dry-run.
const APPLY = process.env.APPLY === '1';

async function main() {
  console.log(`\nMode: ${APPLY ? 'APPLY (writes)' : 'DRY-RUN (no writes — set APPLY=1 to persist)'}`);
  console.log(`Moving expenses with date <= ${CUTOFF_DATE.toISOString()}`);
  console.log(`From period ${SOURCE_PERIOD_KEY}  →  to period ${TARGET_PERIOD_KEY}\n`);

  const sourcePeriods = await prisma.monthPeriod.findMany({
    where: { periodKey: SOURCE_PERIOD_KEY },
    include: { expenses: { orderBy: { date: 'asc' } } },
  });

  if (sourcePeriods.length === 0) {
    console.log(`No period ${SOURCE_PERIOD_KEY} found. Nothing to do.`);
    return;
  }

  let totalMoved = 0;
  let totalAmount = 0;

  for (const src of sourcePeriods) {
    const toMove = src.expenses.filter((e) => e.date <= CUTOFF_DATE);
    if (toMove.length === 0) {
      console.log(`User ${src.userId}: 0 expenses to move`);
      continue;
    }

    let target = await prisma.monthPeriod.findFirst({
      where: { periodKey: TARGET_PERIOD_KEY, userId: src.userId },
    });
    if (!target) {
      const [tYear, tMonth] = TARGET_PERIOD_KEY.split('-').map(Number);
      if (APPLY) {
        target = await prisma.monthPeriod.create({
          data: { periodKey: TARGET_PERIOD_KEY, year: tYear, month: tMonth, userId: src.userId },
        });
        console.log(`Created missing period ${TARGET_PERIOD_KEY} for user ${src.userId}`);
      } else {
        console.log(`[DRY-RUN] Would create missing period ${TARGET_PERIOD_KEY} for user ${src.userId}`);
      }
    } else if (target.isClosed) {
      console.log(`⚠ Target period ${TARGET_PERIOD_KEY} for user ${src.userId} is CLOSED — skipping.`);
      continue;
    }

    if (src.isClosed) {
      console.log(`⚠ Source period ${SOURCE_PERIOD_KEY} for user ${src.userId} is CLOSED — skipping.`);
      continue;
    }

    console.log(`\nUser ${src.userId}: ${toMove.length} expense(s) to move`);
    let userSum = 0;
    for (const e of toMove) {
      console.log(
        `  ${e.date.toISOString()} | ${e.category.padEnd(7)} | ${e.amount.toFixed(2).padStart(8)} € | ${e.label}`
      );
      userSum += e.amount;
    }
    console.log(`  subtotal: ${userSum.toFixed(2)} €`);

    if (APPLY && target) {
      const result = await prisma.expense.updateMany({
        where: { id: { in: toMove.map((e) => e.id) }, monthPeriodId: src.id },
        data: { monthPeriodId: target.id },
      });
      console.log(`  ✓ moved ${result.count} row(s)`);
    }

    totalMoved += toMove.length;
    totalAmount += userSum;
  }

  console.log(
    `\n${APPLY ? 'Done' : 'Would move'}: ${totalMoved} expense(s), total ${totalAmount.toFixed(2)} €`
  );
  if (!APPLY) console.log('Re-run with APPLY=1 to persist these changes.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
