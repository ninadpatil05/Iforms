import api from './axios';

export interface ScheduledEmailShare {
  id: number;
  form_id: number;
  user_id: number | null;
  subject: string;
  recipient_emails: string[];
  scheduled_at: string; // ISO 8601 UTC
  status: 'pending' | 'sent' | 'failed' | 'cancelled';
  created_at: string;
  sent_at: string | null;
  /**
   * JSON string for partial failures when status='sent',
   * or a plain error message when status='failed'.
   */
  error_message: string | null;
}

export const listScheduledEmails = async (
  formId: number
): Promise<ScheduledEmailShare[]> => {
  const response = await api.get<ScheduledEmailShare[]>(
    `/forms/${formId}/scheduled-emails`
  );
  return response.data;
};

export const cancelScheduledEmail = async (
  formId: number,
  scheduleId: number
): Promise<ScheduledEmailShare> => {
  const response = await api.delete<ScheduledEmailShare>(
    `/forms/${formId}/scheduled-emails/${scheduleId}`
  );
  return response.data;
};
