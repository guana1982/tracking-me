import type {
  ApiResponse,
  DashboardSummaryDTO,
  SavingsHistoryDTO,
  SavingsPaceDTO,
  MonthListItemDTO,
  MonthPeriodDTO,
  BudgetRuleDTO,
  UpdateBudgetRuleDTO,
  IncomeDTO,
  CreateIncomeDTO,
  UpdateIncomeDTO,
  ExpenseDTO,
  ExpenseWithPeriodDTO,
  CreateExpenseDTO,
  UpdateExpenseDTO,
  PaginatedResponse,
  ExpenseFilters,
  ReallocationDTO,
  CreateReallocationDTO,
  ReallocationPreviewDTO,
  CashFlowCheckDTO,
  CreateCashFlowCheckDTO,
  UpdateCashFlowCheckDTO,
  CashFlowSettingsDTO,
  CashFlowColumnDTO,
  CreateCashFlowColumnDTO,
  UpdateCashFlowColumnDTO,
  CashFlowClassificationDTO,
  CreateCashFlowClassificationDTO,
  UpdateCashFlowClassificationDTO,
  FixedExpenseTemplateDTO,
  CreateFixedExpenseTemplateDTO,
  UpdateFixedExpenseTemplateDTO,
  ApplyFixedExpenseTemplatesDTO,
  ApplyFixedExpenseTemplatesResultDTO,
  FixedExpenseCategory,
  PortfolioHistoryHorizonDTO,
  PortfolioHistoryResponseDTO,
  PortfolioCompareRequestDTO,
  PortfolioCompareResponseDTO,
  PortfolioAssetClassDTO,
  PortfolioInstrumentDTO,
  CreatePortfolioAssetClassDTO,
  UpdatePortfolioAssetClassDTO,
  CreatePortfolioInstrumentDTO,
  UpdatePortfolioInstrumentDTO,
  PortfolioInvestedStateDTO,
  PortfolioGeographicExposureRequestDTO,
  PortfolioGeographicExposureResponseDTO,
  PortfolioCompanyExposureRequestDTO,
  PortfolioCompanyExposureResponseDTO,
  PortfolioSectorExposureRequestDTO,
  PortfolioSectorExposureResponseDTO,
  PortfolioStaticPerformanceRequestDTO,
  PortfolioStaticPerformanceResponseDTO,
  UpdatePortfolioInvestedStateDTO,
} from '@budget/shared';
import { useAuthStore } from '../stores/authStore';

const API_BASE = import.meta.env.VITE_API_URL || '';

export class ApiError extends Error {
  code: string;
  details?: unknown;

  constructor(message: string, code: string, details?: unknown) {
    super(message);
    this.code = code;
    this.details = details;
    this.name = 'ApiError';
  }
}

async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const token = useAuthStore.getState().token;

  const headers: Record<string, string> = {
    ...(options?.headers as Record<string, string>),
  };

  // Add auth header if token exists
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Only set Content-Type for requests with body
  if (options?.body) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${API_BASE}/api${endpoint}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  // Handle 401 Unauthorized - logout user
  if (response.status === 401) {
    useAuthStore.getState().logout();
    throw new ApiError('Sessione scaduta', 'UNAUTHORIZED');
  }

  const data = (await response.json()) as ApiResponse<T>;

  if (!response.ok || !data.success) {
    throw new ApiError(
      data.error?.message || 'An error occurred',
      data.error?.code || 'UNKNOWN_ERROR',
      data.error?.details
    );
  }

  return data.data as T;
}

// Dashboard
export const dashboardApi = {
  getSummary: (periodKey: string) =>
    fetchApi<DashboardSummaryDTO>(`/dashboard/${periodKey}`),

  getCurrentSummary: () =>
    fetchApi<DashboardSummaryDTO>('/dashboard/current'),

  getSavingsHistory: (periodKey: string) =>
    fetchApi<SavingsHistoryDTO>(`/dashboard/savings-history/${periodKey}`),

  getSavingsPace: (periodKey: string) =>
    fetchApi<SavingsPaceDTO>(`/dashboard/savings-pace/${periodKey}`),
};

