"""
verify_checkbox_rule_evaluation.py
===================================
Unit verification for evaluate_condition with JSON array (checkbox) answers,
plus regression verification for scalar values and branch rule logic.
"""

import sys
import json
from app.utils.rule_evaluation import evaluate_condition, evaluate_group

PASS = "[PASS]"
FAIL = "[FAIL]"
results: list[tuple[str, bool, str]] = []


def check(name: str, condition: bool, detail: str = "") -> None:
    results.append((name, condition, detail))
    label = PASS if condition else FAIL
    suffix = f" -- {detail}" if detail else ""
    print(f"  {label}  {name}{suffix}")


def main() -> None:
    print("=" * 65)
    print("Checkbox (JSON Array) & Scalar Rule Evaluation Unit Verification")
    print("=" * 65)

    checkbox_val = json.dumps(["yes", "maybe"])

    # 1. Checkbox equals
    check("checkbox equals (match 'yes')", evaluate_condition("equals", checkbox_val, "yes"))
    check("checkbox equals (match 'maybe')", evaluate_condition("equals", checkbox_val, "maybe"))
    check("checkbox equals (no match 'no')", not evaluate_condition("equals", checkbox_val, "no"))

    # 2. Checkbox not_equals
    check("checkbox not_equals (no match 'no')", evaluate_condition("not_equals", checkbox_val, "no"))
    check("checkbox not_equals (match 'yes')", not evaluate_condition("not_equals", checkbox_val, "yes"))

    # 3. Checkbox contains
    check("checkbox contains (match 'yes')", evaluate_condition("contains", checkbox_val, "yes"))
    check("checkbox contains (no match 'no')", not evaluate_condition("contains", checkbox_val, "no"))

    # 4. Checkbox is_empty / is_not_empty
    empty_checkbox = json.dumps([])
    check("checkbox is_empty (empty array)", evaluate_condition("is_empty", empty_checkbox, None))
    check("checkbox is_empty (non-empty False)", not evaluate_condition("is_empty", checkbox_val, None))
    check("checkbox is_not_empty (non-empty)", evaluate_condition("is_not_empty", checkbox_val, None))
    check("checkbox is_not_empty (empty array False)", not evaluate_condition("is_not_empty", empty_checkbox, None))

    # 5. Checkbox misconfigured operator fails closed (returns False)
    check("checkbox greater_than (fails closed False)", not evaluate_condition("greater_than", checkbox_val, "10"))
    check("checkbox starts_with (fails closed False)", not evaluate_condition("starts_with", checkbox_val, "ye"))

    # 6. Scalar Regression Checks
    check("scalar dropdown equals (True)", evaluate_condition("equals", "yes", "yes"))
    check("scalar dropdown equals (False)", not evaluate_condition("equals", "yes", "no"))
    check("scalar text contains (True)", evaluate_condition("contains", "hello world", "world"))
    check("scalar text contains (False)", not evaluate_condition("contains", "hello world", "python"))
    check("scalar number greater_than (True)", evaluate_condition("greater_than", "20", "10"))
    check("scalar text is_empty (empty string)", evaluate_condition("is_empty", "", None))
    check("scalar text is_empty (None)", evaluate_condition("is_empty", None, None))

    # 7. Evaluate Group with Checkbox answer dictionary
    group = {
        "combinator": "AND",
        "conditions": [
            {"trigger_field_id": 1, "operator": "equals", "comparison_value": "yes"}
        ],
    }
    answers_matching = {1: checkbox_val}
    answers_non_matching = {1: json.dumps(["no"])}

    check("evaluate_group checkbox (matching)", evaluate_group(group, answers_matching))
    check("evaluate_group checkbox (non-matching)", not evaluate_group(group, answers_non_matching))

    # 8. Section Branching logic with Checkbox answers
    class MockBranchRule:
        def __init__(self, trigger_field_id: int, operator: str, comparison_value: str, to_section_id: int, priority: int = 0):
            self.trigger_field_id = trigger_field_id
            self.operator = operator
            self.comparison_value = comparison_value
            self.to_section_id = to_section_id
            self.priority = priority

    class MockSection:
        def __init__(self, id: int, default_next_section_id: int | None):
            self.id = id
            self.default_next_section_id = default_next_section_id
            self.form_version_id = 1
            self.display_order = 1

    rule = MockBranchRule(trigger_field_id=10, operator="equals", comparison_value="yes", to_section_id=99)
    current_sec = MockSection(id=1, default_next_section_id=50)

    # Simulating branch_evaluation_service logic
    def eval_branch(sec: MockSection, rules: list[MockBranchRule], ans: dict) -> int | None:
        for r in rules:
            actual_val = ans.get(r.trigger_field_id)
            if evaluate_condition(r.operator, actual_val, r.comparison_value):
                return r.to_section_id
        return sec.default_next_section_id

    check("branch navigation matching checkbox -> target section", eval_branch(current_sec, [rule], answers_matching == {1: checkbox_val} and {10: checkbox_val}) == 99)
    check("branch navigation non-matching checkbox -> fallback section", eval_branch(current_sec, [rule], {10: json.dumps(["no"])}) == 50)

    print("\n" + "=" * 65)
    print("Results")
    print("=" * 65)

    passed = sum(1 for _, ok, _ in results if ok)
    total = len(results)
    print(f"  {passed}/{total} passed\n")

    if passed == total:
        print("  All checkbox & scalar rule evaluation checks passed successfully.")
    else:
        print("  One or more checks FAILED.")
        sys.exit(1)


if __name__ == "__main__":
    main()
