"""seed_demo_form.py

Seeds the database with a "Demo: Everything" form that showcases every single feature:
1. Every field type (text, textarea, select, radio, checkbox, rating, file, computed).
2. Multiple sections.
3. Branching rules and default paths.
4. Formula computation.
5. Condition group rules (show/hide/require).
6. Demo invites ready to test.

Run:
    python -m scratch.seed_demo_form
"""

import json
from sqlalchemy import select
from app.database.database import SessionLocal, engine, Base
import app.models
from app.models.user import User
from app.models.form import Form
from app.models.form_version import FormVersion
from app.models.section import Section
from app.models.field import Field
from app.models.branch_rule import SectionBranchRule
from app.models.condition_group import ConditionGroup, ConditionGroupCondition
from app.models.form_invite import FormInvite
from app.utils.security import hash_password
from app.services.form_version_service import form_version_service
from app.services.form_invite_service import form_invite_service
from app.schemas.form_invite import FormInviteBatchCreate


def main():
    db = SessionLocal()
    try:
        # 1. Create or fetch demo user
        email = "demo_user@example.com"
        demo_user = db.execute(select(User).where(User.email == email)).scalar_one_or_none()
        if not demo_user:
            hashed_pw = hash_password("password123")
            demo_user = User(
                name="Demo Builder",
                email=email,
                password_hash=hashed_pw,
                role="user"
            )
            db.add(demo_user)
            db.commit()
            db.refresh(demo_user)
            print(f"Created demo user: {email} with password: password123")
        else:
            print(f"Demo user {email} already exists.")

        # 2. Create the Form
        form_title = "Demo: Everything"
        # Delete existing demo form if it exists to allow re-seeding
        existing_forms = db.execute(select(Form).where(Form.title == form_title, Form.owner_id == demo_user.id)).scalars().all()
        for f in existing_forms:
            # Delete invites manually to prevent NotNullViolation
            for inv in f.invites:
                db.delete(inv)
            db.delete(f)
        db.commit()

        form = Form(
            owner_id=demo_user.id,
            title=form_title,
            description="A comprehensive demonstration showcasing every feature of the Smart Form Builder.",
            status="draft",
            access_mode="public",
            allow_resubmission=True,
        )
        db.add(form)
        db.commit()
        db.refresh(form)
        print(f"Created form: '{form.title}' (ID: {form.id})")

        # 3. Create Draft Version
        draft = FormVersion(
            form_id=form.id,
            version_number=1,
            is_published=False,
        )
        db.add(draft)
        db.commit()
        db.refresh(draft)
        print(f"Initialized draft version (ID: {draft.id})")

        # 4. Create Sections
        sections_data = [
            ("Intro & Consent", "Welcome to the form builder demo. Please confirm your consent.", 0),
            ("Demographics", "Basic personal details.", 1),
            ("Technical Experience", "Tell us about your coding experience.", 2),
            ("Specialized Questions", "This section is shown only to highly experienced engineers.", 3),
            ("Feedback & Formula", "Provide ratings and see computed scoring formulas.", 4),
            ("Summary & Review", "Review your response before final submission.", 5),
        ]
        sections = []
        for title, desc, display_order in sections_data:
            sec = Section(
                form_version_id=draft.id,
                title=title,
                description=desc,
                display_order=display_order,
            )
            db.add(sec)
            sections.append(sec)
        db.commit()
        for sec in sections:
            db.refresh(sec)
        print(f"Created {len(sections)} sections.")

        sec_intro, sec_demo, sec_tech, sec_special, sec_feedback, sec_review = sections

        # 5. Create Fields
        # Section 1 (Intro)
        f_consent = Field(
            form_version_id=draft.id,
            section_id=sec_intro.id,
            label="Consent Agreement",
            field_type="checkbox",
            required=True,
            display_order=0,
            options_json=json.dumps([{"label": "I agree to participate and share my response.", "value": "agree"}]),
        )

        # Section 2 (Demographics)
        f_age = Field(
            form_version_id=draft.id,
            section_id=sec_demo.id,
            label="Your Age",
            field_type="number",
            required=True,
            display_order=0,
            validation_json=json.dumps({"min": 18, "max": 100}),
            placeholder="Enter age (must be 18+)"
        )
        f_gender = Field(
            form_version_id=draft.id,
            section_id=sec_demo.id,
            label="Gender",
            field_type="radio",
            required=False,
            display_order=1,
            options_json=json.dumps([
                {"label": "Male", "value": "male"},
                {"label": "Female", "value": "female"},
                {"label": "Other", "value": "other"},
                {"label": "Prefer not to say", "value": "prefer_not"}
            ])
        )

        # Section 3 (Technical Experience)
        f_languages = Field(
            form_version_id=draft.id,
            section_id=sec_tech.id,
            label="Which programming languages do you use?",
            field_type="checkbox",
            required=True,
            display_order=0,
            options_json=json.dumps([
                {"label": "Python", "value": "python"},
                {"label": "JavaScript / TypeScript", "value": "js_ts"},
                {"label": "Rust", "value": "rust"},
                {"label": "Go", "value": "go"},
                {"label": "C++", "value": "cpp"}
            ])
        )
        f_primary = Field(
            form_version_id=draft.id,
            section_id=sec_tech.id,
            label="What is your primary language?",
            field_type="dropdown",
            required=True,
            display_order=1,
            options_json=json.dumps([
                {"label": "Python", "value": "python"},
                {"label": "JavaScript / TypeScript", "value": "js_ts"},
                {"label": "Rust", "value": "rust"},
                {"label": "Go", "value": "go"},
                {"label": "C++", "value": "cpp"}
            ])
        )
        f_rating = Field(
            form_version_id=draft.id,
            section_id=sec_tech.id,
            label="Rate your overall coding skills",
            field_type="rating",
            required=True,
            display_order=2,
            validation_json=json.dumps({"max": 5})
        )

        # Section 4 (Specialized Questions)
        f_github = Field(
            form_version_id=draft.id,
            section_id=sec_special.id,
            label="GitHub Profile URL",
            field_type="text",
            required=False,
            display_order=0,
            placeholder="https://github.com/username"
        )
        f_resume = Field(
            form_version_id=draft.id,
            section_id=sec_special.id,
            label="Upload your Resume/CV",
            field_type="file",
            required=False,
            display_order=1,
        )

        # Section 5 (Feedback & Formula)
        f_feedback = Field(
            form_version_id=draft.id,
            section_id=sec_feedback.id,
            label="Detailed Feedback",
            field_type="textarea",
            required=False,
            display_order=0,
            placeholder="Type any comments here..."
        )
        f_score_a = Field(
            form_version_id=draft.id,
            section_id=sec_feedback.id,
            label="Knowledge Score",
            field_type="number",
            required=True,
            display_order=1,
            validation_json=json.dumps({"min": 0, "max": 50}),
            placeholder="Score out of 50"
        )
        f_score_b = Field(
            form_version_id=draft.id,
            section_id=sec_feedback.id,
            label="Practical Score",
            field_type="number",
            required=True,
            display_order=2,
            validation_json=json.dumps({"min": 0, "max": 50}),
            placeholder="Score out of 50"
        )
        f_total_score = Field(
            form_version_id=draft.id,
            section_id=sec_feedback.id,
            label="Combined Skill Score",
            field_type="computed",
            required=False,
            display_order=3,
        )

        # Section 6 (Review)
        f_confirm = Field(
            form_version_id=draft.id,
            section_id=sec_review.id,
            label="Confirmation",
            field_type="checkbox",
            required=True,
            display_order=0,
            options_json=json.dumps([{"label": "I verify that all entered details are accurate.", "value": "confirm"}]),
        )

        db.add_all([
            f_consent, f_age, f_gender, f_languages, f_primary,
            f_rating, f_github, f_resume, f_feedback, f_score_a,
            f_score_b, f_total_score, f_confirm
        ])
        db.commit()

        # Refresh all fields to get their IDs
        for f in [f_consent, f_age, f_gender, f_languages, f_primary, f_rating, f_github, f_resume, f_feedback, f_score_a, f_score_b, f_total_score, f_confirm]:
            db.refresh(f)
        print("Created form fields.")

        # 6. Configure Computed Formula for f_total_score
        # Formula: f_score_a + f_score_b
        formula_terms = [
            {"field_id": f_score_a.id},
            {"op": "add"},
            {"field_id": f_score_b.id}
        ]
        f_total_score.validation_json = json.dumps({
            "terms": formula_terms,
            "decimal_places": 0
        })
        db.add(f_total_score)
        db.commit()
        print("Configured computed formula field.")

        # 7. Configure Condition Groups (show Primary Language only if at least one language checked)
        cg = ConditionGroup(
            form_version_id=draft.id,
            target_field_id=f_primary.id,
            action="show",
            combinator="OR"
        )
        db.add(cg)
        db.commit()
        db.refresh(cg)

        # Conditions trigger on f_languages having values
        for idx, lang in enumerate(["python", "js_ts", "rust", "go", "cpp"]):
            cond = ConditionGroupCondition(
                group_id=cg.id,
                trigger_field_id=f_languages.id,
                operator="contains",
                comparison_value=lang,
                display_order=idx
            )
            db.add(cond)
        db.commit()
        print("Configured condition group rules.")

        # 8. Configure Default Next Section Links
        # Intro -> Demographics
        sec_intro.default_next_section_id = sec_demo.id
        # Demographics -> Tech
        sec_demo.default_next_section_id = sec_tech.id
        # Specialized Questions -> Feedback
        sec_special.default_next_section_id = sec_feedback.id
        # Feedback -> Review
        sec_feedback.default_next_section_id = sec_review.id
        # Review -> End (None)
        sec_review.default_next_section_id = None

        # Technical Experience: default path is to bypass Section 4 and go straight to Section 5
        sec_tech.default_next_section_id = sec_feedback.id

        db.add_all([sec_intro, sec_demo, sec_tech, sec_special, sec_feedback, sec_review])
        db.commit()
        print("Configured sequential default next section paths.")

        # 9. Configure Section Branching Rules
        # If Rating is 4 or 5, branch to specialized section (sec_special)
        rule_rating_5 = SectionBranchRule(
            from_section_id=sec_tech.id,
            to_section_id=sec_special.id,
            trigger_field_id=f_rating.id,
            operator="equals",
            comparison_value="5",
            priority=0
        )
        rule_rating_4 = SectionBranchRule(
            from_section_id=sec_tech.id,
            to_section_id=sec_special.id,
            trigger_field_id=f_rating.id,
            operator="equals",
            comparison_value="4",
            priority=1
        )
        db.add_all([rule_rating_5, rule_rating_4])
        db.commit()
        print("Configured conditional section branching rules.")

        # 10. Publish the Form!
        pub_version = form_version_service.publish_draft(db, form.id)
        print(f"Published form: public_link = {pub_version.public_link}")

        # 11. Toggle to invite_only and generate a couple of active invite tokens
        form.access_mode = "invite_only"
        form.allow_resubmission = False
        db.add(form)
        db.commit()
        print("Updated form privacy configuration to invite_only.")

        invite_batch = form_invite_service.create_batch_invites(
            db=db,
            form_id=form.id,
            batch_in=FormInviteBatchCreate(
                emails=["candidate1@example.com", "candidate2@example.com"],
                max_uses=1
            )
        )
        print("\n[SUCCESS] Demo seeding completed successfully!")
        print("=================================================================")
        print("Demo User Details:")
        print("  Email:    demo_user@example.com")
        print("  Password: password123")
        print("\nForm Details:")
        print(f"  Title:    {form.title}")
        print(f"  ID:       {form.id}")
        print(f"  Access:   {form.access_mode}")
        print(f"  Public Link suffix: {pub_version.public_link}")
        print("\nPre-generated Invite Links to test filling:")
        for inv in invite_batch:
            print(f"  * {inv.email}: {inv.invite_link}")
        print("=================================================================")

    finally:
        db.close()


if __name__ == "__main__":
    main()
