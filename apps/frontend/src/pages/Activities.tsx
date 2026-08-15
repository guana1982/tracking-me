import { useState, type ReactNode } from 'react';
import { addDays, format, parseISO, startOfWeek } from 'date-fns';
import { it } from 'date-fns/locale';
import {
  AlertTriangle,
  CalendarClock,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CheckSquare2,
  Loader2,
  Plus,
  Settings2,
} from 'lucide-react';
import type { ActivityDTO, ActivityKindDTO, ActivityScopeDTO, UpdateActivityDTO } from '@budget/shared';
import { ActivityCard } from '../components/activities/ActivityCard';
import { ActivityFormModal, type ActivityFormData } from '../components/activities/ActivityFormModal';
import { ActivityTypeManager } from '../components/activities/ActivityTypeManager';
import {
  useActivityOverview,
  useActivityTypes,
  useCreateActivity,
  useCreateActivityType,
  useDeleteActivity,
  useDeleteActivityType,
  useInstallActivityTypes,
  useUpdateActivity,
  useUpdateActivityType,
} from '../hooks/useActivityQueries';

function localIsoDate(date = new Date()): string {
  return format(date, 'yyyy-MM-dd');
}

function shiftDate(date: string, amount: number): string {
  return localIsoDate(addDays(parseISO(date), amount));
}

interface NewActivityDefaults {
  kind: ActivityKindDTO;
  scope: ActivityScopeDTO;
  date: string;
}

interface ActivitySectionProps {
  title: string;
  subtitle: string;
  icon: ReactNode;
  activities: ActivityDTO[];
  emptyText: string;
  addLabel: string;
  today: string;
  busyId: string | null;
  onAdd: () => void;
  onToggle: (activity: ActivityDTO) => void;
  onEdit: (activity: ActivityDTO) => void;
  onDelete: (activity: ActivityDTO) => void;
}

function ActivitySection({
  title,
  subtitle,
  icon,
  activities,
  emptyText,
  addLabel,
  today,
  busyId,
  onAdd,
  onToggle,
  onEdit,
  onDelete,
}: ActivitySectionProps) {
  return (
    <section className="card p-0 overflow-hidden">
      <div className="flex items-center gap-3 px-3 sm:px-4 py-3 border-b border-slate-100">
        <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">{icon}</div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          <p className="text-[11px] text-slate-500 truncate">{subtitle}</p>
        </div>
        <span className="text-xs font-semibold text-slate-500 bg-slate-100 rounded-full px-2 py-1">{activities.length}</span>
        <button type="button" onClick={onAdd} className="w-10 h-10 sm:w-8 sm:h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50" title={addLabel}>
          <Plus className="w-4 h-4" />
        </button>
      </div>
      {activities.length === 0 ? (
        <button type="button" onClick={onAdd} className="w-full px-4 py-7 text-center hover:bg-slate-50">
          <p className="text-sm text-slate-400">{emptyText}</p>
          <span className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-blue-600"><Plus className="w-3.5 h-3.5" /> {addLabel}</span>
        </button>
      ) : (
        activities.map((activity) => (
          <ActivityCard key={activity.id} activity={activity} today={today} isBusy={busyId === activity.id} onToggle={onToggle} onEdit={onEdit} onDelete={onDelete} />
        ))
      )}
    </section>
  );
}

