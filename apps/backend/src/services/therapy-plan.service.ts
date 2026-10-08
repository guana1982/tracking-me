import { prisma } from '../lib/prisma.js';
import { AppError } from '../lib/error-handler.js';
import { examAdvisories } from '../lib/therapy-config.js';
import { milestoneAttachmentService } from './milestone-attachment.service.js';
import { WEIGHT_INTERVAL_DAYS } from '@budget/shared';
import type {
  CreateMilestoneDTO,
  CreateTitrationStepDTO,
  MilestoneAttachmentDTO,
  MilestoneDTO,
  SaveWeightDTO,
  ScheduleItemDTO,
  TitrationStepDTO,
  UpdateMilestoneDTO,
  WeightEntryDTO,
  WeightSummaryDTO,
} from '@budget/shared';
import type { Milestone, TitrationStep, TreatmentDefinition, WeightEntry } from '@prisma/client';

function dateOnly(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Whole days between two calendar dates, sign included */
function daysBetween(from: string, to: string): number {
  return Math.round((dateOnly(to).getTime() - dateOnly(from).getTime()) / 86_400_000);
}

/**
 * The parts of the therapy that live on a calendar - planned dose changes,
 * exams, appointments - plus the weekly weight.
 *
 * Nothing here is preloaded and nothing fires on its own: the diary reads the
 * schedule and shows what is close, which is the whole point of writing it
 * down before it matters.
 */
class TherapyPlanService {
  // ---------- Titration (§3.1) ----------

  async listTitration(userId: string): Promise<TitrationStepDTO[]> {
    const steps = await prisma.titrationStep.findMany({
      where: { userId },
      include: { treatment: { select: { key: true, name: true } } },
      orderBy: { date: 'asc' },
    });
    return steps.map((step) => ({
      id: step.id,
      treatmentKey: step.treatment.key,
      treatmentName: step.treatment.name,
      date: toIsoDate(step.date),
      dose: step.dose,
      applied: step.applied,
    }));
  }

  async createTitrationStep(
    userId: string,
    data: CreateTitrationStepDTO
  ): Promise<TitrationStepDTO> {
    const treatment = await prisma.treatmentDefinition.findFirst({
      where: { userId, key: data.treatmentKey },
    });
    if (!treatment) throw new AppError('Voce non trovata', 404, 'NOT_FOUND');

    const step = await prisma.titrationStep.create({
      data: {
        userId,
        treatmentId: treatment.id,
        date: dateOnly(data.date),
        dose: data.dose.trim(),
      },
    });
    return this.toTitrationDTO(step, treatment);
  }

  /**
   * Writes the planned dose onto the treatment. Explicit rather than
   * automatic: the app must not claim a dose changed in real life just
   * because a date went by.
   */
  async applyTitrationStep(userId: string, id: string): Promise<TitrationStepDTO> {
    const step = await prisma.titrationStep.findFirst({
      where: { userId, id },
      include: { treatment: true },
    });
    if (!step) throw new AppError('Tappa non trovata', 404, 'NOT_FOUND');

    const [, updated] = await prisma.$transaction([
      prisma.treatmentDefinition.update({
        where: { id: step.treatmentId },
        data: { dose: step.dose },
      }),
      prisma.titrationStep.update({ where: { id: step.id }, data: { applied: true } }),
    ]);
    return this.toTitrationDTO(updated, step.treatment);
  }

  async deleteTitrationStep(userId: string, id: string): Promise<void> {
    await prisma.titrationStep.deleteMany({ where: { userId, id } });
  }

  // ---------- Milestones (§3.7) ----------

  async listMilestones(userId: string): Promise<MilestoneDTO[]> {
    // One query for every attachment rather than one per milestone: the list
    // is short, and the files are what the schedule is now partly about
    const [milestones, attachments] = await Promise.all([
      prisma.milestone.findMany({ where: { userId }, orderBy: { date: 'asc' } }),
      milestoneAttachmentService.mapByMilestone(userId),
    ]);
    return milestones.map((milestone) =>
      this.toMilestoneDTO(milestone, attachments.get(milestone.id) ?? [])
    );
  }

  async createMilestone(userId: string, data: CreateMilestoneDTO): Promise<MilestoneDTO> {
    const milestone = await prisma.milestone.create({
      data: {
        userId,
        kind: data.kind ?? 'OTHER',
        title: data.title.trim(),
        date: dateOnly(data.date),
        notes: data.notes?.trim() || null,
        items: data.items ?? [],
        advisories: data.advisories ?? [],
      },
    });
    return this.toMilestoneDTO(milestone);
  }

  async updateMilestone(
    userId: string,
    id: string,
    data: UpdateMilestoneDTO
  ): Promise<MilestoneDTO> {
    const existing = await prisma.milestone.findFirst({ where: { userId, id } });
    if (!existing) throw new AppError('Scadenza non trovata', 404, 'NOT_FOUND');

    const milestone = await prisma.milestone.update({
      where: { id: existing.id },
      data: {
        kind: data.kind,
        title: data.title?.trim(),
        date: data.date ? dateOnly(data.date) : undefined,
        notes: data.notes === undefined ? undefined : data.notes?.trim() || null,
        items: data.items,
        advisories: data.advisories,
        isDone: data.isDone,
      },
    });
    // Ticking a box must not look like it dropped the files attached to it
    return this.toMilestoneDTO(
      milestone,
      await milestoneAttachmentService.listByMilestone(userId, milestone.id)
    );
  }

  async deleteMilestone(userId: string, id: string): Promise<void> {
    await prisma.milestone.deleteMany({ where: { userId, id } });
  }

  /** The advisories offered when writing down an exam, from the config file */
  suggestedAdvisories(): string[] {
    return examAdvisories();
  }

  /**
   * Milestones and planned dose changes as one list. Past-and-done items are
   * dropped; a past item still open stays, because a forgotten exam is
   * exactly what the schedule is for.
   */
  async getSchedule(userId: string, today: string): Promise<ScheduleItemDTO[]> {
    const [milestones, steps] = await Promise.all([
      this.listMilestones(userId),
      this.listTitration(userId),
    ]);

    const items: ScheduleItemDTO[] = [
      ...milestones.map((milestone) => ({
        id: milestone.id,
        source: 'MILESTONE' as const,
        kind: milestone.kind,
        title: milestone.title,
        date: milestone.date,
        detail: milestone.notes,
        items: milestone.items,
        advisories: milestone.advisories,
        isDone: milestone.isDone,
        daysAway: daysBetween(today, milestone.date),
      })),
      ...steps.map((step) => ({
        id: step.id,
        source: 'TITRATION' as const,
        kind: 'DOSE_CHANGE' as const,
        title: `${step.treatmentName} → ${step.dose}`,
        date: step.date,
        detail: step.dose,
        items: [] as string[],
        advisories: [] as string[],
        isDone: step.applied,
        daysAway: daysBetween(today, step.date),
      })),
    ];

    return items
      .filter((item) => !(item.isDone && item.daysAway < 0))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  // ---------- Weight (§3.6) ----------

  /**
   * Upsert on the day: correcting today's weight edits it. Weekly cadence is
   * a matter for the UI, not a constraint written into the data - a weight
   * taken on the wrong day is still a real weight.
   */
  async saveWeight(userId: string, data: SaveWeightDTO): Promise<WeightEntryDTO> {
    const day = dateOnly(data.date);
    const entry = await prisma.weightEntry.upsert({
      where: { userId_date: { userId, date: day } },
      create: {
        userId,
        date: day,
        weightKg: data.weightKg,
        note: data.note?.trim() || null,
      },
      update: { weightKg: data.weightKg, note: data.note?.trim() || null },
    });
    return this.toWeightDTO(entry);
  }

  async deleteWeight(userId: string, id: string): Promise<void> {
    await prisma.weightEntry.deleteMany({ where: { userId, id } });
  }

  async getWeightSummary(userId: string, today: string): Promise<WeightSummaryDTO> {
    const entries = await prisma.weightEntry.findMany({
      where: { userId },
      orderBy: { date: 'asc' },
    });
    const mapped = entries.map((entry) => this.toWeightDTO(entry));
    const first = mapped[0] ?? null;
    const last = mapped[mapped.length - 1] ?? null;

    return {
      entries: mapped,
      first,
      last,
      deltaKg:
        first && last && first.id !== last.id
          ? Math.round((last.weightKg - first.weightKg) * 10) / 10
          : null,
      daysSinceLast: last ? daysBetween(last.date, today) : null,
    };
  }

  /** True when the weekly slot has come round again */
  isWeightDue(summary: WeightSummaryDTO): boolean {
    return summary.daysSinceLast === null || summary.daysSinceLast >= WEIGHT_INTERVAL_DAYS;
  }

  private toTitrationDTO(
    step: TitrationStep,
    treatment: Pick<TreatmentDefinition, 'key' | 'name'>
  ): TitrationStepDTO {
    return {
      id: step.id,
      treatmentKey: treatment.key,
      treatmentName: treatment.name,
      date: toIsoDate(step.date),
      dose: step.dose,
      applied: step.applied,
    };
  }

  private toMilestoneDTO(
    milestone: Milestone,
    attachments: MilestoneAttachmentDTO[] = []
  ): MilestoneDTO {
    return {
      id: milestone.id,
      kind: milestone.kind,
      title: milestone.title,
      date: toIsoDate(milestone.date),
      notes: milestone.notes,
      items: milestone.items,
      advisories: milestone.advisories,
      isDone: milestone.isDone,
      attachments,
    };
  }

  private toWeightDTO(entry: WeightEntry): WeightEntryDTO {
    return {
      id: entry.id,
      date: toIsoDate(entry.date),
      weightKg: entry.weightKg,
      note: entry.note,
    };
  }
}

export const therapyPlanService = new TherapyPlanService();
