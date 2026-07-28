import { randomUUID } from 'node:crypto';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../lib/error-handler.js';
import { BEDTIME_SLOT, BEDTIME_SLOT_LABEL } from '@budget/shared';
import type {
  CreateTreatmentDefinitionDTO,
  DayIntakesDTO,
  IntakeSlotDTO,
  SetIntakeDTO,
  TreatmentDefinitionDTO,
  UpdateTreatmentDefinitionDTO,
} from '@budget/shared';
import type { TreatmentDefinition } from '@prisma/client';
import { mealTypeDefinitionService } from './meal-type-definition.service.js';

/** Prisma @db.Date columns round-trip cleanly through UTC midnight */
function dateOnly(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** "½ cp" - dose and form joined once so every surface renders it the same */
function doseLabelOf(definition: Pick<TreatmentDefinition, 'dose' | 'form'>): string | null {
  const parts = [definition.dose, definition.form].filter(
    (part): part is string => Boolean(part && part.trim())
  );
  return parts.length > 0 ? parts.join(' ') : null;
}

/**
 * The intake catalogue is empty by default and stays empty until the user
 * adds something: no seeding, so nobody is shown a therapy module they never
 * asked for. What lives in it is entirely up to them - medication,
 * supplements, or anything else taken on a schedule.
 */
class TreatmentService {
  async list(userId: string, includeInactive = true): Promise<TreatmentDefinitionDTO[]> {
    const [definitions, usedKeys] = await Promise.all([
      prisma.treatmentDefinition.findMany({
        where: { userId, ...(includeInactive ? {} : { isActive: true }) },
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      }),
      prisma.treatmentIntake.groupBy({
        by: ['treatmentKey'],
        where: { userId },
        _count: { _all: true },
      }),
    ]);
    const used = new Set(usedKeys.map((entry) => entry.treatmentKey));
    return definitions.map((definition) => this.toDTO(definition, used.has(definition.key)));
  }

  async create(
    userId: string,
    data: CreateTreatmentDefinitionDTO
  ): Promise<TreatmentDefinitionDTO> {
    await this.assertUniqueName(userId, data.name);
    await this.assertSlotsExist(userId, data.slots);
    const last = await prisma.treatmentDefinition.findFirst({
      where: { userId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    const definition = await prisma.treatmentDefinition.create({
      data: {
        userId,
        key: `t-${randomUUID()}`,
        name: data.name.trim(),
        kind: data.kind ?? 'MEDICATION',
        detail: data.detail?.trim() || null,
        form: data.form?.trim() || null,
        dose: data.dose?.trim() || null,
        slots: data.slots,
        notes: data.notes?.trim() || null,
        startedOn: data.startedOn ? dateOnly(data.startedOn) : null,
        position: (last?.position ?? -1) + 1,
      },
    });
    return this.toDTO(definition, false);
  }

  async update(
    key: string,
    userId: string,
    data: UpdateTreatmentDefinitionDTO
  ): Promise<TreatmentDefinitionDTO> {
    const existing = await prisma.treatmentDefinition.findFirst({ where: { userId, key } });
    if (!existing) throw new AppError('Voce non trovata', 404, 'NOT_FOUND');
    if (data.name !== undefined) await this.assertUniqueName(userId, data.name, key);
    if (data.slots !== undefined) await this.assertSlotsExist(userId, data.slots);

    const definition = await prisma.treatmentDefinition.update({
      where: { id: existing.id },
      data: {
        name: data.name?.trim(),
        kind: data.kind,
        detail: data.detail === undefined ? undefined : data.detail?.trim() || null,
        form: data.form === undefined ? undefined : data.form?.trim() || null,
        dose: data.dose === undefined ? undefined : data.dose?.trim() || null,
        slots: data.slots,
        notes: data.notes === undefined ? undefined : data.notes?.trim() || null,
        startedOn:
          data.startedOn === undefined
            ? undefined
            : data.startedOn
              ? dateOnly(data.startedOn)
              : null,
        position: data.position,
        isActive: data.isActive,
      },
    });
    const used = await prisma.treatmentIntake.count({ where: { userId, treatmentKey: key } });
    return this.toDTO(definition, used > 0);
  }

  /**
   * Hard delete of the catalogue entry only. Recorded intakes keep their own
   * name and dose, so adherence history survives (the FK goes null).
   */
  async delete(key: string, userId: string): Promise<void> {
    const existing = await prisma.treatmentDefinition.findFirst({ where: { userId, key } });
    if (!existing) throw new AppError('Voce non trovata', 404, 'NOT_FOUND');
    await prisma.treatmentDefinition.delete({ where: { id: existing.id } });
  }

  /**
   * What is due on a given day, grouped by slot and already carrying the
   * answer given so far. Only active entries whose start date has passed:
   * a treatment added today does not retroactively look like a missed dose.
   */
  async getDay(userId: string, date: string): Promise<DayIntakesDTO> {
    const day = dateOnly(date);
    const [definitions, intakes, mealTypes] = await Promise.all([
      prisma.treatmentDefinition.findMany({
        where: {
          userId,
          isActive: true,
          OR: [{ startedOn: null }, { startedOn: { lte: day } }],
        },
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      }),
      prisma.treatmentIntake.findMany({ where: { userId, date: day } }),
      mealTypeDefinitionService.list(userId),
    ]);

    // Slot order follows the user's meal types, with bedtime always last
    const slotOrder = [...mealTypes.map((type) => type.key), BEDTIME_SLOT];
    const slotNames = new Map(mealTypes.map((type) => [type.key, type.name]));
    slotNames.set(BEDTIME_SLOT, BEDTIME_SLOT_LABEL);

    const answered = new Map(
      intakes.map((intake) => [`${intake.treatmentKey}|${intake.slot}`, intake.status])
    );

    const slots: IntakeSlotDTO[] = [];
    for (const slot of slotOrder) {
      const items = definitions
        .filter((definition) => definition.slots.includes(slot))
        .map((definition) => ({
          treatmentKey: definition.key,
          name: definition.name,
          kind: definition.kind,
          doseLabel: doseLabelOf(definition),
          notes: definition.notes,
          status: answered.get(`${definition.key}|${slot}`) ?? null,
        }));
      if (items.length > 0) {
        slots.push({ slot, slotName: slotNames.get(slot) ?? slot, items });
      }
    }

    const total = slots.reduce((sum, slot) => sum + slot.items.length, 0);
    const answeredCount = slots.reduce(
      (sum, slot) => sum + slot.items.filter((item) => item.status !== null).length,
      0
    );
    return { date, slots, answered: answeredCount, total };
  }

  /**
   * Idempotent per (day, treatment, slot): ticking twice does not create two
   * records, and a null status removes the answer entirely.
   */
  async setIntakes(userId: string, entries: SetIntakeDTO[]): Promise<void> {
    for (const entry of entries) {
      const day = dateOnly(entry.date);
      const where = {
        userId_date_treatmentKey_slot: {
          userId,
          date: day,
          treatmentKey: entry.treatmentKey,
          slot: entry.slot,
        },
      };

      if (entry.status === null) {
        await prisma.treatmentIntake.deleteMany({
          where: { userId, date: day, treatmentKey: entry.treatmentKey, slot: entry.slot },
        });
        continue;
      }

      const definition = await prisma.treatmentDefinition.findFirst({
        where: { userId, key: entry.treatmentKey },
      });
      if (!definition) {
        throw new AppError('Voce non trovata', 404, 'NOT_FOUND');
      }

      await prisma.treatmentIntake.upsert({
        where,
        create: {
          userId,
          treatmentId: definition.id,
          treatmentKey: definition.key,
          // Snapshots: renaming or deleting the definition later leaves the
          // recorded history readable exactly as it was written
          treatmentName: definition.name,
          doseLabel: doseLabelOf(definition),
          slot: entry.slot,
          date: day,
          status: entry.status,
        },
        update: { status: entry.status, loggedAt: new Date() },
      });
    }
  }

  /** Does the user track anything at all? Drives whether the UI shows up */
  async hasAny(userId: string): Promise<boolean> {
    const count = await prisma.treatmentDefinition.count({ where: { userId, isActive: true } });
    return count > 0;
  }

  private toDTO(definition: TreatmentDefinition, isUsed: boolean): TreatmentDefinitionDTO {
    return {
      key: definition.key,
      name: definition.name,
      kind: definition.kind,
      detail: definition.detail,
      form: definition.form,
      dose: definition.dose,
      slots: definition.slots,
      notes: definition.notes,
      startedOn: definition.startedOn ? toIsoDate(definition.startedOn) : null,
      position: definition.position,
      isActive: definition.isActive,
      isUsed,
    };
  }

  /** Slots are meal-type keys, so a typo would silently hide the entry */
  private async assertSlotsExist(userId: string, slots: string[]): Promise<void> {
    const mealTypes = await mealTypeDefinitionService.list(userId);
    const valid = new Set<string>([...mealTypes.map((type) => type.key), BEDTIME_SLOT]);
    const unknown = slots.filter((slot) => !valid.has(slot));
    if (unknown.length > 0) {
      throw new AppError('Momento di assunzione non valido', 400, 'INVALID_SLOT');
    }
  }

  private async assertUniqueName(userId: string, name: string, excludeKey?: string): Promise<void> {
    const duplicate = await prisma.treatmentDefinition.findFirst({
      where: {
        userId,
        name: { equals: name.trim(), mode: 'insensitive' },
        ...(excludeKey ? { key: { not: excludeKey } } : {}),
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new AppError('Esiste già una voce con questo nome', 409, 'DUPLICATE_TREATMENT');
    }
  }
}

export const treatmentService = new TreatmentService();
