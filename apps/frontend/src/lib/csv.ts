import type { ExpenseDTO } from '@budget/shared';

function csvCell(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function csvAmount(value: number): string {
  return value.toFixed(2).replace('.', ',');
}

function getExpenseCategoryLabel(category: ExpenseDTO['category']): string {
  switch (category) {
    case 'NEEDS':
      return 'Necessita';
    case 'WANTS':
      return 'Svago';
    case 'SAVINGS':
      return 'Risparmi';
    case 'EXTRA':
      return 'Extra';
  }
}

// Builds the expenses CSV; when rows carry a periodKey a leading "Mese"
// column is added (cross-period exports)
export function buildExpensesCsv(expenses: (ExpenseDTO & { periodKey?: string })[]): string {
  const withPeriod = expenses.some((expense) => expense.periodKey !== undefined);
  const headers = [
    ...(withPeriod ? ['Mese'] : []),
    'Data', 'Categoria', 'Descrizione', 'Importo', 'Fissa', 'Tricount', 'Note',
  ];
  const lines = [
    headers.map(csvCell).join(';'),
    ...expenses.map((expense) => [
      ...(withPeriod ? [expense.periodKey ?? ''] : []),
      expense.date.slice(0, 10),
      getExpenseCategoryLabel(expense.category),
      expense.label,
      csvAmount(expense.amount),
      expense.isFixed ? 'Si' : 'No',
      expense.tricountType ?? '',
      expense.notes ?? '',
    ].map(csvCell).join(';')),
  ];

  return lines.join('\r\n');
}

export function downloadCsv(csv: string, filename: string): void {
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
