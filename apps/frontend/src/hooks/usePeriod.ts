import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getCurrentPeriodKey } from '../lib/utils';

interface PeriodState {
  periodKey: string;
  // Current period at the time the selection was saved: lets us detect that a
  // new pay-cycle has started since the last visit and drop the stale selection
  lastKnownCurrent: string;
  setPeriodKey: (key: string) => void;
}

export const usePeriodStore = create<PeriodState>()(
  persist(
    (set) => ({
      periodKey: getCurrentPeriodKey(),
      lastKnownCurrent: getCurrentPeriodKey(),
      setPeriodKey: (key: string) =>
        set({ periodKey: key, lastKnownCurrent: getCurrentPeriodKey() }),
    }),
    {
      name: 'budget-period',
      merge: (persisted, current) => {
        const saved = persisted as Partial<PeriodState> | undefined;
        const live = getCurrentPeriodKey();
        if (!saved?.periodKey || saved.lastKnownCurrent !== live) {
          // New cycle since last visit (or nothing saved): open on current period
          return { ...current, periodKey: live, lastKnownCurrent: live };
        }
        return { ...current, ...saved };
      },
    }
  )
);
