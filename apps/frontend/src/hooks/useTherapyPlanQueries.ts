import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { therapyPlanApi } from '../lib/therapyPlanApi';
import type {
  CreateMilestoneAttachmentDTO,
  CreateMilestoneDTO,
  CreateTitrationStepDTO,
  SaveWeightDTO,
  UpdateMilestoneDTO,
} from '@budget/shared';

// "food" prefix as everywhere else in the diary domain: one predicate sweep
// keeps schedule, weight and trends in step with what was just recorded
export const therapyPlanKeys = {
  titration: ['foodTitration'] as const,
  milestones: ['foodMilestones'] as const,
  advisories: ['foodExamAdvisories'] as const,
  schedule: ['foodSchedule'] as const,
  weight: ['foodWeight'] as const,
  trends: (from?: string, to?: string) =>
    ['foodTherapyTrends', from ?? 'default', to ?? 'today'] as const,
};

function invalidateFoodData(queryClient: QueryClient) {
  queryClient.invalidateQueries({
    predicate: (query) => String(query.queryKey[0]).startsWith('food'),
  });
}

// ---------- Titration ----------

export function useTitration() {
  return useQuery({ queryKey: therapyPlanKeys.titration, queryFn: therapyPlanApi.getTitration });
}

export function useCreateTitrationStep() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateTitrationStepDTO) => therapyPlanApi.createTitrationStep(data),
    onSuccess: () => invalidateFoodData(queryClient),
  });
}

export function useApplyTitrationStep() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => therapyPlanApi.applyTitrationStep(id),
    onSuccess: () => invalidateFoodData(queryClient),
  });
}

export function useDeleteTitrationStep() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => therapyPlanApi.removeTitrationStep(id),
    onSuccess: () => invalidateFoodData(queryClient),
  });
}

// ---------- Milestones ----------

export function useMilestones() {
  return useQuery({ queryKey: therapyPlanKeys.milestones, queryFn: therapyPlanApi.getMilestones });
}

export function useExamAdvisories(enabled = true) {
  return useQuery({
    queryKey: therapyPlanKeys.advisories,
    queryFn: therapyPlanApi.getAdvisories,
    enabled,
    staleTime: Infinity, // comes from a config file, not from user data
  });
}

export function useSchedule() {
  return useQuery({ queryKey: therapyPlanKeys.schedule, queryFn: therapyPlanApi.getSchedule });
}

export function useCreateMilestone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateMilestoneDTO) => therapyPlanApi.createMilestone(data),
    onSuccess: () => invalidateFoodData(queryClient),
  });
}

export function useUpdateMilestone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateMilestoneDTO }) =>
      therapyPlanApi.updateMilestone(id, data),
    onSuccess: () => invalidateFoodData(queryClient),
  });
}

export function useDeleteMilestone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => therapyPlanApi.removeMilestone(id),
    onSuccess: () => invalidateFoodData(queryClient),
  });
}

// ---------- Attachments (referti) ----------
// No query of their own: the metadata travels with the milestone list, so a
// file appears in the schedule the moment it is uploaded

export function useUploadMilestoneAttachment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      milestoneId,
      data,
    }: {
      milestoneId: string;
      data: CreateMilestoneAttachmentDTO;
    }) => therapyPlanApi.uploadMilestoneAttachment(milestoneId, data),
    onSuccess: () => invalidateFoodData(queryClient),
  });
}

export function useSetAttachmentInExport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, includeInExport }: { id: string; includeInExport: boolean }) =>
      therapyPlanApi.setAttachmentInExport(id, includeInExport),
    onSuccess: () => invalidateFoodData(queryClient),
  });
}

export function useDeleteAttachment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => therapyPlanApi.removeAttachment(id),
    onSuccess: () => invalidateFoodData(queryClient),
  });
}

// ---------- Weight ----------

export function useWeight() {
  return useQuery({ queryKey: therapyPlanKeys.weight, queryFn: therapyPlanApi.getWeight });
}

export function useSaveWeight() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: SaveWeightDTO) => therapyPlanApi.saveWeight(data),
    onSuccess: () => invalidateFoodData(queryClient),
  });
}

// ---------- Weekly reading ----------

export function useTherapyTrends(from?: string, to?: string) {
  return useQuery({
    queryKey: therapyPlanKeys.trends(from, to),
    queryFn: () => therapyPlanApi.getTrends(from, to),
  });
}
