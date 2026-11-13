export interface Section {
  id: number;
  form_version_id: number;
  title: string;
  description: string | null;
  display_order: number;
  default_next_section_id?: number | null;
}

export interface SectionCreatePayload {
  form_version_id: number;
  title: string;
  description?: string | null;
  display_order?: number;
  default_next_section_id?: number | null;
}

export type SectionUpdatePayload = Partial<Omit<SectionCreatePayload, 'form_version_id'>>;
