import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  ComposedChart,
  Line,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { cn } from '../../lib/utils';
import { todayLocal, addDaysLocal, BODY_LINE_COLOR, MOOD_LINE_COLOR } from '../../lib/foodUtils';
import { useFoodOverview } from '../../hooks/useFoodQueries';
import { TrackToggle, type FoodTrack } from './TrackToggle';

const BAND_COLORS = ['#fde68a', '#bae6fd', '#ddd6fe', '#bbf7d0', '#fecaca'];

interface DayRow {
  date: string;
  shortDate: string;
  state: number | null;
  mood: number | null;
  workout: number | null;
  lateDinner: number | null;
  events: number | null;
  eventCount: number;
  skipped: number | null;
  skippedIntakes: number;
  doseChange: string | null;
  weightKg: number | null;
}

interface StateTimelineProps {
  track: FoodTrack;
  onTrackChange: (track: FoodTrack) => void;
}

/**
 * Linee dello stato del giorno con eventi sovrapposti: condizione fisica e
 * umore su tracce separate, marker allenamento, cene dopo le 21 e bande
 * orizzontali per i periodi integratore.
 */
export function StateTimeline({ track, onTrackChange }: StateTimelineProps) {
  const [days, setDays] = useState<30 | 90>(30);
  const to = todayLocal();
  const from = addDaysLocal(to, -(days - 1));
  const overview = useFoodOverview(from, to);

  const showBody = track === 'BOTH' || track === 'BODY';
  const showMood = track === 'BOTH' || track === 'MOOD';

  const data: DayRow[] = (overview.data?.days ?? []).map((day) => ({
    date: day.date,
    shortDate: day.date.slice(8) + '/' + day.date.slice(5, 7),
    state: day.dayState,
    mood: day.moodState,
    workout: day.workoutPresent ? 1.15 : null,
    lateDinner: day.dinnerAfter21 ? -1.15 : null,
    // Facts with no valence of their own, placed on their own rows so they
    // never look like a judgement of the day
    events: day.eventCount > 0 ? -1.25 : null,
    eventCount: day.eventCount,
    skipped: day.skippedIntakes > 0 ? 1.25 : null,
    skippedIntakes: day.skippedIntakes,
    doseChange: day.doseChanges.length > 0 ? day.doseChanges.join(', ') : null,
    weightKg: day.weightKg,
  }));

  const periods = overview.data?.supplementPeriods ?? [];
  const hasAnyState = data.some(
    (d) => (showBody && d.state !== null) || (showMood && d.mood !== null)
  );

  return (
    <div className="card">
      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
        <h3 className="text-sm font-semibold text-slate-900">Stato del giorno nel tempo</h3>
        <TrackToggle value={track} onChange={onTrackChange} />
        <div className="flex gap-1">
          {([30, 90] as const).map((option) => (
            <button
              key={option}
              onClick={() => setDays(option)}
              className={cn(
                'px-2.5 py-1 text-xs font-medium rounded-full transition-colors',
                days === option
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              )}
            >
              {option} gg
            </button>
          ))}
        </div>
      </div>

      {overview.isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
        </div>
      ) : !hasAnyState ? (
        <p className="text-sm text-slate-500 py-6 text-center">
          {track === 'MOOD'
            ? 'Nessun umore registrato nel periodo: votalo dal diario, o aprilo da «Stati d’umore».'
            : "Nessun dato nel periodo: la linea appare con i voti, gli episodi, il check-in e le note del diario."}
        </p>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -28 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="shortDate"
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                interval="preserveStartEnd"
                minTickGap={24}
              />
              <YAxis domain={[-1.3, 1.3]} ticks={[-1, 0, 1]} tick={{ fontSize: 10, fill: '#94a3b8' }} />
              {periods.map((period, index) => (
                <ReferenceArea
                  key={`${period.name}-${period.startDate}`}
                  x1={data.find((d) => d.date >= period.startDate)?.shortDate}
                  x2={
                    period.endDate
                      ? [...data].reverse().find((d) => d.date <= period.endDate!)?.shortDate
                      : data[data.length - 1]?.shortDate
                  }
                  fill={BAND_COLORS[index % BAND_COLORS.length]}
                  fillOpacity={0.3}
                />
              ))}
              {/* The day a dose moved: the first thing to look for next to a
                  curve that changed shape */}
              {data.map((day) =>
                day.doseChange === null ? null : (
                  <ReferenceLine
                    key={`dose-${day.date}`}
                    x={day.shortDate}
                    stroke="#0d9488"
                    strokeDasharray="4 3"
                    label={{ value: '↑ dose', position: 'top', fontSize: 9, fill: '#0d9488' }}
                  />
                )
              )}
              <Tooltip
                formatter={(value: number, name: string, item: { payload?: DayRow }) => {
                  if (name === 'state') return [value, 'Condizione fisica'];
                  if (name === 'mood') return [value, 'Umore'];
                  if (name === 'workout') return ['sì', 'Allenamento'];
                  if (name === 'lateDinner') return ['sì', 'Cena dopo le 21'];
                  if (name === 'events') return [item.payload?.eventCount ?? 0, 'Episodi'];
                  if (name === 'skipped') {
                    return [item.payload?.skippedIntakes ?? 0, 'Dosi saltate'];
                  }
                  return [value, name];
                }}
                labelFormatter={(label: string) => {
                  const day = data.find((item) => item.shortDate === label);
                  const extras = [
                    day?.doseChange ? `dose: ${day.doseChange}` : null,
                    day?.weightKg !== null && day?.weightKg !== undefined
                      ? `peso ${day.weightKg} kg`
                      : null,
                  ].filter(Boolean);
                  return `Giorno ${label}${extras.length > 0 ? ` · ${extras.join(' · ')}` : ''}`;
                }}
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
              />
              {showBody && (
                <Line
                  type="monotone"
                  dataKey="state"
                  stroke={BODY_LINE_COLOR}
                  strokeWidth={2}
                  dot={{ r: 2.5 }}
                  connectNulls
                />
              )}
              {showMood && (
                <Line
                  type="monotone"
                  dataKey="mood"
                  stroke={MOOD_LINE_COLOR}
                  strokeWidth={2}
                  strokeDasharray="5 3"
                  dot={{ r: 2.5 }}
                  connectNulls
                />
              )}
              {showBody && <Scatter dataKey="workout" fill="#0ea5e9" shape="triangle" />}
              {showBody && <Scatter dataKey="lateDinner" fill="#f59e0b" shape="diamond" />}
              {/* Shown on both tracks: an episode and a skipped dose are
                  context for either curve */}
              <Scatter dataKey="events" fill="#f59e0b" shape="star" />
              <Scatter dataKey="skipped" fill="#a78bfa" shape="cross" />
            </ComposedChart>
          </ResponsiveContainer>

          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
            {showBody && (
              <span className="flex items-center gap-1">
                <span className="w-3 h-0.5 bg-slate-900" /> condizione fisica (−1 / +1)
              </span>
            )}
            {showMood && (
              <span className="flex items-center gap-1">
                <span
                  className="w-3 h-0.5"
                  style={{
                    backgroundImage: `repeating-linear-gradient(90deg, ${MOOD_LINE_COLOR} 0 4px, transparent 4px 6px)`,
                  }}
                />
                umore (−1 / +1)
              </span>
            )}
            {showBody && <span className="flex items-center gap-1 text-sky-600">▲ allenamento</span>}
            {showBody && <span className="flex items-center gap-1 text-amber-500">◆ cena dopo le 21</span>}
            <span className="flex items-center gap-1 text-amber-500">★ episodi</span>
            <span className="flex items-center gap-1 text-violet-400">✕ dosi saltate</span>
            <span className="flex items-center gap-1 text-teal-600">┆ cambio dose</span>
            {periods.map((period, index) => (
              <span key={`${period.name}-${period.startDate}`} className="flex items-center gap-1">
                <span
                  className="w-2.5 h-2.5 rounded"
                  style={{ backgroundColor: BAND_COLORS[index % BAND_COLORS.length] }}
                />
                {period.name}
                {period.endDate === null && ' (in corso)'}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
