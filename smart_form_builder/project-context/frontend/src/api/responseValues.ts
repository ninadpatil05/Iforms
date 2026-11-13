import api from './axios';

export interface ResponseValue { id: number; submission_id: number; field_id: number; value_text: string | null; file_url: string | null; }

export const createResponseValue = async (submissionId: number, fieldId: number, valueText: string): Promise<ResponseValue> =>
  (await api.post<ResponseValue>('/response-values/', { submission_id: submissionId, field_id: fieldId, value_text: valueText })).data;

export const uploadResponseFile = async (submissionId: number, fieldId: number, file: File, onProgress?: (percent: number) => void): Promise<ResponseValue> => {
  const data = new FormData();
  data.append('submission_id', String(submissionId));
  data.append('field_id', String(fieldId));
  data.append('file', file);
  return (await api.post<ResponseValue>('/response-values/upload', data, {
    onUploadProgress: (event) => onProgress?.(event.total ? Math.round((event.loaded / event.total) * 100) : 0),
  })).data;
};

export const listResponseValues = async (submissionId: number): Promise<ResponseValue[]> =>
  (await api.get<ResponseValue[]>(`/response-values/submission/${submissionId}`)).data;

export const downloadResponseFile = async (responseValueId: number): Promise<Blob> =>
  (await api.get(`/response-values/${responseValueId}/file`, { responseType: 'blob' })).data;
