import type {
  ActivityDTO,
  ActivityOverviewDTO,
  ActivityTypeDTO,
  CreateActivityDTO,
  CreateActivityTypeDTO,
  UpdateActivityDTO,
  UpdateActivityTypeDTO,
} from '@budget/shared';
import { fetchApi } from './api';

export const activitiesApi = {
  getOverview: (date: string) =>
    fetchApi<ActivityOverviewDTO>(`/activities/overview?date=${encodeURIComponent(date)}`),

  create: (data: CreateActivityDTO) =>
    fetchApi<ActivityDTO>('/activities', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: UpdateActivityDTO) =>
    fetchApi<ActivityDTO>(`/activities/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  remove: (id: string) =>
    fetchApi<void>(`/activities/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  getTypes: () => fetchApi<ActivityTypeDTO[]>('/activities/types'),

  installDefaultTypes: () =>
    fetchApi<ActivityTypeDTO[]>('/activities/types/defaults', { method: 'POST' }),

  createType: (data: CreateActivityTypeDTO) =>
    fetchApi<ActivityTypeDTO>('/activities/types', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateType: (key: string, data: UpdateActivityTypeDTO) =>
    fetchApi<ActivityTypeDTO>(`/activities/types/${encodeURIComponent(key)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  removeType: (key: string) =>
    fetchApi<void>(`/activities/types/${encodeURIComponent(key)}`, { method: 'DELETE' }),
};
