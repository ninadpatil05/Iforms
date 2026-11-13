import api from './axios';

export interface FormInvite {
  id: number;
  form_id: number;
  email: string;
  token: string;
  max_uses: number;
  use_count: number;
  created_at: string;
  used_at: string | null;
  invite_link: string;
}

export const createInvites = async (
  formId: number,
  emails: string[],
  maxUses = 1
): Promise<FormInvite[]> =>
  (
    await api.post<FormInvite[]>(`/forms/${formId}/invites`, {
      emails,
      max_uses: maxUses,
    })
  ).data;

export const listInvites = async (formId: number): Promise<FormInvite[]> =>
  (await api.get<FormInvite[]>(`/forms/${formId}/invites`)).data;

export const deleteInvite = async (formId: number, inviteId: number): Promise<FormInvite> =>
  (await api.delete<FormInvite>(`/forms/${formId}/invites/${inviteId}`)).data;
