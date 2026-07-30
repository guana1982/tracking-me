import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Download, Loader2, RefreshCw, Info } from 'lucide-react';
import { foodDashboardApi } from '../lib/foodApi';
import { todayLocal, addDaysLocal } from '../lib/foodUtils';
import { useFoodOverview, useRecalculateQuickLogs } from '../hooks/useFoodQueries';
import { MonthCalendar } from '../components/food/MonthCalendar';
import { StateTimeline } from '../components/food/StateTimeline';
import type { FoodTrack } from '../components/food/TrackToggle';
import { ComparisonPanel } from '../components/food/ComparisonPanel';
import { AssociationsPanel } from '../components/food/AssociationsPanel';
import { StatsPanel } from '../components/food/StatsPanel';
import { PeriodComparePanel } from '../components/food/PeriodComparePanel';
import { TherapyTrendsPanel } from '../components/therapy/TherapyTrendsPanel';

const MIN_DAYS_FOR_ANALYTICS = 7;

export function FoodTrends() {
  const [exportFrom, setExportFrom] = useState('');
  const [exportTo, setExportTo] = useState('');
  const [isExporting, setIsExporting] = useState<'csv' | 'ai' | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  // One source of truth for both the calendar and the timeline: switching in
  // either place keeps the two visualizations telling the same story
  const [track, setTrack] = useState<FoodTrack>('BOTH');

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
    setIsExporting('csv');
    setExportError(null);
    try {
      await foodDashboardApi.downloadCsv(exportFrom || undefined, exportTo || undefined);
    } catch {
      setExportError("Errore durante l'export CSV.");
    } finally {
      setIsExporting(null);
    }
  };

  const handleAiExport = async () => {
    setIsExporting('ai');
    setExportError(null);
    try {
      await foodDashboardApi.downloadAiPackage(exportFrom || undefined, exportTo || undefined);
    } catch {
      setExportError("Errore durante l'export per AI.");
    } finally {
      setIsExporting(null);
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

      {/* 1. Calendario mensile a semaforo (fisico + umore) */}
      <MonthCalendar track={track} onTrackChange={setTrack} />

      {/* 2. Linee dello stato con eventi sovrapposti */}
      <StateTimeline track={track} onTrackChange={setTrack} />

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

      {/* 3. Terapia: letture settimanali, mai giornaliere (§4.4) */}
      <TherapyTrendsPanel />

      {/* 4. Confronto condizionato */}
      {hasEnoughData && <ComparisonPanel supplementNames={supplementNames} />}

      {/* 5. Alimenti associati alle sensazioni */}
      {hasEnoughData && <AssociationsPanel />}

      {/* 6-7. Andamento e top alimenti (ultimi 30 giorni) */}
      <StatsPanel from={addDaysLocal(to, -29)} to={to} title="Ultimi 30 giorni" />

      {/* 8. Confronto tra periodi */}
      {hasEnoughData && <PeriodComparePanel />}

      {/* Data export */}
      <div className="card">
        <h3 className="text-sm font-semibold text-slate-900 mb-1">Esporta i dati</h3>
        <p className="text-xs text-slate-400 mb-3">
          Una riga per alimento, note fisiche e note di umore intercalate, più una riga di
          riepilogo per ogni giorno con i due punteggi separati (<code>body_state</code> e{' '}
          <code>mood_state</code>). La colonna <code>record_type</code> distingue i record
          (meal_item / quick_log / mood_log / day_summary). Senza date esporta tutto lo storico.
        </p>
        <div className="grid grid-cols-[1fr_auto_1fr] sm:flex items-center gap-2">
          <input
            type="date"
            value={exportFrom}
            onChange={(e) => setExportFrom(e.target.value)}
            className="input min-w-0 w-full sm:w-auto text-sm"
          />
          <span className="text-xs text-slate-400">→</span>
          <input
            type="date"
            value={exportTo}
            onChange={(e) => setExportTo(e.target.value)}
            className="input min-w-0 w-full sm:w-auto text-sm"
          />
        </div>
        <div className="grid sm:grid-cols-2 gap-2 mt-3">
          <button
            onClick={handleExport}
            disabled={isExporting !== null}
            className="btn btn-secondary min-h-11 text-sm flex items-center justify-center gap-1.5"
          >
            {isExporting === 'csv' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            Esporta CSV
          </button>
          <button
            onClick={handleAiExport}
            disabled={isExporting !== null}
            className="btn btn-primary min-h-11 text-sm flex items-center justify-center gap-1.5"
          >
            {isExporting === 'ai' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            Esporta per AI (.zip)
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Il pacchetto AI include CSV, dizionario dei campi, guida di interpretazione e prompt
          pronto all'uso. Estrai lo ZIP e carica tutti i file nella chat.
        </p>
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
