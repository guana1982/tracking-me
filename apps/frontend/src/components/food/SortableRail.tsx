import { useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, Check, GripVertical, RotateCcw } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface RailSection {
  id: string;
  label: string;
  node: ReactNode;
}

interface SortableRailProps {
  sections: RailSection[];
  order: string[];
  onMove: (id: string, direction: -1 | 1) => void;
  onMoveTo: (dragId: string, targetId: string) => void;
  onReset: () => void;
  isCustom: boolean;
}

/**
 * A rail whose sections the user can rearrange.
 *
 * Reordering lives behind a mode instead of being always on: a permanent grip
 * on every card is clutter for something done once in a while, and a card that
 * can be dragged by accident is worse than one that cannot be dragged at all.
 *
 * Inside the mode there are two ways to move a section - drag, and the arrows.
 * The arrows are not a fallback for the impatient: HTML drag and drop does not
 * exist on touch browsers, and this diary is used mostly on a phone.
 */
export function SortableRail({
  sections,
  order,
  onMove,
  onMoveTo,
  onReset,
  isCustom,
}: SortableRailProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const byId = new Map(sections.map((section) => [section.id, section]));
  const ordered = order
    .map((id) => byId.get(id))
    .filter((section): section is RailSection => section !== undefined);

  return (
    <>
      <div className="mb-2 flex items-center justify-end gap-2">
        {isEditing && isCustom && (
          <button
            type="button"
            onClick={onReset}
            className="flex items-center gap-1 text-[11px] font-medium text-slate-400 hover:text-slate-600"
          >
            <RotateCcw className="w-3 h-3" />
            Ordine originale
          </button>
        )}
        <button
          type="button"
          onClick={() => setIsEditing((open) => !open)}
          className={cn(
            'flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium transition-colors',
            isEditing
              ? 'bg-slate-900 text-white'
              : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
          )}
        >
          {isEditing ? <Check className="w-3 h-3" /> : <GripVertical className="w-3 h-3" />}
          {isEditing ? 'Fatto' : 'Riordina'}
        </button>
      </div>

      {ordered.map((section, index) => (
        <div
          key={section.id}
          draggable={isEditing}
          onDragStart={(event) => {
            setDraggedId(section.id);
            event.dataTransfer.effectAllowed = 'move';
            // Firefox ignores a drag that carries no payload
            event.dataTransfer.setData('text/plain', section.id);
          }}
          onDragEnd={() => {
            setDraggedId(null);
            setOverId(null);
          }}
          onDragOver={(event) => {
            if (!isEditing || !draggedId) return;
            event.preventDefault();
            setOverId(section.id);
          }}
          onDragLeave={() => setOverId((current) => (current === section.id ? null : current))}
          onDrop={(event) => {
            if (!isEditing) return;
            event.preventDefault();
            const dragId = event.dataTransfer.getData('text/plain') || draggedId;
            if (dragId) onMoveTo(dragId, section.id);
            setDraggedId(null);
            setOverId(null);
          }}
          className={cn(
            isEditing && 'rounded-xl transition-colors',
            isEditing && draggedId === section.id && 'opacity-40',
            isEditing &&
              overId === section.id &&
              draggedId !== section.id &&
              'ring-2 ring-sky-400 ring-offset-2'
          )}
        >
          {isEditing && (
            <div className="mb-1 flex items-center gap-1.5 px-1">
              <GripVertical className="w-3.5 h-3.5 text-slate-300 cursor-grab shrink-0" />
              <span className="text-[11px] font-medium text-slate-500 flex-1 truncate">
                {section.label}
              </span>
              <button
                type="button"
                onClick={() => onMove(section.id, -1)}
                disabled={index === 0}
                className="w-8 h-8 rounded-lg border border-slate-200 text-slate-500 flex items-center justify-center disabled:opacity-30 hover:bg-slate-50"
                aria-label={`Sposta ${section.label} in alto`}
              >
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onMove(section.id, 1)}
                disabled={index === ordered.length - 1}
                className="w-8 h-8 rounded-lg border border-slate-200 text-slate-500 flex items-center justify-center disabled:opacity-30 hover:bg-slate-50"
                aria-label={`Sposta ${section.label} in basso`}
              >
                <ArrowDown className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          {/* Pointer events off while reordering: a tap is meant to move the
              card, not to tick something inside it */}
          <div className={cn(isEditing && 'pointer-events-none select-none')}>{section.node}</div>
        </div>
      ))}
    </>
  );
}
