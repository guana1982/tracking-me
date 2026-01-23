import { useState, useEffect, useCallback } from 'react';
import { getCurrentPeriodKey } from '../lib/utils';

export function usePeriodStore() {
  const [periodKey, setPeriodKeyState] = useState(getCurrentPeriodKey());

  const setPeriodKey = useCallback((key: string) => {
    setPeriodKeyState(key);
    // Save to localStorage for persistence
    localStorage.setItem('budget-period', key);
  }, []);

  useEffect(() => {
    // Restore from localStorage
    const saved = localStorage.getItem('budget-period');
    if (saved) {
      setPeriodKeyState(saved);
    }
  }, []);

  return { periodKey, setPeriodKey };
}
