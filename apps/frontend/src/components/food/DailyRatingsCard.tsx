import { useState } from 'react';
import { Gauge, Loader2, Settings2 } from 'lucide-react';
import { todayLocal } from '../../lib/foodUtils';
import { useRatingEntries, useRatings, useSetRating } from '../../hooks/useRatingQueries';
import { RatingRow } from './RatingRow';
import { RatingManager } from './RatingManager';
import { MoodPickerModal } from './MoodPickerModal';
import type { QuickLogDTO, SetRatingDTO } from '@budget/shared';

interface DailyRatingsCardProps {
  date: string;
  /** Visible week, so the votes are read from (and written into) one cache */
  from: string;
  to: string;
  onToast: (message: string) => void;
}

/**
 * The rating rows, at the top of the diary above the intakes. Voting writes
 * the moment as well as the mark, which is what puts the vote in the day
 * timeline instead of leaving it in a panel of its own.
 */
export function DailyRatingsCard({ date, from, to, onToast }: DailyRatingsCardProps) {
  const [isManagerOpen, setIsManagerOpen] = useState(false);
  // The characteristic whose picker is open, if any
  const [linkedFormFor, setLinkedFormFor] = useState<string | null>(null);

  const ratings = useRatings();
  const entries = useRatingEntries(from, to);
  const setRating = useSetRating(from, to);

  if (ratings.isLoading || entries.isLoading) return null;

  const definitions = (ratings.data ?? []).filter((definition) => definition.isActive);
  const dayEntries = (entries.data ?? []).filter((entry) => entry.date === date);

  // A vote on a past day belongs to that day at local noon, not to "now"
  const loggedAt =
    date === todayLocal() ? undefined : new Date(`${date}T12:00:00`).toISOString();

  const submit = (data: Omit<SetRatingDTO, 'date' | 'loggedAt'>) => {
    setRating.mutate({ date, loggedAt, ...data });
  };

  if (definitions.length === 0) {
    return (
      <>
        <button
          type="button"
          onClick={() => setIsManagerOpen(true)}
          className="mb-3 w-full flex items-center justify-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors"
        >
          <Gauge className="w-3.5 h-3.5" />
          Dai un voto a come sta andando
        </button>
        <RatingManager isOpen={isManagerOpen} onClose={() => setIsManagerOpen(false)} />
      </>
    );
  }

  return (
    <div className="card mb-3">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1.5 rounded-lg bg-indigo-50 shrink-0">
            <Gauge className="w-4 h-4 text-indigo-600" />
          </div>
          <p className="text-sm font-semibold text-slate-900">Valutazioni</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {setRating.isPending && <Loader2 className="w-4 h-4 animate-spin text-slate-300" />}
          <button
            type="button"
            onClick={() => setIsManagerOpen(true)}
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100"
            title="Gestisci cosa valutare"
            aria-label="Gestisci cosa valutare"
          >
            <Settings2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {definitions.map((definition) => {
          const entry = dayEntries.find((item) => item.ratingKey === definition.key);
          return (
            <RatingRow
              // Remounted per day: the note field starts from the stored value
              key={`${date}-${definition.key}`}
              definition={definition}
              entry={entry}
              hasLinkedEntry={Boolean(entry?.quickLogId)}
              onSetValue={(value) => submit({ ratingKey: definition.key, value })}
              onSetNote={(note) => submit({ ratingKey: definition.key, note: note || null })}
              onOpenLinkedForm={
                definition.linkedForm === 'MOOD'
                  ? () => setLinkedFormFor(definition.key)
                  : undefined
              }
            />
          );
        })}
      </div>

      {setRating.error && (
        <p className="mt-2 text-xs text-red-600">
          {setRating.error instanceof Error ? setRating.error.message : 'Voto non registrato'}
        </p>
      )}

      <RatingManager isOpen={isManagerOpen} onClose={() => setIsManagerOpen(false)} />

      <MoodPickerModal
        isOpen={linkedFormFor !== null}
        onClose={() => setLinkedFormFor(null)}
        onSaved={onToast}
        date={date}
        // What was chosen is attached to the row, so vote, note and states
        // are one single recap in the timeline
        onMoodLogged={(log: QuickLogDTO) => {
          if (linkedFormFor) submit({ ratingKey: linkedFormFor, quickLogId: log.id });
        }}
      />
    </div>
  );
}
