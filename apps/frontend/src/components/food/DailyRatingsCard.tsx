import { useState } from 'react';
import { Gauge, Loader2, Settings2 } from 'lucide-react';
import { todayLocal } from '../../lib/foodUtils';
import { useCreateRatingEntry, useRatings } from '../../hooks/useRatingQueries';
import { RatingRow } from './RatingRow';
import { RatingManager } from './RatingManager';
import { MoodPickerModal } from './MoodPickerModal';
import type { QuickLogDTO } from '@budget/shared';

interface DailyRatingsCardProps {
  date: string;
  /** Visible week, so a new vote is written into the cache the diary reads */
  from: string;
  to: string;
  onToast: (message: string) => void;
}

/**
 * The rating rows, at the top of the diary above the intakes. They are a way
 * in and nothing else: a vote is written with its moment and then the row is
 * empty again, ready for the next one. What was voted lives in the timeline.
 */
export function DailyRatingsCard({ date, from, to, onToast }: DailyRatingsCardProps) {
  const [isManagerOpen, setIsManagerOpen] = useState(false);
  // The characteristic whose picker is open, if any
  const [linkedFormFor, setLinkedFormFor] = useState<string | null>(null);
  // Mood entries picked but not yet sent: they travel with the next vote of
  // their row, so vote, note and states end up in one single recap
  const [pendingLinks, setPendingLinks] = useState<Record<string, string>>({});

  const ratings = useRatings();
  const createEntry = useCreateRatingEntry(from, to);

  if (ratings.isLoading) return null;

  const definitions = (ratings.data ?? []).filter((definition) => definition.isActive);

  const handleVote = (ratingKey: string, value: number, note: string | null) => {
    createEntry.mutate({
      date,
      ratingKey,
      value,
      note,
      quickLogId: pendingLinks[ratingKey] ?? null,
      // A vote on a past day belongs to that day at local noon, not to "now"
      loggedAt: date === todayLocal() ? undefined : new Date(`${date}T12:00:00`).toISOString(),
    });
    setPendingLinks((previous) => {
      const { [ratingKey]: _sent, ...rest } = previous;
      return rest;
    });
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
          {createEntry.isPending && <Loader2 className="w-4 h-4 animate-spin text-slate-300" />}
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
        {definitions.map((definition) => (
          <RatingRow
            // Remounted when the day changes, so a draft never follows the user
            key={`${date}-${definition.key}`}
            definition={definition}
            hasPendingLink={Boolean(pendingLinks[definition.key])}
            onSubmit={(value, note) => handleVote(definition.key, value, note)}
            onOpenLinkedForm={
              definition.linkedForm === 'MOOD' ? () => setLinkedFormFor(definition.key) : undefined
            }
          />
        ))}
      </div>

      {createEntry.error && (
        <p className="mt-2 text-xs text-red-600">
          {createEntry.error instanceof Error ? createEntry.error.message : 'Voto non registrato'}
        </p>
      )}

      <RatingManager isOpen={isManagerOpen} onClose={() => setIsManagerOpen(false)} />

      <MoodPickerModal
        isOpen={linkedFormFor !== null}
        onClose={() => setLinkedFormFor(null)}
        onSaved={onToast}
        date={date}
        onMoodLogged={(log: QuickLogDTO) => {
          if (linkedFormFor) {
            setPendingLinks((previous) => ({ ...previous, [linkedFormFor]: log.id }));
          }
        }}
      />
    </div>
  );
}
