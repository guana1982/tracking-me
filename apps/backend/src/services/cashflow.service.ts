import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import type {
  CashFlowCheckDTO,
  CreateCashFlowCheckDTO,
  UpdateCashFlowCheckDTO,
  CashFlowSettingsDTO,
  CashFlowColumnDTO,
  CreateCashFlowColumnDTO,
  UpdateCashFlowColumnDTO,
  CashFlowValueMap,
} from '@budget/shared';
import { AppError } from '../lib/error-handler.js';

const LEGACY_COLUMNS: CashFlowColumnDTO[] = [
  { key: 'bbva', label: 'BBVA c/c', position: 0, isActive: true },
  { key: 'tradeRepublic', label: 'TRADE REP.', position: 1, isActive: true },
  { key: 'webankCc', label: 'WEBANK c/c', position: 2, isActive: true },
  { key: 'webankObbl', label: 'WEBANK Obbl', position: 3, isActive: true },
  { key: 'etfLordo', label: 'ETF tutti LORDO', position: 4, isActive: true },
  { key: 'rendimentoLordo', label: 'RENDIM. LORDO', position: 5, isActive: true },
  { key: 'bper', label: 'BPER c/c', position: 6, isActive: true },
  { key: 'tricount', label: 'TRIC DEB/CRED', position: 7, isActive: true },
  { key: 'cartaWebank', label: 'CartaWeBank', position: 8, isActive: true },
  { key: 'edenred', label: 'EDENRED', position: 9, isActive: true },
];

const LEGACY_COLUMN_KEYS = new Set(LEGACY_COLUMNS.map((column) => column.key));
const COLUMN_KEY_REGEX = /^[a-zA-Z0-9_-]+$/;

type CashFlowCheckWithJson = {
  id: string;
  checkLabel: string;
  date: Date;
  bbva: number;
  tradeRepublic: number;
  webankCc: number;
  webankObbl: number;
  etfLordo: number;
  rendimentoLordo: number;
  bper: number;
  tricount: number;
  cartaWebank: number;
  edenred: number;
  valuesJson: unknown;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
};

