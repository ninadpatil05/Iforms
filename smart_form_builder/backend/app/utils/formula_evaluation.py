from typing import Any, Dict, List, Optional, Union


def evaluate_formula(
    terms: List[Dict[str, Any]],
    answers: Dict[int, Optional[Union[str, Any]]],
    decimal_places: int = 2,
) -> Optional[Union[float, int]]:
    """Evaluate an ordered arithmetic formula against a dict of field answers or constant values.

    Pure function without database dependencies.
    - Evaluated strictly left to right.
    - Missing, empty, or non-numeric operand answers are treated as 0.0.
    - Supports constant numeric operands: {"constant_value": 250} or {"value": 250}.
    - Division by zero returns None.
    - Result is rounded to decimal_places.
    """
    if not terms or len(terms) % 2 != 1:
        return None

    def get_operand_val(term: Dict[str, Any]) -> float:
        if "constant_value" in term and term["constant_value"] is not None:
            try:
                return float(term["constant_value"])
            except (ValueError, TypeError):
                return 0.0
        if "value" in term and term["value"] is not None and "field_id" not in term:
            try:
                return float(term["value"])
            except (ValueError, TypeError):
                return 0.0
        field_id = term.get("field_id")
        if field_id is None:
            return 0.0
        raw = answers.get(field_id)
        if raw is None:
            return 0.0
        if isinstance(raw, (int, float)):
            return float(raw)
        raw_str = str(raw).strip()
        if not raw_str:
            return 0.0
        try:
            return float(raw_str)
        except (ValueError, TypeError):
            return 0.0

    current = get_operand_val(terms[0])

    for i in range(1, len(terms), 2):
        op = terms[i].get("op")
        next_val = get_operand_val(terms[i + 1])

        if op == "add":
            current += next_val
        elif op == "subtract":
            current -= next_val
        elif op == "multiply":
            current *= next_val
        elif op == "divide":
            if next_val == 0.0:
                return None
            current /= next_val
        else:
            return None

    if decimal_places == 0:
        return int(round(current))
    return round(current, decimal_places)
