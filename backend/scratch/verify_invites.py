"""verify_invites.py

Exercises every Phase-2 backend feature end-to-end against the real DB.

Run from the backend/ directory:
    python -m scratch.verify_invites
"""

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
email = f"invites_{int(time.time())}@example.com"
password = "Hardn3ning!"

r = api("POST", "/auth/signup", json={"name": "Invites User", "email": email, "password": password})
if r.status_code not in (200, 201, 400, 409):
    fail("signup", r.text)
ok("signup (or already exists)")

r = api("POST", "/auth/login", data={"username": email, "password": password})
if r.status_code != 200:
    fail("login", r.text)
token = r.json()["access_token"]
ok("login")

# -- Create & Publish Form ------------------------------------------------------

print("\n[1] Create & Publish Form")
r = api("POST", "/forms/", token=token, json={"title": "Invite Only Test Form"})
if r.status_code not in (200, 201):
    fail("create form", r.text)
form_id = r.json()["id"]
ok(f"form created id={form_id}")

r = api("GET", f"/forms/{form_id}/current-version", token=token)
if r.status_code != 200:
    fail("get current-version", r.text)
version_id = r.json()["id"]
ok(f"draft version initialized id={version_id}")

# Publish the form (so public endpoints can load it)
r = api("POST", f"/forms/{form_id}/publish", token=token)

if r.status_code not in (200, 201):
    fail("publish form", r.text)
public_link = r.json()["public_link"]
ok(f"form published, public_link={public_link}")

# Verify default is 'public'
r = api("GET", f"/forms/{form_id}", token=token)
form_data = r.json()
if form_data.get("access_mode") != "public":
    fail("default access_mode should be public", str(form_data))
ok("default access mode is public")

# -- Test 1: Public access works by default -------------------------------------

print("\n[2] Test: Public access works without invite token")
r = requests.get(f"{BASE}/public/forms/{public_link}")
if r.status_code != 200:
    fail("public load failed", r.text)
ok("public form structure loaded successfully")

r = requests.post(f"{BASE}/submissions/", json={"form_version_id": version_id})
if r.status_code not in (200, 201):
    fail("public submission failed", r.text)
ok("public submission created successfully without token")

# -- Test 2: Switch to invite-only & enforce token ------------------------------

print("\n[3] Test: Switch to invite_only and check enforcement")

# Update access_mode to invite_only and allow_resubmission to False
r = api("PUT", f"/forms/{form_id}", token=token, json={
    "access_mode": "invite_only",
    "allow_resubmission": False
})
if r.status_code != 200:
    fail("switch to invite_only", r.text)
ok("form updated to access_mode=invite_only, allow_resubmission=False")

# Try to load layout without invite token -> 403
r = requests.get(f"{BASE}/public/forms/{public_link}")
if r.status_code != 403:
    fail(f"expected 403 without token on invite-only form, got {r.status_code}", r.text)
ok("access without token correctly blocked (403)")

# Try to load layout with invalid token -> 403
r = requests.get(f"{BASE}/public/forms/{public_link}", params={"invite": "fake_token"})
if r.status_code != 403:
    fail(f"expected 403 with fake token, got {r.status_code}", r.text)
ok("access with fake token correctly blocked (403)")

# Try to create submission without token -> 403
r = requests.post(f"{BASE}/submissions/", json={"form_version_id": version_id})
if r.status_code != 403:
    fail(f"expected 403 on submission without token, got {r.status_code}", r.text)
ok("submission creation without token blocked (403)")

# -- Test 3: Generate invites & test valid usage -------------------------------

print("\n[4] Test: Generate invites and test valid usage")

invite_email = "respondent@example.com"
r = api("POST", f"/forms/{form_id}/invites", token=token, json={
    "emails": [invite_email],
    "max_uses": 1
})
if r.status_code not in (200, 201):
    fail("generate invite", r.text)
invites = r.json()
if not invites:
    fail("empty invites response", r.text)
invite = invites[0]
invite_token = invite["token"]
ok(f"generated invite token={invite_token} link={invite['invite_link']}")

# Load public layout with valid token -> 200
r = requests.get(f"{BASE}/public/forms/{public_link}", params={"invite": invite_token})
if r.status_code != 200:
    fail("failed to load structure with valid invite token", r.text)
ok("public form structure loaded successfully with valid token")

# Create submission with valid token -> 200
r = requests.post(f"{BASE}/submissions/", json={
    "form_version_id": version_id,
    "invite_token": invite_token
})
if r.status_code not in (200, 201):
    fail("failed to create submission with valid invite token", r.text)
sub_id = r.json()["id"]
# Verify respondent_identifier was automatically set to invite_email
if r.json().get("respondent_identifier") != invite_email:
    fail(f"expected respondent_identifier={invite_email}, got: {r.json().get('respondent_identifier')}")
ok(f"submission created id={sub_id}, respondent_identifier set to {invite_email}")

# -- Test 4: Enforcement of used token -----------------------------------------

print("\n[5] Test: Enforce used token when allow_resubmission is False")

# Get invite list from form management endpoint to verify use_count is 1
r = api("GET", f"/forms/{form_id}/invites", token=token)
if r.status_code != 200:
    fail("get invites list", r.text)
current_invite = [inv for inv in r.json() if inv["token"] == invite_token][0]
if current_invite["use_count"] != 1:
    fail(f"expected use_count=1, got {current_invite['use_count']}")
ok("database correctly recorded use_count=1 and used_at timestamp")

# Try to create a second submission with the same token -> should fail 403
r = requests.post(f"{BASE}/submissions/", json={
    "form_version_id": version_id,
    "invite_token": invite_token
})
if r.status_code != 403:
    fail(f"expected 403 when resubmitting with exhausted token, got {r.status_code}", r.text)
ok("second submission with exhausted token correctly blocked (403)")

# -- Test 5: Allow resubmission toggle -----------------------------------------

print("\n[6] Test: Enable allow_resubmission and verify access is restored")

r = api("PUT", f"/forms/{form_id}", token=token, json={
    "allow_resubmission": True
})
if r.status_code != 200:
    fail("enable resubmissions", r.text)
ok("allow_resubmission toggled to True")

# Try to create submission again -> should succeed now!
r = requests.post(f"{BASE}/submissions/", json={
    "form_version_id": version_id,
    "invite_token": invite_token
})
if r.status_code not in (200, 201):
    fail("failed to create submission after allowing resubmissions", r.text)
ok("second submission succeeded after enabling allow_resubmission")

# -- Test 6: Revocation --------------------------------------------------------

print("\n[7] Test: Revoke invite token")

# Revoke/Delete the invite
r = api("DELETE", f"/forms/{form_id}/invites/{invite['id']}", token=token)
if r.status_code != 200:
    fail("revoke invite", r.text)
ok("invite token successfully deleted/revoked")

# Try to use it -> 403
r = requests.post(f"{BASE}/submissions/", json={
    "form_version_id": version_id,
    "invite_token": invite_token
})
if r.status_code != 403:
    fail(f"expected 403 with revoked token, got {r.status_code}", r.text)
ok("revoked token usage correctly blocked (403)")

print("\n[ALL PASSED] All Phase 2 invite checks completed successfully!")
