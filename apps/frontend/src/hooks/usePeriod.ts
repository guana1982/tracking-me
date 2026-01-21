import { create } from 'zustand';
import { getCurrentPeriodKey } from '../lib/utils';

interface PeriodState {
  currentPeriodKey: string;
  setCurrentPeriodKey: (periodKey: string) => void;
}

// Simple Zustand-like store without external dependency
let currentPeriodKey = getCurrentPeriodKey();
const listeners = new Set<() => void>();

export function usePeriod(): PeriodState {
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  const setCurrentPeriodKey = (periodKey: string) => {
    currentPeriodKey = periodKey;
    listeners.forEach((listener) => listener());
  };

  return {
    currentPeriodKey,
    setCurrentPeriodKey,
  };
}

// React hook with state
import { useState, useEffect, useCallback } from 'react';

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
