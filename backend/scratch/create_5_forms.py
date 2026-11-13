"""
create_5_forms.py
=================
Creates 5 comprehensive forms as np@gmail.com, seeds analytics data,
verifies analytics + export, and produces a final audit report.

Run from d:/InfyProject/backend:
    $env:PYTHONPATH='.'; .\\venv\\Scripts\\python.exe scratch\\create_5_forms.py
"""

import os, sys, json, traceback

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)
EMAIL = "np@gmail.com"
PASSWORD = "123456"
BUGS = []
PASSES = []

def ok(label):
    print(f"  [PASS] {label}")
    PASSES.append(label)

def fail(label, detail=""):
    msg = f"{label}" + (f": {detail}" if detail else "")
    print(f"  [FAIL] {msg}")
    BUGS.append(msg)

def check(cond, label, detail=""):
    if cond:
        ok(label)
    else:
        fail(label, detail)

def section(title):
    print(f"\n{'='*65}\n  {title}\n{'='*65}")

def assert_status(r, expected, label):
    if r.status_code == expected:
        ok(f"{label} [HTTP {r.status_code}]")
        return True
    else:
        fail(f"{label} [HTTP {r.status_code}, expected {expected}]", r.text[:200])
        return False

# ─────────────── STEP 0: AUTH ──────────────────────────────────────────────
section("STEP 0 — Auth: ensure np@gmail.com exists and login")

r = client.post("/api/auth/signup", json={"name":"Ninad Patil","email":EMAIL,"password":PASSWORD,"role":"user"})
if r.status_code == 201:
    ok("Signed up new user np@gmail.com")
elif r.status_code in (400, 409, 422):
    ok("User np@gmail.com already exists (skipping signup)")
else:
    fail(f"Unexpected signup: {r.status_code}", r.text[:100])

r = client.post("/api/auth/login", data={"username": EMAIL, "password": PASSWORD})
assert_status(r, 200, "Login np@gmail.com")
token = r.json()["access_token"]
auth = {"Authorization": f"Bearer {token}"}

# ─────────────── HELPERS ───────────────────────────────────────────────────

def create_form(title, description=""):
    r = client.post("/api/forms/", json={"title": title, "description": description}, headers=auth)
    assert_status(r, 201, f"Create form '{title}'")
    return r.json()

def get_current_version(form_id):
    r = client.get(f"/api/forms/{form_id}/current-version", headers=auth)
    assert_status(r, 200, f"Get version for form {form_id}")
    return r.json()

def create_field(fv_id, label, ftype, required=False, options=None, validation_config=None, display_order=0, section_id=None):
    p = {"form_version_id": fv_id, "label": label, "field_type": ftype, "required": required, "display_order": display_order}
    if options: p["options"] = options
    if validation_config: p["validation_config"] = validation_config
    if section_id is not None: p["section_id"] = section_id
    r = client.post("/api/fields/", json=p, headers=auth)
    assert_status(r, 201, f"  Field '{label}' ({ftype})")
    return r.json()

def create_section(fv_id, title, description="", display_order=0):
    p = {"form_version_id": fv_id, "title": title, "display_order": display_order}
    if description: p["description"] = description
    r = client.post("/api/sections/", json=p, headers=auth)
    assert_status(r, 201, f"  Section '{title}'")
    return r.json()

def create_branch_rule(from_sec, to_sec, trigger_field, operator, comparison_value=None, priority=0):
    p = {"from_section_id": from_sec, "trigger_field_id": trigger_field, "operator": operator, "priority": priority}
    if to_sec is not None: p["to_section_id"] = to_sec
    if comparison_value is not None: p["comparison_value"] = comparison_value
    r = client.post("/api/branch-rules/", json=p, headers=auth)
    assert_status(r, 201, f"  Branch rule sec {from_sec}->{to_sec} via field {trigger_field}")
    return r.json()

def create_conditional_rule(fv_id, trigger_id, operator, comparison_value, target_id, action):
    p = {"form_version_id": fv_id, "trigger_field_id": trigger_id, "operator": operator,
         "comparison_value": comparison_value, "target_field_id": target_id, "action": action}
    r = client.post("/api/conditional-rules/", json=p, headers=auth)
    assert_status(r, 201, f"  ConditionalRule: {trigger_id} {operator} -> {action} {target_id}")
    return r.json()

