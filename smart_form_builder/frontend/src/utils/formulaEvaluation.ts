import { FormulaTerm } from '../types/field';

/**
 * Live client-side preview formula evaluation.
 * Note: Server re-evaluates and overwrites computed field values on submission.
 */
export function evaluateFormula(
  terms: FormulaTerm[] | undefined,
  answers: Record<number, any>,
  decimalPlaces: number = 2
): number | null {
  if (!terms || terms.length === 0 || terms.length % 2 !== 1) {
    return null;
  }

  const getOperandVal = (term: FormulaTerm): number => {
    if ('constant_value' in term && typeof term.constant_value === 'number') {
      return isNaN(term.constant_value) ? 0 : term.constant_value;
    }
    if ('constant_value' in term && typeof (term as any).constant_value === 'string') {
      const parsedConst = parseFloat((term as any).constant_value);
      return isNaN(parsedConst) ? 0 : parsedConst;
    }
    if ('value' in term && typeof (term as any).value === 'number') {
      return isNaN((term as any).value) ? 0 : (term as any).value;
    }
    if ('value' in term && typeof (term as any).value === 'string' && !('field_id' in term)) {
      const parsedVal = parseFloat((term as any).value);
      return isNaN(parsedVal) ? 0 : parsedVal;
    }
    const fieldId = (term as any).field_id;
    if (fieldId === undefined || fieldId === null) return 0;

    const raw = answers[fieldId];
    if (raw === undefined || raw === null) return 0;
    if (typeof raw === 'number') return isNaN(raw) ? 0 : raw;
    const rawStr = String(raw).trim();
    if (!rawStr) return 0;
    const parsed = parseFloat(rawStr);
    return isNaN(parsed) ? 0 : parsed;
  };

  let current = getOperandVal(terms[0]);

  for (let i = 1; i < terms.length; i += 2) {
    const opTerm = terms[i];
    const nextTerm = terms[i + 1];

    if (!('op' in opTerm) || !opTerm.op || !nextTerm) {
      return null;
    }

    const op = opTerm.op;
    const nextVal = getOperandVal(nextTerm);

    if (op === 'add') {
      current += nextVal;
    } else if (op === 'subtract') {
      current -= nextVal;
    } else if (op === 'multiply') {
      current *= nextVal;
    } else if (op === 'divide') {
      if (nextVal === 0) {
        return null;
      }
      current /= nextVal;
    } else {
      return null;
    }
  }

  if (decimalPlaces === 0) {
    return Math.round(current);
  }
  const factor = Math.pow(10, decimalPlaces);
  return Math.round(current * factor) / factor;
}
