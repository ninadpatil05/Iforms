export type FieldType = 'text' | 'number' | 'email' | 'date' | 'dropdown' | 'checkbox' | 'file_upload' | 'file' | 'rating' | 'password' | 'textarea' | 'radio' | 'computed';

export interface FieldOption { label: string; value: string; }

export type FormulaOp = 'add' | 'subtract' | 'multiply' | 'divide';

export type FormulaTerm =
  | { field_id: number; constant_value?: never; op?: never }
  | { constant_value: number; field_id?: never; op?: never }
  | { op: FormulaOp; field_id?: never; constant_value?: never };

export interface FormulaConfig {
  terms: FormulaTerm[];
  decimal_places?: number;
}

export type ValidationConfig = Record<string, any>;

export interface FormVersion { id: number; form_id: number; version_number: number; is_published: boolean; published_at: string | null; public_link: string | null; }
export interface Field {
  id: number; form_version_id: number; label: string; field_type: FieldType; placeholder: string | null;
  required: boolean; options: FieldOption[] | null; validation_config: ValidationConfig | null; display_order: number;
  section_id?: number | null;
}
export interface FieldCreatePayload {
  form_version_id: number; label: string; field_type: FieldType; placeholder?: string | null; required?: boolean;
  options?: FieldOption[] | null; validation_config?: ValidationConfig | null; display_order?: number;
  section_id?: number | null;
}
export type FieldUpdatePayload = Partial<Omit<FieldCreatePayload, 'form_version_id'>>;

