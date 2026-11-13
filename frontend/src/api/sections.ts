import api from './axios';
import type { Section, SectionCreatePayload, SectionUpdatePayload } from '@/types/section';

export const listSections = async (versionId: number) =>
  (await api.get<Section[]>(`/sections/form-version/${versionId}`)).data;

export const createSection = async (payload: SectionCreatePayload) =>
  (await api.post<Section>('/sections/', payload)).data;

export const updateSection = async (id: number, payload: SectionUpdatePayload) =>
  (await api.put<Section>(`/sections/${id}`, payload)).data;

export const deleteSection = async (id: number) =>
  (await api.delete<Section>(`/sections/${id}`)).data;

export const reorderSections = async (versionId: number, sectionIds: number[]) =>
  (await api.patch<Section[]>(`/sections/form-version/${versionId}/reorder`, { section_ids: sectionIds })).data;

export const previewNextPage = async (sectionId: number, answers: Record<number, string | null>) =>
  (await api.post<{ next_section_id: number | null; is_last_section: boolean }>(`/sections/${sectionId}/preview-next-page`, { answers })).data;
