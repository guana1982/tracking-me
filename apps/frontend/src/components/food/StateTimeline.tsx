import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
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
import type { DayContributionDTO, DayMomentDTO } from '@budget/shared';

const BAND_COLORS = ['#fde68a', '#bae6fd', '#ddd6fe', '#bbf7d0', '#fecaca'];

/** Past this many instruments a track is summarised: a tooltip is not a table */
const MAX_TOOLTIP_ROWS = 5;

/** Signed, with the Italian decimal comma the rest of the diary uses */
function formatScore(score: number): string {
  const rounded = Math.round(score * 100) / 100;
  const sign = rounded > 0 ? '+' : rounded < 0 ? '−' : '';
  return `${sign}${Math.abs(rounded).toFixed(2).replace('.', ',')}`;
}

function scoreColor(score: number): string {
  if (score > 0) return 'text-emerald-600';
  if (score < 0) return 'text-rose-600';
  return 'text-slate-400';
}

interface TrackReadoutProps {
  label: string;
  /** A stroke of the series colour: at tooltip density a filled box is too much ink */
  stroke: ReactNode;
  score: number | null;
  contributions: DayContributionDTO[];
}

/**
 * One track's line in the tooltip: the score, then the instruments it is the
 * average of. The number leads and the name follows - the reader already knows
 * which series they are pointing at, and came for the value.
 */
