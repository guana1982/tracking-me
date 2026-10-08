import { useState } from 'react';
import { todayLocal, addDaysLocal } from '../../lib/foodUtils';
import { StatsPanel } from './StatsPanel';

/** Confronto tra due intervalli di date arbitrari, metriche affiancate */
export function PeriodComparePanel() {
  const today = todayLocal();
  const [fromA, setFromA] = useState(addDaysLocal(today, -59));
  const [toA, setToA] = useState(addDaysLocal(today, -30));
  const [fromB, setFromB] = useState(addDaysLocal(today, -29));
  const [toB, setToB] = useState(today);

  const validA = fromA <= toA;
  const validB = fromB <= toB;

  return (
    <div className="card">
      <h3 className="text-sm font-semibold text-slate-900 mb-3">Confronto tra periodi</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-medium text-slate-500 shrink-0">Periodo A</span>
            <input type="date" value={fromA} onChange={(e) => setFromA(e.target.value)} className="input text-xs" />
            <input type="date" value={toA} onChange={(e) => setToA(e.target.value)} className="input text-xs" />
          </div>
          {validA ? (
            <StatsPanel from={fromA} to={toA} compact />
          ) : (
            <p className="text-xs text-red-600">Intervallo non valido.</p>
          )}
        </div>
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-medium text-slate-500 shrink-0">Periodo B</span>
            <input type="date" value={fromB} onChange={(e) => setFromB(e.target.value)} className="input text-xs" />
            <input type="date" value={toB} onChange={(e) => setToB(e.target.value)} className="input text-xs" />
          </div>
          {validB ? (
            <StatsPanel from={fromB} to={toB} compact />
          ) : (
            <p className="text-xs text-red-600">Intervallo non valido.</p>
          )}
        </div>
      </div>
    </div>
  );
}
