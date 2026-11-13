import api from './axios';
import type { BranchRule, BranchRuleCreatePayload, BranchRuleUpdatePayload } from '@/types/branchRule';

export const listRulesForSection = async (fromSectionId: number) =>
  (await api.get<BranchRule[]>(`/branch-rules/section/${fromSectionId}`)).data;

export const createBranchRule = async (payload: BranchRuleCreatePayload) =>
  (await api.post<BranchRule>('/branch-rules/', payload)).data;

export const updateBranchRule = async (id: number, payload: BranchRuleUpdatePayload) =>
  (await api.put<BranchRule>(`/branch-rules/${id}`, payload)).data;

export const deleteBranchRule = async (id: number) =>
  (await api.delete<BranchRule>(`/branch-rules/${id}`)).data;

export const reorderBranchRules = async (fromSectionId: number, orderedRuleIds: number[]) =>
  (await api.patch<BranchRule[]>(`/branch-rules/section/${fromSectionId}/reorder`, { rule_ids: orderedRuleIds })).data;

