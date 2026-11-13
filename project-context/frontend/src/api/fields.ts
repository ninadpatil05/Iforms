import api from './axios';
import type { Field, FieldCreatePayload, FieldUpdatePayload, FormVersion } from '@/types/field';

export const getCurrentVersion = async (formId: number) => (await api.get<FormVersion>(`/forms/${formId}/current-version`)).data;
export const listFields = async (versionId: number) => (await api.get<Field[]>(`/fields/form-version/${versionId}`)).data;
export const createField = async (payload: FieldCreatePayload) => (await api.post<Field>('/fields/', payload)).data;
export const updateField = async (id: number, payload: FieldUpdatePayload) => (await api.put<Field>(`/fields/${id}`, payload)).data;
export const deleteField = async (id: number) => (await api.delete<Field>(`/fields/${id}`)).data;
export const reorderFields = async (versionId: number, fieldIds: number[]) => (await api.patch<Field[]>(`/fields/form-version/${versionId}/reorder`, { field_ids: fieldIds })).data;
