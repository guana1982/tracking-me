import {
  MEAL_TYPE_LABELS,
  MEAL_ITEM_UNIT_LABELS,
  QUICK_LOG_CATEGORY_LABELS,
  QUICK_LOG_VALENCE_LABELS,
  defaultMealTypeForHour,
} from '@budget/shared';
import type {
  MealTypeDTO,
  MealItemUnitDTO,
  QuickLogCategoryDTO,
  QuickLogValenceDTO,
} from '@budget/shared';

// ---------- Labels (Italian UI) ----------

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function mealTypeLabel(mealType: MealTypeDTO): string {
  const label = MEAL_TYPE_LABELS[mealType as keyof typeof MEAL_TYPE_LABELS];
  return label ? capitalize(label) : mealType;
}

export function unitLabel(unit: MealItemUnitDTO): string {
  return MEAL_ITEM_UNIT_LABELS[unit];
}

export function quickLogCategoryLabel(category: QuickLogCategoryDTO): string {
  return capitalize(QUICK_LOG_CATEGORY_LABELS[category]);
}

export function quickLogValenceLabel(valence: QuickLogValenceDTO): string {
  return capitalize(QUICK_LOG_VALENCE_LABELS[valence]);
}

// ---------- Colors ----------

export function valenceColor(valence: QuickLogValenceDTO | null): {
  bg: string;
  text: string;
  border: string;
  dot: string;
} {
  switch (valence) {
    case 'POSITIVE':
      return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' };
    case 'NEGATIVE':
      return { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-500' };
    case 'NEUTRAL':
      return { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200', dot: 'bg-slate-400' };
    default:
      return { bg: 'bg-slate-50', text: 'text-slate-400', border: 'border-slate-200', dot: 'bg-slate-200' };
  }
}

export function categoryColor(category: QuickLogCategoryDTO | null): { bg: string; text: string } {
  switch (category) {
    case 'WORKOUT':
      return { bg: 'bg-sky-100', text: 'text-sky-700' };
    case 'SLEEP':
      return { bg: 'bg-violet-100', text: 'text-violet-700' };
    case 'SUPPLEMENT':
      return { bg: 'bg-amber-100', text: 'text-amber-700' };
    default:
      return { bg: 'bg-slate-100', text: 'text-slate-600' };
  }
}

/** Day-state score [-1, +1] -> semaphore color for the calendar/line */
export function dayStateColor(state: number | null): string {
  if (state === null) return 'bg-slate-100';
  if (state > 0.33) return 'bg-emerald-400';
  if (state >= -0.33) return 'bg-amber-300';
  return 'bg-red-400';
}

// ---------- Local dates ----------

export function todayLocal(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`;
}

export function addDaysLocal(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

/** Local YYYY-MM-DD of an ISO timestamp (for interleaving logs in the diary) */
export function localDateOf(isoTimestamp: string): string {
  const d = new Date(isoTimestamp);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

export function localTimeOf(isoTimestamp: string): string {
  const d = new Date(isoTimestamp);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function smartDefaultMealType(): MealTypeDTO {
  return defaultMealTypeForHour(new Date().getHours());
}

// ---------- Photo resize (client-side, max ~1280px JPEG) ----------

const PHOTO_MAX_SIDE = 1280;
const PHOTO_JPEG_QUALITY = 0.8;

export async function resizePhotoToDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, PHOTO_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas non disponibile');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', PHOTO_JPEG_QUALITY);
}
