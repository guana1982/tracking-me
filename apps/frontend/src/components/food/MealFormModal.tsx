import { useEffect, useMemo, useRef, useState } from 'react';
import { X, Plus, Trash2, Camera, History, Star, Loader2, Settings2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { mealsApi } from '../../lib/foodApi';
import {
  mealTypeLabel,
  unitLabel,
  smartDefaultMealType,
  todayLocal,
  resizePhotoToDataUrl,
} from '../../lib/foodUtils';
import {
  useCreateMeal,
  useUpdateMeal,
  useFoodSuggestions,
  useFrequentMeals,
  useMealPhoto,
  useMealTypes,
} from '../../hooks/useFoodQueries';
import { MEAL_ITEM_UNITS } from '@budget/shared';
import { MealTypeManager } from './MealTypeManager';
import type {
  MealDTO,
  MealTypeDTO,
  MealItemUnitDTO,
  CreateMealItemDTO,
  FrequentMealDTO,
} from '@budget/shared';

interface ItemRow {
  key: number;
  foodName: string;
  quantity: string;
  unit: MealItemUnitDTO | '';
}

interface MealFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (message: string) => void;
  /** Set for editing an existing meal */
  editingMeal?: MealDTO | null;
  /** Set to prefill from another meal (azione "duplica") */
  duplicateFrom?: MealDTO | null;
}

let rowKeyCounter = 0;
function newRow(item?: CreateMealItemDTO): ItemRow {
  rowKeyCounter += 1;
  return {
    key: rowKeyCounter,
    foodName: item?.foodName ?? '',
    quantity: item?.quantity != null ? String(item.quantity) : '',
    unit: item?.unit ?? '',
  };
}