def create_condition_group(fv_id, target_id, action, combinator, conditions):
    p = {"form_version_id": fv_id, "target_field_id": target_id, "action": action, "combinator": combinator, "conditions": conditions}
    r = client.post("/api/condition-groups/", json=p, headers=auth)
    assert_status(r, 201, f"  ConditionGroup ({combinator}) -> {action} field {target_id}")
    return r.json()

def publish_form(form_id):
    r = client.post(f"/api/forms/{form_id}/publish", headers=auth)
    assert_status(r, 200, f"Publish form {form_id}")
    return r.json()

def seed_demo(fv_id):
    r = client.post(f"/api/submissions/form-version/{fv_id}/seed-demo", headers=auth)
    assert_status(r, 201, f"Seed demo submissions for version {fv_id}")
    return r.json()

def get_conditional_rules(fv_id):
    r = client.get(f"/api/conditional-rules/form-version/{fv_id}", headers=auth)
    assert_status(r, 200, f"Get conditional rules for version {fv_id}")
    return r.json()

def get_condition_groups(fv_id):
    r = client.get(f"/api/condition-groups/form-version/{fv_id}")
    assert_status(r, 200, f"Get condition groups for version {fv_id}")
    return r.json()

# ─────────────── FORM 1: Basic Contact Form ───────────────────────────────
section("FORM 1 — Basic Contact Form (all field types)")

f1 = create_form("Basic Contact Form", "All core field types with required/optional mix and basic validation.")
v1 = get_current_version(f1["id"])
v1_id = v1["id"]

name_f = create_field(v1_id, "Full Name", "text", required=True, display_order=0, validation_config={"min_length":2,"max_length":100})
email_f = create_field(v1_id, "Email Address", "email", required=True, display_order=1)
phone_f = create_field(v1_id, "Phone Number", "text", required=False, display_order=2)
age_f = create_field(v1_id, "Age", "number", required=True, display_order=3, validation_config={"min":1,"max":120})
bio_f = create_field(v1_id, "Short Bio", "textarea", required=False, display_order=4, validation_config={"max_length":500})
country_f = create_field(v1_id, "Country", "dropdown", required=True, display_order=5, options=[
    {"label":"India","value":"India"},{"label":"USA","value":"USA"},{"label":"UK","value":"UK"},
    {"label":"Canada","value":"Canada"},{"label":"Other","value":"Other"}])
interests_f = create_field(v1_id, "Interests", "checkbox", required=False, display_order=6, options=[
    {"label":"Technology","value":"tech"},{"label":"Sports","value":"sports"},
    {"label":"Arts","value":"arts"},{"label":"Travel","value":"travel"}])
gender_f = create_field(v1_id, "Gender", "radio", required=False, display_order=7, options=[
    {"label":"Male","value":"male"},{"label":"Female","value":"female"},
    {"label":"Non-binary","value":"non_binary"},{"label":"Prefer not to say","value":"prefer_not"}])
dob_f = create_field(v1_id, "Date of Birth", "date", required=False, display_order=8, validation_config={"max_date":"2010-01-01"})

# Conditional rule: if Country = Other, phone becomes required
cr_f1 = create_conditional_rule(v1_id, country_f["id"], "equals", "Other", phone_f["id"], "require")

rules_f1 = get_conditional_rules(v1_id)
check(len(rules_f1) == 1, "Form 1: conditional rule created", f"count={len(rules_f1)}")

pub1 = publish_form(f1["id"])
check("form_version_id" in pub1 and "public_link" in pub1, "Form 1 published successfully")
print(f"  -> version_id={pub1['form_version_id']}, link={pub1['public_link']}")

# Verify conditional rule on PUBLISHED version
rules_pub1 = get_conditional_rules(pub1["form_version_id"])
check(len(rules_pub1)==1, "Form 1: ConditionalRule on PUBLISHED version", f"count={len(rules_pub1)}")

# Verify ConditionalRule on NEW draft after publish
new_v1 = get_current_version(f1["id"])
rules_new_draft1 = get_conditional_rules(new_v1["id"])
check(len(rules_new_draft1)==1, "Form 1: ConditionalRule cloned to new draft after publish", f"count={len(rules_new_draft1)}")

seed_demo(pub1["form_version_id"])

# ─────────────── FORM 2: Multi-Section Survey ────────────────────────────
section("FORM 2 — Multi-Section Survey (sections + branch logic)")

