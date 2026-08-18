import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent as ReactDragEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import { CheckSquare2, Loader2, Plus, RotateCcw, Search, Tags, X } from 'lucide-react';
import type { ActivityDTO, ActivityPriorityDTO, UpdateActivityDTO } from '@budget/shared';
import { ActivityCard } from '../components/activities/ActivityCard';
import { ActivityEditorModal } from '../components/activities/ActivityEditorModal';
import type { ActivityEditorData } from '../components/activities/ActivityEditorPanel';
import { ActivityMonthPanel, ActivityWeekStrip } from '../components/activities/ActivityCalendar';
import { ActivitySummaryDock } from '../components/activities/ActivitySummaryDock';
import { ActivityTypesModal } from '../components/activities/ActivityTypesModal';
import {
  useActivityOverview,
  useActivityTypes,
  useCreateActivity,
  useCreateActivityType,
  useDeleteActivity,
  useDeleteActivityType,
  useInstallActivityTypes,
  useReorderActivities,
  useResetActivityOrder,
  useUpdateActivity,
  useUpdateActivityType,
} from '../hooks/useActivityQueries';
import { cn } from '../lib/utils';

type ListFilter = 'ALL' | 'DAY' | 'WEEK' | 'DEADLINE' | 'BACKLOG' | 'DONE';

