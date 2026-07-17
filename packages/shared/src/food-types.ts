import type {
  MealTypeDTO,
  MealItemUnitDTO,
  QuickLogCategoryDTO,
  QuickLogValenceDTO,
} from './food-dictionaries';

// ============================================================
// Food Diary module - DTOs (isolated domain)
// ============================================================

// ---------- Meals ----------

export interface MealItemDTO {
  id: string;
  foodName: string;
  quantity: number | null;
  unit: MealItemUnitDTO | null;
  position: number;
}

export interface MealDTO {
  id: string;
  date: string; // YYYY-MM-DD
  mealType: MealTypeDTO;
  notes: string | null;
  hasPhoto: boolean;
  createdAt: string; // ISO datetime - proxy for the meal time (used for linking/late-dinner)
  items: MealItemDTO[];
}

export interface CreateMealItemDTO {
  foodName: string;
  quantity?: number | null;
  unit?: MealItemUnitDTO | null;
}

// Photo travels as a resized base64 data URL (client resizes to ~1280px JPEG)
export interface MealPhotoUploadDTO {
  dataUrl: string;
}

export interface MealPhotoDTO {
  mealId: string;
  dataUrl: string;
}

export interface CreateMealDTO {
  date: string;
  mealType: MealTypeDTO;
  notes?: string;
  items: CreateMealItemDTO[];
  photo?: MealPhotoUploadDTO | null;
}

// photo: undefined = untouched, null = remove, object = replace
export interface UpdateMealDTO {
  date?: string;
  mealType?: MealTypeDTO;
  notes?: string | null;
  items?: CreateMealItemDTO[];
  photo?: MealPhotoUploadDTO | null;
}

// Autocomplete entry built from the user's own meal_items history
export interface FoodSuggestionDTO {
  foodName: string;
  count: number; // frequency of use
  lastUsedAt: string; // ISO date of last use
  lastQuantity: number | null; // prefill values from the most recent use
  lastUnit: MealItemUnitDTO | null;
}

// "Ripeti ieri" prefill: items of yesterday's meal of the same type (null = none)
export interface RepeatMealDTO {
  date: string;
  mealType: MealTypeDTO;
  notes: string | null;
  items: CreateMealItemDTO[];
}

// Frequent meal: recurring identical set of items, offered as prefill base
export interface FrequentMealDTO {
  signature: string; // normalized item-set key
  count: number;
  mealType: MealTypeDTO;
  lastDate: string;
  items: CreateMealItemDTO[];
}

// ---------- Quick logs ----------

export interface QuickLogLinkedMealDTO {
  id: string;
  date: string;
  mealType: MealTypeDTO;
}

export interface QuickLogDTO {
  id: string;
  loggedAt: string; // ISO datetime
  text: string;
  linkedMeal: QuickLogLinkedMealDTO | null;
  derivedCategory: QuickLogCategoryDTO | null;
  derivedValence: QuickLogValenceDTO | null;
  categoryManual: boolean;
  valenceManual: boolean;
}

export interface CreateQuickLogDTO {
  text: string;
  loggedAt?: string; // only when the user explicitly overrides the timestamp
}

// Manual category/valence corrections set the *Manual flags server-side
export interface UpdateQuickLogDTO {
  text?: string;
  derivedCategory?: QuickLogCategoryDTO;
  derivedValence?: QuickLogValenceDTO;
}

export interface RecalculateQuickLogsResultDTO {
  updated: number;
  total: number;
}

// ---------- Dashboard (andamento e correlazioni) ----------

export interface FoodDayOverviewDTO {
  date: string; // YYYY-MM-DD
  mealCount: number;
  hasMeals: boolean;
  dayState: number | null; // avg valence in [-1, +1]; null = no logs attributed to the day
  workoutPresent: boolean;
  workoutValence: QuickLogValenceDTO | null;
  sleepValence: QuickLogValenceDTO | null;
  dinnerAfter21: boolean;
}

export interface SupplementPeriodDTO {
  name: string;
  startDate: string;
  endDate: string | null; // null = still running
}

export interface FoodOverviewDTO {
  from: string;
  to: string;
  days: FoodDayOverviewDTO[];
  supplementPeriods: SupplementPeriodDTO[];
  totalTrackedDays: number; // days having meals or logs, for graceful degradation
}

export type FoodComparisonConditionDTO =
  | 'WORKOUT'
  | 'DINNER_AFTER_21'
  | 'FOOD'
  | 'SUPPLEMENT_PERIOD';

export interface FoodComparisonGroupDTO {
  label: string;
  days: number; // group size, always shown in UI
  avgState: number | null;
  avgSleepValence: number | null;
  avgFeelingValence: number | null;
}

export interface FoodComparisonDTO {
  condition: FoodComparisonConditionDTO;
  conditionValue: string | null; // food name or supplement name when applicable
  withGroup: FoodComparisonGroupDTO;
  withoutGroup: FoodComparisonGroupDTO;
  minReliableDays: number;
  lowReliability: boolean; // true when either group is below the threshold
}

export interface FoodAssociationEntryDTO {
  foodName: string;
  count: number; // occurrences, never percentages (small data honesty)
}

export interface FoodAssociationsDTO {
  positive: FoodAssociationEntryDTO[];
  negative: FoodAssociationEntryDTO[];
  linkedFeelingLogs: number; // sample size the ranking is built on
}

export interface FoodTopFoodDTO {
  foodName: string;
  count: number;
}

export interface FoodStatsDTO {
  from: string;
  to: string;
  totalDays: number;
  daysWithMeals: number;
  mealsPerDay: { date: string; count: number }[];
  avgLunchTime: string | null; // HH:mm from meal insertion time
  avgDinnerTime: string | null;
  workoutCount: number;
  sleepPositive: number;
  sleepNegative: number;
  feelingPositive: number;
  feelingNegative: number;
  avgDayState: number | null;
  topFoods: FoodTopFoodDTO[];
}