f2 = create_form("Multi-Section Survey", "Multi-page survey with section navigation and branch logic.")
v2 = get_current_version(f2["id"])
v2_id = v2["id"]

s2_intro = create_section(v2_id, "Introduction", "Tell us about yourself", 0)
s2_tech   = create_section(v2_id, "Technology Background", "Your tech experience", 1)
s2_gen    = create_section(v2_id, "General Questions", "Non-tech questions", 2)
s2_feed   = create_section(v2_id, "Final Feedback", "Your final comments", 3)

# Intro section fields
f2_name = create_field(v2_id, "Your Name", "text", required=True, display_order=0, section_id=s2_intro["id"])
f2_role = create_field(v2_id, "Are you a developer?", "radio", required=True, display_order=1, section_id=s2_intro["id"],
    options=[{"label":"Yes","value":"yes"},{"label":"No","value":"no"}])
f2_exp = create_field(v2_id, "Years of Experience", "number", required=False, display_order=2,
    section_id=s2_intro["id"], validation_config={"min":0,"max":50})

# Tech section fields
f2_langs = create_field(v2_id, "Preferred Languages", "checkbox", required=True, display_order=0, section_id=s2_tech["id"],
    options=[{"label":"Python","value":"python"},{"label":"JavaScript","value":"js"},
             {"label":"Java","value":"java"},{"label":"Go","value":"go"}])
f2_fw = create_field(v2_id, "Favorite Framework", "dropdown", required=False, display_order=1, section_id=s2_tech["id"],
    options=[{"label":"React","value":"react"},{"label":"FastAPI","value":"fastapi"},
             {"label":"Django","value":"django"},{"label":"Spring","value":"spring"}])

# General section fields
f2_hobby = create_field(v2_id, "What is your hobby?", "text", required=False, display_order=0, section_id=s2_gen["id"])
f2_sports = create_field(v2_id, "Do you play sports?", "radio", required=False, display_order=1, section_id=s2_gen["id"],
    options=[{"label":"Yes","value":"yes"},{"label":"No","value":"no"}])

# Feedback section fields
f2_feedback = create_field(v2_id, "Final Feedback", "textarea", required=False, display_order=0, section_id=s2_feed["id"])
f2_rating = create_field(v2_id, "Overall Rating", "rating", required=True, display_order=1, section_id=s2_feed["id"],
    validation_config={"min":1,"max":5})

# Branch rules: developer -> tech section; non-developer -> general
br1 = create_branch_rule(s2_intro["id"], s2_tech["id"],  f2_role["id"], "equals", "yes", priority=0)
br2 = create_branch_rule(s2_intro["id"], s2_gen["id"],   f2_role["id"], "equals", "no",  priority=1)
# After tech -> go to feedback (use is_not_empty as a catch-all)
br3 = create_branch_rule(s2_tech["id"], s2_feed["id"],   f2_fw["id"],   "is_not_empty", None, priority=0)
# Cycle detection: do NOT add a branch rule from feedback back to intro

pub2 = publish_form(f2["id"])
check("form_version_id" in pub2, "Form 2 published successfully")
print(f"  -> version_id={pub2['form_version_id']}, link={pub2['public_link']}")
seed_demo(pub2["form_version_id"])

# ─────────────── FORM 3: Conditional Rule Groups Form ────────────────────
section("FORM 3 — Conditional Rule Groups Form (AND/OR combinator heavy)")

f3 = create_form("Conditional Rule Groups Form",
    "Heavy use of AND/OR condition groups with multiple rules controlling field visibility.")
v3 = get_current_version(f3["id"])
v3_id = v3["id"]

# Trigger fields
f3_type  = create_field(v3_id, "User Type", "dropdown", required=True, display_order=0,
    options=[{"label":"Student","value":"student"},{"label":"Professional","value":"professional"},
             {"label":"Business Owner","value":"business"}])
f3_age   = create_field(v3_id, "Age Group", "radio", required=True, display_order=1,
    options=[{"label":"18-25","value":"18-25"},{"label":"26-40","value":"26-40"},{"label":"41+","value":"41+"}])
f3_emp   = create_field(v3_id, "Currently Employed?", "radio", required=False, display_order=2,
    options=[{"label":"Yes","value":"yes"},{"label":"No","value":"no"}])

