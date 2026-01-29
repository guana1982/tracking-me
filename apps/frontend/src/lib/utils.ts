import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, parse } from 'date-fns';
import { it } from 'date-fns/locale';
import type { Category } from '@budget/shared';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
}

export function formatNumber(amount: number): string {
  return new Intl.NumberFormat('it-IT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, 'd MMM yyyy', { locale: it });
}

export function formatPeriodKey(periodKey: string): string {
  const date = parse(periodKey, 'yyyy-MM', new Date());
  return format(date, 'MMMM yyyy', { locale: it });
}

export function getCurrentPeriodKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function generatePeriodKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function getAllPeriodsForYear(year: number): { periodKey: string; month: number }[] {
  return Array.from({ length: 12 }, (_, i) => ({
    periodKey: generatePeriodKey(year, i + 1),
    month: i + 1,
  }));
}

export function getCategoryColor(category: Category): {
  bg: string;
  text: string;
  border: string;
  fill: string;
} {
  switch (category) {
    case 'NEEDS':
      return {
        bg: 'bg-emerald-50',
        text: 'text-emerald-700',
        border: 'border-emerald-200',
        fill: '#10B981', // Emerald-500
      };
    case 'WANTS':
      return {
        bg: 'bg-amber-50',
        text: 'text-amber-700',
        border: 'border-amber-200',
        fill: '#F59E0B', // Amber-500
      };
    case 'SAVINGS':
      return {
        bg: 'bg-sky-50',
        text: 'text-sky-700',
        border: 'border-sky-200',
        fill: '#0EA5E9', // Sky-500
      };
  }
}

export function getCategoryLabel(category: Category): string {
  switch (category) {
    case 'NEEDS':
      return 'Necessità';
    case 'WANTS':
      return 'Svago';
    case 'SAVINGS':
      return 'Risparmi';
  }
}

export function getStatusColor(status: 'ok' | 'warning' | 'danger'): string {
  switch (status) {
    case 'ok':
      return 'bg-green-500';
    case 'warning':
      return 'bg-yellow-500';
    case 'danger':
      return 'bg-red-500';
  }
}
