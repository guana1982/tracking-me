import { fetchApi } from './api';
import type {
  CheckInDayDTO,
  CheckInEntryDTO,
  CheckInScaleDTO,
  CreateCheckInScaleDTO,
  CreateTreatmentDefinitionDTO,
  DayIntakesDTO,
  SaveCheckInDTO,
  SetIntakeDTO,
  TreatmentDefinitionDTO,
  UpdateCheckInScaleDTO,
  UpdateTreatmentDefinitionDTO,
} from '@budget/shared';

// Things taken daily (medication, supplements, anything on a schedule)
export const treatmentsApi = {
  getAll: () => fetchApi<TreatmentDefinitionDTO[]>('/treatments'),

  create: (data: CreateTreatmentDefinitionDTO) =>
    fetchApi<TreatmentDefinitionDTO>('/treatments', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (key: string, data: UpdateTreatmentDefinitionDTO) =>
    fetchApi<TreatmentDefinitionDTO>(`/treatments/${encodeURIComponent(key)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  remove: (key: string) =>
    fetchApi<void>(`/treatments/${encodeURIComponent(key)}`, { method: 'DELETE' }),

  getDay: (date: string) =>
    fetchApi<DayIntakesDTO>(`/treatments/day?date=${encodeURIComponent(date)}`),

  setIntakes: (entries: SetIntakeDTO[]) =>
    fetchApi<DayIntakesDTO>('/treatments/day', {
      method: 'POST',
      body: JSON.stringify({ entries }),
    }),
};

// Daily self-report on user-defined scales
export const checkInApi = {
  getScales: () => fetchApi<CheckInScaleDTO[]>('/check-in/scales'),

  installDefaults: () =>
    fetchApi<CheckInScaleDTO[]>('/check-in/scales/defaults', { method: 'POST' }),

  createScale: (data: CreateCheckInScaleDTO) =>
    fetchApi<CheckInScaleDTO>('/check-in/scales', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateScale: (key: string, data: UpdateCheckInScaleDTO) =>
    fetchApi<CheckInScaleDTO>(`/check-in/scales/${encodeURIComponent(key)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  removeScale: (key: string) =>
    fetchApi<void>(`/check-in/scales/${encodeURIComponent(key)}`, { method: 'DELETE' }),

  getDay: (date: string) => fetchApi<CheckInDayDTO>(`/check-in/day?date=${encodeURIComponent(date)}`),

  save: (data: SaveCheckInDTO) =>
    fetchApi<CheckInEntryDTO>('/check-in/day', { method: 'POST', body: JSON.stringify(data) }),

  removeDay: (date: string) =>
    fetchApi<void>(`/check-in/day/${encodeURIComponent(date)}`, { method: 'DELETE' }),
};
