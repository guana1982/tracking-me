import type { TricountType } from '@budget/shared';

/**
 * Apply a Tricount selection without repeatedly halving the displayed amount.
 * The stored amount is the user's share while IO/FRA is selected; returning to
 * "No" restores the original full amount.
 */
export function amountForTricountTransition(
  amount: number,
  previousType: TricountType | null,
  nextType: TricountType | null
): number {
  if (previousType === null && nextType !== null) return amount / 2;
  if (previousType !== null && nextType === null) return amount * 2;
  return amount;
}
