import api from './axios';
import { Form, FormCreatePayload, FormUpdatePayload } from '@/types/form';

export interface PublishFormResponse { form_version_id: number; public_link: string; public_url: string; }
export interface SubmissionAnswer { id: number; field_label: string; field_type: string; display_order: number; value_text: string | null; file_download_url: string | null; file_url?: string | null; }
export interface FormSubmission { id: number; version_number: number; status: string; started_at: string; submitted_at: string | null; respondent_identifier: string | null; category?: string; ai_suggested_category?: string | null; author_overridden?: boolean; answers: SubmissionAnswer[]; }

/**
 * Create a new form. owner_id is set server-side from the JWT token.
 */
export const createForm = async (payload: FormCreatePayload): Promise<Form> => {
  const response = await api.post<Form>('/forms/', payload);
  return response.data;
};

/**
 * Retrieve the authenticated user's forms, newest first.
 * Archived forms are excluded by default; pass includeArchived=true to show them.
 */
export const getMyForms = async (includeArchived = false): Promise<Form[]> => {
  const response = await api.get<Form[]>('/forms/me', {
    params: { include_archived: includeArchived },
  });
  return response.data;
};

/**
 * Retrieve a single form by ID. Returns 403 if the form belongs to another user.
 */
export const getFormById = async (id: number): Promise<Form> => {
  const response = await api.get<Form>(`/forms/${id}`);
  return response.data;
};

/**
 * Update a form's title and/or description. Only the owner may update.
 */
export const updateForm = async (id: number, payload: FormUpdatePayload): Promise<Form> => {
  const response = await api.put<Form>(`/forms/${id}`, payload);
  return response.data;
};

/**
 * Soft-archive a form by setting its status to 'archived'. Owner only.
 * Archived forms disappear from getMyForms() unless includeArchived=true.
 */
export const archiveForm = async (id: number): Promise<Form> => {
  const response = await api.post<Form>(`/forms/${id}/archive`);
  return response.data;
};

export const unarchiveForm = async (id: number): Promise<Form> => {
  const response = await api.post<Form>(`/forms/${id}/unarchive`);
  return response.data;
};

export const restoreForm = async (id: number): Promise<Form> => {
  const response = await api.post<Form>(`/forms/${id}/restore`);
  return response.data;
};

export const deleteForm = async (id: number): Promise<Form> => {
  const response = await api.delete<Form>(`/forms/${id}`);
  return response.data;
};

export const permanentDeleteForm = async (id: number): Promise<Form> => {
  const response = await api.delete<Form>(`/forms/${id}/permanent`);
  return response.data;
};

export const publishForm = async (id: number, forceNewLink = false): Promise<PublishFormResponse> =>
  (await api.post<PublishFormResponse>(`/forms/${id}/publish`, null, { params: { force_new_link: forceNewLink } })).data;
export const unpublishForm = async (id: number): Promise<void> => { await api.post(`/forms/${id}/unpublish`); };
export const getPublishedFormLink = async (id: number): Promise<PublishFormResponse> => (await api.get<PublishFormResponse>(`/forms/${id}/public-link`)).data;
export interface SubmissionFilterParams {
  category?: string;
  status_filter?: string;
  search?: string;
  sort_by?: string;
  sort_order?: string;
  skip?: number;
  limit?: number;
}

export const getFormSubmissions = async (id: number, params?: SubmissionFilterParams): Promise<FormSubmission[]> => (await api.get<FormSubmission[]>(`/forms/${id}/submissions`, { params })).data;

export interface GraphCheckResult {
  valid: boolean;
  unreachable_sections?: number[];
  cycles?: any[];
}

export const checkFormGraph = async (formId: number): Promise<GraphCheckResult> => {
  const response = await api.get<GraphCheckResult>(`/public/forms/graph-check/form/${formId}`);
  return response.data;
};

