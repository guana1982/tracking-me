import { Pencil, Trash2, Copy } from 'lucide-react';
import { mealTypeLabel, unitLabel, localTimeOf } from '../../lib/foodUtils';
import { useMealPhoto } from '../../hooks/useFoodQueries';
import type { MealDTO } from '@budget/shared';

interface MealCardProps {
  meal: MealDTO;
  onEdit: (meal: MealDTO) => void;
  onDuplicate: (meal: MealDTO) => void;
  onDelete: (meal: MealDTO) => void;
}

function MealPhotoThumb({ mealId }: { mealId: string }) {
  const photo = useMealPhoto(mealId, true);
  if (!photo.data) {
    return <div className="w-16 h-16 rounded-xl bg-slate-100 animate-pulse shrink-0" />;
  }
  return (
    <img
      src={photo.data.dataUrl}
      alt="Foto pasto"
      className="w-16 h-16 object-cover rounded-xl border border-slate-200 shrink-0"
    />
  );
}

export function MealCard({ meal, onEdit, onDuplicate, onDelete }: MealCardProps) {
  return (
    <div className="card p-3 xl:p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold">
            {mealTypeLabel(meal.mealType)}
          </span>
          <span className="text-xs text-slate-400">{localTimeOf(meal.createdAt)}</span>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => onEdit(meal)}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            title="Modifica"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDuplicate(meal)}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            title="Duplica"
          >
            <Copy className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(meal)}
            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            title="Elimina"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="mt-2 flex gap-3">
        {meal.hasPhoto && <MealPhotoThumb mealId={meal.id} />}
        <ul className="flex-1 space-y-0.5">
          {meal.items.map((item) => (
            <li key={item.id} className="text-sm text-slate-800 flex justify-between gap-2">
              <span>{item.foodName}</span>
              {item.quantity != null && (
                <span className="text-slate-500 tabular-nums shrink-0">
                  {item.quantity} {item.unit ? unitLabel(item.unit) : ''}
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>

      {meal.notes && <p className="mt-2 text-xs text-slate-500 italic">{meal.notes}</p>}
    </div>
  );
}
