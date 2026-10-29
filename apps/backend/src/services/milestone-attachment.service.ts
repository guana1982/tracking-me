import { prisma } from '../lib/prisma.js';
import { AppError } from '../lib/error-handler.js';
import {
  ATTACHMENT_EXTENSIONS,
  ATTACHMENT_MAX_BYTES,
  MILESTONE_KIND_LABELS,
} from '@budget/shared';
import type {
  AttachmentMimeTypeDTO,
  CreateMilestoneAttachmentDTO,
  MilestoneAttachmentDTO,
} from '@budget/shared';
import type { MilestoneAttachment, Prisma } from '@prisma/client';

/** Folder the reports land in inside the export archive */
const EXPORT_DIR = 'referti';

/** Enough for a life of exams, few enough that a slip cannot fill a table */
const MAX_PER_MILESTONE = 20;

const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/;

export interface ExportAttachment {
  /** The day it belongs to: the date on the schedule, not the upload day */
  date: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  milestoneTitle: string;
  kindLabel: string;
  /** Where the file sits in the archive - and what the CSV row points at */
  exportPath: string;
}

export interface ExportAttachmentFile extends ExportAttachment {
  data: Uint8Array;
}

function baseName(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot > 0 ? fileName.slice(0, dot) : fileName;
}

