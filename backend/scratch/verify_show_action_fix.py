"""verify_show_action_fix.py

Tests resolve_field_states function end-to-end to verify:
1. Show groups default to hidden, become visible if any show group matches.
2. Hide groups default to visible, become hidden if any hide group matches.
3. Hide-wins-over-show when both evaluate to True.
4. Correct resolution of required overrides.

Run:
    python -m scratch.verify_show_action_fix
"""

import sys
from app.utils.rule_evaluation import resolve_field_states


def ok(label: str) -> None:
    print(f"  [OK] {label}")


def fail(label: str, detail: str = "") -> None:
    print(f"  [FAIL] {label}", file=sys.stderr)
    if detail:
        print(f"    {detail}", file=sys.stderr)
    sys.exit(1)


def run_tests():
    print("\n[1] Starting rule evaluation tests...")

    # Define fields
    # Field 1: Target field
    # Field 10: Trigger field A
    # Field 20: Trigger field B

    # Test Case 1: No show groups (only hide group)
    print("\n--- Test Case 1: Only hide group ---")
    hide_group = {
        "target_field_id": 1,
        "action": "hide",
        "combinator": "AND",
        "conditions": [
            {
                "trigger_field_id": 10,
                "operator": "equals",
                "comparison_value": "yes"
            }
        ]
    }

    # Hide trigger false -> should be visible
    res = resolve_field_states([hide_group], {10: "no"})
    if res.get(1, {}).get("hidden") is not False:
        fail("Case 1 (hide false)", f"expected hidden=False, got: {res}")
    ok("hidden=False when hide condition is false")

    # Hide trigger true -> should be hidden
    res = resolve_field_states([hide_group], {10: "yes"})
    if res.get(1, {}).get("hidden") is not True:
        fail("Case 1 (hide true)", f"expected hidden=True, got: {res}")
    ok("hidden=True when hide condition is true")


    # Test Case 2: Only show group
    print("\n--- Test Case 2: Only show group ---")
    show_group = {
        "target_field_id": 1,
        "action": "show",
        "combinator": "AND",
        "conditions": [
            {
                "trigger_field_id": 10,
                "operator": "equals",
                "comparison_value": "yes"
            }
        ]
    }

    # Show trigger false -> should be hidden
    res = resolve_field_states([show_group], {10: "no"})
    if res.get(1, {}).get("hidden") is not True:
        fail("Case 2 (show false)", f"expected hidden=True, got: {res}")
    ok("hidden=True (default hidden) when show condition is false")

    # Show trigger true -> should be visible
    res = resolve_field_states([show_group], {10: "yes"})
    if res.get(1, {}).get("hidden") is not False:
        fail("Case 2 (show true)", f"expected hidden=False, got: {res}")
    ok("hidden=False (visible) when show condition is true")


    # Test Case 3: Multiple show groups (OR combinator behaviour across groups)
    print("\n--- Test Case 3: Multiple show groups ---")
    show_group_a = {
        "target_field_id": 1,
        "action": "show",
        "combinator": "AND",
        "conditions": [{"trigger_field_id": 10, "operator": "equals", "comparison_value": "yes"}]
    }
    show_group_b = {
        "target_field_id": 1,
        "action": "show",
        "combinator": "AND",
        "conditions": [{"trigger_field_id": 20, "operator": "equals", "comparison_value": "active"}]
    }
    groups = [show_group_a, show_group_b]

    # Neither true -> hidden
    res = resolve_field_states(groups, {10: "no", 20: "inactive"})
    if res.get(1, {}).get("hidden") is not True:
        fail("Case 3 (both false)", f"expected hidden=True, got: {res}")
    ok("hidden=True when both show groups evaluate to false")

    # A true, B false -> visible
    res = resolve_field_states(groups, {10: "yes", 20: "inactive"})
    if res.get(1, {}).get("hidden") is not False:
        fail("Case 3 (A true, B false)", f"expected hidden=False, got: {res}")
    ok("hidden=False when first show group evaluates to true")

    # A false, B true -> visible
    res = resolve_field_states(groups, {10: "no", 20: "active"})
    if res.get(1, {}).get("hidden") is not False:
        fail("Case 3 (A false, B true)", f"expected hidden=False, got: {res}")
    ok("hidden=False when second show group evaluates to true")

    # Both true -> visible
    res = resolve_field_states(groups, {10: "yes", 20: "active"})
    if res.get(1, {}).get("hidden") is not False:
        fail("Case 3 (both true)", f"expected hidden=False, got: {res}")
    ok("hidden=False when both show groups evaluate to true")


    # Test Case 4: Hide-wins-over-show (precedence rule)
    print("\n--- Test Case 4: Hide wins over show ---")
    show_group = {
        "target_field_id": 1,
        "action": "show",
        "combinator": "AND",
        "conditions": [{"trigger_field_id": 10, "operator": "equals", "comparison_value": "yes"}]
    }
    hide_group = {
        "target_field_id": 1,
        "action": "hide",
        "combinator": "AND",
        "conditions": [{"trigger_field_id": 20, "operator": "equals", "comparison_value": "yes"}]
    }
    mixed_groups = [show_group, hide_group]

    # Show true, Hide false -> visible
    res = resolve_field_states(mixed_groups, {10: "yes", 20: "no"})
    if res.get(1, {}).get("hidden") is not False:
        fail("Case 4 (show=true, hide=false)", f"expected hidden=False, got: {res}")
    ok("hidden=False when show is true and hide is false")

    # Show true, Hide true -> hidden (hide wins!)
    res = resolve_field_states(mixed_groups, {10: "yes", 20: "yes"})
    if res.get(1, {}).get("hidden") is not True:
        fail("Case 4 (show=true, hide=true)", f"expected hidden=True, got: {res}")
    ok("hidden=True when both show and hide conditions are true (hide wins!)")

    # Show false, Hide true -> hidden
    res = resolve_field_states(mixed_groups, {10: "no", 20: "yes"})
    if res.get(1, {}).get("hidden") is not True:
        fail("Case 4 (show=false, hide=true)", f"expected hidden=True, got: {res}")
    ok("hidden=True when show is false and hide is true")

    # Show false, Hide false -> hidden (since show group exists and is false)
    res = resolve_field_states(mixed_groups, {10: "no", 20: "no"})
    if res.get(1, {}).get("hidden") is not True:
        fail("Case 4 (show=false, hide=false)", f"expected hidden=True, got: {res}")
    ok("hidden=True when both show and hide are false (due to show default)")


    # Test Case 5: Required override logic
    print("\n--- Test Case 5: Required override ---")
    require_group = {
        "target_field_id": 1,
        "action": "require",
        "combinator": "AND",
        "conditions": [{"trigger_field_id": 10, "operator": "equals", "comparison_value": "yes"}]
    }

    # Trigger false -> required_override false
    res = resolve_field_states([require_group], {10: "no"})
    if res.get(1, {}).get("required_override") is not False:
        fail("Case 5 (false)", f"expected required_override=False, got: {res}")
    ok("required_override=False when require condition is false")

    # Trigger true -> required_override true
    res = resolve_field_states([require_group], {10: "yes"})
    if res.get(1, {}).get("required_override") is not True:
        fail("Case 5 (true)", f"expected required_override=True, got: {res}")
    ok("required_override=True when require condition is true")

    print("\n[ALL PASSED] All rule evaluation fix cases completed successfully!")


if __name__ == "__main__":
    run_tests()
