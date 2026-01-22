import type {
  ApiResponse,
  DashboardSummaryDTO,
  MonthListItemDTO,
  MonthPeriodDTO,
  BudgetRuleDTO,
  UpdateBudgetRuleDTO,
  IncomeDTO,
  CreateIncomeDTO,
  UpdateIncomeDTO,
  ExpenseDTO,
  CreateExpenseDTO,
  UpdateExpenseDTO,
  PaginatedResponse,
  ExpenseFilters,
  ReallocationDTO,
  CreateReallocationDTO,
  ReallocationPreviewDTO,
} from '@budget/shared';

const API_BASE = '/api';

class ApiError extends Error {
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
  const headers: Record<string, string> = {
    ...(options?.headers as Record<string, string>),
  };

  // Only set Content-Type for requests with body
  if (options?.body) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

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
