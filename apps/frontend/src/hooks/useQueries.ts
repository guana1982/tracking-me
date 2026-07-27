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
  spendingCategoriesApi,
  sinkingFundsApi,
  wealthGoalsApi,
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
  CreateSpendingCategoryDTO,
  UpdateSpendingCategoryDTO,
  CreateSinkingFundDTO,
  UpdateSinkingFundDTO,
  CreateWealthGoalDTO,
  UpdateWealthGoalDTO,
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
  carryoverPreview: (periodKey: string) =>
    ['carryoverPreview', periodKey] as const,
  surplusForwardPreview: (periodKey: string) =>
    ['surplusForwardPreview', periodKey] as const,
  fixedExpenses: (category?: FixedExpenseCategory) =>
    ['fixedExpenses', category ?? 'all'] as const,
  kpis: (periodKey: string) => ['kpis', periodKey] as const,
  sinkingFunds: ['sinkingFunds'] as const,
  wealthGoals: ['wealthGoals'] as const,
  spendingCategories: ['spendingCategories'] as const,
  spendingBreakdown: (periodKey: string) =>
    ['spendingBreakdown', periodKey] as const,
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

// KPI panel (CFO-style indicators)
export function useKpis(periodKey: string) {
  return useQuery({
    queryKey: queryKeys.kpis(periodKey),
    queryFn: () => dashboardApi.getKpis(periodKey),
  });
}

// Sinking funds (accantonamenti)
export function useSinkingFunds() {
  return useQuery({
    queryKey: queryKeys.sinkingFunds,
    queryFn: sinkingFundsApi.getAll,
  });
}

export function useCreateSinkingFund() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateSinkingFundDTO) => sinkingFundsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sinkingFunds });
    },
  });
}

export function useUpdateSinkingFund() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateSinkingFundDTO }) =>
      sinkingFundsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sinkingFunds });
    },
  });
}

export function useDeleteSinkingFund() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => sinkingFundsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sinkingFunds });
    },
  });
}

// Wealth goals (obiettivi di patrimonio)
export function useWealthGoals() {
  return useQuery({
    queryKey: queryKeys.wealthGoals,
    queryFn: wealthGoalsApi.getAll,
  });
}

export function useCreateWealthGoal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateWealthGoalDTO) => wealthGoalsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.wealthGoals });
    },
  });
}

export function useUpdateWealthGoal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateWealthGoalDTO }) =>
      wealthGoalsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.wealthGoals });
    },
  });
}

export function useDeleteWealthGoal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => wealthGoalsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.wealthGoals });
    },
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
    onSuccess: (updatedPeriod) => {
      // Update the cache immediately so the UI freezes without waiting for refetch
      queryClient.setQueryData(queryKeys.period(periodKey), updatedPeriod);
    },
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
    onSuccess: (updatedPeriod) => {
      // Update the cache immediately so the UI unfreezes without waiting for refetch
      queryClient.setQueryData(queryKeys.period(periodKey), updatedPeriod);
    },
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
      queryClient.invalidateQueries({ queryKey: queryKeys.savingsPace(periodKey) });
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
      queryClient.invalidateQueries({ queryKey: queryKeys.savingsPace(periodKey) });
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
      queryClient.invalidateQueries({ queryKey: queryKeys.savingsPace(periodKey) });
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
      queryClient.invalidateQueries({ queryKey: queryKeys.savingsPace(periodKey) });
      queryClient.invalidateQueries({ queryKey: queryKeys.spendingBreakdown(periodKey) });
      queryClient.invalidateQueries({ queryKey: queryKeys.kpis(periodKey) });
      queryClient.invalidateQueries({ queryKey: queryKeys.sinkingFunds });
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
      queryClient.invalidateQueries({ queryKey: queryKeys.savingsPace(periodKey) });
      queryClient.invalidateQueries({ queryKey: queryKeys.spendingBreakdown(periodKey) });
      queryClient.invalidateQueries({ queryKey: queryKeys.kpis(periodKey) });
      queryClient.invalidateQueries({ queryKey: queryKeys.sinkingFunds });
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
      queryClient.invalidateQueries({ queryKey: queryKeys.savingsPace(periodKey) });
      queryClient.invalidateQueries({ queryKey: queryKeys.spendingBreakdown(periodKey) });
      queryClient.invalidateQueries({ queryKey: queryKeys.kpis(periodKey) });
      queryClient.invalidateQueries({ queryKey: queryKeys.sinkingFunds });
    },
  });
}

// Spending categories (fine-grained expense classification)
export function useSpendingCategories() {
  return useQuery({
    queryKey: queryKeys.spendingCategories,
    queryFn: spendingCategoriesApi.getAll,
  });
}

export function useSpendingBreakdown(periodKey: string) {
  return useQuery({
    queryKey: queryKeys.spendingBreakdown(periodKey),
    queryFn: () => spendingCategoriesApi.getBreakdown(periodKey),
  });
}

// Global breakdown (whole history) — fetched lazily when its modal opens
export function useGlobalSpendingBreakdown(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.spendingBreakdown('all'),
    queryFn: spendingCategoriesApi.getGlobalBreakdown,
    enabled,
  });
}

