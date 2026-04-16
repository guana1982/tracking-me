import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  dashboardApi,
  periodsApi,
  budgetRulesApi,
  incomesApi,
  expensesApi,
  reallocationsApi,
  cashFlowApi,
  fixedExpensesApi,
  portfolioApi,
} from '../lib/api';
import type {
  CreateExpenseDTO,
  UpdateExpenseDTO,
  CreateIncomeDTO,
  UpdateIncomeDTO,
  UpdateBudgetRuleDTO,
  ExpenseFilters,
  CreateReallocationDTO,
  CreateCashFlowCheckDTO,
  UpdateCashFlowCheckDTO,
  CashFlowSettingsDTO,
  CreateCashFlowColumnDTO,
  UpdateCashFlowColumnDTO,
  CreateCashFlowClassificationDTO,
  UpdateCashFlowClassificationDTO,
  CreateFixedExpenseTemplateDTO,
  UpdateFixedExpenseTemplateDTO,
  ApplyFixedExpenseTemplatesDTO,
  FixedExpenseCategory,
  PortfolioHistoryHorizonDTO,
} from '@budget/shared';

// Query keys
export const queryKeys = {
  dashboard: (periodKey: string) => ['dashboard', periodKey] as const,
  savingsHistory: (periodKey: string) => ['savingsHistory', periodKey] as const,
  savingsPace: (periodKey: string) => ['savingsPace', periodKey] as const,
  periods: ['periods'] as const,
  period: (periodKey: string) => ['period', periodKey] as const,
  budgetRule: (periodKey: string) => ['budgetRule', periodKey] as const,
  incomes: (periodKey: string) => ['incomes', periodKey] as const,
  expenses: (periodKey: string, filters?: ExpenseFilters) =>
    ['expenses', periodKey, filters] as const,
  reallocations: (periodKey: string) => ['reallocations', periodKey] as const,
  reallocationPreview: (periodKey: string) =>
    ['reallocationPreview', periodKey] as const,
  fixedExpenses: (category?: FixedExpenseCategory) =>
    ['fixedExpenses', category ?? 'all'] as const,
  cashFlowChecks: ['cashFlowChecks'] as const,
  cashFlowSettings: ['cashFlowSettings'] as const,
  cashFlowColumns: ['cashFlowColumns'] as const,
  cashFlowClassifications: ['cashFlowClassifications'] as const,
  portfolioHistory: (symbolsSignature: string, horizon: PortfolioHistoryHorizonDTO) =>
    ['portfolioHistory', symbolsSignature, horizon] as const,
};

// Dashboard
export function useDashboard(periodKey: string) {
  return useQuery({
    queryKey: queryKeys.dashboard(periodKey),
    queryFn: () => dashboardApi.getSummary(periodKey),
  });
}

// Savings History
export function useSavingsHistory(periodKey: string) {
  return useQuery({
    queryKey: queryKeys.savingsHistory(periodKey),
    queryFn: () => dashboardApi.getSavingsHistory(periodKey),
  });
}

// Savings Pace (current vs best-savings month)
export function useSavingsPace(periodKey: string) {
  return useQuery({
    queryKey: queryKeys.savingsPace(periodKey),
    queryFn: () => dashboardApi.getSavingsPace(periodKey),
  });
}

// Periods
export function usePeriods() {
  return useQuery({
    queryKey: queryKeys.periods,
    queryFn: periodsApi.getAll,
  });
}

export function usePeriod(periodKey: string) {
  return useQuery({
    queryKey: queryKeys.period(periodKey),
    queryFn: () => periodsApi.getByKey(periodKey),
  });
}

export function useCloseMonth(periodKey: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => periodsApi.close(periodKey),
    onSettled: () => {
      // Invalidate queries regardless of success/failure to sync UI with server state
      queryClient.invalidateQueries({ queryKey: queryKeys.period(periodKey) });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(periodKey) });
      queryClient.invalidateQueries({ queryKey: queryKeys.periods });
    },
  });
}

