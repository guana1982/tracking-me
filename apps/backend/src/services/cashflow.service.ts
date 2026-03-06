import { prisma } from '../lib/prisma.js';
import type { CashFlowCheckDTO, CreateCashFlowCheckDTO, UpdateCashFlowCheckDTO, CashFlowSettingsDTO } from '@budget/shared';
import { AppError } from '../lib/error-handler.js';

export class CashFlowService {
  async getAllByUser(userId: string): Promise<CashFlowCheckDTO[]> {
    const checks = await prisma.cashFlowCheck.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
    });

    return checks.map(this.toDTO);
  }

  async getById(id: string, userId: string): Promise<CashFlowCheckDTO | null> {
    const check = await prisma.cashFlowCheck.findFirst({
      where: { id, userId },
    });

    return check ? this.toDTO(check) : null;
  }

  async create(userId: string, data: CreateCashFlowCheckDTO): Promise<CashFlowCheckDTO> {
    const check = await prisma.cashFlowCheck.create({
      data: {
        userId,
        checkLabel: data.checkLabel,
        date: new Date(data.date),
        bbva: data.bbva,
        tradeRepublic: data.tradeRepublic,
        webankCc: data.webankCc,
        webankObbl: data.webankObbl,
        etfLordo: data.etfLordo,
        rendimentoLordo: data.rendimentoLordo,
        bper: data.bper,
        tricount: data.tricount,
        cartaWebank: data.cartaWebank,
        edenred: data.edenred,
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

    const check = await prisma.cashFlowCheck.update({
      where: { id },
      data: {
        checkLabel: data.checkLabel ?? undefined,
        date: data.date ? new Date(data.date) : undefined,
        bbva: data.bbva ?? undefined,
        tradeRepublic: data.tradeRepublic ?? undefined,
        webankCc: data.webankCc ?? undefined,
        webankObbl: data.webankObbl ?? undefined,
        etfLordo: data.etfLordo ?? undefined,
        rendimentoLordo: data.rendimentoLordo ?? undefined,
        bper: data.bper ?? undefined,
        tricount: data.tricount ?? undefined,
        cartaWebank: data.cartaWebank ?? undefined,
        edenred: data.edenred ?? undefined,
        notes: data.notes ?? undefined,
      },
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

  async getSettings(userId: string): Promise<CashFlowSettingsDTO> {
    const settings = await prisma.cashFlowSettings.findUnique({
      where: { userId },
    });

    if (!settings) {
      return { commissionPerEtf: 12, etfCount: 12 };
    }

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

  private toDTO(check: {
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
    notes: string;
    createdAt: Date;
    updatedAt: Date;
  }): CashFlowCheckDTO {
    return {
      id: check.id,
      checkLabel: check.checkLabel,
      date: check.date.toISOString().split('T')[0],
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
      notes: check.notes,
      createdAt: check.createdAt.toISOString(),
      updatedAt: check.updatedAt.toISOString(),
    };
  }
}

export const cashFlowService = new CashFlowService();