const PRIORITY_WEIGHT: Record<ActivityPriorityDTO, number> = {
  URGENT: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

/** How close to the edge of the screen a finger has to be to start scrolling */
const AUTOSCROLL_EDGE = 80;

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

/** The element that actually scrolls: the page shell on desktop, the window on a phone */
function scrollableAncestor(node: HTMLElement | null): HTMLElement | null {
  for (let element = node; element; element = element.parentElement) {
    const overflowY = window.getComputedStyle(element).overflowY;
    if (/(auto|scroll)/.test(overflowY) && element.scrollHeight > element.clientHeight) {
      return element;
    }
  }
  return null;
}

export function Activities() {
  const today = localIsoDate();
  const [selectedDate, setSelectedDate] = useState(today);
  const [editing, setEditing] = useState<ActivityDTO | null>(null);
  const [editorVersion, setEditorVersion] = useState(0);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isTypesOpen, setIsTypesOpen] = useState(false);
  const [isMonthOpen, setIsMonthOpen] = useState(false);
  // Lifted out of the dock because the page has to reserve room for it: a
  // fixed panel over the last cards would put the handle and the checkbox
  // out of reach
  const [isSummaryOpen, setIsSummaryOpen] = useState(() => window.innerWidth >= 640);
  const [filter, setFilter] = useState<ListFilter>('ALL');
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const pointerDragId = useRef<string | null>(null);
  const autoScroll = useRef<{ frame: number | null; speed: number; container: HTMLElement | null }>({
    frame: null,
    speed: 0,
    container: null,
  });

  const overview = useActivityOverview(selectedDate);
  const types = useActivityTypes();
  const createActivity = useCreateActivity();
  const updateActivity = useUpdateActivity();
  const reorderActivities = useReorderActivities();
  const resetOrder = useResetActivityOrder();
  const deleteActivity = useDeleteActivity();
  const installTypes = useInstallActivityTypes();
  const createType = useCreateActivityType();
  const updateType = useUpdateActivityType();
  const deleteType = useDeleteActivityType();

  const allActivities = useMemo(() => {
    if (!overview.data) return [];
    const source = Array.isArray(overview.data.all)
      ? overview.data.all
      : [
          ...overview.data.today,
          ...overview.data.week,
          ...overview.data.deadlines,
          ...(overview.data.backlog ?? []),
        ];
    const unique = new Map(source.map((activity) => [activity.id, activity]));
    return [...unique.values()].sort(sortByImportance);
  }, [overview.data]);

  const backlogIds = useMemo(
    () => new Set((overview.data?.backlog ?? []).map((activity) => activity.id)),
    [overview.data]
  );

  const weekStart = overview.data?.weekStart ?? selectedDate;
  const isManualOrder = allActivities.some((activity) => activity.isManuallyPositioned);

  const matchesFilter = (activity: ActivityDTO, key: ListFilter) => {
    if (key === 'DAY') {
      return (
        activity.kind === 'TASK' && activity.scope === 'DAY' && activity.scheduledFor === selectedDate
      );
    }
    if (key === 'WEEK') {
      return (
        activity.kind === 'TASK' && activity.scope === 'WEEK' && activity.scheduledFor === weekStart
      );
    }
    if (key === 'DEADLINE') return activity.kind === 'DEADLINE';
    if (key === 'BACKLOG') return backlogIds.has(activity.id);
    if (key === 'DONE') return activity.status === 'DONE';
    return true;
  };

  const visibleActivities = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return allActivities.filter((activity) => {
      if (!matchesFilter(activity, filter)) return false;
      if (!needle) return true;
      return [activity.title, activity.notes, activity.typeName]
        .filter((value): value is string => Boolean(value))
        .some((value) => value.toLowerCase().includes(needle));
    });
    // matchesFilter closes over the same values the deps already cover
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allActivities, backlogIds, filter, search, selectedDate, weekStart]);

  const openNewActivity = () => {
    setEditing(null);
    setEditorVersion((version) => version + 1);
    setIsEditorOpen(true);
  };

  const closeEditor = () => {
    setIsEditorOpen(false);
    setEditing(null);
    setEditorVersion((version) => version + 1);
  };

  const handleSave = async (data: ActivityEditorData) => {
    if (editing) {
      const update: UpdateActivityDTO = { ...data, status: data.status };
      await updateActivity.mutateAsync({ id: editing.id, data: update });
    } else {
      const { status: _status, ...create } = data;
      await createActivity.mutateAsync(create);
    }
    closeEditor();
  };

  const handleEdit = (activity: ActivityDTO) => {
    setEditing(activity);
    setIsEditorOpen(true);
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

  const stopAutoScroll = () => {
    if (autoScroll.current.frame !== null) cancelAnimationFrame(autoScroll.current.frame);
    autoScroll.current = { frame: null, speed: 0, container: null };
  };

  useEffect(() => stopAutoScroll, []);

  const stepAutoScroll = () => {
    const { speed, container } = autoScroll.current;
    if (speed === 0) {
      autoScroll.current.frame = null;
      return;
    }
    if (container) container.scrollBy(0, speed);
    else window.scrollBy(0, speed);
    autoScroll.current.frame = requestAnimationFrame(stepAutoScroll);
  };

  /**
   * A finger cannot drag past the edge of the screen, so a long list would be
   * impossible to reorder on a phone without the list coming to meet it.
   */
  const updateAutoScroll = (clientY: number, node: HTMLElement) => {
    const height = window.innerHeight;
    const speed =
      clientY < AUTOSCROLL_EDGE
        ? -Math.ceil((AUTOSCROLL_EDGE - clientY) / 5)
        : clientY > height - AUTOSCROLL_EDGE
          ? Math.ceil((clientY - (height - AUTOSCROLL_EDGE)) / 5)
          : 0;

    if (speed === 0) {
      stopAutoScroll();
      return;
    }
    autoScroll.current.speed = speed;
    if (!autoScroll.current.container) autoScroll.current.container = scrollableAncestor(node);
    if (autoScroll.current.frame === null) {
      autoScroll.current.frame = requestAnimationFrame(stepAutoScroll);
    }
  };

  const clearDragState = () => {
    pointerDragId.current = null;
    stopAutoScroll();
    setDraggedId(null);
    setOverId(null);
  };

  const reorder = async (activeId: string, targetId: string) => {
    if (activeId === targetId) return;
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

  /**
   * Resets everywhere, not just what is on screen: a drag marks every card
   * loaded at that moment, so a reset scoped to the current day would leave
   * other days quietly stuck in manual order.
   */
  const handleResetOrder = async () => {
    setPageError(null);
    try {
      await resetOrder.mutateAsync(undefined);
    } catch (cause) {
      setPageError(cause instanceof Error ? cause.message : 'Impossibile ripristinare l’ordine.');
    }
  };

  const activityAtPoint = (clientX: number, clientY: number) =>
    document
      .elementFromPoint(clientX, clientY)
      ?.closest<HTMLElement>('[data-activity-id]')
      ?.dataset.activityId ?? null;

  const handlePointerDown = (activityId: string, event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === 'mouse') return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerDragId.current = activityId;
    setDraggedId(activityId);
    setOverId(activityId);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!pointerDragId.current) return;
    event.preventDefault();
    updateAutoScroll(event.clientY, event.currentTarget);
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
      if (editing?.id === activity.id) closeEditor();
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
  const countFor = (key: ListFilter) =>
    allActivities.filter((activity) => matchesFilter(activity, key)).length;
  const filters: { key: ListFilter; label: string; count: number }[] = [
    { key: 'ALL', label: 'Tutti', count: allActivities.length },
    { key: 'DAY', label: 'Giornaliere', count: countFor('DAY') },
    { key: 'WEEK', label: 'Settimanali', count: countFor('WEEK') },
    { key: 'DEADLINE', label: 'Scadenze', count: countFor('DEADLINE') },
    { key: 'BACKLOG', label: 'Arretrati', count: backlogIds.size },
    { key: 'DONE', label: 'Completate', count: countFor('DONE') },
  ];

  const selectDate = (date: string) => {
    setSelectedDate(date);
    setEditing(null);
    setEditorVersion((version) => version + 1);
  };

  return (
    <div
      className={cn(
        'sm:ml-44 md:ml-48 lg:ml-52 2xl:ml-56',
        // Room for the docked summary, so the last cards stay clickable
        isSummaryOpen ? 'pb-[22rem] sm:pb-[17rem]' : 'pb-32 sm:pb-20'
      )}
    >
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <ActivityWeekStrip
            selectedDate={selectedDate}
            today={today}
            isMonthOpen={isMonthOpen}
            onToggleMonth={() => setIsMonthOpen((open) => !open)}
            onSelectDate={selectDate}
          />
        </div>

        {/* The two setup panels are now errands, not scenery: they get a button
            each and give their width back to the list */}
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={openNewActivity}
            className="btn btn-primary min-h-10 px-3 text-xs flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Nuova<span className="hidden sm:inline"> attività</span></span>
          </button>
          <button
            type="button"
            onClick={() => setIsTypesOpen(true)}
            className="btn btn-secondary min-h-10 px-3 text-xs flex items-center gap-1.5"
            aria-label="Gestisci le tipologie"
          >
            <Tags className="w-4 h-4" />
            <span className="hidden sm:inline">Tipologie</span>
          </button>
        </div>
      </header>

      {overview.isLoading ? (
        <div className="card min-h-48 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
      ) : overview.isError || !data ? (
        <div className="card text-sm text-red-600">Impossibile caricare le attività. Riprova tra poco.</div>
      ) : (
        <>
          <section className="card p-0 overflow-hidden min-h-64">
            <div className="sticky top-0 z-10 bg-white px-3 sm:px-4 py-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0"><CheckSquare2 className="w-4 h-4" /></div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-sm font-semibold text-slate-900">Da fare</h2>
                  <p className="text-[11px] text-slate-500 truncate capitalize">{selectedLabel}</p>
                </div>
                {isManualOrder && (
                  <button
                    type="button"
                    onClick={() => void handleResetOrder()}
                    disabled={resetOrder.isPending}
                    title="Torna all’ordine per priorità e scadenza"
                    className="shrink-0 inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-50"
                  >
                    {resetOrder.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                    Ordine manuale
                  </button>
                )}
                <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-500">{visibleActivities.length}</span>
              </div>

              <div className="mt-3 flex flex-col gap-2 lg:flex-row lg:items-center">
                <div className="relative lg:w-80 lg:shrink-0">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Cerca nel titolo, nelle note o nella tipologia"
                    aria-label="Cerca tra le attività"
                    className="input w-full min-h-9 pl-8 pr-8 text-xs"
                  />
                  {search && (
                    <button
                      type="button"
                      onClick={() => setSearch('')}
                      aria-label="Azzera la ricerca"
                      className="absolute right-1 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex gap-1.5 overflow-x-auto pb-0.5">
                  {filters.map((entry) => (
                    <button
                      key={entry.key}
                      type="button"
                      onClick={() => setFilter(entry.key)}
                      className={cn(
                        'shrink-0 min-h-9 rounded-full px-3 text-xs font-medium transition-colors',
                        filter === entry.key
                          ? 'bg-slate-900 text-white'
                          : entry.key === 'BACKLOG' && entry.count > 0
                            ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      )}
                    >
                      {entry.label} <span className="opacity-70">{entry.count}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {pageError && <div className="m-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{pageError}</div>}
            {visibleActivities.length === 0 ? (
              <div className="px-4 py-12 text-center">
                <p className="text-sm text-slate-500">
                  {search.trim() ? 'Nessun risultato per questa ricerca.' : 'Niente in questa vista.'}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {search.trim()
                    ? 'Prova con un’altra parola o cambia filtro.'
                    : 'Aggiungi un task con il pulsante «Nuova attività», o scegli un altro giorno dal calendario.'}
                </p>
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
                      isBacklog={backlogIds.has(activity.id)}
                      isBusy={busyId === activity.id}
                      dragHandleProps={{
                        draggable: true,
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

          {/* On a phone the two docks would sit on top of each other, and the
              month is the one that was just asked for */}
          <div className={isMonthOpen ? 'hidden sm:block' : undefined}>
            <ActivitySummaryDock
              summary={data.summary}
              isOpen={isSummaryOpen}
              onOpenChange={setIsSummaryOpen}
              isManualOrder={isManualOrder}
              isResettingOrder={resetOrder.isPending}
              onResetOrder={handleResetOrder}
            />
          </div>
        </>
      )}

      {isMonthOpen && (
        <div className="fixed z-30 bottom-20 right-3 sm:bottom-4 sm:right-4 w-80 max-w-[calc(100vw-1.5rem)]">
          <ActivityMonthPanel
            selectedDate={selectedDate}
            today={today}
            onClose={() => setIsMonthOpen(false)}
            onSelectDate={selectDate}
          />
        </div>
      )}

      <ActivityEditorModal
        key={editing ? `edit-${editing.id}` : `new-${selectedDate}-${editorVersion}`}
        isOpen={isEditorOpen}
        onClose={closeEditor}
        activity={editing}
        selectedDate={selectedDate}
        types={types.data ?? []}
        isSaving={createActivity.isPending || updateActivity.isPending}
        onSave={handleSave}
      />

      <ActivityTypesModal
        isOpen={isTypesOpen}
        onClose={() => setIsTypesOpen(false)}
        types={types.data ?? []}
        isBusy={typeBusy}
        onInstallDefaults={async () => { await installTypes.mutateAsync(); }}
        onCreate={async (value) => { await createType.mutateAsync(value); }}
        onUpdate={async (key, value) => { await updateType.mutateAsync({ key, data: value }); }}
        onDelete={async (key) => { await deleteType.mutateAsync(key); }}
      />
    </div>
  );
}
