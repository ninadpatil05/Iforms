export type FormStatus = 'draft' | 'published' | 'archived' | 'trashed';
export type DuplicatePolicy = 'allow' | 'warn' | 'block';

export interface Form {
  id: number;
  owner_id: number;
  title: string;
  description: string | null;
  status: FormStatus;
  access_mode: 'public' | 'invite_only';
  allow_resubmission: boolean;
  starts_at: string | null;
  ends_at: string | null;
  duplicate_check_field_id: number | null;
  duplicate_policy: DuplicatePolicy;
  submission_count?: number;
  created_at: string;
  updated_at: string;
}

export interface FormCreatePayload {
  title: string;
  description?: string | null;
  access_mode?: 'public' | 'invite_only';
  allow_resubmission?: boolean;
  starts_at?: string | null;
  ends_at?: string | null;
  duplicate_check_field_id?: number | null;
  duplicate_policy?: DuplicatePolicy;
}

export interface FormUpdatePayload {
  title?: string;
  description?: string | null;
  access_mode?: 'public' | 'invite_only';
  allow_resubmission?: boolean;
  starts_at?: string | null;
  ends_at?: string | null;
  duplicate_check_field_id?: number | null;
  duplicate_policy?: DuplicatePolicy;
}
