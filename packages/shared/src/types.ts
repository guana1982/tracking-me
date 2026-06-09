import type { BudgetCategory, Category } from './constants';

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

// Category summary for dashboard (budget categories only — EXTRA is tracked separately)
export interface CategorySummary {
  category: BudgetCategory;
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
  totalSpent: number; // budget categories only (EXTRA excluded)
  unallocatedIncome: number; // Income not yet budgeted
  extraSpent: number; // EXTRA expenses total, tracked outside the budget
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

// Savings pace — answers "at the current run-rate, will I stay within budget by payday?"
// Operates on the pay-cycle, not the calendar month: the cycle runs from the day after
// the previous payday to the current period's payday (both weekend-adjusted to the
// previous Friday if they fall on Sat/Sun). Expenses dated after payday belong to the
// next cycle.
// Primary metric: projected NEEDS+WANTS spending at end-of-cycle vs budget target (income × (needsPct+wantsPct)).
// Secondary: comparison against the best-savings-rate historical month at the equivalent cycle-progress.
export interface SavingsPaceDTO {
  // Cycle progress — frontend renders as "Giorno {daysElapsed}/{effectiveCutoffDay}"
  daysElapsed: number;               // days elapsed within the current pay-cycle (1-based, clamped to effectiveCutoffDay)
  effectiveCutoffDay: number;        // total length of the pay-cycle in days
  nominalCutoffDay: number;          // raw cutoffDay from BudgetRule (the payday number, before weekend adjustment)

  // Run-rate vs budget target
  currentSpendToDate: number;        // NEEDS+WANTS stored in the selected period (SAVINGS excluded, expense date ignored)
  projectedMonthlySpend: number;     // fixed NEEDS+WANTS + variable NEEDS+WANTS projected to end-of-cycle
  budgetTarget: number;              // income × (needsPct + wantsPct) / 100 — max NEEDS+WANTS allowed
  performancePct: number;            // 0..100 gauge position. 50 = projected exactly at target; >50 under target; <50 over target