function TrackReadout({ label, stroke, score, contributions }: TrackReadoutProps) {
  const shown = contributions.slice(0, MAX_TOOLTIP_ROWS);
  const hidden = contributions.length - shown.length;

  return (
    <div>
      <div className="flex items-baseline gap-1.5">
        {stroke}
        <span className="text-[11px] font-medium text-slate-500">{label}</span>
        <span
          className={cn(
            'ml-auto text-xs font-semibold tabular-nums',
            score === null ? 'text-slate-300' : scoreColor(score)
          )}
        >
          {score === null ? 'non rilevato' : formatScore(score)}
        </span>
      </div>
      {shown.length > 0 && (
        <ul className="mt-1 space-y-0.5 pl-4">
          {shown.map((entry) => (
            <li key={entry.label} className="text-[11px]">
              <div className="flex items-baseline gap-2">
                <span className="min-w-0 flex-1 truncate text-slate-500">{entry.label}</span>
                <span className={cn('shrink-0 tabular-nums font-medium', scoreColor(entry.score))}>
                  {formatScore(entry.score)}
                </span>
              </div>
              {/* The words written next to the vote: a score says how much the
                  day moved, and only this says what moved it */}
              {entry.details.map((detail) => (
                <p
                  key={detail}
                  className="mt-0.5 border-l-2 border-slate-200 pl-1.5 text-[11px] leading-snug text-slate-500 line-clamp-3"
                >
                  {detail}
                </p>
              ))}
            </li>
          ))}
          {hidden > 0 && (
            <li className="text-[11px] text-slate-400">
              e altri {hidden} {hidden === 1 ? 'elemento' : 'elementi'}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

interface DayTooltipProps {
  // Injected by recharts
  active?: boolean;
  payload?: { payload?: DayRow }[];
  label?: string;
  data: DayRow[];
  showBody: boolean;
  showMood: boolean;
}

/**
 * Why the curve sits where it sits.
 *
 * The point on its own is an average with nothing to say for itself: a day at
 * −0.4 could be one bad night or four bad things at once, and those are not the
 * same day. So the readout breaks each track into the instruments that made it,
 * heaviest first, and then lists the facts of the day that carry no valence and
 * therefore never entered the score - they explain a lot and measure nothing.
 */
function DayTooltip({ active, payload, label, data, showBody, showMood }: DayTooltipProps) {
  if (!active) return null;
  // The payload carries the row when a series has a value there; on a day where
  // both curves are interrupted it does not, and the label is the way back in
  const row =
    payload?.find((item) => item.payload)?.payload ??
    data.find((item) => item.shortDate === label);
  if (!row) return null;

  // Episodes and side effects have their own block below: here they would be a
  // number where the tooltip can afford the thing itself
  const facts = [
    row.workout !== null && 'allenamento',
    row.lateDinner !== null && 'cena dopo le 21',
    row.skippedIntakes > 0 &&
      `${row.skippedIntakes} ${row.skippedIntakes === 1 ? 'dose saltata' : 'dosi saltate'}`,
    row.doseChange && `dose: ${row.doseChange}`,
    row.weightKg !== null && `peso ${String(row.weightKg).replace('.', ',')} kg`,
  ].filter((fact): fact is string => Boolean(fact));

  // One list, two glyphs - the same ones the chart plots them with, so the
  // marker on the curve and the line in the readout are visibly the same thing
  const moments = [
    ...row.eventList.map((moment) => ({ moment, glyph: '★', tone: 'text-amber-500' })),
    ...row.sideEffectList.map((moment) => ({ moment, glyph: '●', tone: 'text-rose-500' })),
  ].sort((left, right) => left.moment.time.localeCompare(right.moment.time));
  const shownMoments = moments.slice(0, MAX_TOOLTIP_ROWS);
  const hiddenMoments = moments.length - shownMoments.length;

  return (
    <div className="max-w-[20rem] rounded-xl border border-slate-200 bg-white p-2.5 shadow-lg">
      <p className="mb-1.5 text-[11px] font-semibold capitalize text-slate-900">
        {format(parseISO(row.date), 'EEEE d MMMM', { locale: it })}
      </p>

      <div className="space-y-2">
        {showBody && (
          <TrackReadout
            label="Condizione fisica"
            stroke={
              <span
                className="mt-1 w-3 h-0.5 shrink-0 rounded-full"
                style={{ backgroundColor: BODY_LINE_COLOR }}
              />
            }
            score={row.state}
            contributions={row.bodyBreakdown}
          />
        )}
        {showMood && (
          <TrackReadout
            label="Umore"
            stroke={
              <span
                className="mt-1 w-3 h-0.5 shrink-0"
                style={{
                  backgroundImage: `repeating-linear-gradient(90deg, ${MOOD_LINE_COLOR} 0 4px, transparent 4px 6px)`,
                }}
              />
            }
            score={row.mood}
            contributions={row.moodBreakdown}
          />
        )}
      </div>

      {moments.length > 0 && (
        <div className="mt-2 border-t border-slate-100 pt-1.5">
          <p className="text-[10px] uppercase tracking-wide text-slate-400">Cos’è successo</p>
          <ul className="mt-0.5 space-y-0.5">
            {shownMoments.map(({ moment, glyph, tone }, index) => (
              <li
                key={`${moment.time}-${moment.label}-${index}`}
                className="flex items-baseline gap-1.5 text-[11px]"
              >
                <span className={cn('shrink-0', tone)} aria-hidden="true">
                  {glyph}
                </span>
                <span className="shrink-0 tabular-nums text-slate-400">{moment.time}</span>
                <span className="min-w-0 flex-1 text-slate-600">
                  <span className="font-medium text-slate-700">{moment.label}</span>
                  {moment.detail && <span className="text-slate-500"> — {moment.detail}</span>}
                </span>
                {moment.intensity !== null && (
                  <span className="shrink-0 tabular-nums text-slate-400">
                    {moment.intensity}/{moment.maxValue}
                  </span>
                )}
              </li>
            ))}
            {hiddenMoments > 0 && (
              <li className="text-[11px] text-slate-400">e altri {hiddenMoments}</li>
            )}
          </ul>
        </div>
      )}

      {facts.length > 0 && (
        <div className="mt-2 border-t border-slate-100 pt-1.5">
          <p className="text-[10px] uppercase tracking-wide text-slate-400">Anche quel giorno</p>
          <p className="mt-0.5 text-[11px] text-slate-500">{facts.join(' · ')}</p>
        </div>
      )}
    </div>
  );
}

interface DayRow {
  date: string;
  shortDate: string;
  state: number | null;
  mood: number | null;
  /** What each score is the average of, heaviest first */
  bodyBreakdown: DayContributionDTO[];
  moodBreakdown: DayContributionDTO[];
  /** The episodes and side effects themselves, not just how many there were */
  eventList: DayMomentDTO[];
  sideEffectList: DayMomentDTO[];
  workout: number | null;
  lateDinner: number | null;
  events: number | null;
  eventCount: number;
  skipped: number | null;
  skippedIntakes: number;
  sideEffects: number | null;
  sideEffectCount: number;
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
  const navigate = useNavigate();
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
    bodyBreakdown: day.bodyBreakdown,
    moodBreakdown: day.moodBreakdown,
    // Renamed on the way in: `events` is already the scatter series' dataKey
    eventList: day.events,
    sideEffectList: day.sideEffects,
    workout: day.workoutPresent ? 1.15 : null,
    lateDinner: day.dinnerAfter21 ? -1.15 : null,
    // Facts with no valence of their own, placed on their own rows so they
    // never look like a judgement of the day
    events: day.eventCount > 0 ? -1.25 : null,
    eventCount: day.eventCount,
    skipped: day.skippedIntakes > 0 ? 1.25 : null,
    skippedIntakes: day.skippedIntakes,
    // Grouped with the other therapy facts, at the top of the plot
    sideEffects: day.sideEffectCount > 0 ? 1.38 : null,
    sideEffectCount: day.sideEffectCount,
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
            : "Nessun dato nel periodo: la linea appare con i voti, gli episodi, il check-in e le abitudini — non con i commenti liberi della giornata."}
        </p>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart
              data={data}
              margin={{ top: 8, right: 8, bottom: 0, left: -28 }}
              style={{ cursor: 'pointer' }}
              /**
               * The whole column, not the dot alone: a 2.5px target is not one
               * anybody can hit, and the day is what is being asked for either
               * way. `activeTooltipIndex` is the column the tooltip is on, so
               * what gets opened is exactly what was being read.
               */
              onClick={(state) => {
                const index = state?.activeTooltipIndex;
                const day = typeof index === 'number' ? data[index] : undefined;
                if (day) navigate(`/food?date=${day.date}`);
              }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="shortDate"
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                interval="preserveStartEnd"
                minTickGap={24}
              />
              {/* Headroom for the marker rows: the readable range stays -1..+1 */}
              <YAxis domain={[-1.3, 1.45]} ticks={[-1, 0, 1]} tick={{ fontSize: 10, fill: '#94a3b8' }} />
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
                // The crosshair finds the day: nobody aims at a 2px line
                cursor={{ stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: '3 3' }}
                content={<DayTooltip data={data} showBody={showBody} showMood={showMood} />}
              />
              {showBody && (
                <Line
                  type="monotone"
                  dataKey="state"
                  stroke={BODY_LINE_COLOR}
                  strokeWidth={2}
                  dot={{ r: 2.5 }}
                  activeDot={{ r: 5 }}
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
                  activeDot={{ r: 5 }}
                  connectNulls
                />
              )}
              {showBody && <Scatter dataKey="workout" fill="#0ea5e9" shape="triangle" />}
              {showBody && <Scatter dataKey="lateDinner" fill="#f59e0b" shape="diamond" />}
              {/* Shown on both tracks: an episode and a skipped dose are
                  context for either curve */}
              <Scatter dataKey="events" fill="#f59e0b" shape="star" />
              <Scatter dataKey="skipped" fill="#a78bfa" shape="cross" />
              <Scatter dataKey="sideEffects" fill="#f43f5e" shape="circle" />
            </ComposedChart>
          </ResponsiveContainer>

          <p className="mt-2 text-[11px] text-slate-400">
            Passa sopra a un giorno per vedere da cosa è composto il punteggio; clicca per aprire
            quel giorno nel diario.
          </p>

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
            <span className="flex items-center gap-1 text-rose-500">● effetti collaterali</span>
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