// Month Periods
export const periodsApi = {
  getAll: () =>
    fetchApi<MonthListItemDTO[]>('/periods'),

  getCurrent: () =>
    fetchApi<MonthPeriodDTO>('/periods/current'),

  getByKey: (periodKey: string) =>
    fetchApi<MonthPeriodDTO>(`/periods/${periodKey}`),

  create: (data: { year: number; month: number }) =>
    fetchApi<MonthPeriodDTO>('/periods', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  close: (periodKey: string) =>
    fetchApi<MonthPeriodDTO>(`/periods/${periodKey}/close`, {
      method: 'POST',
    }),

  reopen: (periodKey: string) =>
    fetchApi<MonthPeriodDTO>(`/periods/${periodKey}/reopen`, {
      method: 'POST',
    }),
};

// Budget Rules
export const budgetRulesApi = {
  getByPeriodKey: (periodKey: string) =>
    fetchApi<BudgetRuleDTO>(`/budget-rules/${periodKey}`),

  update: (periodKey: string, data: UpdateBudgetRuleDTO) =>
    fetchApi<BudgetRuleDTO>(`/budget-rules/${periodKey}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
};

// Incomes
export const incomesApi = {
  getByPeriodKey: (periodKey: string) =>
    fetchApi<IncomeDTO[]>(`/incomes/period/${periodKey}`),

  create: (periodKey: string, data: CreateIncomeDTO) =>
    fetchApi<IncomeDTO>(`/incomes/period/${periodKey}`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: UpdateIncomeDTO) =>
    fetchApi<IncomeDTO>(`/incomes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    fetchApi<void>(`/incomes/${id}`, {
      method: 'DELETE',
    }),
};

// Expenses
export const expensesApi = {
  getByPeriodKey: (periodKey: string, filters?: ExpenseFilters) => {
    const params = new URLSearchParams();
    if (filters?.category) params.set('category', filters.category);
    if (filters?.startDate) params.set('startDate', filters.startDate);
    if (filters?.endDate) params.set('endDate', filters.endDate);
    if (filters?.search) params.set('search', filters.search);
    if (filters?.page) params.set('page', String(filters.page));
    if (filters?.pageSize) params.set('pageSize', String(filters.pageSize));

    const query = params.toString();
    return fetchApi<PaginatedResponse<ExpenseDTO>>(
      `/expenses/period/${periodKey}${query ? `?${query}` : ''}`
    );
  },

  getAllForPeriod: (periodKey: string) =>
    fetchApi<ExpenseDTO[]>(`/expenses/period/${periodKey}/all`),

  getAllGlobal: () =>
    fetchApi<ExpenseWithPeriodDTO[]>('/expenses/all'),

  create: (periodKey: string, data: CreateExpenseDTO) =>
    fetchApi<ExpenseDTO>(`/expenses/period/${periodKey}`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: UpdateExpenseDTO) =>
    fetchApi<ExpenseDTO>(`/expenses/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    fetchApi<void>(`/expenses/${id}`, {
      method: 'DELETE',
    }),
};

// Reallocations
export const reallocationsApi = {
  getByPeriodKey: (periodKey: string) =>
    fetchApi<ReallocationDTO[]>(`/reallocations/period/${periodKey}`),

  getPreview: (periodKey: string) =>
    fetchApi<ReallocationPreviewDTO>(`/reallocations/period/${periodKey}/preview`),

  create: (periodKey: string, data: CreateReallocationDTO) =>
    fetchApi<ReallocationDTO>(`/reallocations/period/${periodKey}`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    fetchApi<void>(`/reallocations/${id}`, {
      method: 'DELETE',
    }),
};

// CashFlow
export const cashFlowApi = {
  getChecks: () =>
    fetchApi<CashFlowCheckDTO[]>('/cashflow/checks'),

  createCheck: (data: CreateCashFlowCheckDTO) =>
    fetchApi<CashFlowCheckDTO>('/cashflow/checks', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateCheck: (id: string, data: UpdateCashFlowCheckDTO) =>
    fetchApi<CashFlowCheckDTO>(`/cashflow/checks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteCheck: (id: string) =>
    fetchApi<void>(`/cashflow/checks/${id}`, {
      method: 'DELETE',
    }),

  getSettings: () =>
    fetchApi<CashFlowSettingsDTO>('/cashflow/settings'),

  updateSettings: (data: CashFlowSettingsDTO) =>
    fetchApi<CashFlowSettingsDTO>('/cashflow/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  getColumns: () =>
    fetchApi<CashFlowColumnDTO[]>('/cashflow/columns'),

  createColumn: (data: CreateCashFlowColumnDTO) =>
    fetchApi<CashFlowColumnDTO>('/cashflow/columns', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateColumn: (key: string, data: UpdateCashFlowColumnDTO) =>
    fetchApi<CashFlowColumnDTO>(`/cashflow/columns/${key}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  swapColumns: (keyA: string, keyB: string) =>
    fetchApi<CashFlowColumnDTO[]>('/cashflow/columns/swap', {
      method: 'PUT',
      body: JSON.stringify({ keyA, keyB }),
    }),

  deleteColumn: (key: string) =>
    fetchApi<void>(`/cashflow/columns/${key}`, {
      method: 'DELETE',
    }),

  getClassifications: () =>
    fetchApi<CashFlowClassificationDTO[]>('/cashflow/classifications'),

  createClassification: (data: CreateCashFlowClassificationDTO) =>
    fetchApi<CashFlowClassificationDTO>('/cashflow/classifications', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateClassification: (key: string, data: UpdateCashFlowClassificationDTO) =>
    fetchApi<CashFlowClassificationDTO>(`/cashflow/classifications/${key}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteClassification: (key: string) =>
    fetchApi<void>(`/cashflow/classifications/${key}`, {
      method: 'DELETE',
    }),
};

// Fixed expense templates
export const fixedExpensesApi = {
  getAll: (category?: FixedExpenseCategory) => {
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    const query = params.toString();

    return fetchApi<FixedExpenseTemplateDTO[]>(
      `/fixed-expenses${query ? `?${query}` : ''}`
    );
  },

  create: (data: CreateFixedExpenseTemplateDTO) =>
    fetchApi<FixedExpenseTemplateDTO>('/fixed-expenses', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: UpdateFixedExpenseTemplateDTO) =>
    fetchApi<FixedExpenseTemplateDTO>(`/fixed-expenses/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    fetchApi<void>(`/fixed-expenses/${id}`, {
      method: 'DELETE',
    }),

  applyToPeriod: (periodKey: string, data: ApplyFixedExpenseTemplatesDTO) =>
    fetchApi<ApplyFixedExpenseTemplatesResultDTO>(`/fixed-expenses/apply/${periodKey}`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// Portfolio
export const portfolioApi = {
  getAssetClasses: () =>
    fetchApi<PortfolioAssetClassDTO[]>('/portfolio/asset-classes'),

  createAssetClass: (data: CreatePortfolioAssetClassDTO) =>
    fetchApi<PortfolioAssetClassDTO>('/portfolio/asset-classes', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateAssetClass: (id: string, data: UpdatePortfolioAssetClassDTO) =>
    fetchApi<PortfolioAssetClassDTO>(`/portfolio/asset-classes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  getInstruments: () =>
    fetchApi<PortfolioInstrumentDTO[]>('/portfolio/instruments'),

  createInstrument: (data: CreatePortfolioInstrumentDTO) =>
    fetchApi<PortfolioInstrumentDTO>('/portfolio/instruments', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateInstrument: (id: string, data: UpdatePortfolioInstrumentDTO) =>
    fetchApi<PortfolioInstrumentDTO>(`/portfolio/instruments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  getInvested: () =>
    fetchApi<PortfolioInvestedStateDTO>('/portfolio/invested'),

  updateInvested: (data: UpdatePortfolioInvestedStateDTO) =>
    fetchApi<PortfolioInvestedStateDTO>('/portfolio/invested', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  getGeographicExposure: (data: PortfolioGeographicExposureRequestDTO) =>
    fetchApi<PortfolioGeographicExposureResponseDTO>('/portfolio/geographic-exposure', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getSectorExposure: (data: PortfolioSectorExposureRequestDTO) =>
    fetchApi<PortfolioSectorExposureResponseDTO>('/portfolio/sector-exposure', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getCompanyExposure: (data: PortfolioCompanyExposureRequestDTO) =>
    fetchApi<PortfolioCompanyExposureResponseDTO>('/portfolio/company-exposure', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getInvestedStaticPerformance: (data: PortfolioStaticPerformanceRequestDTO) =>
    fetchApi<PortfolioStaticPerformanceResponseDTO>('/portfolio/invested-performance', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getJustEtfDebugRaw: (isin?: string) => {
    const query = isin ? `?isin=${encodeURIComponent(isin)}` : '';
    return fetchApi<{ isin: string; payload: Record<string, unknown> }>(
      `/portfolio/debug/justetf${query}`
    );
  },

  compare: (data: PortfolioCompareRequestDTO) =>
    fetchApi<PortfolioCompareResponseDTO>('/portfolio/compare', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getHistory: (symbols: string[], horizon: PortfolioHistoryHorizonDTO) => {
    const params = new URLSearchParams({
      symbols: symbols.join(','),
      horizon,
    });
    return fetchApi<PortfolioHistoryResponseDTO>(`/portfolio/history?${params.toString()}`);
  },
};