export function MealFormModal({
  isOpen,
  onClose,
  onSaved,
  editingMeal,
  duplicateFrom,
}: MealFormModalProps) {
  const [date, setDate] = useState(todayLocal());
  const [mealType, setMealType] = useState<MealTypeDTO>('LUNCH');
  const [notes, setNotes] = useState('');
  const [rows, setRows] = useState<ItemRow[]>([newRow()]);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [photoRemoved, setPhotoRemoved] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [focusedFoodRow, setFocusedFoodRow] = useState<number | null>(null);
  const [activeSuggestRow, setActiveSuggestRow] = useState<number | null>(null);
  const [suggestQuery, setSuggestQuery] = useState('');
  const [showFrequent, setShowFrequent] = useState(false);
  const [repeatMessage, setRepeatMessage] = useState<string | null>(null);
  const [isRepeatLoading, setIsRepeatLoading] = useState(false);
  const [isMealTypeManagerOpen, setIsMealTypeManagerOpen] = useState(false);
  const firstFoodRef = useRef<HTMLTextAreaElement>(null);

  const createMeal = useCreateMeal();
  const updateMeal = useUpdateMeal();
  const suggestions = useFoodSuggestions(suggestQuery);
  const frequentMeals = useFrequentMeals(isOpen && showFrequent);
  const mealTypes = useMealTypes();
  const existingPhoto = useMealPhoto(
    editingMeal?.id ?? '',
    isOpen && Boolean(editingMeal?.hasPhoto) && !photoDataUrl && !photoRemoved
  );

  const isEdit = Boolean(editingMeal);
  const isPending = createMeal.isPending || updateMeal.isPending;
  const error = createMeal.error || updateMeal.error;

  useEffect(() => {
    if (!isOpen) return;
    const source = editingMeal ?? duplicateFrom;
    if (source) {
      setDate(editingMeal ? source.date : todayLocal());
      setMealType(source.mealType);
      setNotes(source.notes ?? '');
      setRows(
        source.items.length > 0
          ? source.items.map((item) =>
              newRow({ foodName: item.foodName, quantity: item.quantity, unit: item.unit })
            )
          : [newRow()]
      );
    } else {
      setDate(todayLocal());
      setMealType(smartDefaultMealType());
      setNotes('');
      setRows([newRow()]);
    }
    setPhotoDataUrl(null);
    setPhotoRemoved(false);
    setPhotoError(null);
    setFocusedFoodRow(null);
    setActiveSuggestRow(null);
    setSuggestQuery('');
    setShowFrequent(false);
    setIsMealTypeManagerOpen(false);
    setRepeatMessage(null);
    setTimeout(() => firstFoodRef.current?.focus(), 100);
  }, [isOpen, editingMeal, duplicateFrom]);

  useEffect(() => {
    if (!isOpen || !mealTypes.data?.length || editingMeal || duplicateFrom) return;
    const selectedIsActive = mealTypes.data.some(
      (type) => type.key === mealType && type.isActive
    );
    if (!selectedIsActive) {
      setMealType(mealTypes.data.find((type) => type.isActive)?.key ?? mealType);
    }
  }, [isOpen, mealTypes.data, mealType, editingMeal, duplicateFrom]);

  const validItems = useMemo(
    () =>
      rows
        .filter((row) => row.foodName.trim().length > 0)
        .map(
          (row): CreateMealItemDTO => ({
            foodName: row.foodName.trim(),
            quantity: row.quantity.trim() ? parseFloat(row.quantity.replace(',', '.')) || null : null,
            unit: row.unit || null,
          })
        ),
    [rows]
  );

  const updateRow = (key: number, patch: Partial<ItemRow>) => {
    setRows((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  };

  const applyPrefill = (items: CreateMealItemDTO[], type?: MealTypeDTO) => {
    setRows(items.length > 0 ? items.map((item) => newRow(item)) : [newRow()]);
    if (type) setMealType(type);
  };

  const handleRepeatYesterday = async () => {
    setIsRepeatLoading(true);
    setRepeatMessage(null);
    try {
      const meal = await mealsApi.getRepeatYesterday(date, mealType);
      if (meal) {
        applyPrefill(meal.items);
        if (meal.notes) setNotes(meal.notes);
      } else {
        const selectedName =
          mealTypes.data?.find((type) => type.key === mealType)?.name ?? mealTypeLabel(mealType);
        setRepeatMessage(`Nessun ${selectedName.toLowerCase()} registrato ieri.`);
      }
    } catch {
      setRepeatMessage('Errore nel recupero del pasto di ieri.');
    } finally {
      setIsRepeatLoading(false);
    }
  };

  const handlePickFrequent = (meal: FrequentMealDTO) => {
    applyPrefill(meal.items, meal.mealType);
    setShowFrequent(false);
  };

  const handlePhotoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setPhotoError(null);
    try {
      setPhotoDataUrl(await resizePhotoToDataUrl(file));
      setPhotoRemoved(false);
    } catch {
      setPhotoError('Impossibile elaborare la foto.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (validItems.length === 0) return;

    if (isEdit && editingMeal) {
      await updateMeal.mutateAsync({
        id: editingMeal.id,
        data: {
          date,
          mealType,
          notes: notes.trim() || null,
          items: validItems,
          photo: photoDataUrl
            ? { dataUrl: photoDataUrl }
            : photoRemoved
              ? null
              : undefined,
        },
      });
      onSaved('Pasto aggiornato');
    } else {
      await createMeal.mutateAsync({
        date,
        mealType,
        notes: notes.trim() || undefined,
        items: validItems,
        photo: photoDataUrl ? { dataUrl: photoDataUrl } : undefined,
      });
      onSaved('Pasto salvato');
    }
    onClose();
  };

  if (!isOpen) return null;

  const previewPhoto = photoDataUrl ?? (photoRemoved ? null : existingPhoto.data?.dataUrl ?? null);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">
            {isEdit ? 'Modifica pasto' : 'Nuovo pasto'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4 overflow-y-auto">
          {/* Date + meal type */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Data</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="input"
                required
              />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label className="label">Tipo pasto</label>
                <button
                  type="button"
                  onClick={() => setIsMealTypeManagerOpen(true)}
                  className="mb-1 text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                  <Settings2 className="w-3.5 h-3.5" />
                  Gestisci
                </button>
              </div>
              <select
                value={mealType}
                onChange={(e) => setMealType(e.target.value as MealTypeDTO)}
                className="input"
              >
                {mealTypes.data
                  ?.filter((type) => type.isActive || type.key === mealType)
                  .map((type) => (
                  <option key={type.key} value={type.key}>
                    {type.name}{!type.isActive ? ' (disattivato)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Shortcuts */}
          {!isEdit && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleRepeatYesterday}
                disabled={isRepeatLoading}
                className="btn btn-secondary text-xs flex items-center gap-1.5"
              >
                {isRepeatLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <History className="w-3.5 h-3.5" />
                )}
                Ripeti ieri
              </button>
              <button
                type="button"
                onClick={() => setShowFrequent((v) => !v)}
                className={cn(
                  'btn text-xs flex items-center gap-1.5',
                  showFrequent ? 'btn-primary' : 'btn-secondary'
                )}
              >
                <Star className="w-3.5 h-3.5" />
                Pasti frequenti
              </button>
            </div>
          )}
          {repeatMessage && (
            <p className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">{repeatMessage}</p>
          )}
          {showFrequent && (
            <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-44 overflow-y-auto">
              {frequentMeals.isLoading && (
                <p className="p-3 text-sm text-slate-500">Caricamento...</p>
              )}
              {frequentMeals.data?.length === 0 && (
                <p className="p-3 text-sm text-slate-500">
                  Ancora nessun pasto ricorrente: si costruiscono con l'uso.
                </p>
              )}
              {frequentMeals.data?.map((meal) => (
                <button
                  key={meal.signature}
                  type="button"
                  onClick={() => handlePickFrequent(meal)}
                  className="w-full p-3 text-left hover:bg-slate-50"
                >
                  <p className="text-sm text-slate-800 truncate">
                    {meal.items.map((item) => item.foodName).join(', ')}
                  </p>
                  <p className="text-xs text-slate-500">
                    {meal.mealTypeName} · {meal.count} volte
                  </p>
                </button>
              ))}
            </div>
          )}

          {/* Items */}
          <div>
            <label className="label">Alimenti</label>
            <div className="space-y-2">
              {rows.map((row, index) => (
                <div key={row.key} className="relative">
                  <div className="flex flex-wrap sm:flex-nowrap gap-2">
                    <div
                      className={cn(
                        'relative min-w-0',
                        focusedFoodRow === row.key
                          ? 'basis-full sm:basis-auto sm:flex-1'
                          : 'flex-1'
                      )}
                    >
                      <textarea
                        ref={index === 0 ? firstFoodRef : undefined}
                        rows={focusedFoodRow === row.key ? 4 : 1}
                        value={row.foodName}
                        onChange={(e) => {
                          updateRow(row.key, { foodName: e.target.value });
                          setActiveSuggestRow(row.key);
                          setSuggestQuery(e.target.value);
                        }}
                        onFocus={() => {
                          setFocusedFoodRow(row.key);
                          setActiveSuggestRow(row.key);
                          setSuggestQuery(row.foodName);
                        }}
                        onBlur={() => {
                          setFocusedFoodRow(null);
                          setTimeout(() => setActiveSuggestRow(null), 150);
                        }}
                        placeholder="Es. pasta al pomodoro"
                        className={cn(
                          'input resize-none transition-[height] duration-200',
                          focusedFoodRow === row.key
                            ? 'h-28 py-3 leading-6 sm:h-10 sm:py-2 sm:leading-normal'
                            : 'h-10 overflow-hidden whitespace-nowrap'
                        )}
                      />
                      {activeSuggestRow === row.key &&
                        (suggestions.data?.length ?? 0) > 0 && (
                          <div className="absolute left-0 right-0 top-full mt-1 z-20 bg-white border border-slate-200 rounded-xl shadow-lg max-h-44 overflow-y-auto">
                            {suggestions.data!.map((sug) => (
                              <button
                                key={sug.foodName}
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                  updateRow(row.key, {
                                    foodName: sug.foodName,
                                    quantity:
                                      sug.lastQuantity != null ? String(sug.lastQuantity) : '',
                                    unit: sug.lastUnit ?? '',
                                  });
                                  setActiveSuggestRow(null);
                                }}
                                className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 flex items-center justify-between gap-2"
                              >
                                <span className="truncate">{sug.foodName}</span>
                                <span className="text-xs text-slate-400 shrink-0">
                                  {sug.count}×
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                    </div>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={row.quantity}
                      onChange={(e) => updateRow(row.key, { quantity: e.target.value })}
                      placeholder="Qtà"
                      className="input w-16 sm:w-20 text-center"
                    />
                    <select
                      value={row.unit}
                      onChange={(e) =>
                        updateRow(row.key, { unit: e.target.value as MealItemUnitDTO | '' })
                      }
                      className="input w-24 sm:w-28"
                    >
                      <option value="">unità</option>
                      {MEAL_ITEM_UNITS.map((unit) => (
                        <option key={unit} value={unit}>
                          {unitLabel(unit)}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() =>
                        setRows((prev) =>
                          prev.length > 1 ? prev.filter((r) => r.key !== row.key) : prev
                        )
                      }
                      className="p-2 text-slate-400 hover:text-red-500 transition-colors shrink-0"
                      title="Rimuovi voce"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setRows((prev) => [...prev, newRow()])}
              className="mt-2 flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              <Plus className="w-4 h-4" />
              Aggiungi voce
            </button>
            <p className="mt-1 text-xs text-slate-400">
              Quantità e unità sono opzionali: meglio annotare che non annotare.
            </p>
          </div>

          {/* Notes */}
          <div>
            <label className="label">Note (opzionali)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Es. con olio evo"
              className="input resize-none"
            />
          </div>

          {/* Photo */}
          <div>
            <label className="label">Foto (opzionale)</label>
            {previewPhoto ? (
              <div className="flex items-center gap-3">
                <img
                  src={previewPhoto}
                  alt="Foto pasto"
                  className="w-20 h-20 object-cover rounded-xl border border-slate-200"
                />
                <button
                  type="button"
                  onClick={() => {
                    setPhotoDataUrl(null);
                    setPhotoRemoved(true);
                  }}
                  className="btn btn-secondary text-xs"
                >
                  Rimuovi foto
                </button>
              </div>
            ) : (
              <label className="flex items-center gap-2 btn btn-secondary text-sm cursor-pointer w-fit">
                <Camera className="w-4 h-4" />
                Scatta o scegli foto
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handlePhotoChange}
                  className="hidden"
                />
              </label>
            )}
            {photoError && <p className="mt-1 text-xs text-red-600">{photoError}</p>}
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              {error instanceof Error ? error.message : 'Errore durante il salvataggio'}
            </p>
          )}

          <button
            type="submit"
            disabled={isPending || validItems.length === 0}
            className="w-full btn btn-primary py-3 text-base"
          >
            {isPending ? 'Salvataggio...' : isEdit ? 'Salva modifiche' : 'Salva pasto'}
          </button>
        </form>
      </div>

      <MealTypeManager
        isOpen={isMealTypeManagerOpen}
        onClose={() => setIsMealTypeManagerOpen(false)}
        onCreated={(key) => {
          setMealType(key);
          setIsMealTypeManagerOpen(false);
        }}
      />
    </div>
  );
}
