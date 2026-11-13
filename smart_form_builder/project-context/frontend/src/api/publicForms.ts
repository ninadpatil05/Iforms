import api from './axios';
import type { Field } from '@/types/field';
import type { Section } from '@/types/section';

export interface PublicConditionGroupCondition {
  trigger_field_id: number;
  operator: string;
  comparison_value: string | null;
}

export interface PublicConditionGroup {
  id: number;
  target_field_id: number;
  action: 'show' | 'hide' | 'require';
  combinator: 'AND' | 'OR';
  conditions: PublicConditionGroupCondition[];
}

export interface PublicForm {
  id: number;
  title: string;
  description: string | null;
  form_version_id: number;
  fields: Field[];
  sections: Section[];
  condition_groups?: PublicConditionGroup[];
}

export interface NextPageResponse {
  next_section_id: number | null;
  is_last_section: boolean;
}

export interface PreviousPageResponse {
  previous_section_id: number;
}

export interface SavedAnswer {
  field_id: number;
  value_text: string | null;
}

export const getPublicForm = async (publicLink: string, inviteToken?: string): Promise<PublicForm> =>
  (await api.get<PublicForm>(`/public/forms/${encodeURIComponent(publicLink)}`, { params: { invite: inviteToken } })).data;

export const getNextPage = async (
  publicLink: string,
  submissionId: number,
  currentSectionId: number,
  accessToken: string,
): Promise<NextPageResponse> =>
  (
    await api.post<NextPageResponse>(
      `/public/forms/${encodeURIComponent(publicLink)}/next-page`,
      { submission_id: submissionId, current_section_id: currentSectionId },
      { params: { access_token: accessToken } },
    )
  ).data;

export const getPreviousPage = async (
  publicLink: string,
  submissionId: number,
  accessToken: string,
): Promise<PreviousPageResponse> =>
  (
    await api.get<PreviousPageResponse>(
      `/public/forms/${encodeURIComponent(publicLink)}/previous-page`,
      { params: { submission_id: submissionId, access_token: accessToken } },
    )
  ).data;

export const getSavedAnswers = async (
  publicLink: string,
  submissionId: number,
  accessToken: string,
): Promise<SavedAnswer[]> =>
  (
    await api.get<SavedAnswer[]>(
      `/public/forms/${encodeURIComponent(publicLink)}/response-values/${submissionId}`,
      { params: { access_token: accessToken } },
    )
  ).data;
