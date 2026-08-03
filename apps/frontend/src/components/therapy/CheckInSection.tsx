import { useState } from 'react';
import { ChevronDown, ClipboardList, Settings2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { describeScaleValue } from '@budget/shared';
import type { CheckInDayDTO, CheckInScaleDTO } from '@budget/shared';
import { CheckInScaleManager } from './CheckInScaleManager';

interface CheckInSectionProps {
  day: CheckInDayDTO | undefined;
  isLoading: boolean;
  values: Record<string, number>;
  /** Keys already answered for the day, or moved just now */
  answeredKeys: string[];
  onChange: (key: string, value: number) => void;
  note: string;
  onNoteChange: (note: string) => void;
  isExpanded: boolean;
  onToggleExpanded: () => void;
}

function ScaleRow({
  scale,
  value,
  isAnswered,
  onChange,
}: {
  scale: CheckInScaleDTO;
  value: number;
  /** False = never answered. Deliberately not the same as answering zero */
  isAnswered: boolean;
  onChange: (value: number) => void;
}) {
  const wording = describeScaleValue(value, scale.maxValue, scale.isPositive, scale.levelLabels);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-slate-800">{scale.name}</p>
        {scale.isPositive && (
          <span className="text-[10px] font-medium text-emerald-600 uppercase tracking-wide shrink-0">
            alto = meglio
          </span>
        )}
      </div>

      {scale.levelLabels.length > 0 ? (
        // Named steps instead of a number: some things are worse to count exactly
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {scale.levelLabels.map((label, index) => (
            <button
              key={label}
              type="button"
              onClick={() => onChange(index)}
              aria-pressed={isAnswered && value === index}
              className={cn(
                'px-3 py-1.5 rounded-full border text-xs font-medium transition-colors',
                isAnswered && value === index
                  ? 'border-violet-500 bg-violet-500 text-white'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              )}
            >
              {label}
            </button>
          ))}
        </div>
      ) : (
        <>
          <input
            type="range"
            min={0}
            max={scale.maxValue}
            step={1}
            value={value}
            onChange={(event) => onChange(Number(event.target.value))}
            className={cn('mt-1.5 w-full accent-violet-600', !isAnswered && 'opacity-50')}
            aria-label={scale.name}
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] text-slate-400 truncate">{scale.lowLabel}</span>
            <span
              className={cn(
                'text-xs font-medium shrink-0',
                isAnswered ? 'text-slate-700' : 'text-slate-400 italic'
              )}
            >
              {isAnswered ? `${value} — ${wording}` : 'non risposto'}
            </span>
            <span className="text-[10px] text-slate-400 truncate text-right">
              {scale.highLabel}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * The daily check-in, folded into the mood entry instead of standing on its
 * own: the moment you are already saying how you feel is the moment to ask.
 * Sliders start from the previous answer, so only what changed has to move.
 */
export function CheckInSection({
  day,
  isLoading,
  values,
  answeredKeys,
  onChange,
  note,
  onNoteChange,
  isExpanded,
  onToggleExpanded,
}: CheckInSectionProps) {
  const [isManagerOpen, setIsManagerOpen] = useState(false);
  const [showOptional, setShowOptional] = useState(false);

  if (isLoading) return null;

  // Side effects live in the diary now, under the drug that brought them up:
  // asked here they were buried behind two taps and a collapsed section
  const scales = (day?.scales ?? []).filter((scale) => !scale.isSideEffect);

  // No scales configured: one quiet line, nothing more
  if (scales.length === 0) {
    return (
      <>
        <button
          type="button"
          onClick={() => setIsManagerOpen(true)}
          className="w-full flex items-center justify-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors"
        >
          <ClipboardList className="w-3.5 h-3.5" />
          Aggiungi un check-in giornaliero
        </button>
        <CheckInScaleManager isOpen={isManagerOpen} onClose={() => setIsManagerOpen(false)} />
      </>
    );
  }

  const coreScales = scales.filter((scale) => scale.isCore);
  const optionalScales = scales.filter((scale) => !scale.isCore);
  const alreadyFilled = day?.entry !== null && day?.entry !== undefined;

  return (
    <div className="border-t border-slate-100 pt-3">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onToggleExpanded}
          className="flex items-center gap-2 flex-1 min-w-0 text-left"
        >
          <ChevronDown
            className={cn(
              'w-4 h-4 text-slate-400 transition-transform shrink-0',
              isExpanded ? 'rotate-0' : '-rotate-90'
            )}
          />
          <span className="text-sm font-medium text-slate-700">Check-in</span>
          <span className="text-[11px] text-slate-400 truncate">
            {alreadyFilled ? 'già compilato, puoi modificarlo' : `${coreScales.length} scale`}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setIsManagerOpen(true)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 shrink-0"
          title="Gestisci le scale"
          aria-label="Gestisci le scale"
        >
          <Settings2 className="w-4 h-4" />
        </button>
      </div>

      {isExpanded && (
        <div className="mt-3 space-y-4">
          {coreScales.map((scale) => (
            <ScaleRow
              key={scale.key}
              scale={scale}
              value={values[scale.key] ?? 0}
              isAnswered={answeredKeys.includes(scale.key)}
              onChange={(value) => onChange(scale.key, value)}
            />
          ))}

          {optionalScales.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setShowOptional((open) => !open)}
                className="text-xs font-medium text-blue-600 hover:text-blue-700"
              >
                {showOptional ? 'Nascondi' : 'Altro'} ({optionalScales.length})
              </button>
              {showOptional && (
                <div className="mt-3 space-y-4">
                  {optionalScales.map((scale) => (
                    <ScaleRow
                      key={scale.key}
                      scale={scale}
                      value={values[scale.key] ?? 0}
                      isAnswered={answeredKeys.includes(scale.key)}
                      onChange={(value) => onChange(scale.key, value)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          <div>
            <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide mb-1.5">
              Nota del check-in
            </p>
            <input
              type="text"
              value={note}
              onChange={(event) => onNoteChange(event.target.value)}
              placeholder="Facoltativa"
              className="input text-sm"
              autoComplete="off"
            />
          </div>
        </div>
      )}

      <CheckInScaleManager isOpen={isManagerOpen} onClose={() => setIsManagerOpen(false)} />
    </div>
  );
}