export class CashFlowService {
  async getAllByUser(userId: string): Promise<CashFlowCheckDTO[]> {
    const checks = await prisma.cashFlowCheck.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
    });

    return checks.map((check) => this.toDTO(check));
  }

  async getById(id: string, userId: string): Promise<CashFlowCheckDTO | null> {
    const check = await prisma.cashFlowCheck.findFirst({
      where: { id, userId },
    });

    return check ? this.toDTO(check) : null;
  }

  async create(userId: string, data: CreateCashFlowCheckDTO): Promise<CashFlowCheckDTO> {
    const values = this.normalizeValues(data.values);

    const check = await prisma.cashFlowCheck.create({
      data: {
        userId,
        checkLabel: data.checkLabel,
        date: new Date(data.date),
        bbva: values.bbva ?? 0,
        tradeRepublic: values.tradeRepublic ?? 0,
        webankCc: values.webankCc ?? 0,
        webankObbl: values.webankObbl ?? 0,
        etfLordo: values.etfLordo ?? 0,
        rendimentoLordo: values.rendimentoLordo ?? 0,
        bper: values.bper ?? 0,
        tricount: values.tricount ?? 0,
        cartaWebank: values.cartaWebank ?? 0,
        edenred: values.edenred ?? 0,
        valuesJson: values as Prisma.InputJsonValue,
        notes: data.notes ?? '',
      },
    });

    return this.toDTO(check);
  }

  async update(id: string, userId: string, data: UpdateCashFlowCheckDTO): Promise<CashFlowCheckDTO> {
    const existing = await prisma.cashFlowCheck.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      throw new AppError('CashFlow check not found', 404, 'NOT_FOUND');
    }

    const updateData: Prisma.CashFlowCheckUpdateInput = {
      checkLabel: data.checkLabel ?? undefined,
      date: data.date ? new Date(data.date) : undefined,
      notes: data.notes ?? undefined,
    };

    if (data.values) {
      const mergedValues = {
        ...this.getMergedValues(existing),
        ...this.normalizeValues(data.values),
      };

      updateData.bbva = mergedValues.bbva ?? 0;
      updateData.tradeRepublic = mergedValues.tradeRepublic ?? 0;
      updateData.webankCc = mergedValues.webankCc ?? 0;
      updateData.webankObbl = mergedValues.webankObbl ?? 0;
      updateData.etfLordo = mergedValues.etfLordo ?? 0;
      updateData.rendimentoLordo = mergedValues.rendimentoLordo ?? 0;
      updateData.bper = mergedValues.bper ?? 0;
      updateData.tricount = mergedValues.tricount ?? 0;
      updateData.cartaWebank = mergedValues.cartaWebank ?? 0;
      updateData.edenred = mergedValues.edenred ?? 0;
      updateData.valuesJson = mergedValues as Prisma.InputJsonValue;
    }

    const check = await prisma.cashFlowCheck.update({
      where: { id },
      data: updateData,
    });

    return this.toDTO(check);
  }

  async delete(id: string, userId: string): Promise<void> {
    const existing = await prisma.cashFlowCheck.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      throw new AppError('CashFlow check not found', 404, 'NOT_FOUND');
    }

    await prisma.cashFlowCheck.delete({
      where: { id },
    });
  }

  async getColumns(userId: string): Promise<CashFlowColumnDTO[]> {
    const settings = await this.getOrCreateSettingsRecord(userId);
    const columns = this.normalizeColumns(settings.columnsJson);

    if (JSON.stringify(columns) !== JSON.stringify(settings.columnsJson)) {
      await prisma.cashFlowSettings.update({
        where: { userId },
        data: {
          columnsJson: columns as unknown as Prisma.InputJsonValue,
        },
      });
    }

    return columns;
  }

  async createColumn(userId: string, data: CreateCashFlowColumnDTO): Promise<CashFlowColumnDTO> {
    const settings = await this.getOrCreateSettingsRecord(userId);
    const columns = this.normalizeColumns(settings.columnsJson);

    const label = data.label.trim();
    if (!label) {
      throw new AppError('Column label is required', 400, 'VALIDATION_ERROR');
    }

    let key = this.buildCustomColumnKey();
    while (columns.some((column) => column.key === key)) {
      key = this.buildCustomColumnKey();
    }

    columns.push({
      key,
      label,
      position: columns.length,
      isActive: true,
    });

    const normalized = this.normalizeColumns(columns);

    await prisma.cashFlowSettings.update({
      where: { userId },
      data: {
        columnsJson: normalized as unknown as Prisma.InputJsonValue,
      },
    });

    return normalized.find((column) => column.key === key)!;
  }

  async updateColumn(userId: string, key: string, data: UpdateCashFlowColumnDTO): Promise<CashFlowColumnDTO> {
    const settings = await this.getOrCreateSettingsRecord(userId);
    const columns = this.normalizeColumns(settings.columnsJson);
    const index = columns.findIndex((column) => column.key === key);

    if (index < 0) {
      throw new AppError('CashFlow column not found', 404, 'NOT_FOUND');
    }

    const current = columns[index];
    const next: CashFlowColumnDTO = {
      ...current,
      label: data.label !== undefined ? data.label.trim() : current.label,
      position: data.position ?? current.position,
      isActive: data.isActive ?? current.isActive,
    };

    if (!next.label) {
      throw new AppError('Column label is required', 400, 'VALIDATION_ERROR');
    }

    columns[index] = next;
    const normalized = this.normalizeColumns(columns);

    await prisma.cashFlowSettings.update({
      where: { userId },
      data: {
        columnsJson: normalized as unknown as Prisma.InputJsonValue,
      },
    });

    return normalized.find((column) => column.key === key)!;
  }

  async deleteColumn(userId: string, key: string): Promise<void> {
    const settings = await this.getOrCreateSettingsRecord(userId);
    const columns = this.normalizeColumns(settings.columnsJson);
    const index = columns.findIndex((column) => column.key === key);

    if (index < 0) {
      throw new AppError('CashFlow column not found', 404, 'NOT_FOUND');
    }

    let nextColumns: CashFlowColumnDTO[];

    if (LEGACY_COLUMN_KEYS.has(key)) {
      columns[index] = { ...columns[index], isActive: false };
      nextColumns = this.normalizeColumns(columns);
    } else {
      nextColumns = this.normalizeColumns(columns.filter((column) => column.key !== key));
    }

    await prisma.cashFlowSettings.update({
      where: { userId },
      data: {
        columnsJson: nextColumns as unknown as Prisma.InputJsonValue,
      },
    });
  }

  async getSettings(userId: string): Promise<CashFlowSettingsDTO> {
    const settings = await this.getOrCreateSettingsRecord(userId);

    return {
      commissionPerEtf: settings.commissionPerEtf,
      etfCount: settings.etfCount,
    };
  }

  async updateSettings(userId: string, data: CashFlowSettingsDTO): Promise<CashFlowSettingsDTO> {
    const settings = await prisma.cashFlowSettings.upsert({
      where: { userId },
      create: {
        userId,
        commissionPerEtf: data.commissionPerEtf,
        etfCount: data.etfCount,
        columnsJson: LEGACY_COLUMNS as unknown as Prisma.InputJsonValue,
      },
      update: {
        commissionPerEtf: data.commissionPerEtf,
        etfCount: data.etfCount,
      },
    });

    return {
      commissionPerEtf: settings.commissionPerEtf,
      etfCount: settings.etfCount,
    };
  }

  private async getOrCreateSettingsRecord(userId: string) {
    const existing = await prisma.cashFlowSettings.findUnique({
      where: { userId },
    });

    if (existing) {
      return existing;
    }

    return prisma.cashFlowSettings.create({
      data: {
        userId,
        commissionPerEtf: 12,
        etfCount: 12,
        columnsJson: LEGACY_COLUMNS as unknown as Prisma.InputJsonValue,
      },
    });
  }

  private buildCustomColumnKey(): string {
    return `custom_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
  }

  private normalizeColumns(rawColumns: unknown): CashFlowColumnDTO[] {
    const result: CashFlowColumnDTO[] = [];
    const seen = new Set<string>();

    if (Array.isArray(rawColumns)) {
      rawColumns.forEach((entry, index) => {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return;

        const keyValue = (entry as { key?: unknown }).key;
        const labelValue = (entry as { label?: unknown }).label;
        const positionValue = (entry as { position?: unknown }).position;
        const isActiveValue = (entry as { isActive?: unknown }).isActive;

        const key =
          typeof keyValue === 'string' && COLUMN_KEY_REGEX.test(keyValue) ? keyValue : '';
        const label = typeof labelValue === 'string' ? labelValue.trim() : '';
        const position =
          typeof positionValue === 'number' && Number.isInteger(positionValue) && positionValue >= 0
            ? positionValue
            : index;
        const isActive = typeof isActiveValue === 'boolean' ? isActiveValue : true;

        if (!key || !label || seen.has(key)) return;
        seen.add(key);
        result.push({ key, label, position, isActive });
      });
    }

    LEGACY_COLUMNS.forEach((legacyColumn) => {
      if (!seen.has(legacyColumn.key)) {
        result.push({ ...legacyColumn });
        seen.add(legacyColumn.key);
      }
    });

    result.sort((a, b) => a.position - b.position || a.label.localeCompare(b.label));
    return result.map((column, index) => ({
      ...column,
      position: index,
    }));
  }

  private normalizeValues(values: CashFlowValueMap): CashFlowValueMap {
    const normalized: CashFlowValueMap = {};

    Object.entries(values).forEach(([key, rawValue]) => {
      if (!COLUMN_KEY_REGEX.test(key)) return;
      const value = Number(rawValue);
      if (!Number.isFinite(value)) return;
      normalized[key] = value;
    });

    return normalized;
  }

  private parseValuesJson(raw: unknown): CashFlowValueMap {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};

    const parsed: CashFlowValueMap = {};
    Object.entries(raw as Record<string, unknown>).forEach(([key, value]) => {
      if (!COLUMN_KEY_REGEX.test(key)) return;
      if (typeof value !== 'number' || !Number.isFinite(value)) return;
      parsed[key] = value;
    });

    return parsed;
  }

  private getMergedValues(check: CashFlowCheckWithJson): CashFlowValueMap {
    return {
      bbva: check.bbva,
      tradeRepublic: check.tradeRepublic,
      webankCc: check.webankCc,
      webankObbl: check.webankObbl,
      etfLordo: check.etfLordo,
      rendimentoLordo: check.rendimentoLordo,
      bper: check.bper,
      tricount: check.tricount,
      cartaWebank: check.cartaWebank,
      edenred: check.edenred,
      ...this.parseValuesJson(check.valuesJson),
    };
  }

  private toDTO(check: CashFlowCheckWithJson): CashFlowCheckDTO {
    return {
      id: check.id,
      checkLabel: check.checkLabel,
      date: check.date.toISOString().split('T')[0],
      values: this.getMergedValues(check),
      notes: check.notes,
      createdAt: check.createdAt.toISOString(),
      updatedAt: check.updatedAt.toISOString(),
    };
  }
}

export const cashFlowService = new CashFlowService();
