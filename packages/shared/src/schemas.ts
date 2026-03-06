import { z } from 'zod';
import { CATEGORIES } from './constants';

// Category enum schema
export const categorySchema = z.enum(CATEGORIES);
export const fixedExpenseCategorySchema = z.enum(['NEEDS', 'WANTS']);

// Tricount type schema for shared expenses
export const tricountTypeSchema = z.enum(['IO', 'FRA']);

// Month Period schemas
export const createMonthPeriodSchema = z.object({
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
});

// Budget Rule schemas
export const updateBudgetRuleSchema = z
  .object({
    needsPct: z.number().min(0).max(100).optional(),
    wantsPct: z.number().min(0).max(100).optional(),
    savingsPct: z.number().min(0).max(100).optional(),
    cutoffDay: z.number().int().min(1).max(31).optional(),
    autoReallocateNeedsRemainder: z.boolean().optional(),
  })
  .refine(
    (data) => {
      // If any percentage is provided, validate that all three sum to 100
      const needs = data.needsPct;
      const wants = data.wantsPct;
      const savings = data.savingsPct;

      // Only validate if all three are provided
      if (needs !== undefined && wants !== undefined && savings !== undefined) {
        return needs + wants + savings === 100;
      }
      return true;
    },
    {
      message: 'Budget percentages must sum to 100',
    }
  );

// Income schemas
export const createIncomeSchema = z.object({
  label: z.string().min(1).max(100).trim(),
  amount: z.number().positive().multipleOf(0.01), // Allow cents
});

export const updateIncomeSchema = z.object({
  label: z.string().min(1).max(100).trim().optional(),
  amount: z.number().positive().multipleOf(0.01).optional(),
});

// Expense schemas
export const createExpenseSchema = z.object({
  date: z.string().datetime().or(z.string().date()), // ISO date or datetime
  category: categorySchema,
  label: z.string().min(1).max(200).trim(),
  amount: z.number().positive().multipleOf(0.01),
  notes: z.string().max(500).trim().optional(),
  isFixed: z.boolean().optional().default(false),
  tricountType: tricountTypeSchema.nullable().optional(),
});

export const updateExpenseSchema = z.object({
  date: z.string().datetime().or(z.string().date()).optional(),
  category: categorySchema.optional(),
  label: z.string().min(1).max(200).trim().optional(),
  amount: z.number().positive().multipleOf(0.01).optional(),
  notes: z.string().max(500).trim().optional().nullable(),
  isFixed: z.boolean().optional(),
  tricountType: tricountTypeSchema.nullable().optional(),
});

// Fixed expense template schemas
export const createFixedExpenseTemplateSchema = z.object({
  category: fixedExpenseCategorySchema,
  label: z.string().min(1).max(200).trim(),
  amount: z.number().positive().multipleOf(0.01),
});

export const updateFixedExpenseTemplateSchema = z
  .object({
    category: fixedExpenseCategorySchema.optional(),
    label: z.string().min(1).max(200).trim().optional(),
    amount: z.number().positive().multipleOf(0.01).optional(),
  })
  .refine(
    (data) => data.category !== undefined || data.label !== undefined || data.amount !== undefined,
    {
      message: 'At least one field must be provided',
    }
  );

export const applyFixedExpenseTemplatesSchema = z.object({
  category: fixedExpenseCategorySchema,
  templateIds: z.array(z.string().min(1)).optional(),
});

// Reallocation schemas
export const createReallocationSchema = z.object({
  fromCategory: categorySchema,
  toCategory: categorySchema,
  amount: z.number().positive().multipleOf(0.01),
  reason: z.string().max(200).trim().optional(),
});

// Expense filters schema
export const expenseFiltersSchema = z.object({
  category: categorySchema.optional(),
  startDate: z.string().date().optional(),
  endDate: z.string().date().optional(),
  search: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

// Period key schema (YYYY-MM)
export const periodKeySchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, {
  message: 'Period key must be in YYYY-MM format',
});

// CashFlow Check schemas
const cashFlowNumericField = z.number().multipleOf(0.01);

export const createCashFlowCheckSchema = z.object({
  checkLabel: z.string().min(1).max(100).trim(),
  date: z.string().date(),
  bbva: cashFlowNumericField,
  tradeRepublic: cashFlowNumericField,
  webankCc: cashFlowNumericField,
  webankObbl: cashFlowNumericField,
  etfLordo: cashFlowNumericField,
  rendimentoLordo: cashFlowNumericField,
  bper: cashFlowNumericField,
  tricount: cashFlowNumericField,
  cartaWebank: cashFlowNumericField,
  edenred: cashFlowNumericField,
  notes: z.string().max(500).trim().optional(),
});

export const updateCashFlowCheckSchema = z.object({
  checkLabel: z.string().min(1).max(100).trim().optional(),
  date: z.string().date().optional(),
  bbva: cashFlowNumericField.optional(),
  tradeRepublic: cashFlowNumericField.optional(),
  webankCc: cashFlowNumericField.optional(),
  webankObbl: cashFlowNumericField.optional(),
  etfLordo: cashFlowNumericField.optional(),
  rendimentoLordo: cashFlowNumericField.optional(),
  bper: cashFlowNumericField.optional(),
  tricount: cashFlowNumericField.optional(),
  cartaWebank: cashFlowNumericField.optional(),
  edenred: cashFlowNumericField.optional(),
  notes: z.string().max(500).trim().optional(),
});

// CashFlow Settings schema
export const cashFlowSettingsSchema = z.object({
  commissionPerEtf: z.number().min(0).multipleOf(0.01),
  etfCount: z.number().int().min(0),
});

// Type exports from schemas
export type CreateMonthPeriodInput = z.infer<typeof createMonthPeriodSchema>;
export type UpdateBudgetRuleInput = z.infer<typeof updateBudgetRuleSchema>;
export type CreateIncomeInput = z.infer<typeof createIncomeSchema>;
export type UpdateIncomeInput = z.infer<typeof updateIncomeSchema>;
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;
export type CreateFixedExpenseTemplateInput = z.infer<typeof createFixedExpenseTemplateSchema>;
export type UpdateFixedExpenseTemplateInput = z.infer<typeof updateFixedExpenseTemplateSchema>;
export type ApplyFixedExpenseTemplatesInput = z.infer<typeof applyFixedExpenseTemplatesSchema>;
export type CreateReallocationInput = z.infer<typeof createReallocationSchema>;
export type ExpenseFiltersInput = z.infer<typeof expenseFiltersSchema>;
export type CreateCashFlowCheckInput = z.infer<typeof createCashFlowCheckSchema>;
export type UpdateCashFlowCheckInput = z.infer<typeof updateCashFlowCheckSchema>;
export type CashFlowSettingsInput = z.infer<typeof cashFlowSettingsSchema>;
