import { fetchApi } from './api';
import type {
  CreateHabitDefinitionDTO,
  HabitDayDTO,
  HabitDefinitionDTO,
  HabitEntryDTO,
  SetHabitDTO,
  UpdateHabitDefinitionDTO,
} from '@budget/shared';

function buildQuery(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

// Habits the user tracks, and the answer given each day
export const habitsApi = {
  getAll: () => fetchApi<HabitDefinitionDTO[]>('/habits'),

  installDefaults: () => fetchApi<HabitDefinitionDTO[]>('/habits/defaults', { method: 'POST' }),

  create: (data: CreateHabitDefinitionDTO) =>
    fetchApi<HabitDefinitionDTO>('/habits', { method: 'POST', body: JSON.stringify(data) }),

  update: (key: string, data: UpdateHabitDefinitionDTO) =>
    fetchApi<HabitDefinitionDTO>(`/habits/${encodeURIComponent(key)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  remove: (key: string) =>
    fetchApi<void>(`/habits/${encodeURIComponent(key)}`, { method: 'DELETE' }),

  getDay: (date: string) => fetchApi<HabitDayDTO>(`/habits/day?date=${encodeURIComponent(date)}`),

  // Returns the refreshed day, so a tap never flashes back while refetching
  setEntry: (data: SetHabitDTO) =>
    fetchApi<HabitDayDTO>('/habits/day', { method: 'POST', body: JSON.stringify(data) }),

  getEntries: (from?: string, to?: string) =>
    fetchApi<HabitEntryDTO[]>(`/habits/entries${buildQuery({ from, to })}`),
};