export function useReopenMonth(periodKey: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => periodsApi.reopen(periodKey),
    onSettled: () => {
      // Invalidate queries regardless of success/failure to sync UI with server state
      queryClient.invalidateQueries({ queryKey: queryKeys.period(periodKey) });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(periodKey) });
      queryClient.invalidateQueries({ queryKey: queryKeys.periods });
    },
  });
}

// Incomes
export function useIncomes(periodKey: string) {
  return useQuery({
    queryKey: queryKeys.incomes(periodKey),
    queryFn: () => incomesApi.getByPeriodKey(periodKey),
  });
}

export function useCreateIncome(periodKey: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateIncomeDTO) => incomesApi.create(periodKey, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.incomes(periodKey) });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(periodKey) });
    },
  });
}

export function useUpdateIncome(periodKey: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateIncomeDTO }) =>
      incomesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.incomes(periodKey) });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(periodKey) });
    },
  });
}

export function useDeleteIncome(periodKey: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => incomesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.incomes(periodKey) });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(periodKey) });
    },
  });
}

// Expenses
export function useExpenses(periodKey: string, filters?: ExpenseFilters) {
  return useQuery({
    queryKey: queryKeys.expenses(periodKey, filters),
    queryFn: () => expensesApi.getByPeriodKey(periodKey, filters),
  });
}

export function useCreateExpense(periodKey: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateExpenseDTO) => expensesApi.create(periodKey, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses', periodKey] });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(periodKey) });
    },
  });
}

export function useUpdateExpense(periodKey: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateExpenseDTO }) =>
      expensesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses', periodKey] });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(periodKey) });
    },
  });
}

export function useDeleteExpense(periodKey: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => expensesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses', periodKey] });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(periodKey) });
    },
  });
}

// Fixed expense templates
export function useFixedExpenseTemplates(category?: FixedExpenseCategory) {
  return useQuery({
    queryKey: queryKeys.fixedExpenses(category),
    queryFn: () => fixedExpensesApi.getAll(category),
  });
}

export function useCreateFixedExpenseTemplate(periodKey: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateFixedExpenseTemplateDTO) => fixedExpensesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fixedExpenses'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(periodKey) });
    },
  });
}

export function useUpdateFixedExpenseTemplate(periodKey: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateFixedExpenseTemplateDTO }) =>
      fixedExpensesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fixedExpenses'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(periodKey) });
    },
  });
}

export function useDeleteFixedExpenseTemplate(periodKey: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => fixedExpensesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fixedExpenses'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(periodKey) });
    },
  });
}

export function useApplyFixedExpenseTemplates(periodKey: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ApplyFixedExpenseTemplatesDTO) =>
      fixedExpensesApi.applyToPeriod(periodKey, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses', periodKey] });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(periodKey) });
      queryClient.invalidateQueries({ queryKey: queryKeys.fixedExpenses() });
    },
  });
}

// Budget Rules
export function useBudgetRule(periodKey: string) {
  return useQuery({
    queryKey: queryKeys.budgetRule(periodKey),
    queryFn: () => budgetRulesApi.getByPeriodKey(periodKey),
  });
}

export function useUpdateBudgetRule(periodKey: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateBudgetRuleDTO) =>
      budgetRulesApi.update(periodKey, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.budgetRule(periodKey) });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(periodKey) });
    },
  });
}

// Reallocations
export function useReallocations(periodKey: string) {
  return useQuery({
    queryKey: queryKeys.reallocations(periodKey),
    queryFn: () => reallocationsApi.getByPeriodKey(periodKey),
  });
}

export function useReallocationPreview(periodKey: string) {
  return useQuery({
    queryKey: queryKeys.reallocationPreview(periodKey),
    queryFn: () => reallocationsApi.getPreview(periodKey),
  });
}

export function useCreateReallocation(periodKey: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateReallocationDTO) =>
      reallocationsApi.create(periodKey, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.reallocations(periodKey),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.reallocationPreview(periodKey),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(periodKey) });
      queryClient.invalidateQueries({ queryKey: queryKeys.savingsHistory(periodKey) });
    },
  });
}

