import { describe, expect, it } from 'vitest';
import { amountForTricountTransition } from './expense-amount.js';

describe('amountForTricountTransition', () => {
  it('halves an expense only when Tricount is enabled for the first time', () => {
    expect(amountForTricountTransition(8.93, null, 'IO')).toBe(4.465);
    expect(amountForTricountTransition(8.93, null, 'FRA')).toBe(4.465);
  });

  it('does not divide again when changing from Io to Fra or vice versa', () => {
    expect(amountForTricountTransition(4.465, 'IO', 'FRA')).toBe(4.465);
    expect(amountForTricountTransition(4.465, 'FRA', 'IO')).toBe(4.465);
  });

  it('restores the full amount when returning to No', () => {
    expect(amountForTricountTransition(4.465, 'IO', null)).toBe(8.93);
    expect(amountForTricountTransition(4.465, 'FRA', null)).toBe(8.93);
  });

  it('leaves the amount unchanged when the selection does not change', () => {
    expect(amountForTricountTransition(8.93, null, null)).toBe(8.93);
    expect(amountForTricountTransition(4.465, 'IO', 'IO')).toBe(4.465);
  });
});
