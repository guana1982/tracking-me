import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { ratingsApi } from '../lib/ratingApi';
import type {
  CreateRatingDefinitionDTO,
  CreateRatingEntryDTO,
  RatingEntryDTO,
  UpdateRatingDefinitionDTO,
  UpdateRatingEntryDTO,
} from '@budget/shared';

// "food" prefix again: the votes live in the diary, so any diary mutation
// refreshes them along with everything else
export const ratingQueryKeys = {
  definitions: ['foodRatings'] as const,
  entries: (from?: string, to?: string) =>
    ['foodRatingEntries', from ?? 'all', to ?? 'all'] as const,
  triggers: ['foodRatingTriggers'] as const,
};

function invalidateFoodData(queryClient: QueryClient) {
  queryClient.invalidateQueries({
    predicate: (query) => String(query.queryKey[0]).startsWith('food'),
  });
}

// ---------- Characteristics ----------

export function useRatings() {
  return useQuery({
    queryKey: ratingQueryKeys.definitions,
    queryFn: ratingsApi.getAll,
  });
}

export function useCreateRating() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateRatingDefinitionDTO) => ratingsApi.create(data),
    onSuccess: () => invalidateFoodData(queryClient),
  });
}

export function useUpdateRating() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ key, data }: { key: string; data: UpdateRatingDefinitionDTO }) =>
      ratingsApi.update(key, data),
    onSuccess: () => invalidateFoodData(queryClient),
  });
}

export function useDeleteRating() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (key: string) => ratingsApi.remove(key),
    onSuccess: () => invalidateFoodData(queryClient),
  });
}

export function useInstallDefaultEvents() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => ratingsApi.installDefaultEvents(),
    onSuccess: () => invalidateFoodData(queryClient),
  });
}

/** Autocomplete source, and in time the ranking of the real triggers */
export function useTriggers(enabled = true) {
  return useQuery({
    queryKey: ratingQueryKeys.triggers,
    queryFn: ratingsApi.getTriggers,
    enabled,
  });
}

// ---------- Votes ----------

export function useRatingEntries(from?: string, to?: string) {
  return useQuery({
    queryKey: ratingQueryKeys.entries(from, to),
    queryFn: () => ratingsApi.getEntries(from, to),
  });
}

/**
 * The visible range is passed in so the new vote can be written straight into
 * that cache entry: the recap must show up in the timeline immediately, not
 * after a refetch round trip.
 */
export function useCreateRatingEntry(from?: string, to?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateRatingEntryDTO) => ratingsApi.createEntry(data),
    onSuccess: (entry) => {
      queryClient.setQueryData<RatingEntryDTO[]>(
        ratingQueryKeys.entries(from, to),
        (previous) => [...(previous ?? []), entry]
      );
      invalidateFoodData(queryClient);
    },
  });
}

/**
 * Corrections are written into every cached range that already holds the
 * vote, whatever week is on screen: an inline edit must not blink through
 * the old value while the list refetches. Nothing is ever injected into a
 * range that did not contain it.
 */
export function useUpdateRatingEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateRatingEntryDTO }) =>
      ratingsApi.updateEntry(id, data),
    onSuccess: (entry) => {
      queryClient.setQueriesData<RatingEntryDTO[]>(
        { queryKey: ['foodRatingEntries'] },
        (previous) =>
          previous?.map((item) => (item.id === entry.id ? entry : item))
      );
      invalidateFoodData(queryClient);
    },
  });
}

export function useDeleteRatingEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => ratingsApi.removeEntry(id),
    onSuccess: () => invalidateFoodData(queryClient),
  });
}
