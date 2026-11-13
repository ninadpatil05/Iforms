import api from './axios';

export interface DuplicateOverrideRequestItem {
  id: number;
  form_id: number;
  submission_id: number;
  duplicate_value: string | null;
  status: string;
  requested_at: string;
  decided_at: string | null;
}

export const getDuplicateOverrideRequests = async (
  formId: number
): Promise<DuplicateOverrideRequestItem[]> => {
  const response = await api.get<DuplicateOverrideRequestItem[]>(
    `/forms/${formId}/duplicate-override-requests`
  );
  return response.data;
};

export const approveDuplicateOverrideRequest = async (
  requestId: number
): Promise<DuplicateOverrideRequestItem> => {
  const response = await api.post<DuplicateOverrideRequestItem>(
    `/duplicate-override-requests/${requestId}/approve`
  );
  return response.data;
};

export const denyDuplicateOverrideRequest = async (
  requestId: number
): Promise<DuplicateOverrideRequestItem> => {
  const response = await api.post<DuplicateOverrideRequestItem>(
    `/duplicate-override-requests/${requestId}/deny`
  );
  return response.data;
};
