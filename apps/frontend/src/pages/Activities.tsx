import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent as ReactDragEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import { ArrowDownWideNarrow, CheckSquare2, Loader2, Plus, Search, Tags, X } from 'lucide-react';
import type { ActivityDTO, UpdateActivityDTO } from '@budget/shared';
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

/** Where a dragged card would land relative to the one under the pointer */
type DropTarget = { id: string; edge: 'before' | 'after' };

/** The month opened against one card's date, and where it was opened from */
type DatePicker = {
  activity: ActivityDTO;
  field: 'scheduledFor' | 'dueDate';
  x: number;
  y: number;
};

/** Roughly what the month panel measures, used only to keep it on screen */
const PICKER_WIDTH = 320;
const PICKER_HEIGHT = 430;
const PICKER_MARGIN = 12;

/** How close to the edge of the screen a finger has to be to start scrolling */
const AUTOSCROLL_EDGE = 80;
/** How long a finger has to rest on a card before it becomes a drag */
const LONG_PRESS_MS = 320;
/** Movement that means the finger meant to scroll, not to pick the card up */
const PRESS_SLOP = 10;

function localIsoDate(date = new Date()): string {
  return format(date, 'yyyy-MM-dd');
}

/**
 * The list is in the order the user put it in. Priority and due date are still
 * shown on the cards but no longer decide anything; the only thing that moves
 * a card on its own is finishing it, and it goes to the bottom so the open
 * ones stay together.
 */
