import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateActivityDTO,
  CreateActivityTypeDTO,
  UpdateActivityDTO,
  UpdateActivityTypeDTO,
} from '@budget/shared';
import { activitiesApi } from '../lib/activityApi';

const activityKeys = {
  all: ['activities'] as const,
  overview: (date: string) => ['activities', 'overview', date] as const,
  types: ['activities', 'types'] as const,
};

export function useActivityOverview(date: string) {
  return useQuery({
    queryKey: activityKeys.overview(date),
    queryFn: () => activitiesApi.getOverview(date),
    enabled: Boolean(date),
  });
}

export function useActivityTypes() {
  return useQuery({ queryKey: activityKeys.types, queryFn: activitiesApi.getTypes });
}

function useRefreshActivities() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: activityKeys.all });
}

export function useCreateActivity() {
  const refresh = useRefreshActivities();
  return useMutation({ mutationFn: (data: CreateActivityDTO) => activitiesApi.create(data), onSuccess: refresh });
}

export function useUpdateActivity() {
  const refresh = useRefreshActivities();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateActivityDTO }) =>
      activitiesApi.update(id, data),
    onSuccess: refresh,
  });
}

export function useDeleteActivity() {
  const refresh = useRefreshActivities();
  return useMutation({ mutationFn: activitiesApi.remove, onSuccess: refresh });
}

export function useInstallActivityTypes() {
  const refresh = useRefreshActivities();
  return useMutation({ mutationFn: activitiesApi.installDefaultTypes, onSuccess: refresh });
}

export function useCreateActivityType() {
  const refresh = useRefreshActivities();
  return useMutation({ mutationFn: (data: CreateActivityTypeDTO) => activitiesApi.createType(data), onSuccess: refresh });
}

export function useUpdateActivityType() {
  const refresh = useRefreshActivities();
  return useMutation({
    mutationFn: ({ key, data }: { key: string; data: UpdateActivityTypeDTO }) =>
      activitiesApi.updateType(key, data),
    onSuccess: refresh,
  });
}

export function useDeleteActivityType() {
  const refresh = useRefreshActivities();
  return useMutation({ mutationFn: activitiesApi.removeType, onSuccess: refresh });
}
