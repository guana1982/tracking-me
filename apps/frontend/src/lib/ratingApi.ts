import { fetchApi } from './api';
import type {
  CreateRatingDefinitionDTO,
  CreateRatingEntryDTO,
  RatingDefinitionDTO,
  RatingEntryDTO,
  UpdateRatingDefinitionDTO,
} from '@budget/shared';

function buildQuery(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

// Characteristics rated daily in the diary, and the votes given on them
export const ratingsApi = {
  getAll: () => fetchApi<RatingDefinitionDTO[]>('/ratings'),

  create: (data: CreateRatingDefinitionDTO) =>
    fetchApi<RatingDefinitionDTO>('/ratings', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (key: string, data: UpdateRatingDefinitionDTO) =>
    fetchApi<RatingDefinitionDTO>(`/ratings/${encodeURIComponent(key)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  remove: (key: string) =>
    fetchApi<void>(`/ratings/${encodeURIComponent(key)}`, { method: 'DELETE' }),

  getEntries: (from?: string, to?: string) =>
    fetchApi<RatingEntryDTO[]>(`/ratings/entries${buildQuery({ from, to })}`),

  createEntry: (data: CreateRatingEntryDTO) =>
    fetchApi<RatingEntryDTO>('/ratings/entries', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  removeEntry: (id: string) =>
    fetchApi<void>(`/ratings/entries/${encodeURIComponent(id)}`, { method: 'DELETE' }),
};
