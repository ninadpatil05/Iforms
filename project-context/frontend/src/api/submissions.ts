import api from './axios';

export interface Submission {
  id: number;
  form_version_id: number;
  status: string;
  started_at: string;
  submitted_at: string | null;
}

/** Returned by POST /submissions/ — carries the one-time access token. */
export interface SubmissionCreateResponse extends Submission {
  access_token: string;
}

export const createSubmission = async (
  formVersionId: number,
  inviteToken?: string
): Promise<SubmissionCreateResponse> => {
  const response = await api.post<SubmissionCreateResponse>('/submissions/', {
    form_version_id: formVersionId,
    invite_token: inviteToken,
  });
  return response.data;
};

export const startSubmission = createSubmission;

export const saveSubmissionValues = async (
  submissionId: number,
  accessToken: string,
  values: Record<number, string>
): Promise<void> => {
  try {
    await api.post(
      `/submissions/${submissionId}/save-values`,
      { values },
      { headers: { 'x-submission-token': accessToken } }
    );
  } catch {
    // Fallback to individual response values save
    await Promise.all(
      Object.entries(values).map(([fieldId, valueText]) =>
        api.post('/response-values/', {
          submission_id: submissionId,
          field_id: Number(fieldId),
          value_text: valueText,
        }).catch(() => {})
      )
    );
  }
};

export const submitSubmission = async (
  submissionId: number,
  accessToken?: string
): Promise<Submission> => {
  const response = await api.post<Submission>(
    `/submissions/${submissionId}/submit`,
    {},
    { headers: accessToken ? { 'x-submission-token': accessToken } : {} }
  );
  return response.data;
};

export const completeSubmission = submitSubmission;

export const listSubmissions = async (formVersionId: number): Promise<Submission[]> =>
  (await api.get<Submission[]>(`/submissions/form-version/${formVersionId}`)).data;

export interface DuplicateOverrideRequest {
  id: number;
  status: string;
  requested_at: string;
}

export const requestDuplicateOverride = async (
  submissionId: number
): Promise<DuplicateOverrideRequest> => {
  const response = await api.post<DuplicateOverrideRequest>(
    `/submissions/${submissionId}/request-duplicate-override`
  );
  return response.data;
};

export const getDuplicateOverrideStatus = async (
  submissionId: number
): Promise<{ status: string }> => {
  const response = await api.get<{ status: string }>(
    `/submissions/${submissionId}/duplicate-override-status`
  );
  return response.data;
};