# Conditionally shown fields
f3_uni   = create_field(v3_id, "University Name", "text", required=False, display_order=3)
f3_gpa   = create_field(v3_id, "GPA / Percentage", "number", required=False, display_order=4, validation_config={"min":0,"max":100})
f3_comp  = create_field(v3_id, "Company Name", "text", required=False, display_order=5)
f3_sal   = create_field(v3_id, "Annual Salary Range", "dropdown", required=False, display_order=6,
    options=[{"label":"<","value":"lt30"},{"label":"-","value":"30_70"},
             {"label":"-","value":"70_150"},{"label":">","value":"gt150"}])
f3_biz   = create_field(v3_id, "Business Name", "text", required=False, display_order=7)
f3_bsz   = create_field(v3_id, "Business Size", "dropdown", required=False, display_order=8,
    options=[{"label":"1-10","value":"1_10"},{"label":"11-50","value":"11_50"},
             {"label":"51-200","value":"51_200"},{"label":"200+","value":"200+"}])
f3_cmts  = create_field(v3_id, "Additional Comments", "textarea", required=False, display_order=9)

# Condition Groups (7 total)
# 1. AND: Show University Name when User Type = student
create_condition_group(v3_id, f3_uni["id"], "show", "AND", [
    {"trigger_field_id": f3_type["id"], "operator": "equals", "comparison_value": "student"}])

# 2. AND: Show GPA when (User Type = student AND Age Group = 18-25)
create_condition_group(v3_id, f3_gpa["id"], "show", "AND", [
    {"trigger_field_id": f3_type["id"], "operator": "equals", "comparison_value": "student"},
    {"trigger_field_id": f3_age["id"],  "operator": "equals", "comparison_value": "18-25"}])

# 3. OR: Show Company when (User Type = professional OR User Type = business)
create_condition_group(v3_id, f3_comp["id"], "show", "OR", [
    {"trigger_field_id": f3_type["id"], "operator": "equals", "comparison_value": "professional"},
    {"trigger_field_id": f3_type["id"], "operator": "equals", "comparison_value": "business"}])

# 4. AND: Show Salary when (User Type = professional AND Employed = yes)
create_condition_group(v3_id, f3_sal["id"], "show", "AND", [
    {"trigger_field_id": f3_type["id"], "operator": "equals", "comparison_value": "professional"},
    {"trigger_field_id": f3_emp["id"],  "operator": "equals", "comparison_value": "yes"}])

# 5. AND: Show Business Name when (User Type = business)
create_condition_group(v3_id, f3_biz["id"], "show", "AND", [
    {"trigger_field_id": f3_type["id"], "operator": "equals", "comparison_value": "business"}])

# 6. AND: Show Business Size when (User Type = business AND Age Group != 18-25)
create_condition_group(v3_id, f3_bsz["id"], "show", "AND", [
    {"trigger_field_id": f3_type["id"], "operator": "equals",     "comparison_value": "business"},
    {"trigger_field_id": f3_age["id"],  "operator": "not_equals", "comparison_value": "18-25"}])

# 7. OR: Show Comments when (User Type = student OR Employed = no)
create_condition_group(v3_id, f3_cmts["id"], "show", "OR", [
    {"trigger_field_id": f3_type["id"], "operator": "equals", "comparison_value": "student"},
    {"trigger_field_id": f3_emp["id"],  "operator": "equals", "comparison_value": "no"}])

groups_v3 = get_condition_groups(v3_id)
check(len(groups_v3)==7, f"Form 3: 7 condition groups created", f"count={len(groups_v3)}")

pub3 = publish_form(f3["id"])
check("form_version_id" in pub3, "Form 3 published successfully")
print(f"  -> version_id={pub3['form_version_id']}, link={pub3['public_link']}")

# Verify groups survived publish on new draft
new_v3 = get_current_version(f3["id"])
groups_new3 = get_condition_groups(new_v3["id"])
check(len(groups_new3)==7, "Form 3: ConditionGroups cloned to new draft", f"count={len(groups_new3)}")

seed_demo(pub3["form_version_id"])

# ─────────────── FORM 4: Publish/Clone Test Form ─────────────────────────
section("FORM 4 — Publish/Clone Test Form (ConditionalRule publish survival)")

f4 = create_form("Publish Clone Test Form",
    "Tests publish flow: conditional rules and condition groups must survive publish_draft().")
v4 = get_current_version(f4["id"])
v4_id = v4["id"]