// All expenses of a period / of the whole history, for the per-category
// expense modals (filtered client-side by spendingCategoryId)
export function useAllExpensesForPeriod(periodKey: string, enabled: boolean) {
  return useQuery({
    queryKey: ['expenses', periodKey, 'all-list'] as const,
    queryFn: () => expensesApi.getAllForPeriod(periodKey),
    enabled,
  });
}

export function useAllExpensesGlobal(enabled: boolean) {
  return useQuery({
    queryKey: ['expenses', 'global-list'] as const,
    queryFn: expensesApi.getAllGlobal,
    enabled,
  });
}

export function useCreateSpendingCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateSpendingCategoryDTO) => spendingCategoriesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.spendingCategories });
    },
  });
}

export function useUpdateSpendingCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateSpendingCategoryDTO }) =>
      spendingCategoriesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.spendingCategories });
      queryClient.invalidateQueries({ queryKey: ['spendingBreakdown'] });
    },
  });
}

export function useDeleteSpendingCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => spendingCategoriesApi.delete(id),
    onSuccess: () => {
      // Deleting a category unclassifies its expenses (FK SET NULL)
      queryClient.invalidateQueries({ queryKey: queryKeys.spendingCategories });
      queryClient.invalidateQueries({ queryKey: ['spendingBreakdown'] });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
    },
  });
}

export function useAddCategoryRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ categoryId, keyword }: { categoryId: string; keyword: string }) =>
      spendingCategoriesApi.addRule(categoryId, { keyword }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.spendingCategories });
    },
  });
}

export function useDeleteCategoryRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ruleId: string) => spendingCategoriesApi.deleteRule(ruleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.spendingCategories });
    },
  });
}

export function useReclassifyExpenses() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => spendingCategoriesApi.reclassify(),
    onSuccess: () => {
      // Reclassification touches every period, invalidate whole families
      queryClient.invalidateQueries({ queryKey: ['spendingBreakdown'] });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.sinkingFunds });
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
      queryClient.invalidateQueries({ queryKey: queryKeys.savingsPace(periodKey) });
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
      queryClient.invalidateQueries({ queryKey: queryKeys.savingsPace(periodKey) });
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

export function useCarryoverPreview(periodKey: string) {
  return useQuery({
    queryKey: queryKeys.carryoverPreview(periodKey),
    queryFn: () => reallocationsApi.getCarryoverPreview(periodKey),
  });
}

export function useCreateCarryover(periodKey: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (category?: 'NEEDS' | 'WANTS') =>
      reallocationsApi.createCarryover(periodKey, category ? { category } : {}),
    onSuccess: () => {
      // The carry-over writes expenses into the NEXT period, so invalidate
      // whole families rather than just the current periodKey
      queryClient.invalidateQueries({ queryKey: ['carryoverPreview'] });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['savingsHistory'] });
      queryClient.invalidateQueries({ queryKey: ['savingsPace'] });
      queryClient.invalidateQueries({ queryKey: ['reallocationPreview'] });
      queryClient.invalidateQueries({ queryKey: ['periods'] });
    },
  });
}

export function useSurplusForwardPreview(periodKey: string) {
  return useQuery({
    queryKey: queryKeys.surplusForwardPreview(periodKey),
    queryFn: () => reallocationsApi.getSurplusForwardPreview(periodKey),
  });
}

export function useCreateSurplusForward(periodKey: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => reallocationsApi.createSurplusForward(periodKey),
    onSuccess: () => {
      // Writes an income into the NEXT period, so invalidate whole families
      queryClient.invalidateQueries({ queryKey: ['surplusForwardPreview'] });
      queryClient.invalidateQueries({ queryKey: ['reallocationPreview'] });
      queryClient.invalidateQueries({ queryKey: ['incomes'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['savingsHistory'] });
      queryClient.invalidateQueries({ queryKey: ['savingsPace'] });
      queryClient.invalidateQueries({ queryKey: ['kpis'] });
      queryClient.invalidateQueries({ queryKey: ['periods'] });
    },
  });
}

export function useDeleteSurplusForward(periodKey: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => reallocationsApi.deleteSurplusForward(periodKey),
    onSuccess: () => {
      // Removes the income from the NEXT period, so invalidate whole families
      queryClient.invalidateQueries({ queryKey: ['surplusForwardPreview'] });
      queryClient.invalidateQueries({ queryKey: ['reallocationPreview'] });
      queryClient.invalidateQueries({ queryKey: ['incomes'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['savingsHistory'] });
      queryClient.invalidateQueries({ queryKey: ['savingsPace'] });
      queryClient.invalidateQueries({ queryKey: ['kpis'] });
      queryClient.invalidateQueries({ queryKey: ['periods'] });
    },
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
      queryClient.invalidateQueries({ queryKey: queryKeys.savingsPace(periodKey) });
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
      queryClient.invalidateQueries({ queryKey: queryKeys.savingsPace(periodKey) });
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
      queryClient.invalidateQueries({ queryKey: queryKeys.wealthGoals });
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
      queryClient.invalidateQueries({ queryKey: queryKeys.wealthGoals });
    },
  });
}

export function useDeleteCashFlowCheck() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => cashFlowApi.deleteCheck(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cashFlowChecks });
      queryClient.invalidateQueries({ queryKey: queryKeys.wealthGoals });
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
