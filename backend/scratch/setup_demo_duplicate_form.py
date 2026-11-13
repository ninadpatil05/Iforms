import uuid
from app.database.database import SessionLocal
from app.models.user import User
from app.models.form import Form
from app.models.form_version import FormVersion
from app.models.section import Section
from app.models.field import Field
from app.repositories.user_repository import user_repository

def setup_form():
    db = SessionLocal()
    try:
        user = user_repository.get_by_email(db, "np@gmail.com")
        if not user:
            print("User np@gmail.com not found!")
            return

        # 1. Create a Form
        form = Form(
            owner_id=user.id,
            title="Duplicate Detection Demo Form",
            description="Testing Duplicate Block & Approval Flow",
            status="published",
            access_mode="public",
            allow_resubmission=True,
            duplicate_policy="block"
        )
        db.add(form)
        db.commit()
        db.refresh(form)

        # 2. Create Published Form Version
        pub_link = str(uuid.uuid4())[:12]
        version = FormVersion(
            form_id=form.id,
            version_number=1,
            is_published=True,
            public_link=pub_link
        )
        db.add(version)
        db.commit()
        db.refresh(version)

        # 3. Create Section
        section = Section(
            form_version_id=version.id,
            title="Personal Info",
            display_order=0
        )
        db.add(section)
        db.commit()
        db.refresh(section)

        # 4. Create Email Field (Field to check for duplicates)
        email_field = Field(
            form_version_id=version.id,
            section_id=section.id,
            field_type="email",
            label="Email Address",
            placeholder="enter your email",
            required=True,
            display_order=0
        )
        db.add(email_field)
        db.commit()
        db.refresh(email_field)

        # 5. Set duplicate_check_field_id on form
        form.duplicate_check_field_id = email_field.id
        db.commit()
        db.refresh(form)

        print("\n" + "="*70)
        print("DEMO FORM SUCCESSFULLY CONFIGURED AND PUBLISHED IN POSTGRESQL!")
        print("="*70)
        print(f"Form ID            : {form.id}")
        print(f"Form Title         : {form.title}")
        print(f"Duplicate Policy   : {form.duplicate_policy}")
        print(f"Check Field        : {email_field.label} (ID: {email_field.id})")
        print(f"Public Fill URL    : http://localhost:5173/f/{pub_link}")
        print(f"Form Dashboard URL : http://localhost:5173/forms/{form.id}")
        print("="*70)

    finally:
        db.close()

if __name__ == "__main__":
    setup_form()
