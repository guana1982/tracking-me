import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { habitsApi } from '../lib/habitApi';
import type {
  CreateHabitDefinitionDTO,
  SetHabitDTO,
  UpdateHabitDefinitionDTO,
} from '@budget/shared';

// "food" prefix like the rest of the diary domain: one predicate sweep
export const habitQueryKeys = {
  definitions: ['foodHabits'] as const,
  day: (date: string) => ['foodHabitDay', date] as const,
  entries: (from?: string, to?: string) =>
    ['foodHabitEntries', from ?? 'all', to ?? 'all'] as const,
};

function invalidateFoodData(queryClient: QueryClient) {
  queryClient.invalidateQueries({
    predicate: (query) => String(query.queryKey[0]).startsWith('food'),
  });
}

export function useHabits() {
  return useQuery({ queryKey: habitQueryKeys.definitions, queryFn: habitsApi.getAll });
}

export function useInstallDefaultHabits() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => habitsApi.installDefaults(),
    onSuccess: () => invalidateFoodData(queryClient),
  });
}

export function useCreateHabit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateHabitDefinitionDTO) => habitsApi.create(data),
    onSuccess: () => invalidateFoodData(queryClient),
  });
}

export function useUpdateHabit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ key, data }: { key: string; data: UpdateHabitDefinitionDTO }) =>
      habitsApi.update(key, data),
    onSuccess: () => invalidateFoodData(queryClient),
  });
}

export function useDeleteHabit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (key: string) => habitsApi.remove(key),
    onSuccess: () => invalidateFoodData(queryClient),
  });
}

export function useHabitDay(date: string, enabled = true) {
  return useQuery({
    queryKey: habitQueryKeys.day(date),
    queryFn: () => habitsApi.getDay(date),
    enabled,
  });
}

export function useSetHabit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: SetHabitDTO) => habitsApi.setEntry(data),
    onSuccess: (day) => {
      // The response is the refreshed day: written straight in, so a tap
      // never flashes back to the previous state while refetching
      queryClient.setQueryData(habitQueryKeys.day(day.date), day);
      invalidateFoodData(queryClient);
    },
  });
}
