import type {
  CreateMealPlanEntryDTO,
  CreatePantryItemDTO,
  CreateRecipeDTO,
  CreateShoppingItemDTO,
  KitchenDayMarkDTO,
  KitchenWeekDTO,
  ShoppingItemDTO,
  UpdateMealPlanEntryDTO,
  UpdatePantryItemDTO,
  UpdateRecipeDTO,
  UpdateShoppingItemDTO,
} from '@budget/shared';
import { format } from 'date-fns';
import { fetchApi } from './api';

/** The device's today: the server's clock may already be on tomorrow */
function today(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

const id = (value: string) => encodeURIComponent(value);
const post = (body: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(body) });
const put = (body: unknown): RequestInit => ({ method: 'PUT', body: JSON.stringify(body) });
const remove: RequestInit = { method: 'DELETE' };

export const kitchenApi = {
  getWeek: (date: string) =>
    fetchApi<KitchenWeekDTO>(`/kitchen/week?date=${id(date)}&today=${today()}`),

  getMarks: (from: string, to: string) =>
    fetchApi<KitchenDayMarkDTO[]>(`/kitchen/marks?from=${id(from)}&to=${id(to)}&today=${today()}`),

  createPantryItem: (data: CreatePantryItemDTO) => fetchApi<{ id: string }>('/kitchen/pantry', post(data)),
  updatePantryItem: (itemId: string, data: UpdatePantryItemDTO) =>
    fetchApi<void>(`/kitchen/pantry/${id(itemId)}`, put(data)),
  adjustPantryItem: (itemId: string, delta: number) =>
    fetchApi<void>(`/kitchen/pantry/${id(itemId)}/adjust`, post({ delta })),
  deletePantryItem: (itemId: string) => fetchApi<void>(`/kitchen/pantry/${id(itemId)}`, remove),

  createShoppingItem: (data: CreateShoppingItemDTO) => fetchApi<ShoppingItemDTO>('/kitchen/shopping', post(data)),
  updateShoppingItem: (itemId: string, data: UpdateShoppingItemDTO) =>
    fetchApi<ShoppingItemDTO>(`/kitchen/shopping/${id(itemId)}`, put(data)),
  deleteShoppingItem: (itemId: string) => fetchApi<void>(`/kitchen/shopping/${id(itemId)}`, remove),
  addMissingToList: (date: string) =>
    fetchApi<{ added: number }>('/kitchen/shopping/add-missing', post({ date, today: today() })),
  clearChecked: (date: string) => fetchApi<{ removed: number }>('/kitchen/shopping/clear-checked', post({ date })),
  copyPreviousList: (date: string) => fetchApi<{ added: number }>('/kitchen/shopping/copy-previous', post({ date })),

  createRecipe: (data: CreateRecipeDTO) => fetchApi<{ id: string }>('/kitchen/recipes', post(data)),
  updateRecipe: (recipeId: string, data: UpdateRecipeDTO) =>
    fetchApi<void>(`/kitchen/recipes/${id(recipeId)}`, put(data)),
  deleteRecipe: (recipeId: string) => fetchApi<void>(`/kitchen/recipes/${id(recipeId)}`, remove),

  createPlanEntry: (data: CreateMealPlanEntryDTO) => fetchApi<{ id: string }>('/kitchen/plan', post(data)),
  updatePlanEntry: (entryId: string, data: UpdateMealPlanEntryDTO) =>
    fetchApi<void>(`/kitchen/plan/${id(entryId)}`, put(data)),
  deletePlanEntry: (entryId: string) => fetchApi<void>(`/kitchen/plan/${id(entryId)}`, remove),
  copyPreviousPlan: (date: string) => fetchApi<{ added: number }>('/kitchen/plan/copy-previous', post({ date })),
};
