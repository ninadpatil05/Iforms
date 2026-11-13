"""
verify_operators.py
===================
Pure unit test script for evaluate_condition() operator logic.
Checks all 11 operators (6 existing regression + 5 new operators).
No DB dependency required.
"""

import sys
from app.utils.rule_evaluation import evaluate_condition

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
    print("Conditional Logic Operators Unit Verification")
    print("=" * 65)

    # 1. Existing 6 operators regression check
    check("equals (True)", evaluate_condition("equals", "hello", "hello"))
    check("equals (False)", not evaluate_condition("equals", "hello", "world"))

    check("not_equals (True)", evaluate_condition("not_equals", "hello", "world"))
    check("not_equals (False)", not evaluate_condition("not_equals", "hello", "hello"))

    check("contains (True)", evaluate_condition("contains", "hello world", "world"))
    check("contains (False)", not evaluate_condition("contains", "hello world", "python"))

    check("greater_than (True)", evaluate_condition("greater_than", "10", "5"))
    check("greater_than (False)", not evaluate_condition("greater_than", "5", "10"))

    check("less_than (True)", evaluate_condition("less_than", "5", "10"))
    check("less_than (False)", not evaluate_condition("less_than", "10", "5"))

    check("is_empty (empty string)", evaluate_condition("is_empty", "", None))
    check("is_empty (None)", evaluate_condition("is_empty", None, None))
    check("is_empty (whitespace)", evaluate_condition("is_empty", "   ", None))
    check("is_empty (non-empty False)", not evaluate_condition("is_empty", "val", None))

    # 2. is_not_empty
    check("is_not_empty (non-empty)", evaluate_condition("is_not_empty", "hello", None))
    check("is_not_empty (None False)", not evaluate_condition("is_not_empty", None, None))
    check("is_not_empty (whitespace False)", not evaluate_condition("is_not_empty", "   ", None))

    # 3. greater_than_or_equal / less_than_or_equal
    # Equal boundary cases (inclusive behavior)
    check("greater_than_or_equal (equal boundary)", evaluate_condition("greater_than_or_equal", "18", "18"))
    check("less_than_or_equal (equal boundary)", evaluate_condition("less_than_or_equal", "18", "18"))

    # Greater / Less numeric cases
    check("greater_than_or_equal (greater numeric)", evaluate_condition("greater_than_or_equal", "20", "18"))
    check("greater_than_or_equal (smaller numeric False)", not evaluate_condition("greater_than_or_equal", "15", "18"))
    check("less_than_or_equal (smaller numeric)", evaluate_condition("less_than_or_equal", "15", "18"))
    check("less_than_or_equal (greater numeric False)", not evaluate_condition("less_than_or_equal", "20", "18"))

    # Non-numeric fallback string comparison
    check("greater_than_or_equal (string fallback True)", evaluate_condition("greater_than_or_equal", "banana", "apple"))
    check("greater_than_or_equal (string fallback False)", not evaluate_condition("greater_than_or_equal", "apple", "banana"))
    check("less_than_or_equal (string fallback True)", evaluate_condition("less_than_or_equal", "apple", "banana"))
    check("less_than_or_equal (string fallback False)", not evaluate_condition("less_than_or_equal", "banana", "apple"))

    # 4. starts_with / ends_with
    check("starts_with (match)", evaluate_condition("starts_with", "hello world", "hello"))
    check("starts_with (no match)", not evaluate_condition("starts_with", "hello world", "world"))
    check("starts_with (empty cmp)", evaluate_condition("starts_with", "hello", ""))

    check("ends_with (match)", evaluate_condition("ends_with", "hello world", "world"))
    check("ends_with (no match)", not evaluate_condition("ends_with", "hello world", "hello"))
    check("ends_with (empty cmp)", evaluate_condition("ends_with", "hello", ""))

    # None actual_value handling
    check("starts_with (actual_value=None, non-empty cmp)", not evaluate_condition("starts_with", None, "hello"))
    check("starts_with (actual_value=None, empty cmp)", evaluate_condition("starts_with", None, ""))
    check("ends_with (actual_value=None, non-empty cmp)", not evaluate_condition("ends_with", None, "world"))
    check("ends_with (actual_value=None, empty cmp)", evaluate_condition("ends_with", None, ""))

    print("\n" + "=" * 65)
    print("Results")
    print("=" * 65)

    passed = sum(1 for _, ok, _ in results if ok)
    total = len(results)
    print(f"  {passed}/{total} passed\n")

    if passed == total:
        print("  All operator checks passed successfully.")
    else:
        print("  One or more operator checks FAILED.")
        sys.exit(1)


if __name__ == "__main__":
    main()