export function useDeleteReallocation(periodKey: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => reallocationsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.reallocations(periodKey),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.reallocationPreview(periodKey),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(periodKey) });
      queryClient.invalidateQueries({ queryKey: queryKeys.savingsHistory(periodKey) });
    },
  });
}

// CashFlow Checks
export function useCashFlowChecks() {
  return useQuery({
    queryKey: queryKeys.cashFlowChecks,
    queryFn: cashFlowApi.getChecks,
  });
}

export function useCreateCashFlowCheck() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateCashFlowCheckDTO) => cashFlowApi.createCheck(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cashFlowChecks });
    },
  });
}

export function useUpdateCashFlowCheck() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCashFlowCheckDTO }) =>
      cashFlowApi.updateCheck(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cashFlowChecks });
    },
  });
}

export function useDeleteCashFlowCheck() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => cashFlowApi.deleteCheck(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cashFlowChecks });
    },
  });
}

export function useCashFlowColumns() {
  return useQuery({
    queryKey: queryKeys.cashFlowColumns,
    queryFn: cashFlowApi.getColumns,
  });
}

export function useCreateCashFlowColumn() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateCashFlowColumnDTO) => cashFlowApi.createColumn(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cashFlowColumns });
      queryClient.invalidateQueries({ queryKey: queryKeys.cashFlowChecks });
    },
  });
}

export function useUpdateCashFlowColumn() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ key, data }: { key: string; data: UpdateCashFlowColumnDTO }) =>
      cashFlowApi.updateColumn(key, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cashFlowColumns });
      queryClient.invalidateQueries({ queryKey: queryKeys.cashFlowChecks });
    },
  });
}

export function useDeleteCashFlowColumn() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (key: string) => cashFlowApi.deleteColumn(key),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cashFlowColumns });
      queryClient.invalidateQueries({ queryKey: queryKeys.cashFlowChecks });
    },
  });
}

export function useSwapCashFlowColumns() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ keyA, keyB }: { keyA: string; keyB: string }) =>
      cashFlowApi.swapColumns(keyA, keyB),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cashFlowColumns });
    },
  });
}

// CashFlow Classifications
export function useCashFlowClassifications() {
  return useQuery({
    queryKey: queryKeys.cashFlowClassifications,
    queryFn: cashFlowApi.getClassifications,
  });
}

export function useCreateCashFlowClassification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateCashFlowClassificationDTO) => cashFlowApi.createClassification(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cashFlowClassifications });
    },
  });
}

export function useUpdateCashFlowClassification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ key, data }: { key: string; data: UpdateCashFlowClassificationDTO }) =>
      cashFlowApi.updateClassification(key, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cashFlowClassifications });
    },
  });
}

export function useDeleteCashFlowClassification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (key: string) => cashFlowApi.deleteClassification(key),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cashFlowClassifications });
    },
  });
}

// CashFlow Settings
export function useCashFlowSettings() {
  return useQuery({
    queryKey: queryKeys.cashFlowSettings,
    queryFn: cashFlowApi.getSettings,
  });
}

export function useUpdateCashFlowSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CashFlowSettingsDTO) => cashFlowApi.updateSettings(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cashFlowSettings });
      queryClient.invalidateQueries({ queryKey: queryKeys.cashFlowChecks });
    },
  });
}

// Portfolio history
export function usePortfolioHistory(
  symbols: string[],
  horizon: PortfolioHistoryHorizonDTO,
  enabled: boolean = true
) {
  const normalizedSymbols = [...symbols].sort();
  const signature = normalizedSymbols.join('|');

  return useQuery({
    queryKey: queryKeys.portfolioHistory(signature, horizon),
    queryFn: () => portfolioApi.getHistory(normalizedSymbols, horizon),
    enabled: enabled && normalizedSymbols.length > 0,
    staleTime: 1000 * 60 * 60, // 1h
  });
}
