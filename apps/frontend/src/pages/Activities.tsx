import {
  useMemo,
  useRef,
  useState,
  type DragEvent as ReactDragEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import { CheckSquare2, Loader2 } from 'lucide-react';
import type { ActivityDTO, ActivityPriorityDTO, UpdateActivityDTO } from '@budget/shared';
import { ActivityCard } from '../components/activities/ActivityCard';
import { ActivityEditorPanel, type ActivityEditorData } from '../components/activities/ActivityEditorPanel';
import { ActivityMonthCalendar } from '../components/activities/ActivityMonthCalendar';
import { ActivityToolsPanel } from '../components/activities/ActivityToolsPanel';
import {
  useActivityOverview,
  useActivityTypes,
  useCreateActivity,
  useCreateActivityType,
  useDeleteActivity,
  useDeleteActivityType,
  useInstallActivityTypes,
  useReorderActivities,
  useUpdateActivity,
  useUpdateActivityType,
} from '../hooks/useActivityQueries';
import { cn } from '../lib/utils';

type ListFilter = 'ALL' | 'DAY' | 'WEEK' | 'DEADLINE';

const PRIORITY_WEIGHT: Record<ActivityPriorityDTO, number> = {
  URGENT: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

const PANE_CLASS = 'min-w-0 space-y-3 xl:h-full xl:overflow-y-auto xl:overscroll-contain xl:pr-1';

function localIsoDate(date = new Date()): string {
  return format(date, 'yyyy-MM-dd');
}

function sortByImportance(left: ActivityDTO, right: ActivityDTO): number {
  if (left.isManuallyPositioned && right.isManuallyPositioned) {
    return left.position - right.position || left.createdAt.localeCompare(right.createdAt);
  }
  if (left.isManuallyPositioned !== right.isManuallyPositioned) {
    return left.isManuallyPositioned ? -1 : 1;
  }
  if (left.status === 'DONE' && right.status !== 'DONE') return 1;
  if (left.status !== 'DONE' && right.status === 'DONE') return -1;
  const priority = PRIORITY_WEIGHT[right.priority] - PRIORITY_WEIGHT[left.priority];
  if (priority !== 0) return priority;
  const dueDate = (left.dueDate ?? '9999-12-31').localeCompare(right.dueDate ?? '9999-12-31');
  if (dueDate !== 0) return dueDate;
  const dueTime = (left.dueTime ?? '23:59').localeCompare(right.dueTime ?? '23:59');
  if (dueTime !== 0) return dueTime;
  return left.position - right.position || left.createdAt.localeCompare(right.createdAt);
}

export function Activities() {
  const today = localIsoDate();
  const [selectedDate, setSelectedDate] = useState(today);
  const [editing, setEditing] = useState<ActivityDTO | null>(null);
  const [editorVersion, setEditorVersion] = useState(0);
  const [filter, setFilter] = useState<ListFilter>('ALL');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const pointerDragId = useRef<string | null>(null);

  const overview = useActivityOverview(selectedDate);
  const types = useActivityTypes();
  const createActivity = useCreateActivity();
  const updateActivity = useUpdateActivity();
  const reorderActivities = useReorderActivities();
  const deleteActivity = useDeleteActivity();
  const installTypes = useInstallActivityTypes();
  const createType = useCreateActivityType();
  const updateType = useUpdateActivityType();
  const deleteType = useDeleteActivityType();

  const allActivities = useMemo(() => {
    if (!overview.data) return [];
    const source = Array.isArray(overview.data.all)
      ? overview.data.all
      : [...overview.data.today, ...overview.data.week, ...overview.data.deadlines];
    const unique = new Map(source.map((activity) => [activity.id, activity]));
    return [...unique.values()].sort(sortByImportance);
  }, [overview.data]);

  const visibleActivities = useMemo(
    () =>
      allActivities.filter((activity) => {
        if (filter === 'DAY') return activity.kind === 'TASK' && activity.scope === 'DAY';
        if (filter === 'WEEK') return activity.kind === 'TASK' && activity.scope === 'WEEK';
        if (filter === 'DEADLINE') return activity.kind === 'DEADLINE';
        return true;
      }),
    [allActivities, filter]
  );

  const handleSave = async (data: ActivityEditorData) => {
    if (editing) {
      const update: UpdateActivityDTO = { ...data, status: data.status };
      await updateActivity.mutateAsync({ id: editing.id, data: update });
      setEditing(null);
    } else {
      const { status: _status, ...create } = data;
      await createActivity.mutateAsync(create);
    }
    setEditorVersion((version) => version + 1);
  };

  const handleEdit = (activity: ActivityDTO) => {
    setEditing(activity);
    requestAnimationFrame(() => editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  const handleToggle = async (activity: ActivityDTO) => {
    setBusyId(activity.id);
    setPageError(null);
    try {
      await updateActivity.mutateAsync({
        id: activity.id,
        data: { status: activity.status === 'DONE' ? 'TODO' : 'DONE' },
      });
    } catch (cause) {
      setPageError(cause instanceof Error ? cause.message : 'Impossibile aggiornare l’attività.');
    } finally {
      setBusyId(null);
    }
  };

  const handleSaveNote = async (activity: ActivityDTO, notes: string | null) => {
    await updateActivity.mutateAsync({ id: activity.id, data: { notes } });
  };

  const clearDragState = () => {
    pointerDragId.current = null;
    setDraggedId(null);
    setOverId(null);
  };

  const reorder = async (activeId: string, targetId: string) => {
    if (activeId === targetId || reorderActivities.isPending) return;
    const activityIds = allActivities.map((activity) => activity.id);
    const sourceIndex = activityIds.indexOf(activeId);
    const targetIndex = activityIds.indexOf(targetId);
    if (sourceIndex < 0 || targetIndex < 0) return;

    const [movedId] = activityIds.splice(sourceIndex, 1);
    activityIds.splice(targetIndex, 0, movedId);
    setPageError(null);
    try {
      await reorderActivities.mutateAsync(activityIds);
    } catch (cause) {
      setPageError(cause instanceof Error ? cause.message : 'Impossibile salvare il nuovo ordine.');
    }
  };

  const activityAtPoint = (clientX: number, clientY: number) =>
    document
      .elementFromPoint(clientX, clientY)
      ?.closest<HTMLElement>('[data-activity-id]')
      ?.dataset.activityId ?? null;

  const handlePointerDown = (activityId: string, event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === 'mouse' || reorderActivities.isPending) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerDragId.current = activityId;
    setDraggedId(activityId);
    setOverId(activityId);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!pointerDragId.current) return;
    event.preventDefault();
    const targetId = activityAtPoint(event.clientX, event.clientY);
    if (targetId) setOverId(targetId);
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const activeId = pointerDragId.current;
    if (!activeId) return;
    const targetId = activityAtPoint(event.clientX, event.clientY);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    clearDragState();
    if (targetId) void reorder(activeId, targetId);
  };

  const moveWithKeyboard = (activityId: string, direction: -1 | 1) => {
    const currentIndex = visibleActivities.findIndex((activity) => activity.id === activityId);
    const target = visibleActivities[currentIndex + direction];
    if (currentIndex >= 0 && target) void reorder(activityId, target.id);
  };

  const handleDelete = async (activity: ActivityDTO) => {
    if (!window.confirm(`Eliminare “${activity.title}”?`)) return;
    setBusyId(activity.id);
    setPageError(null);
    try {
      await deleteActivity.mutateAsync(activity.id);
      if (editing?.id === activity.id) {
        setEditing(null);
        setEditorVersion((version) => version + 1);
      }
    } catch (cause) {
      setPageError(cause instanceof Error ? cause.message : 'Impossibile eliminare l’attività.');
    } finally {
      setBusyId(null);
    }
  };

  const data = overview.data;
  const selectedLabel = format(parseISO(selectedDate), 'EEEE d MMMM', { locale: it });
  const typeBusy =
    installTypes.isPending || createType.isPending || updateType.isPending || deleteType.isPending;
  const filters: { key: ListFilter; label: string; count: number }[] = [
    { key: 'ALL', label: 'Tutti', count: allActivities.length },
    { key: 'DAY', label: 'Giornaliere', count: allActivities.filter((activity) => activity.kind === 'TASK' && activity.scope === 'DAY').length },
    { key: 'WEEK', label: 'Settimanali', count: allActivities.filter((activity) => activity.kind === 'TASK' && activity.scope === 'WEEK').length },
    { key: 'DEADLINE', label: 'Scadenze', count: allActivities.filter((activity) => activity.kind === 'DEADLINE').length },
  ];

  return (
    <div className="sm:ml-44 md:ml-48 lg:ml-52 2xl:ml-56 max-w-7xl pb-6 xl:max-w-none xl:h-full xl:flex xl:flex-col xl:overflow-hidden">
      <div className="mb-4 xl:shrink-0">
        <ActivityMonthCalendar selectedDate={selectedDate} today={today} onSelectDate={(date) => { setSelectedDate(date); setEditing(null); setEditorVersion((version) => version + 1); }} />
      </div>

      {overview.isLoading ? (
        <div className="card min-h-48 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
      ) : overview.isError || !data ? (
        <div className="card text-sm text-red-600">Impossibile caricare le attività. Riprova tra poco.</div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[20rem_minmax(0,1fr)] xl:grid-cols-[21rem_minmax(0,1fr)_21rem] 2xl:grid-cols-[24rem_minmax(0,1fr)_24rem] xl:flex-1 xl:min-h-0">
          <aside ref={editorRef} className={`${PANE_CLASS} lg:col-start-1 lg:row-start-1`}>
            <ActivityEditorPanel
              key={editing ? `edit-${editing.id}` : `new-${selectedDate}-${editorVersion}`}
              activity={editing}
              selectedDate={selectedDate}
              types={types.data ?? []}
              isSaving={createActivity.isPending || updateActivity.isPending}
              onSave={handleSave}
              onCancelEdit={() => { setEditing(null); setEditorVersion((version) => version + 1); }}
            />
          </aside>

          <main className={`${PANE_CLASS} lg:col-start-2 lg:row-start-1`}>
            <section className="card p-0 overflow-hidden min-h-64">
              <div className="sticky top-0 z-10 bg-white px-3 sm:px-4 py-3 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0"><CheckSquare2 className="w-4 h-4" /></div>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-sm font-semibold text-slate-900">Task ordinati per importanza</h2>
                    <p className="text-[11px] text-slate-500 truncate">Aperte · riepilogo del {selectedLabel}</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-500">{visibleActivities.length}</span>
                </div>
                <div className="flex gap-1.5 mt-3 overflow-x-auto pb-0.5">
                  {filters.map((entry) => (
                    <button
                      key={entry.key}
                      type="button"
                      onClick={() => setFilter(entry.key)}
                      className={`shrink-0 min-h-9 rounded-full px-3 text-xs font-medium transition-colors ${
                        filter === entry.key ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {entry.label} <span className="opacity-70">{entry.count}</span>
                    </button>
                  ))}
                </div>
              </div>

              {pageError && <div className="m-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{pageError}</div>}
              {visibleActivities.length === 0 ? (
                <div className="px-4 py-12 text-center">
                  <p className="text-sm text-slate-500">Nessun task in questa vista.</p>
                  <p className="mt-1 text-xs text-slate-400">Usa il pannello a sinistra per aggiungerne uno.</p>
                </div>
              ) : (
                <div className="space-y-2 bg-slate-50/60 p-2.5 sm:p-3">
                  {visibleActivities.map((activity) => (
                    <div
                      key={activity.id}
                      data-activity-id={activity.id}
                      onDragOver={(event) => {
                        if (!draggedId) return;
                        event.preventDefault();
                        event.dataTransfer.dropEffect = 'move';
                        setOverId(activity.id);
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        const activeId = event.dataTransfer.getData('text/plain') || draggedId;
                        clearDragState();
                        if (activeId) void reorder(activeId, activity.id);
                      }}
                      className={cn(
                        'rounded-xl transition-all',
                        draggedId === activity.id && 'opacity-40',
                        overId === activity.id && draggedId !== activity.id && 'ring-2 ring-sky-400 ring-offset-2'
                      )}
                    >
                      <ActivityCard
                        activity={activity}
                        today={today}
                        isBusy={busyId === activity.id}
                        dragHandleProps={{
                          draggable: !reorderActivities.isPending,
                          disabled: reorderActivities.isPending,
                          title: 'Trascina per riordinare',
                          'aria-label': `Riordina ${activity.title}`,
                          onDragStart: (event: ReactDragEvent<HTMLButtonElement>) => {
                            setDraggedId(activity.id);
                            setOverId(activity.id);
                            event.dataTransfer.effectAllowed = 'move';
                            event.dataTransfer.setData('text/plain', activity.id);
                          },
                          onDragEnd: clearDragState,
                          onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => handlePointerDown(activity.id, event),
                          onPointerMove: handlePointerMove,
                          onPointerUp: handlePointerUp,
                          onPointerCancel: clearDragState,
                          onKeyDown: (event: ReactKeyboardEvent<HTMLButtonElement>) => {
                            if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
                              event.preventDefault();
                              moveWithKeyboard(activity.id, event.key === 'ArrowUp' ? -1 : 1);
                            }
                          },
                        }}
                        onToggle={handleToggle}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                        onSaveNote={handleSaveNote}
                      />
                    </div>
                  ))}
                </div>
              )}
            </section>
          </main>

          <aside className={`${PANE_CLASS} lg:col-span-2 lg:row-start-2 xl:col-span-1 xl:col-start-3 xl:row-start-1`}>
            <ActivityToolsPanel
              summary={data.summary}
              types={types.data ?? []}
              isBusy={typeBusy}
              onInstallDefaults={async () => { await installTypes.mutateAsync(); }}
              onCreate={async (value) => { await createType.mutateAsync(value); }}
              onUpdate={async (key, value) => { await updateType.mutateAsync({ key, data: value }); }}
              onDelete={async (key) => { await deleteType.mutateAsync(key); }}
            />
          </aside>
        </div>
      )}
    </div>
  );
}
