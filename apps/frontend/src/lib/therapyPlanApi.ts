import { fetchApi, ApiError } from './api';
import { useAuthStore } from '../stores/authStore';
import type {
  CreateMilestoneAttachmentDTO,
  CreateMilestoneDTO,
  CreateTitrationStepDTO,
  MilestoneAttachmentDTO,
  MilestoneDTO,
  SaveWeightDTO,
  ScheduleItemDTO,
  TherapyTrendsDTO,
  TitrationStepDTO,
  UpdateMilestoneDTO,
  WeightEntryDTO,
  WeightSummaryDTO,
} from '@budget/shared';

const API_BASE = import.meta.env.VITE_API_URL || '';

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

  // ---------- Attachments (referti) ----------

  getMilestoneAttachments: (milestoneId: string) =>
    fetchApi<MilestoneAttachmentDTO[]>(
      `/therapy-plan/milestones/${encodeURIComponent(milestoneId)}/attachments`
    ),

  uploadMilestoneAttachment: (milestoneId: string, data: CreateMilestoneAttachmentDTO) =>
    fetchApi<MilestoneAttachmentDTO>(
      `/therapy-plan/milestones/${encodeURIComponent(milestoneId)}/attachments`,
      { method: 'POST', body: JSON.stringify(data) }
    ),

  setAttachmentInExport: (attachmentId: string, includeInExport: boolean) =>
    fetchApi<MilestoneAttachmentDTO>(
      `/therapy-plan/attachments/${encodeURIComponent(attachmentId)}`,
      { method: 'PATCH', body: JSON.stringify({ includeInExport }) }
    ),

  removeAttachment: (attachmentId: string) =>
    fetchApi<void>(`/therapy-plan/attachments/${encodeURIComponent(attachmentId)}`, {
      method: 'DELETE',
    }),

  /**
   * Not fetchApi: the response is a file, not JSON, and the endpoint needs the
   * same Authorization header as everything else - so it goes through fetch
   * the same way the exports do
   */
  downloadAttachment: async (attachmentId: string, fileName: string): Promise<void> => {
    const token = useAuthStore.getState().token;
    const response = await fetch(
      `${API_BASE}/api/therapy-plan/attachments/${encodeURIComponent(attachmentId)}/file`,
      {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: 'include',
      }
    );
    if (!response.ok) {
      throw new ApiError('Errore durante il download del file', 'DOWNLOAD_ERROR');
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  },

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
