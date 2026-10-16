import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getCurrentPeriodKey } from '../lib/utils';

interface PeriodState {
  periodKey: string;
  // Current period at the time the selection was saved: lets us detect that a
  // new pay-cycle has started since the last visit and drop the stale selection
  lastKnownCurrent: string;
  setPeriodKey: (key: string) => void;
  // Called with the live period computed by the backend from the user's payday;
  // the local default-payday guess is only a placeholder until then
  syncLivePeriod: (live: string) => void;
}

export const usePeriodStore = create<PeriodState>()(
  persist(
    (set, get) => ({
      periodKey: getCurrentPeriodKey(),
      lastKnownCurrent: getCurrentPeriodKey(),
      setPeriodKey: (key: string) => set({ periodKey: key }),
      syncLivePeriod: (live: string) => {
        if (get().lastKnownCurrent !== live) {
          // New cycle since last visit (or first real answer): open on current period
          set({ periodKey: live, lastKnownCurrent: live });
        }
      },
    }),
    {
      name: 'budget-period',
      partialize: (state) => ({ periodKey: state.periodKey, lastKnownCurrent: state.lastKnownCurrent }),
      merge: (persisted, current) => {
        const saved = persisted as Partial<PeriodState> | undefined;
        if (!saved?.periodKey || !saved.lastKnownCurrent) return current;
        return { ...current, ...saved };
      },
    }
  )
);