f4_sat   = create_field(v4_id, "Overall Satisfaction", "rating", required=True, display_order=0, validation_config={"min":1,"max":10})
f4_rec   = create_field(v4_id, "Would you recommend us?", "radio", required=True, display_order=1,
    options=[{"label":"Yes","value":"yes"},{"label":"No","value":"no"}])
f4_reas  = create_field(v4_id, "Reason for not recommending", "textarea", required=False, display_order=2)
f4_nps   = create_field(v4_id, "NPS Score (1-10)", "number", required=False, display_order=3, validation_config={"min":1,"max":10})
f4_email = create_field(v4_id, "Your Email (for follow-up)", "email", required=False, display_order=4)

# Legacy conditional rules (3 of them)
create_conditional_rule(v4_id, f4_rec["id"],  "equals",    "no",  f4_reas["id"],  "show")
create_conditional_rule(v4_id, f4_sat["id"],  "less_than", "5",   f4_nps["id"],   "require")
create_conditional_rule(v4_id, f4_rec["id"],  "equals",    "yes", f4_email["id"], "show")

# AND condition group
create_condition_group(v4_id, f4_email["id"], "require", "AND", [
    {"trigger_field_id": f4_rec["id"], "operator": "equals",       "comparison_value": "yes"},
    {"trigger_field_id": f4_sat["id"], "operator": "greater_than", "comparison_value": "7"}])

rules_before = get_conditional_rules(v4_id)
groups_before = get_condition_groups(v4_id)
check(len(rules_before)==3,  f"Form 4: 3 legacy ConditionalRules created", f"count={len(rules_before)}")
check(len(groups_before)==1, f"Form 4: 1 ConditionGroup created", f"count={len(groups_before)}")

pub4 = publish_form(f4["id"])
published_v4_id = pub4["form_version_id"]
check("form_version_id" in pub4, "Form 4 published successfully")
print(f"  -> Published version_id={published_v4_id}")

# CRITICAL: verify rules on PUBLISHED version
rules_pub4 = get_conditional_rules(published_v4_id)
groups_pub4 = get_condition_groups(published_v4_id)
check(len(rules_pub4)==3,  "CRITICAL: ConditionalRules on PUBLISHED version", f"count={len(rules_pub4)} (expected 3)")
check(len(groups_pub4)==1, "CRITICAL: ConditionGroups on PUBLISHED version",  f"count={len(groups_pub4)} (expected 1)")

# CRITICAL: verify rules CLONED to new draft
new_v4 = get_current_version(f4["id"])
rules_new4 = get_conditional_rules(new_v4["id"])
groups_new4 = get_condition_groups(new_v4["id"])
check(len(rules_new4)==3,  "CRITICAL: ConditionalRules cloned to new draft after publish", f"count={len(rules_new4)}")
check(len(groups_new4)==1, "CRITICAL: ConditionGroups cloned to new draft after publish",  f"count={len(groups_new4)}")

seed_demo(published_v4_id)

# ─────────────── FORM 5: Analytics + Export Form ─────────────────────────
section("FORM 5 — Analytics + Export Form (rich analytics data)")

f5 = create_form("Analytics Export Form",
    "Multi-section form designed to generate rich analytics: views, submissions, drop-off data.")
v5 = get_current_version(f5["id"])
v5_id = v5["id"]

s5_a = create_section(v5_id, "Personal Info", "Basic personal information", 0)
s5_b = create_section(v5_id, "Professional Details", "Career information", 1)
s5_c = create_section(v5_id, "Product Feedback", "Your experience", 2)

f5_name = create_field(v5_id, "Full Name", "text", required=True, display_order=0, section_id=s5_a["id"])
f5_eml  = create_field(v5_id, "Email", "email", required=True, display_order=1, section_id=s5_a["id"])
f5_age  = create_field(v5_id, "Age", "number", required=False, display_order=2, section_id=s5_a["id"], validation_config={"min":18,"max":100})
f5_cty  = create_field(v5_id, "Country", "dropdown", required=True, display_order=3, section_id=s5_a["id"],
    options=[{"label":"India","value":"india"},{"label":"USA","value":"usa"},{"label":"UK","value":"uk"},{"label":"Other","value":"other"}])

f5_job  = create_field(v5_id, "Job Title", "text", required=False, display_order=0, section_id=s5_b["id"])
f5_comp = create_field(v5_id, "Company", "text", required=False, display_order=1, section_id=s5_b["id"])
f5_yrs  = create_field(v5_id, "Years of Experience", "number", required=False, display_order=2, section_id=s5_b["id"], validation_config={"min":0,"max":50})

