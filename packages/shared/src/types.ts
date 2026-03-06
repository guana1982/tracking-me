import type { Category } from './constants';

// Base entity with common fields
export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

// Month Period - represents a budget month (e.g., 2026-01)
export interface MonthPeriod extends BaseEntity {
  year: number;
  month: number; // 1-12
  periodKey: string; // YYYY-MM format for easy querying
}

// Budget Rule - configurable percentages for a month
export interface BudgetRule extends BaseEntity {
  monthPeriodId: string;
  needsPct: number;
  wantsPct: number;
  savingsPct: number;
  cutoffDay: number; // Day of month for reallocation (e.g., 26)
  autoReallocateNeedsRemainder: boolean;
}

// Income - monthly income entry
export interface Income extends BaseEntity {
  monthPeriodId: string;
  label: string;
  amount: number; // in cents to avoid floating point issues
}

// Expense - individual expense entry
export interface Expense extends BaseEntity {
  monthPeriodId: string;
  date: Date;
  category: Category;
  label: string;
  amount: number; // in cents
  notes?: string | null;
  isFixed: boolean;
  tricountType: TricountType | null;
}

// Tricount type for shared expenses
export type TricountType = 'IO' | 'FRA';
export type FixedExpenseCategory = Extract<Category, 'NEEDS' | 'WANTS'>;

// Reallocation - transfer between categories at end of month
export interface Reallocation extends BaseEntity {
  monthPeriodId: string;
  fromCategory: Category;
  toCategory: Category;
  amount: number; // in cents
  executedAt: Date;
  reason?: string | null;
}

// ============= DTOs =============

// Month Period DTOs
export interface MonthPeriodDTO {
  id: string;
  year: number;
  month: number;
  periodKey: string;
  isClosed: boolean;
  closedAt: string | null;
  createdAt: string;
}

export interface CreateMonthPeriodDTO {
  year: number;
  month: number;
}

// Budget Rule DTOs
export interface BudgetRuleDTO {
  id: string;
  monthPeriodId: string;
  needsPct: number;
  wantsPct: number;
  savingsPct: number;
  cutoffDay: number;
  autoReallocateNeedsRemainder: boolean;
}

export interface UpdateBudgetRuleDTO {
  needsPct?: number;
  wantsPct?: number;
  savingsPct?: number;
  cutoffDay?: number;
  autoReallocateNeedsRemainder?: boolean;
}

// Income DTOs
export interface IncomeDTO {
  id: string;
  monthPeriodId: string;
  label: string;
  amount: number;
  createdAt: string;
}

export interface CreateIncomeDTO {
  label: string;
  amount: number;
}

export interface UpdateIncomeDTO {
  label?: string;
  amount?: number;
}

// Expense DTOs
export interface ExpenseDTO {
  id: string;
  monthPeriodId: string;
  date: string;
  category: Category;
  label: string;
  amount: number;
  notes?: string | null;
  isFixed: boolean;
  tricountType: TricountType | null;
  createdAt: string;
}

export interface CreateExpenseDTO {
  date: string; // ISO date string
  category: Category;
  label: string;
  amount: number;
  notes?: string;
  isFixed?: boolean;
  tricountType?: TricountType | null;
}

export interface UpdateExpenseDTO {
  date?: string;
  category?: Category;
  label?: string;
  amount?: number;
  notes?: string | null;
  isFixed?: boolean;
  tricountType?: TricountType | null;
}

// Fixed Expense Template DTOs
export interface FixedExpenseTemplateDTO {
  id: string;
  category: FixedExpenseCategory;
  label: string;
  amount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFixedExpenseTemplateDTO {
  category: FixedExpenseCategory;
  label: string;
  amount: number;
}

export interface UpdateFixedExpenseTemplateDTO {
  category?: FixedExpenseCategory;
  label?: string;
  amount?: number;
}

export interface ApplyFixedExpenseTemplatesDTO {
  category: FixedExpenseCategory;
  templateIds?: string[];
}

export interface ApplyFixedExpenseTemplatesResultDTO {
  createdCount: number;
  skippedCount: number;
  created: ExpenseDTO[];
}

// Reallocation DTOs
export interface ReallocationDTO {
  id: string;
  monthPeriodId: string;
  fromCategory: Category;
  toCategory: Category;
  amount: number;
  executedAt: string;
  reason?: string | null;
}

export interface CreateReallocationDTO {
  fromCategory: Category;
  toCategory: Category;
  amount: number;
  reason?: string;
}

// ============= Dashboard DTOs =============

// Category summary for dashboard
export interface CategorySummary {
  category: Category;
  targetAmount: number; // Budget target based on percentage
  actualAmount: number; // Total spent
  remaining: number; // Target - Actual (can be negative)
  percentage: number; // Actual percentage of target used
  status: 'ok' | 'warning' | 'danger'; // Based on thresholds
}

// Dashboard summary response
export interface DashboardSummaryDTO {
  monthPeriod: MonthPeriodDTO;
  budgetRule: BudgetRuleDTO;
  totalIncome: number;
  totalSpent: number;
  unallocatedIncome: number; // Income not yet budgeted
  categories: CategorySummary[];
  reallocationPreview?: ReallocationPreviewDTO;
  recentExpenses: ExpenseDTO[];
}

// Reallocation preview (shown when cutoff day reached)
export interface ReallocationPreviewDTO {
  available: boolean; // Is reallocation possible?
  needsRemainder: number; // Amount left in NEEDS
  wantsRemainder: number; // Amount left in WANTS
  suggestedAmount: number; // Suggested total transfer to SAVINGS
  cutoffDay: number;
  isAfterCutoff: boolean;
}

// Savings history for bar chart and cumulative totals
export interface MonthlySavingsDTO {
  periodKey: string;
  month: number;
  year: number;
  savings: number; // actual savings amount for that month
}

export interface SavingsHistoryDTO {
  months: MonthlySavingsDTO[];
  currentMonthSavings: number;
  previousMonthsTotal: number;
  cumulativeTotal: number;
}

// Month list item for navigation
export interface MonthListItemDTO {
  periodKey: string;
  year: number;
  month: number;
  totalIncome: number;
  totalSpent: number;
}

// ============= CashFlow DTOs =============

// CashFlow Check - net worth snapshot
export interface CashFlowCheckDTO {
  id: string;
  checkLabel: string;
  date: string;
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
  createdAt: string;
  updatedAt: string;
}

export interface CreateCashFlowCheckDTO {
  checkLabel: string;
  date: string;
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
  notes?: string;
}

export type UpdateCashFlowCheckDTO = Partial<CreateCashFlowCheckDTO>;

// CashFlow Settings - per-user commission/ETF config
export interface CashFlowSettingsDTO {
  commissionPerEtf: number;
  etfCount: number;
}

// API Response wrapper
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

// Pagination
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Expense filters
export interface ExpenseFilters {
  category?: Category;
  startDate?: string;
  endDate?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}
