from app.database.database import SessionLocal
from app.models.form import Form
from app.models.form_version import FormVersion
from app.services.submission_service import submission_service

def seed_fest():
    db = SessionLocal()
    try:
        # Find the Fest form or the demo form
        forms = db.query(Form).all()
        for f in forms:
            print(f"Form ID {f.id}: '{f.title}'")
            version = db.query(FormVersion).filter_by(form_id=f.id, is_published=True).first()
            if version:
                created = submission_service.seed_demo_submissions(db, version.id, count=5)
                print(f" -> Seeded {len(created)} sample submissions for Form ID {f.id} (Version {version.id})!")
    finally:
        db.close()

if __name__ == "__main__":
    seed_fest()
