export type BranchOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'greater_than'
  | 'less_than'
  | 'is_empty'
  | 'is_not_empty'
  | 'greater_than_or_equal'
  | 'less_than_or_equal'
  | 'starts_with'
  | 'ends_with';


export interface BranchRule {
  id: number;
  from_section_id: number;
  to_section_id: number | null;
  trigger_field_id: number;
  operator: BranchOperator;
  comparison_value: string | null;
  priority: number;
}

export interface BranchRuleCreatePayload {
  from_section_id: number;
  to_section_id?: number | null;
  trigger_field_id: number;
  operator: BranchOperator;
  comparison_value?: string | null;
  priority?: number;
}

export type BranchRuleUpdatePayload = Partial<Omit<BranchRuleCreatePayload, 'from_section_id'>>;

export interface NextPageResponse {
  next_section_id: number | null;
  is_last_section: boolean;
}
