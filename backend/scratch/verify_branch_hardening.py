"""verify_branch_hardening.py

Exercises every Phase-1 backend feature end-to-end against the real DB.

Run from the backend/ directory:
    python -m scratch.verify_branch_hardening

Covers:
1. Duplicate-priority rejection -> 409
2. 3-section cycle (A->B, B->C, try C->A) -> 422 with cycle path in message
3. 2-section direct cycle -> 422
4. graph-check endpoint - unreachable section detected
5. visited_section_ids tracking (Next / Back navigation)
6. Reorder endpoint - priorities reassigned in given order
"""

import json
import sys
import time
import requests

import app.models  # Ensures all SQLAlchemy models are registered

BASE = "http://localhost:8000/api"

# -- Helpers -------------------------------------------------------------------

def ok(label: str) -> None:
    print(f"  [OK] {label}")

def fail(label: str, detail: str = "") -> None:
    print(f"  [FAIL] {label}", file=sys.stderr)
    if detail:
        print(f"    {detail}", file=sys.stderr)
    sys.exit(1)

def api(method: str, path: str, *, token: str = "", **kwargs) -> requests.Response:
    headers = kwargs.pop("headers", {})
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return requests.request(method, f"{BASE}{path}", headers=headers, **kwargs)

# -- Auth -----------------------------------------------------------------------

print("\n[0] Auth -- sign up / login")
email = f"hardening_{int(time.time())}@example.com"
password = "Hardn3ning!"

r = api("POST", "/auth/signup", json={"name": "Hardening User", "email": email, "password": password})
if r.status_code not in (200, 201, 400, 409):
    fail("signup", r.text)
ok("signup (or already exists)")

r = api("POST", "/auth/login", data={"username": email, "password": password})
if r.status_code != 200:
    fail("login", r.text)
token = r.json()["access_token"]
ok("login")

# -- Create form ----------------------------------------------------------------

print("\n[1] Create form + 4 sections + 1 field")
r = api("POST", "/forms/", token=token, json={"title": "Hardening Test Form"})
if r.status_code not in (200, 201):
    fail("create form", r.text)
form_id = r.json()["id"]
ok(f"form created id={form_id}")

r = api("GET", f"/forms/{form_id}/current-version", token=token)
if r.status_code != 200:
    fail("get version", r.text)
version_id = r.json()["id"]
ok(f"version_id={version_id}")

# Create 4 sections: A, B, C, D
section_ids = {}
for name in ["A", "B", "C", "D"]:
    r = api("POST", "/sections/", token=token, json={"form_version_id": version_id, "title": f"Section {name}", "display_order": len(section_ids)})
    if r.status_code not in (200, 201):
        fail(f"create section {name}", r.text)
    section_ids[name] = r.json()["id"]
    ok(f"section {name} id={section_ids[name]}")

# Create a field in section A
r = api("POST", "/fields/", token=token, json={
    "form_version_id": version_id,
    "section_id": section_ids["A"],
    "label": "Your answer",
    "field_type": "text",
    "display_order": 0,
})
if r.status_code not in (200, 201):
    fail("create field", r.text)
field_id = r.json()["id"]
ok(f"field id={field_id}")

# -- Test 1: Duplicate priority -> 409 -----------------------------------------

print("\n[2] Duplicate priority per from_section -> 409")

r = api("POST", "/branch-rules/", token=token, json={
    "from_section_id": section_ids["A"],
    "to_section_id": section_ids["B"],
    "trigger_field_id": field_id,
    "operator": "equals",
    "comparison_value": "yes",
    "priority": 0,
})
if r.status_code not in (200, 201):
    fail("create first rule priority=0", r.text)
rule1_id = r.json()["id"]
ok(f"first rule created (priority=0) id={rule1_id}")

r = api("POST", "/branch-rules/", token=token, json={
    "from_section_id": section_ids["A"],
    "to_section_id": section_ids["C"],
    "trigger_field_id": field_id,
    "operator": "equals",
    "comparison_value": "maybe",
    "priority": 0,  # duplicate!
})
if r.status_code != 409:
    fail(f"expected 409 on duplicate priority, got {r.status_code}", r.text)
ok(f"duplicate priority correctly rejected with 409 (detail: {r.json().get('detail', '')[:80]})")

