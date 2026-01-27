import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getCurrentPeriodKey } from '../lib/utils';

interface PeriodState {
  periodKey: string;
  setPeriodKey: (key: string) => void;
}

export const usePeriodStore = create<PeriodState>()(
  persist(
    (set) => ({
      periodKey: getCurrentPeriodKey(),
      setPeriodKey: (key: string) => set({ periodKey: key }),
    }),
    {
      name: 'budget-period',
    }
  )
);
