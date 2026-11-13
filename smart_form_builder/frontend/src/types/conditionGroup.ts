import type { BranchOperator } from './branchRule';

export type GroupCombinator = 'AND' | 'OR';
export type GroupAction = 'show' | 'hide' | 'require';

export interface ConditionGroupCondition {
  id?: number;
  trigger_field_id: number;
  operator: BranchOperator;
  comparison_value?: string | null;
  display_order?: number;
}

export interface ConditionGroup {
  id: number;
  form_version_id: number;
  target_field_id: number;
  action: GroupAction;
  combinator: GroupCombinator;
  conditions: ConditionGroupCondition[];
}

export interface ConditionGroupConditionCreatePayload {
  trigger_field_id: number;
  operator: BranchOperator;
  comparison_value?: string | null;
}

export interface ConditionGroupCreatePayload {
  form_version_id: number;
  target_field_id: number;
  action: GroupAction;
  combinator: GroupCombinator;
  conditions: ConditionGroupConditionCreatePayload[];
}

export interface ConditionGroupUpdatePayload {
  action?: GroupAction;
  combinator?: GroupCombinator;
  conditions?: ConditionGroupConditionCreatePayload[];
}
