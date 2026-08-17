import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ActivityOverviewDTO,
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

export function useReorderActivities() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (activityIds: string[]) => activitiesApi.reorder({ activityIds }),
    onMutate: async (activityIds) => {
      await queryClient.cancelQueries({ queryKey: activityKeys.all });
      const previous = queryClient.getQueriesData<ActivityOverviewDTO>({ queryKey: activityKeys.all });
      const positions = new Map(activityIds.map((id, position) => [id, position]));
      const updateItems = (items: ActivityOverviewDTO['all']) =>
        items.map((activity) => {
          const position = positions.get(activity.id);
          return position === undefined
            ? activity
            : { ...activity, position, isManuallyPositioned: true };
        });

      queryClient.setQueriesData<ActivityOverviewDTO>({ queryKey: activityKeys.all }, (current) =>
        current
          ? {
              ...current,
              all: updateItems(Array.isArray(current.all) ? current.all : []),
              today: updateItems(current.today),
              week: updateItems(current.week),
              deadlines: updateItems(current.deadlines),
            }
          : current
      );
      return { previous };
    },
    onError: (_error, _activityIds, context) => {
      context?.previous.forEach(([queryKey, data]) => queryClient.setQueryData(queryKey, data));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: activityKeys.all }),
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