f5_sat  = create_field(v5_id, "Product Satisfaction", "rating", required=True, display_order=0, section_id=s5_c["id"], validation_config={"min":1,"max":5})
f5_feat = create_field(v5_id, "Most Valued Features", "checkbox", required=False, display_order=1, section_id=s5_c["id"],
    options=[{"label":"Easy to use","value":"usability"},{"label":"Fast performance","value":"performance"},
             {"label":"Good support","value":"support"},{"label":"Affordable","value":"pricing"}])
f5_cmts = create_field(v5_id, "Additional Comments", "textarea", required=False, display_order=2, section_id=s5_c["id"])
f5_nps  = create_field(v5_id, "NPS Score (0-10)", "number", required=True, display_order=3, section_id=s5_c["id"], validation_config={"min":0,"max":10})

pub5 = publish_form(f5["id"])
published_v5_id = pub5["form_version_id"]
check("form_version_id" in pub5, "Form 5 published successfully")
print(f"  -> Published version_id={published_v5_id}, link={pub5['public_link']}")

seed_demo(published_v5_id)

# Also add synthetic FormViews via DB for analytics
from app.database.database import SessionLocal
import random
from datetime import datetime, timezone, timedelta

db = SessionLocal()
try:
    from app.models.form_view import FormView
    now = datetime.now(timezone.utc)
    for i in range(20):
        view = FormView(form_version_id=published_v5_id, viewed_at=now - timedelta(days=random.randint(0, 29)))
        db.add(view)
    db.commit()
    ok("Form 5: Added 20 synthetic page views for analytics")
except Exception as e:
    print(f"  [WARN] Could not add FormView rows: {e}")
finally:
    db.close()

# ─────────────── STEP 7: Analytics Dashboard ─────────────────────────────
section("STEP 7 — Verify Analytics Dashboard for all 5 forms")

for fname, fobj in [("Form 1", f1), ("Form 2", f2), ("Form 3", f3), ("Form 4", f4), ("Form 5", f5)]:
    r = client.get(f"/api/analytics/form/{fobj['id']}/dashboard", headers=auth)
    if r.status_code == 200:
        data = r.json()
        ov = data.get("overview", {})
        print(f"  {fname} -> views={ov.get('total_views')}, submitted={ov.get('total_submitted')}, rate={ov.get('completion_rate')}")
        ok(f"Analytics dashboard works for {fname}")
    else:
        fail(f"Analytics dashboard failed for {fname}", f"HTTP {r.status_code}: {r.text[:100]}")

# ─────────────── STEP 8: Export ──────────────────────────────────────────
section("STEP 8 — Verify Export (CSV) for Form 5")

f5_id = f5["id"]
r = client.get(f"/api/export/{f5_id}/submissions", headers=auth)
if r.status_code == 200:
    body = r.text.strip()
    rows = body.split("\n")
    ok(f"Export CSV: {len(rows)} rows (header + {len(rows)-1} data rows)")
    if len(rows) >= 2:
        ok("Export has header + at least 1 data row")
    else:
        fail("Export CSV only has 1 row (header only — no data?)")
else:
    fail("Export CSV failed", f"HTTP {r.status_code}: {r.text[:200]}")

# ─────────────── FINAL SUMMARY ───────────────────────────────────────────
section("FINAL SUMMARY")

print(f"\n  PASSED: {len(PASSES)}")
print(f"  FAILED: {len(BUGS)}")

if BUGS:
    print("\n  === BUGS FOUND ===")
    for b in BUGS:
        print(f"    ❌ {b}")
else:
    print("\n  ✅ ALL CHECKS PASSED — No bugs found!")

print(f"""
  5 Forms Created:
    Form 1 — Basic Contact Form        (9 fields, all core types, 1 conditional rule)
    Form 2 — Multi-Section Survey      (4 sections, 9 fields, 3 branch rules)
    Form 3 — Conditional Rule Groups   (10 fields, 7 condition groups AND+OR)
    Form 4 — Publish/Clone Test        (5 fields, 3 legacy rules + 1 group, publish verified)
    Form 5 — Analytics + Export        (3 sections, 11 fields, demo subs + views seeded)
""")

if BUGS:
    sys.exit(1)
else:
    sys.exit(0)


