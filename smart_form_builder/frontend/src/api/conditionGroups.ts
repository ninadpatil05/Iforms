import api from './axios';
import type { ConditionGroup, ConditionGroupCreatePayload, ConditionGroupUpdatePayload } from '@/types/conditionGroup';

export const listGroupsForVersion = async (formVersionId: number) =>
  (await api.get<ConditionGroup[]>(`/condition-groups/form-version/${formVersionId}`)).data;

export const createConditionGroup = async (payload: ConditionGroupCreatePayload) =>
  (await api.post<ConditionGroup>('/condition-groups/', payload)).data;

export const updateConditionGroup = async (id: number, payload: ConditionGroupUpdatePayload) =>
  (await api.put<ConditionGroup>(`/condition-groups/${id}`, payload)).data;

export const deleteConditionGroup = async (id: number) =>
  (await api.delete<ConditionGroup>(`/condition-groups/${id}`)).data;
