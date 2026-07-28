import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { checkInApi, treatmentsApi } from '../lib/therapyApi';
import type {
  CreateCheckInScaleDTO,
  CreateTreatmentDefinitionDTO,
  SaveCheckInDTO,
  SetIntakeDTO,
  UpdateCheckInScaleDTO,
  UpdateTreatmentDefinitionDTO,
} from '@budget/shared';

// Keys are prefixed with "food" on purpose: intakes and check-in are part of
// the diary, so a mutation anywhere in it refreshes them too
export const therapyQueryKeys = {
  treatments: ['foodTreatments'] as const,
  intakeDay: (date: string) => ['foodIntakeDay', date] as const,
  checkInScales: ['foodCheckInScales'] as const,
  checkInDay: (date: string) => ['foodCheckInDay', date] as const,
};

function invalidateFoodData(queryClient: QueryClient) {
  queryClient.invalidateQueries({
    predicate: (query) => String(query.queryKey[0]).startsWith('food'),
  });
}

// ---------- Catalogue ----------

export function useTreatments() {
  return useQuery({
    queryKey: therapyQueryKeys.treatments,
    queryFn: treatmentsApi.getAll,
  });
}

export function useCreateTreatment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateTreatmentDefinitionDTO) => treatmentsApi.create(data),
    onSuccess: () => invalidateFoodData(queryClient),
  });
}

export function useUpdateTreatment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ key, data }: { key: string; data: UpdateTreatmentDefinitionDTO }) =>
      treatmentsApi.update(key, data),
    onSuccess: () => invalidateFoodData(queryClient),
  });
}

export function useDeleteTreatment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (key: string) => treatmentsApi.remove(key),
    onSuccess: () => invalidateFoodData(queryClient),
  });
}

// ---------- Adherence ----------

export function useIntakeDay(date: string, enabled = true) {
  return useQuery({
    queryKey: therapyQueryKeys.intakeDay(date),
    queryFn: () => treatmentsApi.getDay(date),
    enabled,
  });
}

export function useSetIntakes() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (entries: SetIntakeDTO[]) => treatmentsApi.setIntakes(entries),
    onSuccess: (day) => {
      // The response is the refreshed day: write it straight in, so a tap
      // never flashes back to the previous state while refetching
      queryClient.setQueryData(therapyQueryKeys.intakeDay(day.date), day);
      invalidateFoodData(queryClient);
    },
  });
}

// ---------- Check-in ----------

export function useCheckInScales() {
  return useQuery({
    queryKey: therapyQueryKeys.checkInScales,
    queryFn: checkInApi.getScales,
  });
}

export function useInstallDefaultScales() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => checkInApi.installDefaults(),
    onSuccess: () => invalidateFoodData(queryClient),
  });
}

export function useCreateCheckInScale() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateCheckInScaleDTO) => checkInApi.createScale(data),
    onSuccess: () => invalidateFoodData(queryClient),
  });
}

export function useUpdateCheckInScale() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ key, data }: { key: string; data: UpdateCheckInScaleDTO }) =>
      checkInApi.updateScale(key, data),
    onSuccess: () => invalidateFoodData(queryClient),
  });
}

export function useDeleteCheckInScale() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (key: string) => checkInApi.removeScale(key),
    onSuccess: () => invalidateFoodData(queryClient),
  });
}

export function useCheckInDay(date: string, enabled = true) {
  return useQuery({
    queryKey: therapyQueryKeys.checkInDay(date),
    queryFn: () => checkInApi.getDay(date),
    enabled,
  });
}

export function useSaveCheckIn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: SaveCheckInDTO) => checkInApi.save(data),
    onSuccess: () => invalidateFoodData(queryClient),
  });
}
