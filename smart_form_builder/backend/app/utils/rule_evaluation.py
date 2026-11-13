import json
from typing import Any, Dict, List, Optional


def _coerce_and_compare(
    operator: str, actual_value: Optional[str], comparison_value: Optional[str]
) -> bool:
    actual_values = None
    if isinstance(actual_value, str):
        try:
            parsed = json.loads(actual_value)
            if isinstance(parsed, list):
                actual_values = parsed
        except (ValueError, TypeError):
            pass

    if actual_values is not None:
        if operator == "is_empty":
            return len(actual_values) == 0
        if operator == "is_not_empty":
            return len(actual_values) > 0

        cmp = comparison_value if comparison_value is not None else ""
        if operator == "equals":
            return cmp in actual_values
        if operator == "not_equals":
            return cmp not in actual_values
        if operator == "contains":
            return cmp in actual_values

        return False

    if operator == "is_empty":
        return actual_value is None or actual_value.strip() == ""

    if operator == "is_not_empty":
        return actual_value is not None and actual_value.strip() != ""

    act = actual_value if actual_value is not None else ""
    cmp = comparison_value if comparison_value is not None else ""

    if operator == "equals":
        return act == cmp

    if operator == "not_equals":
        return act != cmp

    if operator == "contains":
        return cmp in act

    if operator == "greater_than":
        try:
            return float(act) > float(cmp)
        except (ValueError, TypeError):
            return act > cmp

    if operator == "less_than":
        try:
            return float(act) < float(cmp)
        except (ValueError, TypeError):
            return act < cmp

    if operator == "greater_than_or_equal":
        try:
            return float(act) >= float(cmp)
        except (ValueError, TypeError):
            return act >= cmp

    if operator == "less_than_or_equal":
        try:
            return float(act) <= float(cmp)
        except (ValueError, TypeError):
            return act <= cmp

    if operator == "starts_with":
        return act.startswith(cmp)

    if operator == "ends_with":
        return act.endswith(cmp)

    return False


def evaluate_condition(
    operator: str, actual_value: Optional[str], comparison_value: Optional[str]
) -> bool:
    """Evaluate a single rule condition against an actual answer value.

    Pure function without database dependencies.
    """
    return _coerce_and_compare(operator, actual_value, comparison_value)


def evaluate_group(group: Any, answers: Dict[int, Optional[str]]) -> bool:
    """Evaluate a ConditionGroup (or dict representation) against an answers dict.

    Pure function without database dependencies.
    """
    conditions = group.conditions if hasattr(group, "conditions") else group.get("conditions", [])
    if not conditions:
        return False

    results = []
    for cond in conditions:
        trig_id = cond.trigger_field_id if hasattr(cond, "trigger_field_id") else cond["trigger_field_id"]
        op = cond.operator if hasattr(cond, "operator") else cond["operator"]
        op_str = op.value if hasattr(op, "value") else str(op)
        cmp_val = cond.comparison_value if hasattr(cond, "comparison_value") else cond.get("comparison_value")

        actual_val = answers.get(trig_id)
        results.append(evaluate_condition(op_str, actual_val, cmp_val))

    combinator = group.combinator if hasattr(group, "combinator") else group.get("combinator", "AND")
    comb_str = combinator.value if hasattr(combinator, "value") else str(combinator)

    if comb_str.upper() == "OR":
        return any(results)
    return all(results)


def resolve_field_states(
    groups: List[Any], answers: Dict[int, Optional[str]]
) -> Dict[int, Dict[str, bool]]:
    """Resolve final {hidden: bool, required_override: bool} state for each target_field_id.

    Conflict Rules:
    - If a field is targeted by one or more 'show' groups, it defaults to hidden.
    - It becomes visible if any 'show' group evaluates to True.
    - If any 'hide' group evaluates to True, it is hidden ('hide' wins over 'show').
    - If any 'require' group evaluates to True, it becomes required.
    """
    by_target: Dict[int, List[Any]] = {}
    for group in groups:
        tid = group.target_field_id if hasattr(group, "target_field_id") else group["target_field_id"]
        by_target.setdefault(tid, []).append(group)

    resolved: Dict[int, Dict[str, bool]] = {}

    for target_field_id, group_list in by_target.items():
        has_show_groups = False
        show_matched = False
        hide_matched = False
        required_override = False

        for group in group_list:
            action = group.action if hasattr(group, "action") else group["action"]
            act_str = action.value if hasattr(action, "value") else str(action)
            act_str = act_str.lower()

            if act_str == "show":
                has_show_groups = True

            if evaluate_group(group, answers):
                if act_str == "hide":
                    hide_matched = True
                elif act_str == "show":
                    show_matched = True
                elif act_str == "require":
                    required_override = True

        hidden = hide_matched or (has_show_groups and not show_matched)

        resolved[target_field_id] = {
            "hidden": hidden,
            "required_override": required_override,
        }

    return resolved