export function Activities() {
  const today = localIsoDate();
  const [selectedDate, setSelectedDate] = useState(today);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ActivityDTO | null>(null);
  const [defaults, setDefaults] = useState<NewActivityDefaults>({ kind: 'TASK', scope: 'DAY', date: today });
  const [typesOpen, setTypesOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);

  const overview = useActivityOverview(selectedDate);
  const types = useActivityTypes();
  const createActivity = useCreateActivity();
  const updateActivity = useUpdateActivity();
  const deleteActivity = useDeleteActivity();
  const installTypes = useInstallActivityTypes();
  const createType = useCreateActivityType();
  const updateType = useUpdateActivityType();
  const deleteType = useDeleteActivityType();

  const openCreate = (kind: ActivityKindDTO, scope: ActivityScopeDTO, date: string) => {
    setEditing(null);
    setDefaults({ kind, scope, date });
    setFormOpen(true);
  };

  const handleSave = async (data: ActivityFormData) => {
    if (editing) {
      const update: UpdateActivityDTO = { ...data, status: data.status };
      await updateActivity.mutateAsync({ id: editing.id, data: update });
    } else {
      const { status: _status, ...create } = data;
      await createActivity.mutateAsync(create);
    }
    setFormOpen(false);
    setEditing(null);
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

  const handleDelete = async (activity: ActivityDTO) => {
    if (!window.confirm(`Eliminare “${activity.title}”?`)) return;
    setBusyId(activity.id);
    setPageError(null);
    try {
      await deleteActivity.mutateAsync(activity.id);
    } catch (cause) {
      setPageError(cause instanceof Error ? cause.message : 'Impossibile eliminare l’attività.');
    } finally {
      setBusyId(null);
    }
  };

  const data = overview.data;
  const formattedDay = format(parseISO(selectedDate), 'EEEE d MMMM', { locale: it });
  const weekLabel = data
    ? `${format(parseISO(data.weekStart), 'd MMM', { locale: it })} – ${format(parseISO(data.weekEnd), 'd MMM', { locale: it })}`
    : '';
  const visibleWeekStart = startOfWeek(parseISO(selectedDate), { weekStartsOn: 1 });
  const visibleWeekDays = Array.from({ length: 7 }, (_, index) =>
    localIsoDate(addDays(visibleWeekStart, index))
  );
  const typeBusy = installTypes.isPending || createType.isPending || updateType.isPending || deleteType.isPending;

  return (
    <div className="sm:ml-44 md:ml-48 lg:ml-52 2xl:ml-56 max-w-6xl mx-auto space-y-4 pb-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Calendario e attività</h1>
          <p className="text-sm text-slate-500 mt-0.5">Organizza la giornata, la settimana e le prossime scadenze.</p>
        </div>
        <div className="grid grid-cols-[auto_1fr] sm:flex gap-2">
          <button type="button" onClick={() => setTypesOpen(true)} title="Gestisci tipologie" aria-label="Gestisci tipologie" className="btn btn-secondary min-h-11 flex items-center justify-center gap-2">
            <Settings2 className="w-4 h-4" /> <span className="hidden sm:inline">Tipologie</span>
          </button>
          <button type="button" onClick={() => openCreate('TASK', 'DAY', selectedDate)} className="btn btn-primary min-h-11 flex items-center justify-center gap-2">
            <Plus className="w-4 h-4" /> Nuova attività
          </button>
        </div>
      </div>

      <div className="card p-2 sm:p-3">
        <div className="flex items-center justify-between gap-2">
          <button type="button" onClick={() => setSelectedDate(shiftDate(selectedDate, -1))} className="w-11 h-11 rounded-xl hover:bg-slate-100 flex items-center justify-center" aria-label="Giorno precedente">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button type="button" onClick={() => setSelectedDate(today)} className="min-w-0 text-center px-2 py-1 rounded-xl hover:bg-slate-50">
            <p className="text-sm font-semibold text-slate-900 capitalize truncate">{formattedDay}</p>
            <p className="text-[11px] text-blue-600 mt-0.5">{selectedDate === today ? 'Oggi' : 'Torna a oggi'}</p>
          </button>
          <button type="button" onClick={() => setSelectedDate(shiftDate(selectedDate, 1))} className="w-11 h-11 rounded-xl hover:bg-slate-100 flex items-center justify-center" aria-label="Giorno successivo">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 mt-2 pt-2 border-t border-slate-100">
          {visibleWeekDays.map((day) => {
            const isSelected = day === selectedDate;
            const isToday = day === today;
            return (
              <button
                key={day}
                type="button"
                onClick={() => setSelectedDate(day)}
                className={`min-h-12 rounded-xl flex flex-col items-center justify-center text-xs transition-colors ${
                  isSelected
                    ? 'bg-slate-900 text-white'
                    : isToday
                      ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-200'
                      : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                <span className="text-[9px] uppercase">{format(parseISO(day), 'EEE', { locale: it }).slice(0, 2)}</span>
                <span className="mt-0.5 font-semibold">{format(parseISO(day), 'd')}</span>
              </button>
            );
          })}
        </div>
      </div>

      {overview.isLoading ? (
        <div className="card min-h-48 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
      ) : overview.isError || !data ? (
        <div className="card text-sm text-red-600">Impossibile caricare le attività. Riprova tra poco.</div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <div className="card p-3 sm:p-4"><p className="text-[10px] sm:text-xs text-slate-500">Oggi</p><p className="mt-1 text-lg sm:text-xl font-bold text-slate-900">{data.summary.todayCompleted}/{data.summary.todayTotal}</p><p className="hidden sm:block text-[11px] text-slate-400">completate</p></div>
            <div className="card p-3 sm:p-4"><p className="text-[10px] sm:text-xs text-slate-500">Settimana</p><p className="mt-1 text-lg sm:text-xl font-bold text-slate-900">{data.summary.weekCompleted}/{data.summary.weekTotal}</p><p className="hidden sm:block text-[11px] text-slate-400">completate</p></div>
            <div className="card p-3 sm:p-4"><p className="text-[10px] sm:text-xs text-slate-500">Scadute</p><p className={`mt-1 text-lg sm:text-xl font-bold ${data.summary.overdue > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{data.summary.overdue}</p><p className="hidden sm:block text-[11px] text-slate-400">da recuperare</p></div>
          </div>

          {pageError && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{pageError}</div>}

          <div className="grid lg:grid-cols-2 gap-4 items-start">
            <div className="space-y-4">
              <ActivitySection title="Oggi" subtitle={formattedDay} icon={<CheckSquare2 className="w-4 h-4" />} activities={data.today} emptyText="Nessuna attività per questa giornata." addLabel="Aggiungi attività" today={today} busyId={busyId} onAdd={() => openCreate('TASK', 'DAY', selectedDate)} onToggle={handleToggle} onEdit={(activity) => { setEditing(activity); setFormOpen(true); }} onDelete={handleDelete} />
              <ActivitySection title="Questa settimana" subtitle={weekLabel} icon={<CalendarDays className="w-4 h-4" />} activities={data.week} emptyText="Nessuna attività settimanale." addLabel="Aggiungi alla settimana" today={today} busyId={busyId} onAdd={() => openCreate('TASK', 'WEEK', data.weekStart)} onToggle={handleToggle} onEdit={(activity) => { setEditing(activity); setFormOpen(true); }} onDelete={handleDelete} />
            </div>
            <ActivitySection title="Scadenze" subtitle="Aperte e completate nella settimana" icon={<CalendarClock className="w-4 h-4" />} activities={data.deadlines} emptyText="Nessuna scadenza aperta." addLabel="Aggiungi scadenza" today={today} busyId={busyId} onAdd={() => openCreate('DEADLINE', 'DAY', selectedDate)} onToggle={handleToggle} onEdit={(activity) => { setEditing(activity); setFormOpen(true); }} onDelete={handleDelete} />
          </div>

          {data.summary.overdue > 0 && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              Hai {data.summary.overdue} {data.summary.overdue === 1 ? 'scadenza arretrata' : 'scadenze arretrate'} ancora aperte.
            </div>
          )}
        </>
      )}

      <ActivityFormModal isOpen={formOpen} activity={editing} initialKind={defaults.kind} initialScope={defaults.scope} initialDate={defaults.date} types={types.data ?? []} isSaving={createActivity.isPending || updateActivity.isPending} onClose={() => { setFormOpen(false); setEditing(null); }} onSave={handleSave} />
      <ActivityTypeManager isOpen={typesOpen} types={types.data ?? []} isBusy={typeBusy} onClose={() => setTypesOpen(false)} onInstallDefaults={async () => { await installTypes.mutateAsync(); }} onCreate={async (value) => { await createType.mutateAsync(value); }} onUpdate={async (key, value) => { await updateType.mutateAsync({ key, data: value }); }} onDelete={async (key) => { await deleteType.mutateAsync(key); }} />
    </div>
  );
}
