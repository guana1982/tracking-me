// ============================================================
// Activities - tasks, weekly planning and deadlines
// ============================================================

export const ACTIVITY_KINDS = ['TASK', 'DEADLINE'] as const;
export type ActivityKindDTO = (typeof ACTIVITY_KINDS)[number];

export const ACTIVITY_KIND_LABELS: Record<ActivityKindDTO, string> = {
  TASK: 'Attività',
  DEADLINE: 'Scadenza',
};

export const ACTIVITY_SCOPES = ['DAY', 'WEEK'] as const;
export type ActivityScopeDTO = (typeof ACTIVITY_SCOPES)[number];

export const ACTIVITY_SCOPE_LABELS: Record<ActivityScopeDTO, string> = {
  DAY: 'Giorno',
  WEEK: 'Settimana',
};

export const ACTIVITY_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
export type ActivityPriorityDTO = (typeof ACTIVITY_PRIORITIES)[number];

export const ACTIVITY_PRIORITY_LABELS: Record<ActivityPriorityDTO, string> = {
  LOW: 'Bassa',
  MEDIUM: 'Media',
  HIGH: 'Alta',
  URGENT: 'Urgente',
};

export const ACTIVITY_STATUSES = ['TODO', 'IN_PROGRESS', 'DONE'] as const;
export type ActivityStatusDTO = (typeof ACTIVITY_STATUSES)[number];

export const ACTIVITY_STATUS_LABELS: Record<ActivityStatusDTO, string> = {
  TODO: 'Da fare',
  IN_PROGRESS: 'In corso',
  DONE: 'Completata',
};

export interface ActivityTypeSeed {
  name: string;
  color: string;
  kind: ActivityKindDTO;
}

export const DEFAULT_ACTIVITY_TYPES: ActivityTypeSeed[] = [
  { name: 'Lavoro', color: '#3b82f6', kind: 'TASK' },
  { name: 'Casa', color: '#10b981', kind: 'TASK' },
  { name: 'Personale', color: '#8b5cf6', kind: 'TASK' },
  { name: 'Amministrativa', color: '#f59e0b', kind: 'DEADLINE' },
  { name: 'Pagamento', color: '#ef4444', kind: 'DEADLINE' },
  { name: 'Salute', color: '#06b6d4', kind: 'DEADLINE' },
];

export interface ActivityTypeDTO {
  key: string;
  name: string;
  color: string;
  kind: ActivityKindDTO;
  position: number;
  isActive: boolean;
  isDefault: boolean;
}

export interface CreateActivityTypeDTO {
  name: string;
  color: string;
  kind: ActivityKindDTO;
}

export interface UpdateActivityTypeDTO {
  name?: string;
  color?: string;
  position?: number;
  isActive?: boolean;
}

export interface ActivityDTO {
  id: string;
  title: string;
  notes: string | null;
  kind: ActivityKindDTO;
  scope: ActivityScopeDTO;
  scheduledFor: string;
  dueDate: string | null;
  dueTime: string | null;
  priority: ActivityPriorityDTO;
  status: ActivityStatusDTO;
  typeKey: string | null;
  typeName: string | null;
  typeColor: string | null;
  position: number;
  isManuallyPositioned: boolean;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReorderActivitiesDTO {
  activityIds: string[];
}

export interface CreateActivityDTO {
  title: string;
  notes?: string | null;
  kind?: ActivityKindDTO;
  scope?: ActivityScopeDTO;
  scheduledFor: string;
  dueDate?: string | null;
  dueTime?: string | null;
  priority?: ActivityPriorityDTO;
  typeKey?: string | null;
}

export interface UpdateActivityDTO {
  title?: string;
  notes?: string | null;
  kind?: ActivityKindDTO;
  scope?: ActivityScopeDTO;
  scheduledFor?: string;
  dueDate?: string | null;
  dueTime?: string | null;
  priority?: ActivityPriorityDTO;
  status?: ActivityStatusDTO;
  typeKey?: string | null;
  position?: number;
}

export interface ActivityOverviewDTO {
  date: string;
  weekStart: string;
  weekEnd: string;
  /** Every open item, plus completed items belonging to the selected day/week. */
  all: ActivityDTO[];
  today: ActivityDTO[];
  week: ActivityDTO[];
  deadlines: ActivityDTO[];
  summary: {
    todayCompleted: number;
    todayTotal: number;
    weekCompleted: number;
    weekTotal: number;
    overdue: number;
  };
}
