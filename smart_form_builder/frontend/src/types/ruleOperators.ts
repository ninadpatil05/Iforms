import type { BranchOperator } from './branchRule';

export interface OperatorOption {
  value: BranchOperator;
  label: string;
}

export const RULE_OPERATORS: OperatorOption[] = [
  { value: 'equals', label: 'Equals' },
  { value: 'not_equals', label: 'Does not equal' },
  { value: 'contains', label: 'Contains' },
  { value: 'greater_than', label: 'Greater than' },
  { value: 'less_than', label: 'Less than' },
  { value: 'is_empty', label: 'Is empty' },
  { value: 'is_not_empty', label: 'Is not empty' },
  { value: 'greater_than_or_equal', label: 'Greater than or equal to' },
  { value: 'less_than_or_equal', label: 'Less than or equal to' },
  { value: 'starts_with', label: 'Starts with' },
  { value: 'ends_with', label: 'Ends with' },
];

export const operatorNeedsValue = (op: BranchOperator): boolean =>
  op !== 'is_empty' && op !== 'is_not_empty';
