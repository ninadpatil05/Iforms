"""seed_college_fest.py

Seeds the database with a "College Fest Registration & Merchandise Order" form.
This form is configured to test the "Show" condition actions, the "Hide wins over show" precedence rules,
as well as dynamic section branching and computed fields.

Run:
    python -m scratch.seed_college_fest
"""

import json
from sqlalchemy import select
from app.database.database import SessionLocal
import app.models
from app.models.user import User
from app.models.form import Form
from app.models.form_version import FormVersion
from app.models.section import Section
from app.models.field import Field
from app.models.branch_rule import SectionBranchRule
from app.models.condition_group import ConditionGroup, ConditionGroupCondition
from app.utils.security import hash_password
from app.services.form_version_service import form_version_service


def main():
    db = SessionLocal()
    try:
        # 1. Fetch or create demo user
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
            print(f"Created demo user: {email}")
        else:
            print(f"Demo user {email} already exists.")

        # 2. Create the Form
        form_title = "College Fest Registration & Merchandise Order"
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
            description="Register for the annual College Fest, sign up for events, and order merchandise.",
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
            ("Participant Details", "Provide your personal and participation details.", 0),
            ("Event Details", "Register for specific events and arrange logistics.", 1),
            ("Merchandise Order", "Order official college fest T-shirts.", 2),
            ("Feedback", "Tell us what you think.", 3),
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

        sec_participant, sec_event, sec_merch, sec_feedback = sections

        # 5. Create Fields
        # Section 1: Participant Details
        f_name = Field(
            form_version_id=draft.id,
            section_id=sec_participant.id,
            label="Full Name",
            field_type="text",
            required=True,
            display_order=0,
            placeholder="John Doe"
        )
        f_email = Field(
            form_version_id=draft.id,
            section_id=sec_participant.id,
            label="Email",
            field_type="text",
            required=True,
            display_order=1,
            placeholder="john.doe@example.com"
        )
        f_college = Field(
            form_version_id=draft.id,
            section_id=sec_participant.id,
            label="College/Organization",
            field_type="text",
            required=True,
            display_order=2,
            placeholder="State University"
        )
        f_dob = Field(
            form_version_id=draft.id,
            section_id=sec_participant.id,
            label="Date of Birth",
            field_type="date",
            required=True,
            display_order=3,
        )
        f_mode = Field(
            form_version_id=draft.id,
            section_id=sec_participant.id,
            label="Participation Mode",
            field_type="dropdown",
            required=True,
            display_order=4,
            options_json=json.dumps([
                {"label": "In person", "value": "In person"},
                {"label": "Online", "value": "Online"}
            ])
        )
        f_events = Field(
            form_version_id=draft.id,
            section_id=sec_participant.id,
            label="Events You Want to Join",
            field_type="checkbox",
            required=True,
            display_order=5,
            options_json=json.dumps([
                {"label": "Coding Challenge", "value": "Coding Challenge"},
                {"label": "Dance Competition", "value": "Dance Competition"},
                {"label": "Design Workshop", "value": "Design Workshop"},
                {"label": "Music Night", "value": "Music Night"}
            ])
        )
        f_id_card = Field(
            form_version_id=draft.id,
            section_id=sec_participant.id,
            label="Student ID Card",
            field_type="file",
            required=False,
            display_order=6,
        )

        # Section 2: Event Details
        f_seats = Field(
            form_version_id=draft.id,
            section_id=sec_event.id,
            label="How many workshop seats",
            field_type="number",
            required=True,
            display_order=0,
            validation_json=json.dumps({"min": 0, "max": 10}),
            placeholder="Seats (0-10)"
        )
        f_seat_price = Field(
            form_version_id=draft.id,
            section_id=sec_event.id,
            label="Workshop Seat Price",
            field_type="number",
            required=True,
            display_order=1,
            validation_json=json.dumps({"default_value": "250", "read_only": True}),
            placeholder="250"
        )
        f_workshop_total = Field(
            form_version_id=draft.id,
            section_id=sec_event.id,
            label="Workshop Total",
            field_type="computed",
            required=False,
            display_order=2,
        )
        f_accommodation = Field(
            form_version_id=draft.id,
            section_id=sec_event.id,
            label="Would you need accommodation?",
            field_type="dropdown",
            required=True,
            display_order=3,
            options_json=json.dumps([
                {"label": "Yes", "value": "Yes"},
                {"label": "No", "value": "No"}
            ])
        )
        f_arrival = Field(
            form_version_id=draft.id,
            section_id=sec_event.id,
            label="Arrival Date",
            field_type="date",
            required=False,
            display_order=4,
        )
        f_food = Field(
            form_version_id=draft.id,
            section_id=sec_event.id,
            label="Food Preference",
            field_type="dropdown",
            required=True,
            display_order=5,
            options_json=json.dumps([
                {"label": "Vegetarian", "value": "Vegetarian"},
                {"label": "Non-vegetarian", "value": "Non-vegetarian"},
                {"label": "Vegan", "value": "Vegan"}
            ])
        )
        f_special_req = Field(
            form_version_id=draft.id,
            section_id=sec_event.id,
            label="Special Accommodation Request",
            field_type="text",
            required=False,
            display_order=6,
            placeholder="Describe any special requirements..."
        )

        # Section 3: Merchandise Order
        f_qty = Field(
            form_version_id=draft.id,
            section_id=sec_merch.id,
            label="T-shirt Quantity",
            field_type="number",
            required=True,
            display_order=0,
            validation_json=json.dumps({"min": 0, "max": 5}),
            placeholder="Quantity (0-5)"
        )
        f_price = Field(
            form_version_id=draft.id,
            section_id=sec_merch.id,
            label="T-shirt Price",
            field_type="number",
            required=True,
            display_order=1,
            placeholder="Price per T-shirt"
        )
        f_tshirt_total = Field(
            form_version_id=draft.id,
            section_id=sec_merch.id,
            label="T-shirt Total",
            field_type="computed",
            required=False,
            display_order=2,
        )
        f_grand_total = Field(
            form_version_id=draft.id,
            section_id=sec_merch.id,
            label="Grand Total",
            field_type="computed",
            required=False,
            display_order=3,
        )

        # Section 4: Feedback
        f_rating = Field(
            form_version_id=draft.id,
            section_id=sec_feedback.id,
            label="rating field",
            field_type="rating",
            required=True,
            display_order=0,
            validation_json=json.dumps({"max": 5})
        )
        f_anything = Field(
            form_version_id=draft.id,
            section_id=sec_feedback.id,
            label="Anything else we should know?",
            field_type="text",
            required=False,
            display_order=1,
            placeholder="Optional comments..."
        )
        f_recommend = Field(
            form_version_id=draft.id,
            section_id=sec_feedback.id,
            label="Would you recommend this fest?",
            field_type="dropdown",
            required=True,
            display_order=2,
            options_json=json.dumps([
                {"label": "Yes", "value": "Yes"},
                {"label": "No", "value": "No"}
            ])
        )

        db.add_all([
            f_name, f_email, f_college, f_dob, f_mode, f_events, f_id_card,
            f_seats, f_seat_price, f_workshop_total, f_accommodation, f_arrival, f_food, f_special_req,
            f_qty, f_price, f_tshirt_total, f_grand_total,
            f_rating, f_anything, f_recommend
        ])
        db.commit()

        # Refresh fields to get IDs
        fields_list = [
            f_name, f_email, f_college, f_dob, f_mode, f_events, f_id_card,
            f_seats, f_seat_price, f_workshop_total, f_accommodation, f_arrival, f_food, f_special_req,
            f_qty, f_price, f_tshirt_total, f_grand_total,
            f_rating, f_anything, f_recommend
        ]
        for f in fields_list:
            db.refresh(f)
        print("Created form fields.")

        # 6. Configure Computed Formula Fields
        # Workshop Total = seats * price
        f_workshop_total.validation_json = json.dumps({
            "terms": [
                {"field_id": f_seats.id},
                {"op": "multiply"},
                {"field_id": f_seat_price.id}
            ],
            "decimal_places": 2
        })
        # T-shirt Total = quantity * price
        f_tshirt_total.validation_json = json.dumps({
            "terms": [
                {"field_id": f_qty.id},
                {"op": "multiply"},
                {"field_id": f_price.id}
            ],
            "decimal_places": 2
        })
        # Grand Total = Workshop Total + T-shirt Total
        f_grand_total.validation_json = json.dumps({
            "terms": [
                {"field_id": f_workshop_total.id},
                {"op": "add"},
                {"field_id": f_tshirt_total.id}
            ],
            "decimal_places": 2
        })
        db.add_all([f_workshop_total, f_tshirt_total, f_grand_total])
        db.commit()
        print("Configured computed formulas.")

        # 7. Configure Condition Groups
        # Condition 1: show Arrival Date when Participation Mode equals In person AND Would you need accommodation? equals Yes
        cg_arrival = ConditionGroup(
            form_version_id=draft.id,
            target_field_id=f_arrival.id,
            action="show",
            combinator="AND"
        )
        db.add(cg_arrival)
        db.commit()
        db.refresh(cg_arrival)

        cond_arrival_mode = ConditionGroupCondition(
            group_id=cg_arrival.id,
            trigger_field_id=f_mode.id,
            operator="equals",
            comparison_value="In person",
            display_order=0
        )
        cond_arrival_need = ConditionGroupCondition(
            group_id=cg_arrival.id,
            trigger_field_id=f_accommodation.id,
            operator="equals",
            comparison_value="Yes",
            display_order=1
        )
        db.add_all([cond_arrival_mode, cond_arrival_need])

        # Condition 2: require Student ID Card when Participation Mode equals In person
        cg_id_card = ConditionGroup(
            form_version_id=draft.id,
            target_field_id=f_id_card.id,
            action="require",
            combinator="AND"
        )
        db.add(cg_id_card)
        db.commit()
        db.refresh(cg_id_card)

        cond_id_mode = ConditionGroupCondition(
            group_id=cg_id_card.id,
            trigger_field_id=f_mode.id,
            operator="equals",
            comparison_value="In person",
            display_order=0
        )
        db.add(cond_id_mode)

        # Condition 3: show workshop seats / seat price / workshop total when Events You Want to Join contains Design Workshop
        for target in [f_seats, f_seat_price, f_workshop_total]:
            cg_workshop = ConditionGroup(
                form_version_id=draft.id,
                target_field_id=target.id,
                action="show",
                combinator="AND"
            )
            db.add(cg_workshop)
            db.commit()
            db.refresh(cg_workshop)

            cond_workshop_event = ConditionGroupCondition(
                group_id=cg_workshop.id,
                trigger_field_id=f_events.id,
                operator="contains",
                comparison_value="Design Workshop",
                display_order=0
            )
            db.add(cond_workshop_event)

        # Condition 4: show "Anything else we should know?" when Would you recommend this fest equals No OR rating less_than_or_equal 2
        cg_anything = ConditionGroup(
            form_version_id=draft.id,
            target_field_id=f_anything.id,
            action="show",
            combinator="OR"
        )
        db.add(cg_anything)
        db.commit()
        db.refresh(cg_anything)

        cond_recommend = ConditionGroupCondition(
            group_id=cg_anything.id,
            trigger_field_id=f_recommend.id,
            operator="equals",
            comparison_value="No",
            display_order=0
        )
        cond_rating = ConditionGroupCondition(
            group_id=cg_anything.id,
            trigger_field_id=f_rating.id,
            operator="less_than_or_equal",
            comparison_value="2",
            display_order=1
        )
        db.add_all([cond_recommend, cond_rating])

        # Condition 5: show Special Accommodation Request when Food Preference equals Vegan OR Would you need accommodation equals Yes
        cg_special = ConditionGroup(
            form_version_id=draft.id,
            target_field_id=f_special_req.id,
            action="show",
            combinator="OR"
        )
        db.add(cg_special)
        db.commit()
        db.refresh(cg_special)

        cond_special_food = ConditionGroupCondition(
            group_id=cg_special.id,
            trigger_field_id=f_food.id,
            operator="equals",
            comparison_value="Vegan",
            display_order=0
        )
        cond_special_accommodation = ConditionGroupCondition(
            group_id=cg_special.id,
            trigger_field_id=f_accommodation.id,
            operator="equals",
            comparison_value="Yes",
            display_order=1
        )
        db.add_all([cond_special_food, cond_special_accommodation])
        db.commit()
        print("Configured all condition groups.")

        # 8. Configure Default Next Section Links
        # Participant Details -> Event Details
        sec_participant.default_next_section_id = sec_event.id
        # Event Details -> Merchandise Order
        sec_event.default_next_section_id = sec_merch.id
        # Merchandise Order -> Feedback
        sec_merch.default_next_section_id = sec_feedback.id
        # Feedback -> End (None)
        sec_feedback.default_next_section_id = None

        db.add_all([sec_participant, sec_event, sec_merch, sec_feedback])
        db.commit()
        print("Configured default next section paths.")

        # 9. Configure Section Branching Rules
        # From Participant Details, if Participation Mode equals Online, go directly to Merchandise Order
        rule_online = SectionBranchRule(
            from_section_id=sec_participant.id,
            to_section_id=sec_merch.id,
            trigger_field_id=f_mode.id,
            operator="equals",
            comparison_value="Online",
            priority=0
        )
        db.add(rule_online)
        db.commit()
        print("Configured conditional section branching rule (Online skip).")

        # 10. Publish the Form!
        pub_version = form_version_service.publish_draft(db, form.id)
        print(f"Published form: public_link = {pub_version.public_link}")

        print("\n[SUCCESS] College Fest seeding completed successfully!")
        print("=================================================================")
        print("Form Details:")
        print(f"  Title:    {form.title}")
        print(f"  ID:       {form.id}")
        print(f"  Access:   {form.access_mode}")
        print(f"  Public Link suffix: {pub_version.public_link}")
        print(f"  Public Link URL: http://localhost:5173/f/{pub_version.public_link}")
        print("=================================================================")

    finally:
        db.close()


if __name__ == "__main__":
    main()
