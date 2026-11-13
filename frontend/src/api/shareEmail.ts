import api from './axios';

export interface ShareEmailRequest {
  recipient_emails: string[];
  subject: string;
  message: string;
  /** ISO 8601 UTC datetime string. If provided, the email is scheduled rather than sent immediately. */
  scheduled_at?: string;
}

export interface ShareEmailFailedRecipient {
  email: string;
  reason: string;
}

export interface ShareEmailResponse {
  sent_count: number;
  failed: ShareEmailFailedRecipient[];
  /** True when the request was accepted as a scheduled send (HTTP 202). */
  scheduled?: boolean;
  /** ID of the ScheduledEmailShare row created (present when scheduled=true). */
  scheduled_email_id?: number;
}

export const shareFormViaEmail = async (
  formId: number,
  payload: ShareEmailRequest
): Promise<ShareEmailResponse> => {
  const response = await api.post<ShareEmailResponse>(`/forms/${formId}/share-email`, payload);
  return response.data;
};