function slugify(value: string): string {
  return (
    value
      // NFD splits "à" into "a" + its accent, and the accent is then dropped
      // as non-ASCII: without this "città" would slug to "citt-" instead of
      // "citta", because the next pass turns anything left into a dash
      .normalize('NFD')
      .replace(/[^\x00-\x7f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'referto'
  );
}

/**
 * The name a file gets inside the archive: the day first, so the folder reads
 * in the same order as the diary, and the extension from the declared type
 * rather than from whatever the original name ended in.
 *
 * A counter is added only where two files of one day would collide. It is
 * derived from position, which is why every caller has to feed this the same
 * ordering: the CSV names the paths and the ZIP writes them, and the two
 * would stop matching the moment they disagreed about the order.
 */
export function buildExportPaths<T extends { date: string; fileName: string; mimeType: string }>(
  attachments: T[]
): (T & { exportPath: string })[] {
  const used = new Map<string, number>();
  return attachments.map((attachment) => {
    const extension = ATTACHMENT_EXTENSIONS[attachment.mimeType as AttachmentMimeTypeDTO] ?? 'bin';
    const stem = `${attachment.date}-${slugify(baseName(attachment.fileName))}`;
    const seen = used.get(stem) ?? 0;
    used.set(stem, seen + 1);
    return {
      ...attachment,
      exportPath: `${EXPORT_DIR}/${stem}${seen === 0 ? '' : `-${seen + 1}`}.${extension}`,
    };
  });
}

class MilestoneAttachmentService {
  async listByMilestone(userId: string, milestoneId: string): Promise<MilestoneAttachmentDTO[]> {
    const rows = await prisma.milestoneAttachment.findMany({
      where: { userId, milestoneId },
      // Never `data`: a list of ten reports would otherwise be a list of
      // ten files travelling to the browser for nothing
      select: this.metadataSelect,
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) => this.toDTO(row));
  }

  /** Every attachment of the user, keyed by milestone - one query for a list view */
  async mapByMilestone(userId: string): Promise<Map<string, MilestoneAttachmentDTO[]>> {
    const rows = await prisma.milestoneAttachment.findMany({
      where: { userId },
      select: this.metadataSelect,
      orderBy: { createdAt: 'asc' },
    });
    const map = new Map<string, MilestoneAttachmentDTO[]>();
    for (const row of rows) {
      const list = map.get(row.milestoneId) ?? [];
      list.push(this.toDTO(row));
      map.set(row.milestoneId, list);
    }
    return map;
  }

  async create(
    userId: string,
    milestoneId: string,
    input: CreateMilestoneAttachmentDTO
  ): Promise<MilestoneAttachmentDTO> {
    const milestone = await prisma.milestone.findFirst({
      where: { id: milestoneId, userId },
      select: { id: true },
    });
    if (!milestone) {
      throw new AppError('Scadenza non trovata', 404, 'NOT_FOUND');
    }

    const count = await prisma.milestoneAttachment.count({ where: { userId, milestoneId } });
    if (count >= MAX_PER_MILESTONE) {
      throw new AppError(
        `Massimo ${MAX_PER_MILESTONE} allegati per scadenza`,
        400,
        'TOO_MANY_ATTACHMENTS'
      );
    }

    const content = input.content.replace(/\s+/g, '');
    if (!BASE64.test(content)) {
      throw new AppError('Contenuto del file non valido', 400, 'INVALID_FILE');
    }
    const data = Buffer.from(content, 'base64');
    if (data.byteLength === 0) {
      throw new AppError('Il file è vuoto', 400, 'INVALID_FILE');
    }
    if (data.byteLength > ATTACHMENT_MAX_BYTES) {
      throw new AppError(
        `Il file supera ${Math.round(ATTACHMENT_MAX_BYTES / (1024 * 1024))} MB`,
        400,
        'FILE_TOO_LARGE'
      );
    }
    // A PDF always opens with %PDF-. Checking it costs nothing and catches the
    // real mistake this guards against: a file renamed rather than converted
    if (input.mimeType === 'application/pdf' && data.subarray(0, 5).toString('latin1') !== '%PDF-') {
      throw new AppError('Il file non è un PDF valido', 400, 'INVALID_FILE');
    }

    const created = await prisma.milestoneAttachment.create({
      data: {
        userId,
        milestoneId,
        fileName: input.fileName,
        mimeType: input.mimeType,
        sizeBytes: data.byteLength,
        data,
      },
      select: this.metadataSelect,
    });
    return this.toDTO(created);
  }

  async setIncludeInExport(
    userId: string,
    id: string,
    includeInExport: boolean
  ): Promise<MilestoneAttachmentDTO> {
    const existing = await prisma.milestoneAttachment.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!existing) {
      throw new AppError('Allegato non trovato', 404, 'NOT_FOUND');
    }
    const updated = await prisma.milestoneAttachment.update({
      where: { id },
      data: { includeInExport },
      select: this.metadataSelect,
    });
    return this.toDTO(updated);
  }

  async remove(userId: string, id: string): Promise<void> {
    const { count } = await prisma.milestoneAttachment.deleteMany({ where: { id, userId } });
    if (count === 0) {
      throw new AppError('Allegato non trovato', 404, 'NOT_FOUND');
    }
  }

  /** The file itself, for a download */
  async getFile(
    userId: string,
    id: string
  ): Promise<{ fileName: string; mimeType: string; data: Buffer }> {
    const row = await prisma.milestoneAttachment.findFirst({
      where: { id, userId },
      select: { fileName: true, mimeType: true, data: true },
    });
    if (!row) {
      throw new AppError('Allegato non trovato', 404, 'NOT_FOUND');
    }
    return { fileName: row.fileName, mimeType: row.mimeType, data: Buffer.from(row.data) };
  }

  /** What the CSV names: the same set as the archive, without the bytes */
  async listForExport(userId: string, from?: string, to?: string): Promise<ExportAttachment[]> {
    const rows = await prisma.milestoneAttachment.findMany({
      where: this.exportWhere(userId, from, to),
      select: {
        fileName: true,
        mimeType: true,
        sizeBytes: true,
        milestone: { select: { date: true, title: true, kind: true } },
      },
      orderBy: this.exportOrder(),
    });
    return buildExportPaths(rows.map((row) => this.toExportRow(row)));
  }

  /** What the archive writes: the same set as the CSV, with the bytes */
  async listFilesForExport(
    userId: string,
    from?: string,
    to?: string
  ): Promise<ExportAttachmentFile[]> {
    const rows = await prisma.milestoneAttachment.findMany({
      where: this.exportWhere(userId, from, to),
      select: {
        fileName: true,
        mimeType: true,
        sizeBytes: true,
        data: true,
        milestone: { select: { date: true, title: true, kind: true } },
      },
      orderBy: this.exportOrder(),
    });
    return buildExportPaths(
      rows.map((row) => ({ ...this.toExportRow(row), data: Uint8Array.from(row.data) }))
    );
  }

  private readonly metadataSelect = {
    id: true,
    milestoneId: true,
    fileName: true,
    mimeType: true,
    sizeBytes: true,
    includeInExport: true,
    createdAt: true,
  } as const;

  // Both export queries read the same set, ordered the same way: it is what
  // makes the paths in the CSV and the paths in the archive the same paths
  private exportOrder(): Prisma.MilestoneAttachmentOrderByWithRelationInput[] {
    return [{ milestone: { date: 'asc' } }, { createdAt: 'asc' }];
  }

  private exportWhere(userId: string, from?: string, to?: string) {
    return {
      userId,
      includeInExport: true,
      // Filtered on the date on the schedule, like every other dated record,
      // and not on when the file happened to be uploaded
      ...(from || to
        ? {
            milestone: {
              date: {
                ...(from ? { gte: new Date(`${from}T00:00:00.000Z`) } : {}),
                ...(to ? { lte: new Date(`${to}T00:00:00.000Z`) } : {}),
              },
            },
          }
        : {}),
    };
  }

  private toExportRow(row: {
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    milestone: { date: Date; title: string; kind: keyof typeof MILESTONE_KIND_LABELS };
  }): Omit<ExportAttachment, 'exportPath'> {
    return {
      date: row.milestone.date.toISOString().slice(0, 10),
      fileName: row.fileName,
      mimeType: row.mimeType,
      sizeBytes: row.sizeBytes,
      milestoneTitle: row.milestone.title,
      kindLabel: MILESTONE_KIND_LABELS[row.milestone.kind],
    };
  }

  private toDTO(row: Omit<MilestoneAttachment, 'userId' | 'data'>): MilestoneAttachmentDTO {
    return {
      id: row.id,
      milestoneId: row.milestoneId,
      fileName: row.fileName,
      mimeType: row.mimeType as AttachmentMimeTypeDTO,
      sizeBytes: row.sizeBytes,
      includeInExport: row.includeInExport,
      createdAt: row.createdAt.toISOString(),
    };
  }
}

export const milestoneAttachmentService = new MilestoneAttachmentService();
