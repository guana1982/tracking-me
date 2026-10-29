import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateMealPlanEntryDTO,
  CreatePantryItemDTO,
  CreateRecipeDTO,
  CreateShoppingItemDTO,
  KitchenWeekDTO,
  UpdateMealPlanEntryDTO,
  UpdatePantryItemDTO,
  UpdateRecipeDTO,
  UpdateShoppingItemDTO,
} from '@budget/shared';
import type { DayMark } from '../components/calendar/WeekCalendar';
import { kitchenApi } from '../lib/kitchenApi';

const kitchenKeys = {
  all: ['kitchen'] as const,
  weeks: ['kitchen', 'week'] as const,
  week: (date: string) => ['kitchen', 'week', date] as const,
  marks: (from: string, to: string) => ['kitchen', 'marks', from, to] as const,
};

/** Keyed by the selected day so moving inside a week shows the cached week at once */
export function useKitchenWeek(date: string) {
  return useQuery({
    queryKey: kitchenKeys.week(date),
    queryFn: () => kitchenApi.getWeek(date),
    enabled: Boolean(date),
    placeholderData: (previous) => previous,
  });
}

/** The calendar's dots: blue = planned, red = something is missing, green = all cooked */
export function useKitchenDayMarks(from: string, to: string): Map<string, DayMark> {
  const query = useQuery({
    queryKey: kitchenKeys.marks(from, to),
    queryFn: () => kitchenApi.getMarks(from, to),
    enabled: Boolean(from && to),
  });
  return useMemo(() => {
    const marks = new Map<string, DayMark>();
    for (const day of query.data ?? []) {
      const dots: DayMark['dots'] = [];
      if (day.missing > 0) dots.push('late');
      else if (day.planned > 0) dots.push('open');
      if (day.planned === 0 && day.cooked > 0) dots.push('done');
      const parts: string[] = [];
      if (day.planned > 0) parts.push(`${day.planned} da cucinare`);
      if (day.cooked > 0) parts.push(`${day.cooked} cucinati`);
      if (day.missing > 0) parts.push(`${day.missing} con ingredienti mancanti`);
      marks.set(day.date, { dots, label: parts.join(' · ') || undefined });
    }
    return marks;
  }, [query.data]);
}

function useRefreshKitchen() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: kitchenKeys.all });
}

/** Changes the cached weeks right away, so ticking and +/- never wait for the network */
function useOptimisticWeek() {
  const queryClient = useQueryClient();
  return async (update: (week: KitchenWeekDTO) => KitchenWeekDTO) => {
    await queryClient.cancelQueries({ queryKey: kitchenKeys.weeks });
    const previous = queryClient.getQueriesData<KitchenWeekDTO>({ queryKey: kitchenKeys.weeks });
    queryClient.setQueriesData<KitchenWeekDTO>({ queryKey: kitchenKeys.weeks }, (week) =>
      week ? update(week) : week
    );
    return { previous };
  };
}

function useRestoreWeeks() {
  const queryClient = useQueryClient();
  return (context: { previous: Array<[readonly unknown[], KitchenWeekDTO | undefined]> } | undefined) =>
    context?.previous.forEach(([queryKey, data]) => queryClient.setQueryData(queryKey, data));
}

// Pantry

export function useCreatePantryItem() {
  const refresh = useRefreshKitchen();
  return useMutation({ mutationFn: (data: CreatePantryItemDTO) => kitchenApi.createPantryItem(data), onSuccess: refresh });
}

export function useUpdatePantryItem() {
  const refresh = useRefreshKitchen();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdatePantryItemDTO }) => kitchenApi.updatePantryItem(id, data),
    onSuccess: refresh,
  });
}

export function useAdjustPantryItem() {
  const refresh = useRefreshKitchen();
  const optimistic = useOptimisticWeek();
  const restore = useRestoreWeeks();
  return useMutation({
    mutationFn: ({ id, delta }: { id: string; delta: number }) => kitchenApi.adjustPantryItem(id, delta),
    onMutate: ({ id, delta }) =>
      optimistic((week) => ({
        ...week,
        pantry: week.pantry.map((item) =>
          item.id === id ? { ...item, quantity: Math.max(0, Math.round((item.quantity + delta) * 100) / 100) } : item
        ),
      })),
    onError: (_error, _vars, context) => restore(context),
    onSettled: refresh,
  });
}

