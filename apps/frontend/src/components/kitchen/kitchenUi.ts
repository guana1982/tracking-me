import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import {
  formatKitchenQuantity,
  KITCHEN_CATEGORIES,
  type IngredientNeedDTO,
  type KitchenCategoryDTO,
  type KitchenUnitDTO,
} from '@budget/shared';

export function weekdayName(date: string): string {
  return format(parseISO(date), 'EEEE', { locale: it });
}

export function dayLabel(date: string, today: string): string {
  if (date === today) return 'oggi';
  const tomorrow = format(new Date(parseISO(today).getTime() + 86400000), 'yyyy-MM-dd');
  if (date === tomorrow) return 'domani';
  return weekdayName(date);
}

/** "uova (4 pz), pepe" */
export function needsLabel(needs: IngredientNeedDTO[], limit = 3): string {
  const shown = needs.slice(0, limit).map((need) => {
    const amount = formatKitchenQuantity(need.quantity, need.unit);
    return amount ? `${need.name} (${amount})` : need.name;
  });
  const rest = needs.length - shown.length;
  return rest > 0 ? `${shown.join(', ')} e altri ${rest}` : shown.join(', ');
}

/** Groups in aisle order, skipping the empty ones */
export function groupByCategory<T extends { category: KitchenCategoryDTO }>(items: T[]) {
  return KITCHEN_CATEGORIES.map((category) => ({
    category,
    items: items.filter((item) => item.category === category),
  })).filter((group) => group.items.length > 0);
}

/** One tap of +/- : a piece, a pack, or a sensible bit of the rest */
export function stepFor(unit: KitchenUnitDTO): number {
  switch (unit) {
    case 'g':
      return 100;
    case 'ml':
      return 250;
    case 'kg':
    case 'l':
      return 0.5;
    default:
      return 1;
  }
}
