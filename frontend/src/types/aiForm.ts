export type AiFieldTypeForGeneration =
  | 'text'
  | 'number'
  | 'email'
  | 'date'
  | 'dropdown'
  | 'checkbox'
  | 'file_upload'
  | 'rating';

export interface AiFieldOption {
  label: string;
  value: string;
}

export interface AiGeneratedField {
  label: string;
  field_type: AiFieldTypeForGeneration;
  placeholder?: string | null;
  required: boolean;
  options?: AiFieldOption[] | null;
  validation_config?: Record<string, any> | null;
  display_order: number;
  ai_rationale?: string | null;
}

export interface AiGeneratedSection {
  title: string;
  description?: string | null;
  display_order: number;
  fields: AiGeneratedField[];
}

export interface AiFormGenerationResult {
  title: string;
  description?: string | null;
  sections: AiGeneratedSection[];
}

export interface AiFormDraft {
  id: number;
  prompt: string;
  generated_json: AiFormGenerationResult;
  status: string;
  form_id?: number | null;
  created_at: string;
  accepted_at?: string | null;
}
