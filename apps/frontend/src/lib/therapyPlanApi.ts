import { fetchApi } from './api';
import type {
  CreateMilestoneDTO,
  CreateTitrationStepDTO,
  MilestoneDTO,
  SaveWeightDTO,
  ScheduleItemDTO,
  TherapyTrendsDTO,
  TitrationStepDTO,
  UpdateMilestoneDTO,
  WeightEntryDTO,
  WeightSummaryDTO,
} from '@budget/shared';

// The parts of the therapy that live on a calendar, plus the weekly reading
export const therapyPlanApi = {
  getTitration: () => fetchApi<TitrationStepDTO[]>('/therapy-plan/titration'),

  createTitrationStep: (data: CreateTitrationStepDTO) =>
    fetchApi<TitrationStepDTO>('/therapy-plan/titration', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  applyTitrationStep: (id: string) =>
    fetchApi<TitrationStepDTO>(`/therapy-plan/titration/${encodeURIComponent(id)}/apply`, {
      method: 'POST',
    }),

  removeTitrationStep: (id: string) =>
    fetchApi<void>(`/therapy-plan/titration/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  getMilestones: () => fetchApi<MilestoneDTO[]>('/therapy-plan/milestones'),

  getAdvisories: () => fetchApi<string[]>('/therapy-plan/milestones/advisories'),

  createMilestone: (data: CreateMilestoneDTO) =>
    fetchApi<MilestoneDTO>('/therapy-plan/milestones', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateMilestone: (id: string, data: UpdateMilestoneDTO) =>
    fetchApi<MilestoneDTO>(`/therapy-plan/milestones/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  removeMilestone: (id: string) =>
    fetchApi<void>(`/therapy-plan/milestones/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  getSchedule: () => fetchApi<ScheduleItemDTO[]>('/therapy-plan/schedule'),

  getWeight: () => fetchApi<WeightSummaryDTO>('/therapy-plan/weight'),

  saveWeight: (data: SaveWeightDTO) =>
    fetchApi<WeightEntryDTO>('/therapy-plan/weight', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  removeWeight: (id: string) =>
    fetchApi<void>(`/therapy-plan/weight/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  getTrends: (from?: string, to?: string) => {
    const search = new URLSearchParams();
    if (from) search.set('from', from);
    if (to) search.set('to', to);
    const qs = search.toString();
    return fetchApi<TherapyTrendsDTO>(`/therapy-plan/trends${qs ? `?${qs}` : ''}`);
  },
};