export function useDeletePantryItem() {
  const refresh = useRefreshKitchen();
  return useMutation({ mutationFn: kitchenApi.deletePantryItem, onSuccess: refresh });
}

// Shopping list

export function useCreateShoppingItem() {
  const refresh = useRefreshKitchen();
  return useMutation({ mutationFn: (data: CreateShoppingItemDTO) => kitchenApi.createShoppingItem(data), onSuccess: refresh });
}

export function useUpdateShoppingItem() {
  const refresh = useRefreshKitchen();
  const optimistic = useOptimisticWeek();
  const restore = useRestoreWeeks();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateShoppingItemDTO }) => kitchenApi.updateShoppingItem(id, data),
    onMutate: ({ id, data }) =>
      optimistic((week) => ({
        ...week,
        shopping: week.shopping.map((item) => (item.id === id ? { ...item, ...data } : item)),
      })),
    onError: (_error, _vars, context) => restore(context),
    onSettled: refresh,
  });
}

export function useDeleteShoppingItem() {
  const refresh = useRefreshKitchen();
  return useMutation({ mutationFn: kitchenApi.deleteShoppingItem, onSuccess: refresh });
}

export function useAddMissingToList() {
  const refresh = useRefreshKitchen();
  return useMutation({ mutationFn: kitchenApi.addMissingToList, onSuccess: refresh });
}

export function useClearCheckedShopping() {
  const refresh = useRefreshKitchen();
  return useMutation({ mutationFn: kitchenApi.clearChecked, onSuccess: refresh });
}

export function useCopyPreviousList() {
  const refresh = useRefreshKitchen();
  return useMutation({ mutationFn: kitchenApi.copyPreviousList, onSuccess: refresh });
}

// Dishes

export function useCreateRecipe() {
  const refresh = useRefreshKitchen();
  return useMutation({ mutationFn: (data: CreateRecipeDTO) => kitchenApi.createRecipe(data), onSuccess: refresh });
}

export function useUpdateRecipe() {
  const refresh = useRefreshKitchen();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateRecipeDTO }) => kitchenApi.updateRecipe(id, data),
    onSuccess: refresh,
  });
}

export function useDeleteRecipe() {
  const refresh = useRefreshKitchen();
  return useMutation({ mutationFn: kitchenApi.deleteRecipe, onSuccess: refresh });
}

// Menu

export function useCreatePlanEntry() {
  const refresh = useRefreshKitchen();
  return useMutation({ mutationFn: (data: CreateMealPlanEntryDTO) => kitchenApi.createPlanEntry(data), onSuccess: refresh });
}

export function useUpdatePlanEntry() {
  const refresh = useRefreshKitchen();
  const optimistic = useOptimisticWeek();
  const restore = useRestoreWeeks();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateMealPlanEntryDTO }) => kitchenApi.updatePlanEntry(id, data),
    onMutate: ({ id, data }) =>
      optimistic((week) => ({
        ...week,
        plan: week.plan.map((entry) =>
          entry.id === id
            ? {
                ...entry,
                ...(data.status ? { status: data.status, availability: data.status === 'PLANNED' ? entry.availability : 'DONE' } : {}),
              }
            : entry
        ),
      })),
    onError: (_error, _vars, context) => restore(context),
    onSettled: refresh,
  });
}

export function useDeletePlanEntry() {
  const refresh = useRefreshKitchen();
  return useMutation({ mutationFn: kitchenApi.deletePlanEntry, onSuccess: refresh });
}

export function useCopyPreviousPlan() {
  const refresh = useRefreshKitchen();
  return useMutation({ mutationFn: kitchenApi.copyPreviousPlan, onSuccess: refresh });
}
