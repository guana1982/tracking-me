import { fetchApi, ApiError } from './api';
import { useAuthStore } from '../stores/authStore';
import type {
  MealDTO,
  CreateMealDTO,
  UpdateMealDTO,
  MealPhotoDTO,
  FoodSuggestionDTO,
  RepeatMealDTO,
  FrequentMealDTO,
  MealTypeDTO,
  MealTypeDefinitionDTO,
  CreateMealTypeDefinitionDTO,
  UpdateMealTypeDefinitionDTO,
  MealUnitDefinitionDTO,
  CreateMealUnitDefinitionDTO,
  UpdateMealUnitDefinitionDTO,
  MoodDefinitionDTO,
  CreateMoodDefinitionDTO,
  UpdateMoodDefinitionDTO,
  QuickLogDTO,
  CreateQuickLogDTO,
  UpdateQuickLogDTO,
  RecalculateQuickLogsResultDTO,
  FoodOverviewDTO,
  FoodComparisonDTO,
  FoodComparisonConditionDTO,
  FoodAssociationsDTO,
  FoodStatsDTO,
} from '@budget/shared';

const API_BASE = import.meta.env.VITE_API_URL || '';

// Minutes to add to UTC to get the user's local time (Italy summer = +120)
export function tzOffsetMinutes(): number {
  return -new Date().getTimezoneOffset();
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

// Meals
export const mealsApi = {
  getByRange: (from?: string, to?: string) =>
    fetchApi<MealDTO[]>(`/meals${buildQuery({ from, to })}`),

  create: (data: CreateMealDTO) =>
    fetchApi<MealDTO>('/meals', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: string, data: UpdateMealDTO) =>
    fetchApi<MealDTO>(`/meals/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  remove: (id: string) => fetchApi<void>(`/meals/${id}`, { method: 'DELETE' }),

  getSuggestions: (q: string) =>
    fetchApi<FoodSuggestionDTO[]>(`/meals/suggestions${buildQuery({ q })}`),

  getRepeatYesterday: (date: string, mealType: MealTypeDTO) =>
    fetchApi<RepeatMealDTO | null>(
      `/meals/repeat-yesterday${buildQuery({ date, mealType })}`
    ),

  getFrequent: () => fetchApi<FrequentMealDTO[]>('/meals/frequent'),

  getPhoto: (id: string) => fetchApi<MealPhotoDTO>(`/meals/${id}/photo`),
};

export const mealTypesApi = {
  getAll: () => fetchApi<MealTypeDefinitionDTO[]>('/meal-types'),
  create: (data: CreateMealTypeDefinitionDTO) =>
    fetchApi<MealTypeDefinitionDTO>('/meal-types', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (key: string, data: UpdateMealTypeDefinitionDTO) =>
    fetchApi<MealTypeDefinitionDTO>(`/meal-types/${encodeURIComponent(key)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
};

export const moodsApi = {
  getAll: () => fetchApi<MoodDefinitionDTO[]>('/moods'),
  create: (data: CreateMoodDefinitionDTO) =>
    fetchApi<MoodDefinitionDTO>('/moods', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (key: string, data: UpdateMoodDefinitionDTO) =>
    fetchApi<MoodDefinitionDTO>(`/moods/${encodeURIComponent(key)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  remove: (key: string) =>
    fetchApi<void>(`/moods/${encodeURIComponent(key)}`, { method: 'DELETE' }),
};

export const mealUnitsApi = {
  getAll: () => fetchApi<MealUnitDefinitionDTO[]>('/meal-units'),
  create: (data: CreateMealUnitDefinitionDTO) =>
    fetchApi<MealUnitDefinitionDTO>('/meal-units', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (key: string, data: UpdateMealUnitDefinitionDTO) =>
    fetchApi<MealUnitDefinitionDTO>(`/meal-units/${encodeURIComponent(key)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
};

// Quick logs
export const quickLogsApi = {
  getByRange: (from?: string, to?: string) =>
    fetchApi<QuickLogDTO[]>(`/quick-logs${buildQuery({ from, to })}`),

  create: (data: CreateQuickLogDTO) =>
    fetchApi<QuickLogDTO>('/quick-logs', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: string, data: UpdateQuickLogDTO) =>
    fetchApi<QuickLogDTO>(`/quick-logs/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  remove: (id: string) => fetchApi<void>(`/quick-logs/${id}`, { method: 'DELETE' }),

  recalculate: () =>
    fetchApi<RecalculateQuickLogsResultDTO>('/quick-logs/recalculate', { method: 'POST' }),
};

// Dashboard (trends/correlations) + CSV export
export const foodDashboardApi = {
  getOverview: (from: string, to: string) =>
    fetchApi<FoodOverviewDTO>(
      `/food-dashboard/overview${buildQuery({ from, to, tzOffset: tzOffsetMinutes() })}`
    ),

  getComparison: (
    condition: FoodComparisonConditionDTO,
    value: string | undefined,
    from: string,
    to: string
  ) =>
    fetchApi<FoodComparisonDTO>(
      `/food-dashboard/comparison${buildQuery({ condition, value, from, to, tzOffset: tzOffsetMinutes() })}`
    ),

  getAssociations: (from: string, to: string) =>
    fetchApi<FoodAssociationsDTO>(
      `/food-dashboard/associations${buildQuery({ from, to, tzOffset: tzOffsetMinutes() })}`
    ),

  getStats: (from: string, to: string) =>
    fetchApi<FoodStatsDTO>(
      `/food-dashboard/stats${buildQuery({ from, to, tzOffset: tzOffsetMinutes() })}`
    ),

  // Raw text/csv download (outside the JSON envelope): fetch with the token,
  // then trigger a browser download from the blob
  downloadCsv: async (from?: string, to?: string): Promise<void> => {
    const token = useAuthStore.getState().token;
    const qs = buildQuery({ from, to, tzOffset: tzOffsetMinutes() });
    const response = await fetch(`${API_BASE}/api/food-dashboard/export.csv${qs}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: 'include',
    });
    if (!response.ok) {
      throw new ApiError("Errore durante l'export CSV", 'EXPORT_ERROR');
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'diario-alimentare.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  },

  downloadAiPackage: async (from?: string, to?: string): Promise<void> => {
    const token = useAuthStore.getState().token;
    const qs = buildQuery({ from, to, tzOffset: tzOffsetMinutes() });
    const response = await fetch(`${API_BASE}/api/food-dashboard/export-ai.zip${qs}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: 'include',
    });
    if (!response.ok) {
      throw new ApiError("Errore durante l'export per AI", 'EXPORT_ERROR');
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'diario-alimentare-ai.zip';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  },
};