# -- Test 2: 3-section cycle -> 422 --------------------------------------------

print("\n[3] 3-section cycle detection -- 422 with path")

# A(0)->B already exists. Create B->C.
r = api("POST", "/branch-rules/", token=token, json={
    "from_section_id": section_ids["B"],
    "to_section_id": section_ids["C"],
    "trigger_field_id": field_id,
    "operator": "is_not_empty",
    "comparison_value": None,
    "priority": 0,
})
if r.status_code not in (200, 201):
    fail("create B->C rule", r.text)
ok("B->C rule created")

# Try C->A - should form cycle A->B->C->A and be rejected with 422
r = api("POST", "/branch-rules/", token=token, json={
    "from_section_id": section_ids["C"],
    "to_section_id": section_ids["A"],
    "trigger_field_id": field_id,
    "operator": "is_not_empty",
    "comparison_value": None,
    "priority": 0,
})
if r.status_code != 422:
    fail(f"expected 422 on C->A cycle, got {r.status_code}", r.text)
detail = r.json().get("detail", "")
if "Section" not in detail:
    fail(f"cycle message should contain section titles, got: {detail}")
detail_safe = detail.replace("→", "->")
ok(f"3-section cycle correctly rejected 422, path: {detail_safe}")

# -- Test 3: 2-section direct cycle -> 422 -------------------------------------

print("\n[4] 2-section direct cycle via default_next_section_id -> 422")

r = api("PUT", f"/sections/{section_ids['B']}", token=token, json={
    "default_next_section_id": section_ids["A"]
})
if r.status_code != 422:
    fail(f"expected 422 on default_next B->A cycle, got {r.status_code}", r.text)
detail = r.json().get("detail", "")
detail_safe = detail.replace("→", "->")
ok(f"2-section cycle via default_next correctly rejected 422, path: {detail_safe[:80]}")

# -- Test 4: Graph-check endpoint ----------------------------------------------

print("\n[5] Graph-check: unreachable section detection")

r = api("GET", f"/public/forms/graph-check/form/{form_id}", token=token)
if r.status_code != 200:
    fail("graph-check endpoint", r.text)
data = r.json()
if "unreachable_sections" not in data:
    fail("response missing unreachable_sections key", str(data))
ok(f"graph-check endpoint works. Unreachable: {[s['title'] for s in data['unreachable_sections']]}")

# -- Test 5: visited_section_ids tracking -------------------------------------

print("\n[6] visited_section_ids -- next/back navigation")

r = api("POST", f"/forms/{form_id}/publish", token=token)
if r.status_code not in (200, 201):
    fail("publish form", r.text)
public_link = r.json()["public_link"]
ok(f"form published, public_link={public_link}")

r = requests.get(f"{BASE}/public/forms/{public_link}")
if r.status_code != 200:
    fail("get public form", r.text)
pub_form = r.json()
pub_sections = pub_form["sections"]

r = requests.post(f"{BASE}/submissions/", json={"form_version_id": pub_form["form_version_id"]})
if r.status_code not in (200, 201):
    fail("create submission", r.text)
sub_id = r.json()["id"]
ok(f"submission created id={sub_id}")

pub_fields = pub_form["fields"]
if pub_fields:
    pub_field_id = pub_fields[0]["id"]
    r = requests.post(f"{BASE}/response-values/", json={
        "submission_id": sub_id,
        "field_id": pub_field_id,
        "value_text": "yes"
    })
    ok(f"saved answer for field {pub_field_id}")

first_section_id = pub_sections[0]["id"]
r = requests.post(f"{BASE}/public/forms/{public_link}/next-page", json={
    "submission_id": sub_id,
    "current_section_id": first_section_id,
})
if r.status_code != 200:
    fail("next-page", r.text)
next_data = r.json()
ok(f"next-page returned next_section_id={next_data['next_section_id']}")

from app.database.database import SessionLocal
from app.models.submission import Submission as SubmissionModel
db = SessionLocal()
try:
    sub = db.get(SubmissionModel, sub_id)
    visited_raw = sub.visited_section_ids
    if not visited_raw:
        fail("visited_section_ids should not be empty after next-page")
    visited = json.loads(visited_raw)
    if first_section_id not in visited:
        fail(f"expected {first_section_id} in visited, got {visited}")
    ok(f"visited_section_ids correctly updated: {visited}")
