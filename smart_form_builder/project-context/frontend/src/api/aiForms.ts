import api from './axios';
import { AiFormDraft, AiFormGenerationResult } from '@/types/aiForm';
import { Form } from '@/types/form';

export const generateForm = async (prompt: string): Promise<AiFormDraft> => {
  const response = await api.post<AiFormDraft>('/ai/forms/generate', { prompt });
  return response.data;
};

export const regenerateDraft = async (
  draftId: number,
  prompt?: string
): Promise<AiFormDraft> => {
  const response = await api.post<AiFormDraft>(`/ai/forms/${draftId}/regenerate`, {
    prompt,
  });
  return response.data;
};

export const acceptDraft = async (
  draftId: number,
  editedDraft: AiFormGenerationResult
): Promise<Form> => {
  const response = await api.post<Form>(`/ai/forms/${draftId}/accept`, {
    edited_draft: editedDraft,
  });
  return response.data;
};

export const discardDraft = async (draftId: number): Promise<void> => {
  await api.delete(`/ai/forms/${draftId}`);
};