  // Secondary: best historical month by savings-rate (savings / income), excluding the current period
  bestMonth: {
    periodKey: string;
    month: number;
    year: number;
    income: number;
    savings: number;
    savingsRate: number;             // 0..1 (e.g. 0.18 = 18%)
  } | null;
  bestSpendAtSameProgress: number;   // best month's NEEDS+WANTS at current cycle progress ratio (date-agnostic)
  hasComparison: boolean;            // false when no usable historical month is available
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

export type CashFlowValueMap = Record<string, number>;

export interface CashFlowColumnDTO {
  key: string;
  label: string;
  position: number;
  isActive: boolean;
  showInPie: boolean;
}

// CashFlow Check - net worth snapshot
export interface CashFlowCheckDTO {
  id: string;
  checkLabel: string;
  date: string;
  values: CashFlowValueMap;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCashFlowCheckDTO {
  checkLabel: string;
  date: string;
  values: CashFlowValueMap;
  notes?: string;
}

export type UpdateCashFlowCheckDTO = Partial<CreateCashFlowCheckDTO>;

export interface CreateCashFlowColumnDTO {
  label: string;
}

export interface UpdateCashFlowColumnDTO {
  label?: string;
  position?: number;
  isActive?: boolean;
  showInPie?: boolean;
}

// CashFlow Settings - per-user commission/ETF config
export interface CashFlowSettingsDTO {
  commissionPerEtf: number;
  etfCount: number;
}

// CashFlow Column Classifications
export interface CashFlowClassificationDTO {
  key: string;
  label: string;
  columnKeys: string[];
  position: number;
}

export interface CreateCashFlowClassificationDTO {
  label: string;
}

export interface UpdateCashFlowClassificationDTO {
  label?: string;
  columnKeys?: string[];
  position?: number;
}

// ============= Portfolio DTOs =============

export type PortfolioHistoryHorizonDTO = '1Y' | '3Y' | '5Y';

export interface PortfolioHistoryPointDTO {
  date: string; // YYYY-MM-DD
  close: number;
}

export interface PortfolioSymbolHistoryDTO {
  symbol: string;
  points: PortfolioHistoryPointDTO[];
}

export interface PortfolioHistoryResponseDTO {
  horizon: PortfolioHistoryHorizonDTO;
  generatedAt: string;
  series: PortfolioSymbolHistoryDTO[];
}

export type PortfolioInputValueModeDTO = 'quote' | 'quote_with_dividends';

export interface PortfolioCompareDefinitionDTO {
  name: string;
  weights: Record<string, number>;
}

export interface PortfolioCompareRequestDTO {
  horizon: PortfolioHistoryHorizonDTO;
  inputValue: PortfolioInputValueModeDTO;
  riskFreeAnnual: number;
  universeByLabel: Record<string, string>;
  portfolios: PortfolioCompareDefinitionDTO[];
}

export interface PortfolioUniverseItemDTO {
  label: string;
  isin: string;
  name: string | null;
  ticker: string | null;
  currency: string | null;
  strategy: string | null;
}

export interface PortfolioSeriesPointValueDTO {
  date: string;
  value: number;
}

export interface PortfolioMetricsDTO {
  annualizedReturn: number;
  annualizedVolatility: number;
  sharpe: number | null;
  nMonths: number;
  divers: number;
  avgCorr: number | null;
  score: number | null;
}

export interface PortfolioComparisonResultDTO {
  name: string;
  weights: Record<string, number>;
  metrics: PortfolioMetricsDTO;
  series: PortfolioSeriesPointValueDTO[];
}

export interface PortfolioCorrelationMatrixDTO {
  labels: string[];
  values: Array<Array<number | null>>;
}

export interface PortfolioScatterPointDTO {
  name: string;
  annualizedReturn: number;
  annualizedVolatility: number;
  divers: number;
  avgCorr: number | null;
  score: number | null;
}

export interface PortfolioCompareResponseDTO {
  generatedAt: string;
  horizon: PortfolioHistoryHorizonDTO;
  inputValue: PortfolioInputValueModeDTO;
  riskFreeAnnual: number;
  universe: PortfolioUniverseItemDTO[];
  portfolios: PortfolioComparisonResultDTO[];
  ranking: string[];
  correlationBetweenPortfolios: PortfolioCorrelationMatrixDTO;
  scatter: PortfolioScatterPointDTO[];
}

export interface PortfolioInvestedPositionDTO {
  symbol: string;
  amount: number;
}

export interface PortfolioInvestedStateDTO {
  hasSaved: boolean;
  updatedAt: string | null;
  positions: PortfolioInvestedPositionDTO[];
}

export interface UpdatePortfolioInvestedStateDTO {
  positions: PortfolioInvestedPositionDTO[];
}

export interface PortfolioGeographicExposureInputPositionDTO {
  isin: string;
  amount: number;
}

export interface PortfolioGeographicExposureRequestDTO {
  positions: PortfolioGeographicExposureInputPositionDTO[];
}

export interface PortfolioGeographicExposureCountryDTO {
  country: string;
  amount: number;
  percentage: number;
  assetClassBreakdown: PortfolioGeographicExposureAssetClassDTO[];
  etfs: string[];
}

export interface PortfolioGeographicExposureAssetClassDTO {
  assetClass: string;
  amount: number;
  percentage: number;
}

export interface PortfolioGeographicExposureResponseDTO {
  generatedAt: string;
  totalAmount: number;
  countries: PortfolioGeographicExposureCountryDTO[];
}

export interface PortfolioSectorExposureInputPositionDTO {
  isin: string;
  amount: number;
}

export interface PortfolioSectorExposureRequestDTO {
  positions: PortfolioSectorExposureInputPositionDTO[];
}

export interface PortfolioSectorExposureSectorDTO {
  sector: string;
  amount: number;
  percentage: number;
}

export interface PortfolioSectorExposureResponseDTO {
  generatedAt: string;
  totalAmount: number;
  sectors: PortfolioSectorExposureSectorDTO[];
}

export interface PortfolioCompanyExposureInputPositionDTO {
  isin: string;
  amount: number;
}

export interface PortfolioCompanyExposureRequestDTO {
  positions: PortfolioCompanyExposureInputPositionDTO[];
}

export interface PortfolioCompanyExposureCompanyDTO {
  company: string;
  isin: string | null;
  amount: number;
  percentage: number;
}

export interface PortfolioCompanyExposureResponseDTO {
  generatedAt: string;
  totalAmount: number;
  companies: PortfolioCompanyExposureCompanyDTO[];
}

export type PortfolioStaticPerformanceMetricDTO = 'relative' | 'relative_with_reinvested_dividends';

export interface PortfolioStaticPerformancePositionDTO {
  isin: string;
  amount: number;
}

export interface PortfolioStaticPerformanceRequestDTO {
  positions: PortfolioStaticPerformancePositionDTO[];
  metric?: PortfolioStaticPerformanceMetricDTO;
}

export interface PortfolioStaticPerformancePointDTO {
  date: string;
  value: number;
}

export interface PortfolioStaticPerformanceResponseDTO {
  generatedAt: string;
  metric: PortfolioStaticPerformanceMetricDTO;
  etfCount: number;
  startDate: string;
  endDate: string;
  finalReturn: number;
  points: PortfolioStaticPerformancePointDTO[];
}

export interface PortfolioAssetClassDTO {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePortfolioAssetClassDTO {
  name: string;
}

export interface UpdatePortfolioAssetClassDTO {
  name: string;
}

export interface PortfolioInstrumentDTO {
  id: string;
  symbol: string;
  name: string;
  isin: string;
  assetClassId: string;
  assetClassName: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePortfolioInstrumentDTO {
  symbol: string;
  name: string;
  isin: string;
  assetClassId: string;
}

export interface UpdatePortfolioInstrumentDTO {
  symbol?: string;
  name?: string;
  isin?: string;
  assetClassId?: string;
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