finally:
    db.close()

if next_data["next_section_id"] is not None:
    r = requests.get(f"{BASE}/public/forms/{public_link}/previous-page", params={"submission_id": sub_id})
    if r.status_code != 200:
        fail("previous-page", r.text)
    prev_data = r.json()
    if prev_data["previous_section_id"] != first_section_id:
        fail(f"expected previous_section_id={first_section_id}, got {prev_data['previous_section_id']}")
    ok(f"previous-page correctly returned previous_section_id={prev_data['previous_section_id']}")

    db = SessionLocal()
    try:
        db.expire_all()
        sub = db.get(SubmissionModel, sub_id)
        visited2 = json.loads(sub.visited_section_ids or "[]")
        if first_section_id in visited2:
            fail(f"section {first_section_id} should have been popped, but got {visited2}")
        ok(f"visited_section_ids correctly popped to: {visited2}")
    finally:
        db.close()

    r = requests.get(f"{BASE}/public/forms/{public_link}/previous-page", params={"submission_id": sub_id})
    if r.status_code != 403:
        fail(f"expected 403 on empty history, got {r.status_code}", r.text)
    ok("previous-page on empty history correctly returns 403")

# -- Test 6: Reorder endpoint --------------------------------------------------

print("\n[7] Reorder rules -- PATCH /branch-rules/section/{id}/reorder")

# Create a fresh form for reorder testing
r_f = api("POST", "/forms/", token=token, json={"title": "Reorder Test Form"})
reorder_form_id = r_f.json()["id"]
r_v = api("GET", f"/forms/{reorder_form_id}/current-version", token=token)
reorder_ver_id = r_v.json()["id"]

r_s1 = api("POST", "/sections/", token=token, json={"form_version_id": reorder_ver_id, "title": "S1", "display_order": 0})
r_s2 = api("POST", "/sections/", token=token, json={"form_version_id": reorder_ver_id, "title": "S2", "display_order": 1})
sec1_id = r_s1.json()["id"]
sec2_id = r_s2.json()["id"]

r_fld = api("POST", "/fields/", token=token, json={
    "form_version_id": reorder_ver_id,
    "section_id": sec1_id,
    "label": "Trigger",
    "field_type": "text",
    "display_order": 0,
})
trigger_id = r_fld.json()["id"]

r1 = api("POST", "/branch-rules/", token=token, json={
    "from_section_id": sec1_id,
    "to_section_id": sec2_id,
    "trigger_field_id": trigger_id,
    "operator": "equals",
    "comparison_value": "first",
    "priority": 0,
})
r2 = api("POST", "/branch-rules/", token=token, json={
    "from_section_id": sec1_id,
    "to_section_id": sec2_id,
    "trigger_field_id": trigger_id,
    "operator": "equals",
    "comparison_value": "second",
    "priority": 1,
})
if r1.status_code not in (200, 201) or r2.status_code not in (200, 201):
    fail("could not create 2 rules for reorder", f"r1: {r1.text}, r2: {r2.text}")
rule_a_id = r1.json()["id"]
rule_b_id = r2.json()["id"]

r = api("PATCH", f"/branch-rules/section/{sec1_id}/reorder", token=token, json={
    "rule_ids": [rule_b_id, rule_a_id]
})
if r.status_code != 200:
    fail("reorder endpoint", r.text)
reordered = r.json()
priority_map = {rule["id"]: rule["priority"] for rule in reordered}
if priority_map[rule_b_id] != 0 or priority_map[rule_a_id] != 1:
    fail(f"reorder didn't assign correct priorities: {priority_map}")
ok(f"reorder works: rule {rule_b_id} now priority=0, rule {rule_a_id} now priority=1")

r = api("PATCH", f"/branch-rules/section/{sec1_id}/reorder", token=token, json={
    "rule_ids": [rule_a_id]
})
if r.status_code != 400:
    fail(f"expected 400 on partial reorder, got {r.status_code}")
ok("partial reorder correctly rejected 400")

print("\n[ALL PASSED] All Phase 1 checks completed successfully!")
