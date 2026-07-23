import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import {
  mealsApi,
  mealTypesApi,
  mealUnitsApi,
  quickLogsApi,
  foodDashboardApi,
} from '../lib/foodApi';
import type {
  CreateMealDTO,
  UpdateMealDTO,
  CreateQuickLogDTO,
  UpdateQuickLogDTO,
  MealTypeDTO,
  CreateMealTypeDefinitionDTO,
  UpdateMealTypeDefinitionDTO,
  CreateMealUnitDefinitionDTO,
  UpdateMealUnitDefinitionDTO,
  FoodComparisonConditionDTO,
} from '@budget/shared';

// Query keys - all prefixed with "food" so mutations can invalidate the
// whole isolated domain in one predicate sweep
export const foodQueryKeys = {
  meals: (from?: string, to?: string) => ['foodMeals', from ?? 'all', to ?? 'all'] as const,
  mealTypes: ['foodMealTypes'] as const,
  mealUnits: ['foodMealUnits'] as const,
  quickLogs: (from?: string, to?: string) =>
    ['foodQuickLogs', from ?? 'all', to ?? 'all'] as const,
  suggestions: (q: string) => ['foodSuggestions', q] as const,
  frequentMeals: ['foodFrequentMeals'] as const,
  repeatYesterday: (date: string, mealType: MealTypeDTO) =>
    ['foodRepeatYesterday', date, mealType] as const,
  mealPhoto: (id: string) => ['foodMealPhoto', id] as const,
  overview: (from: string, to: string) => ['foodOverview', from, to] as const,
  comparison: (condition: string, value: string, from: string, to: string) =>
    ['foodComparison', condition, value, from, to] as const,
  associations: (from: string, to: string) => ['foodAssociations', from, to] as const,
  stats: (from: string, to: string) => ['foodStats', from, to] as const,
};

// Any data mutation reshapes diary AND derived dashboards - invalidate all
function invalidateFoodData(queryClient: QueryClient) {
  queryClient.invalidateQueries({
    predicate: (query) => String(query.queryKey[0]).startsWith('food'),
  });
}

// ---------- Meals ----------

export function useMeals(from?: string, to?: string) {
  return useQuery({
    queryKey: foodQueryKeys.meals(from, to),
    queryFn: () => mealsApi.getByRange(from, to),
  });
}

export function useMealTypes() {
  return useQuery({
    queryKey: foodQueryKeys.mealTypes,
    queryFn: mealTypesApi.getAll,
  });
}

export function useCreateMealType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateMealTypeDefinitionDTO) => mealTypesApi.create(data),
    onSuccess: () => invalidateFoodData(queryClient),
  });
}

export function useUpdateMealType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      key,
      data,
    }: {
      key: string;
      data: UpdateMealTypeDefinitionDTO;
    }) => mealTypesApi.update(key, data),
    onSuccess: () => invalidateFoodData(queryClient),
  });
}

export function useMealUnits() {
  return useQuery({
    queryKey: foodQueryKeys.mealUnits,
    queryFn: mealUnitsApi.getAll,
  });
}

export function useCreateMealUnit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateMealUnitDefinitionDTO) => mealUnitsApi.create(data),
    onSuccess: () => invalidateFoodData(queryClient),
  });
}

export function useUpdateMealUnit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      key,
      data,
    }: {
      key: string;
      data: UpdateMealUnitDefinitionDTO;
    }) => mealUnitsApi.update(key, data),
    onSuccess: () => invalidateFoodData(queryClient),
  });
}

export function useCreateMeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateMealDTO) => mealsApi.create(data),
    onSuccess: () => invalidateFoodData(queryClient),
  });
}

export function useUpdateMeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateMealDTO }) => mealsApi.update(id, data),
    onSuccess: () => invalidateFoodData(queryClient),
  });
}

export function useDeleteMeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => mealsApi.remove(id),
    onSuccess: () => invalidateFoodData(queryClient),
  });
}

export function useFoodSuggestions(q: string) {
  return useQuery({
    queryKey: foodQueryKeys.suggestions(q),
    queryFn: () => mealsApi.getSuggestions(q),
    enabled: q.trim().length >= 2,
    staleTime: 1000 * 30,
  });
}

export function useFrequentMeals(enabled: boolean) {
  return useQuery({
    queryKey: foodQueryKeys.frequentMeals,
    queryFn: mealsApi.getFrequent,
    enabled,
  });
}

export function useMealPhoto(id: string, enabled: boolean) {
  return useQuery({
    queryKey: foodQueryKeys.mealPhoto(id),
    queryFn: () => mealsApi.getPhoto(id),
    enabled,
    staleTime: 1000 * 60 * 30, // photos never change silently
  });
}

// ---------- Quick logs ----------

export function useQuickLogs(from?: string, to?: string) {
  return useQuery({
    queryKey: foodQueryKeys.quickLogs(from, to),
    queryFn: () => quickLogsApi.getByRange(from, to),
  });
}

export function useCreateQuickLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateQuickLogDTO) => quickLogsApi.create(data),
    onSuccess: () => invalidateFoodData(queryClient),
  });
}

export function useUpdateQuickLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateQuickLogDTO }) =>
      quickLogsApi.update(id, data),
    onSuccess: () => invalidateFoodData(queryClient),
  });
}

export function useDeleteQuickLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => quickLogsApi.remove(id),
    onSuccess: () => invalidateFoodData(queryClient),
  });
}

export function useRecalculateQuickLogs() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => quickLogsApi.recalculate(),
    onSuccess: () => invalidateFoodData(queryClient),
  });
}

// ---------- Dashboard ----------

export function useFoodOverview(from: string, to: string) {
  return useQuery({
    queryKey: foodQueryKeys.overview(from, to),
    queryFn: () => foodDashboardApi.getOverview(from, to),
  });
}

export function useFoodComparison(
  condition: FoodComparisonConditionDTO,
  value: string | undefined,
  from: string,
  to: string
) {
  const needsValue = condition === 'FOOD' || condition === 'SUPPLEMENT_PERIOD';
  return useQuery({
    queryKey: foodQueryKeys.comparison(condition, value ?? '', from, to),
    queryFn: () => foodDashboardApi.getComparison(condition, value, from, to),
    enabled: !needsValue || Boolean(value && value.trim().length > 0),
  });
}

export function useFoodAssociations(from: string, to: string) {
  return useQuery({
    queryKey: foodQueryKeys.associations(from, to),
    queryFn: () => foodDashboardApi.getAssociations(from, to),
  });
}

export function useFoodStats(from: string, to: string, enabled = true) {
  return useQuery({
    queryKey: foodQueryKeys.stats(from, to),
    queryFn: () => foodDashboardApi.getStats(from, to),
    enabled,
  });
}
