import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { ratingsApi } from '../lib/ratingApi';
import type {
  CreateRatingDefinitionDTO,
  RatingEntryDTO,
  SetRatingDTO,
  UpdateRatingDefinitionDTO,
} from '@budget/shared';

// "food" prefix again: the votes live in the diary, so any diary mutation
// refreshes them along with everything else
export const ratingQueryKeys = {
  definitions: ['foodRatings'] as const,
  entries: (from?: string, to?: string) =>
    ['foodRatingEntries', from ?? 'all', to ?? 'all'] as const,
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

// ---------- Votes ----------

export function useRatingEntries(from?: string, to?: string) {
  return useQuery({
    queryKey: ratingQueryKeys.entries(from, to),
    queryFn: () => ratingsApi.getEntries(from, to),
  });
}

/**
 * The visible range is passed in so the answer can be written straight into
 * that cache entry: tapping a box must light up immediately, not after a
 * refetch round trip.
 */
export function useSetRating(from?: string, to?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: SetRatingDTO) => ratingsApi.setEntry(data),
    onSuccess: (entry, variables) => {
      queryClient.setQueryData<RatingEntryDTO[]>(
        ratingQueryKeys.entries(from, to),
        (previous) => {
          const others = (previous ?? []).filter(
            (item) => !(item.date === variables.date && item.ratingKey === variables.ratingKey)
          );
          return entry ? [...others, entry] : others;
        }
      );
      invalidateFoodData(queryClient);
    },
  });
}

export function useDeleteRatingEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ date, ratingKey }: { date: string; ratingKey: string }) =>
      ratingsApi.removeEntry(date, ratingKey),
    onSuccess: () => invalidateFoodData(queryClient),
  });
}