function sortByPosition(left: ActivityDTO, right: ActivityDTO): number {
  if (left.status === 'DONE' && right.status !== 'DONE') return 1;
  if (left.status !== 'DONE' && right.status === 'DONE') return -1;
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

/** Above or below the card under the pointer, decided by its midline */
function edgeFor(clientY: number, element: HTMLElement): DropTarget['edge'] {
  const rect = element.getBoundingClientRect();
  return clientY < rect.top + rect.height / 2 ? 'before' : 'after';
}

function targetAtPoint(clientX: number, clientY: number): DropTarget | null {
  const element = document
    .elementFromPoint(clientX, clientY)
    ?.closest<HTMLElement>('[data-activity-id]');
  const id = element?.dataset.activityId;
  return element && id ? { id, edge: edgeFor(clientY, element) } : null;
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
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const [datePicker, setDatePicker] = useState<DatePicker | null>(null);
  const pointerDragId = useRef<string | null>(null);
  // Read synchronously by dragover: state has not necessarily been committed
  // by the time the first one arrives, and a dragover that does not
  // preventDefault is a dragover the browser refuses
  const dragSourceId = useRef<string | null>(null);
  const pressTimer = useRef<number | null>(null);
  const pressOrigin = useRef<{ x: number; y: number } | null>(null);
  // A long press that turned into a drag must not also fire the click of
  // whatever sat under the finger when it was released
  const swallowClick = useRef(false);
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
    return [...unique.values()].sort(sortByPosition);
  }, [overview.data]);

  const backlogIds = useMemo(
    () => new Set((overview.data?.backlog ?? []).map((activity) => activity.id)),
    [overview.data]
  );

  const weekStart = overview.data?.weekStart ?? selectedDate;

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

  const openDatePicker = (
    activity: ActivityDTO,
    field: DatePicker['field'],
    event: ReactMouseEvent<HTMLButtonElement>
  ) => {
    // Anchored under the label rather than at the raw pointer, so the month
    // hangs off the date it is about
    const rect = event.currentTarget.getBoundingClientRect();
    setDatePicker({ activity, field, x: rect.left, y: rect.bottom + 6 });
  };

  const saveActivityDate = async (data: UpdateActivityDTO) => {
    if (!datePicker) return;
    const { activity } = datePicker;
    setDatePicker(null);
    setBusyId(activity.id);
    setPageError(null);
    try {
      await updateActivity.mutateAsync({ id: activity.id, data });
    } catch (cause) {
      setPageError(cause instanceof Error ? cause.message : 'Impossibile aggiornare la data.');
    } finally {
      setBusyId(null);
    }
  };

  const stopAutoScroll = () => {
    if (autoScroll.current.frame !== null) cancelAnimationFrame(autoScroll.current.frame);
    autoScroll.current = { frame: null, speed: 0, container: null };
  };

  useEffect(() => stopAutoScroll, []);

  /**
   * The browser decides whether a touch scrolls the page the moment the finger
   * lands, and a `touch-action` set later does not change its mind. Blocking
   * the default here is what keeps the page still while a card is carried.
   */
  useEffect(() => {
    if (!draggedId) return undefined;
    const block = (event: TouchEvent) => {
      if (pointerDragId.current) event.preventDefault();
    };
    document.addEventListener('touchmove', block, { passive: false });
    return () => document.removeEventListener('touchmove', block);
  }, [draggedId]);

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

  const cancelPressTimer = () => {
    if (pressTimer.current !== null) window.clearTimeout(pressTimer.current);
    pressTimer.current = null;
    pressOrigin.current = null;
  };

  const clearDragState = () => {
    cancelPressTimer();
    pointerDragId.current = null;
    dragSourceId.current = null;
    stopAutoScroll();
    setDraggedId(null);
    setDropTarget(null);
  };

  /**
   * Starting a native drag makes the browser take the pointer away, and it
   * says so with a pointercancel. Tearing the drag down there would end it
   * before the first dragover, which is why the mouse only ever got the
   * no-drop cursor. Only a touch drag, which owns its pointer, ends here.
   */
  const handlePointerCancel = () => {
    cancelPressTimer();
    if (pointerDragId.current) clearDragState();
  };

  /**
   * Moves the card to where the insertion line was drawn. The whole list goes
   * to the server, not just the pair that swapped: position is what the order
   * is made of, and it is rewritten in one go.
   */
  const applyDrop = async (activeId: string, target: DropTarget) => {
    if (activeId === target.id) return;
    const activityIds = allActivities.map((activity) => activity.id);
    const sourceIndex = activityIds.indexOf(activeId);
    if (sourceIndex < 0) return;
    activityIds.splice(sourceIndex, 1);
    const anchorIndex = activityIds.indexOf(target.id);
    if (anchorIndex < 0) return;
    activityIds.splice(target.edge === 'before' ? anchorIndex : anchorIndex + 1, 0, activeId);

    setPageError(null);
    try {
      await reorderActivities.mutateAsync(activityIds);
    } catch (cause) {
      setPageError(cause instanceof Error ? cause.message : 'Impossibile salvare il nuovo ordine.');
    }
  };

  /** Lays the list out by priority and due date once, then leaves it alone. */
  const handleSortByRule = async () => {
    setPageError(null);
    try {
      await resetOrder.mutateAsync(undefined);
    } catch (cause) {
      setPageError(cause instanceof Error ? cause.message : 'Impossibile riordinare la lista.');
    }
  };

  const beginPointerDrag = (activityId: string, element: HTMLElement, pointerId: number) => {
    pointerDragId.current = activityId;
    setDraggedId(activityId);
    if (element.isConnected && !element.hasPointerCapture(pointerId)) {
      element.setPointerCapture(pointerId);
    }
    navigator.vibrate?.(15);
  };

  const handlePointerDown = (activityId: string, event: ReactPointerEvent<HTMLElement>) => {
    if (event.pointerType === 'mouse') return;
    const origin = event.target as HTMLElement;
    if (origin.closest('[data-no-drag]')) return;

    const element = event.currentTarget;
    const { pointerId, clientX, clientY } = event;
    pressOrigin.current = { x: clientX, y: clientY };

    // The grip still picks a card up straight away: it is the one spot on the
    // card that exists for nothing else
    if (origin.closest('[data-drag-handle]')) {
      event.preventDefault();
      beginPointerDrag(activityId, element, pointerId);
      return;
    }
    if (pressTimer.current !== null) window.clearTimeout(pressTimer.current);
    pressTimer.current = window.setTimeout(() => {
      pressTimer.current = null;
      beginPointerDrag(activityId, element, pointerId);
    }, LONG_PRESS_MS);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    if (!pointerDragId.current) {
      const origin = pressOrigin.current;
      if (origin && Math.hypot(event.clientX - origin.x, event.clientY - origin.y) > PRESS_SLOP) {
        cancelPressTimer();
      }
      return;
    }
    event.preventDefault();
    updateAutoScroll(event.clientY, event.currentTarget);
    setDropTarget(targetAtPoint(event.clientX, event.clientY));
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLElement>) => {
    const activeId = pointerDragId.current;
    if (!activeId) {
      cancelPressTimer();
      return;
    }
    const target = targetAtPoint(event.clientX, event.clientY);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    swallowClick.current = true;
    clearDragState();
    if (target) void applyDrop(activeId, target);
  };

  const moveWithKeyboard = (activityId: string, direction: -1 | 1) => {
    const currentIndex = visibleActivities.findIndex((activity) => activity.id === activityId);
    const target = visibleActivities[currentIndex + direction];
    if (currentIndex >= 0 && target) {
      void applyDrop(activityId, { id: target.id, edge: direction === -1 ? 'before' : 'after' });
    }
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

  // Dragging only makes sense against the whole list: with a filter or a
  // search on, the neighbours on screen are not the neighbours in the order
  const isReorderable = filter === 'ALL' && search.trim() === '';

  const dragPropsFor = (activity: ActivityDTO) =>
    isReorderable
      ? {
          onDragStart: (event: ReactDragEvent<HTMLElement>) => {
            dragSourceId.current = activity.id;
            setDraggedId(activity.id);
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', activity.id);
          },
          onDragEnd: clearDragState,
          onPointerDown: (event: ReactPointerEvent<HTMLElement>) =>
            handlePointerDown(activity.id, event),
          onPointerMove: handlePointerMove,
          onPointerUp: handlePointerUp,
          onPointerCancel: handlePointerCancel,
          onClickCapture: (event: ReactMouseEvent<HTMLElement>) => {
            if (!swallowClick.current) return;
            swallowClick.current = false;
            event.preventDefault();
            event.stopPropagation();
          },
        }
      : {};

  return (
    <div
      className={cn(
        'sm:ml-44 md:ml-48 lg:ml-52 2xl:ml-56',
        // Room for the docked summary, so the last cards stay clickable
        isSummaryOpen ? 'pb-[22rem] sm:pb-[17rem]' : 'pb-32 sm:pb-20'
      )}
    >
      <header className="mb-4">
        <ActivityWeekStrip
          selectedDate={selectedDate}
          today={today}
          isMonthOpen={isMonthOpen}
          onToggleMonth={() => setIsMonthOpen((open) => !open)}
          onSelectDate={selectDate}
          actions={
            /* The two setup panels are now errands, not scenery: a button each,
               and their width goes back to the list */
            <>
              <button
                type="button"
                onClick={openNewActivity}
                className="btn btn-primary min-h-9 px-2 sm:px-2.5 text-xs flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Nuova<span className="hidden sm:inline"> attività</span></span>
              </button>
              <button
                type="button"
                onClick={() => setIsTypesOpen(true)}
                className="btn btn-secondary min-h-9 px-2 sm:px-2.5 text-xs flex items-center gap-1.5"
                aria-label="Gestisci le tipologie"
              >
                <Tags className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Tipologie</span>
              </button>
            </>
          }
        />
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
                <button
                  type="button"
                  onClick={() => void handleSortByRule()}
                  disabled={resetOrder.isPending}
                  title="Riordina per priorità e scadenza, una volta sola. Dopo l’ordine torna a essere il tuo."
                  className="shrink-0 inline-flex items-center gap-1 rounded-full border border-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                >
                  {resetOrder.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowDownWideNarrow className="w-3 h-3" />}
                  <span className="hidden sm:inline">Riordina</span>
                </button>
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

              {!isReorderable && visibleActivities.length > 1 && (
                <p className="mt-2 text-[11px] text-slate-400">
                  Per spostare le schede togli la ricerca e torna al filtro «Tutti».
                </p>
              )}
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
              <div
                // The gaps between the cards belong to the list too: without
                // this the cursor flicks to "no drop" every time it crosses one
                onDragOver={(event) => {
                  if (!isReorderable || !(dragSourceId.current ?? draggedId)) return;
                  event.preventDefault();
                  event.dataTransfer.dropEffect = 'move';
                }}
                className="space-y-2 bg-slate-50/60 p-2.5 sm:p-3"
              >
                {visibleActivities.map((activity) => {
                  const isTarget =
                    dropTarget?.id === activity.id && draggedId !== null && draggedId !== activity.id;
                  return (
                    <div
                      key={activity.id}
                      data-activity-id={activity.id}
                      onDragOver={(event) => {
                        if (!isReorderable || !(dragSourceId.current ?? draggedId)) return;
                        event.preventDefault();
                        event.dataTransfer.dropEffect = 'move';
                        setDropTarget({
                          id: activity.id,
                          edge: edgeFor(event.clientY, event.currentTarget),
                        });
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        const activeId =
                          event.dataTransfer.getData('text/plain') ||
                          dragSourceId.current ||
                          draggedId;
                        // Read off the event, never off the state: the last
                        // dragover may not have been rendered yet
                        const edge = edgeFor(event.clientY, event.currentTarget);
                        clearDragState();
                        if (activeId) void applyDrop(activeId, { id: activity.id, edge });
                      }}
                      className="relative"
                    >
                      {isTarget && (
                        <span
                          aria-hidden="true"
                          className={cn(
                            'absolute left-1 right-1 z-10 h-0.5 rounded-full bg-sky-500',
                            dropTarget.edge === 'before' ? '-top-1' : '-bottom-1'
                          )}
                        />
                      )}
                      <ActivityCard
                        activity={activity}
                        today={today}
                        isBacklog={backlogIds.has(activity.id)}
                        isBusy={busyId === activity.id}
                        isDragging={draggedId === activity.id}
                        canDrag={isReorderable}
                        dragProps={dragPropsFor(activity)}
                        dragHandleProps={{
                          title: isReorderable ? 'Trascina la scheda per spostarla' : undefined,
                          'aria-label': `Sposta ${activity.title}`,
                          tabIndex: isReorderable ? 0 : -1,
                          onKeyDown: (event: ReactKeyboardEvent<HTMLButtonElement>) => {
                            if (!isReorderable) return;
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
                        onPickDate={openDatePicker}
                      />
                    </div>
                  );
                })}
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
              isSorting={resetOrder.isPending}
              onSortByRule={handleSortByRule}
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

      {datePicker && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setDatePicker(null)} />
          <div
            className="fixed z-50 w-80 max-w-[calc(100vw-1.5rem)]"
            style={{
              left: Math.max(
                PICKER_MARGIN,
                Math.min(datePicker.x, window.innerWidth - PICKER_WIDTH - PICKER_MARGIN)
              ),
              top: Math.max(
                PICKER_MARGIN,
                Math.min(datePicker.y, window.innerHeight - PICKER_HEIGHT - PICKER_MARGIN)
              ),
            }}
          >
            <ActivityMonthPanel
              // The month it opens on is the card's own date, not the day the
              // page happens to be showing
              selectedDate={
                (datePicker.field === 'dueDate'
                  ? datePicker.activity.dueDate
                  : datePicker.activity.scheduledFor) ?? selectedDate
              }
              today={today}
              caption={
                <>
                  <p className="font-semibold text-slate-700 truncate">{datePicker.activity.title}</p>
                  <p>
                    {datePicker.field === 'dueDate'
                      ? 'Scegli entro quando va chiusa.'
                      : datePicker.activity.scope === 'WEEK'
                        ? 'Scegli un giorno: il task si sposta alla sua settimana.'
                        : 'Scegli il giorno del task.'}
                  </p>
                </>
              }
              footer={
                datePicker.field === 'dueDate' && datePicker.activity.dueDate ? (
                  <button
                    type="button"
                    onClick={() => void saveActivityDate({ dueDate: null, dueTime: null })}
                    className="btn btn-secondary min-h-8 w-full px-2 text-[11px]"
                  >
                    Togli la data entro cui chiudere
                  </button>
                ) : undefined
              }
              onClose={() => setDatePicker(null)}
              onSelectDate={(date) =>
                void saveActivityDate(
                  datePicker.field === 'dueDate' ? { dueDate: date } : { scheduledFor: date }
                )
              }
            />
          </div>
        </>
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
