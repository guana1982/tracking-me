import { Layers, Activity, Smile } from 'lucide-react';
import { cn } from '../../lib/utils';

/** Which of the two independent day tracks the charts should show */
export type FoodTrack = 'BOTH' | 'BODY' | 'MOOD';

const OPTIONS: { value: FoodTrack; label: string; icon: typeof Layers; activeClass: string }[] = [
  { value: 'BOTH', label: 'Entrambi', icon: Layers, activeClass: 'bg-slate-900 text-white' },
  { value: 'BODY', label: 'Fisico', icon: Activity, activeClass: 'bg-slate-700 text-white' },
  { value: 'MOOD', label: 'Umore', icon: Smile, activeClass: 'bg-fuchsia-600 text-white' },
];

interface TrackToggleProps {
  value: FoodTrack;
  onChange: (track: FoodTrack) => void;
}

/**
 * Segmented control switching between the physical and mood tracks. The same
 * control is rendered in every card that plots them, all bound to one state,
 * so calendar and chart always show the same thing.
 */
export function TrackToggle({ value, onChange }: TrackToggleProps) {
  return (
    <div className="inline-flex items-center gap-0.5 p-0.5 bg-slate-100 rounded-full">
      {OPTIONS.map((option) => {
        const Icon = option.icon;
        const isActive = value === option.value;
        return (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            aria-pressed={isActive}
            className={cn(
              'flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors',
              isActive ? option.activeClass : 'text-slate-600 hover:bg-slate-200'
            )}
            title={`Mostra ${option.label.toLowerCase()}`}
          >
            <Icon className="w-3.5 h-3.5" />
            <span className="hidden xs:inline sm:inline">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
