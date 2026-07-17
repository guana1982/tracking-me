import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Download, Loader2, RefreshCw, Info } from 'lucide-react';
import { foodDashboardApi } from '../lib/foodApi';
import { todayLocal, addDaysLocal } from '../lib/foodUtils';
import { useFoodOverview, useRecalculateQuickLogs } from '../hooks/useFoodQueries';
import { MonthCalendar } from '../components/food/MonthCalendar';
import { StateTimeline } from '../components/food/StateTimeline';
import { ComparisonPanel } from '../components/food/ComparisonPanel';
import { AssociationsPanel } from '../components/food/AssociationsPanel';
import { StatsPanel } from '../components/food/StatsPanel';
import { PeriodComparePanel } from '../components/food/PeriodComparePanel';

const MIN_DAYS_FOR_ANALYTICS = 7;

export function FoodTrends() {
  const [exportFrom, setExportFrom] = useState('');
  const [exportTo, setExportTo] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const to = todayLocal();
  const from = addDaysLocal(to, -89);
  const overview = useFoodOverview(from, to);
  const recalculate = useRecalculateQuickLogs();

  const trackedDays = overview.data?.totalTrackedDays ?? 0;
  const hasEnoughData = trackedDays >= MIN_DAYS_FOR_ANALYTICS;

  const supplementNames = useMemo(
    () => [...new Set((overview.data?.supplementPeriods ?? []).map((p) => p.name))],
    [overview.data]
  );

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2500);
  };

  const handleExport = async () => {
    setIsExporting(true);
    setExportError(null);
    try {
      await foodDashboardApi.downloadCsv(exportFrom || undefined, exportTo || undefined);
    } catch {
      setExportError("Errore durante l'export CSV.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleRecalculate = async () => {
    const result = await recalculate.mutateAsync();
    showToast(`Classificazioni ricalcolate: ${result.updated} note aggiornate`);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <Link to="/food" className="btn btn-secondary text-xs flex items-center gap-1.5">
          <ArrowLeft className="w-3.5 h-3.5" />
          Diario
        </Link>
        <button
          onClick={handleRecalculate}
          disabled={recalculate.isPending}
          className="btn btn-secondary text-xs flex items-center gap-1.5"
          title="Riapplica i dizionari di parole chiave a tutte le note"
        >
          {recalculate.isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
          Ricalcola classificazioni
        </button>
      </div>

      {/* Graceful degradation con pochi dati */}
      {!overview.isLoading && !hasEnoughData && (
        <div className="card flex items-start gap-2 text-sm text-slate-600">
          <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
          <p>
            Hai {trackedDays} {trackedDays === 1 ? 'giorno' : 'giorni'} di dati negli ultimi 90:
            per confronti e correlazioni affidabili ne servono almeno {MIN_DAYS_FOR_ANALYTICS}.
            Continua a registrare pasti e note — i grafici si popoleranno da soli.
          </p>
        </div>
      )}

      {/* 1. Calendario mensile a semaforo */}
      <MonthCalendar />

      {/* 2. Linea dello stato con eventi sovrapposti */}
      <StateTimeline />

      {/* 3. Confronto condizionato */}
      {hasEnoughData && <ComparisonPanel supplementNames={supplementNames} />}

      {/* 4. Alimenti associati alle sensazioni */}
      {hasEnoughData && <AssociationsPanel />}

      {/* 5-6. Andamento e top alimenti (ultimi 30 giorni) */}
      <StatsPanel from={addDaysLocal(to, -29)} to={to} title="Ultimi 30 giorni" />

      {/* 7. Confronto tra periodi */}
      {hasEnoughData && <PeriodComparePanel />}

      {/* Export CSV */}
      <div className="card">
        <h3 className="text-sm font-semibold text-slate-900 mb-1">Export CSV</h3>
        <p className="text-xs text-slate-400 mb-3">
          Una riga per alimento, note rapide intercalate (colonna record_type). Pensato per
          l'analisi a valle con un LLM. Senza date esporta tutto lo storico.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={exportFrom}
            onChange={(e) => setExportFrom(e.target.value)}
            className="input w-auto text-sm"
          />
          <span className="text-xs text-slate-400">→</span>
          <input
            type="date"
            value={exportTo}
            onChange={(e) => setExportTo(e.target.value)}
            className="input w-auto text-sm"
          />
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="btn btn-primary text-sm flex items-center gap-1.5"
          >
            {isExporting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            Esporta CSV
          </button>
        </div>
        {exportError && <p className="mt-2 text-xs text-red-600">{exportError}</p>}
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-20 sm:bottom-8 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-sm px-4 py-2 rounded-full shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
