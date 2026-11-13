/**
 * Frontend rule evaluation engine.
 * SOURCE OF TRUTH: backend/app/utils/rule_evaluation.py
 *
 * Keep evaluation semantics in sync with backend rule_evaluation.py.
 */

import type { PublicConditionGroup, PublicConditionGroupCondition } from '@/api/publicForms';

export function evaluateCondition(
  operator: string,
  actualValue?: string | string[] | null,
  comparisonValue?: string | null
): boolean {
  const cmp = comparisonValue ?? '';

  if (operator === 'is_empty') {
    if (actualValue === null || actualValue === undefined) return true;
    if (Array.isArray(actualValue)) return actualValue.length === 0;
    return String(actualValue).trim() === '';
  }

  if (operator === 'is_not_empty') {
    if (actualValue === null || actualValue === undefined) return false;
    if (Array.isArray(actualValue)) return actualValue.length > 0;
    return String(actualValue).trim() !== '';
  }

  let actStr = '';
  if (actualValue !== null && actualValue !== undefined) {
    if (Array.isArray(actualValue)) {
      actStr = actualValue.join(', ');
    } else {
      actStr = String(actualValue);
    }
  }

  if (operator === 'equals') {
    if (Array.isArray(actualValue)) {
      return actualValue.includes(cmp) || actStr === cmp;
    }
    return actStr === cmp;
  }

  if (operator === 'not_equals') {
    if (Array.isArray(actualValue)) {
      return !actualValue.includes(cmp) && actStr !== cmp;
    }
    return actStr !== cmp;
  }

  if (operator === 'contains') {
    if (Array.isArray(actualValue)) {
      return actualValue.some(v => v.includes(cmp)) || actStr.includes(cmp);
    }
    return actStr.includes(cmp);
  }

  if (operator === 'greater_than') {
    const actNum = Number(actStr);
    const cmpNum = Number(cmp);
    if (!isNaN(actNum) && !isNaN(cmpNum) && actStr !== '' && cmp !== '') {
      return actNum > cmpNum;
    }
    return actStr > cmp;
  }

  if (operator === 'less_than') {
    const actNum = Number(actStr);
    const cmpNum = Number(cmp);
    if (!isNaN(actNum) && !isNaN(cmpNum) && actStr !== '' && cmp !== '') {
      return actNum < cmpNum;
    }
    return actStr < cmp;
  }

  if (operator === 'greater_than_or_equal') {
    const actNum = Number(actStr);
    const cmpNum = Number(cmp);
    if (!isNaN(actNum) && !isNaN(cmpNum) && actStr !== '' && cmp !== '') {
      return actNum >= cmpNum;
    }
    return actStr >= cmp;
  }

  if (operator === 'less_than_or_equal') {
    const actNum = Number(actStr);
    const cmpNum = Number(cmp);
    if (!isNaN(actNum) && !isNaN(cmpNum) && actStr !== '' && cmp !== '') {
      return actNum <= cmpNum;
    }
    return actStr <= cmp;
  }

  if (operator === 'starts_with') {
    return actStr.startsWith(cmp);
  }

  if (operator === 'ends_with') {
    return actStr.endsWith(cmp);
  }

  return false;
}

export function evaluateGroup(
  group: PublicConditionGroup,
  answers: Record<number, string | string[]>
): boolean {
  if (!group.conditions || group.conditions.length === 0) return false;

  const results = group.conditions.map((cond: PublicConditionGroupCondition) => {
    const actualValue = answers[cond.trigger_field_id];
    return evaluateCondition(cond.operator, actualValue, cond.comparison_value);
  });

  if (group.combinator === 'OR') {
    return results.some(Boolean);
  }
  return results.every(Boolean);
}

export interface FieldResolvedState {
  hidden: boolean;
  required_override: boolean;
}

export function resolveFieldStates(
  groups: PublicConditionGroup[],
  answers: Record<number, string | string[]>
): Record<number, FieldResolvedState> {
  const byTarget: Record<number, PublicConditionGroup[]> = {};
  for (const group of groups) {
    if (!byTarget[group.target_field_id]) {
      byTarget[group.target_field_id] = [];
    }
    byTarget[group.target_field_id].push(group);
  }

  const resolved: Record<number, FieldResolvedState> = {};

  for (const targetFieldIdStr in byTarget) {
    const targetFieldId = Number(targetFieldIdStr);
    const groupList = byTarget[targetFieldId];
    let hasShowGroups = false;
    let showMatched = false;
    let hideMatched = false;
    let required_override = false;

    for (const group of groupList) {
      const action = group.action.toLowerCase();
      if (action === 'show') {
        hasShowGroups = true;
      }

      if (evaluateGroup(group, answers)) {
        if (action === 'hide') {
          hideMatched = true;
        } else if (action === 'show') {
          showMatched = true;
        } else if (action === 'require') {
          required_override = true;
        }
      }
    }

    const hidden = hideMatched || (hasShowGroups && !showMatched);

    resolved[targetFieldId] = { hidden, required_override };
  }

  return resolved;
}
