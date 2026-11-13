import asyncio
from app.database.database import SessionLocal
from app.models.user import User
from app.models.form import Form
from app.models.form_version import FormVersion
from app.services.ai_analysis_service import ai_analysis_service

async def test_analysis():
    db = SessionLocal()
    try:
        user = db.query(User).filter_by(email="np@gmail.com").first()
        version = db.query(FormVersion).join(Form).filter(Form.owner_id == user.id, FormVersion.is_published == True).first()
        if not user or not version:
            print("User or published version not found.")
            return

        print(f"Running AI analysis for Form Version {version.id} owned by {user.email}...")
        report = await ai_analysis_service.run_analysis(db, user, version.id)
        print("\n" + "=" * 60)
        print("[SUCCESS] AI ANALYSIS REPORT GENERATED SUCCESSFULLY!")
        print("=" * 60)
        print(f"Summary: {report.generated_json.get('executive_summary')}")
        print("=" * 60)
    except Exception as e:
        print(f"[FAILED] Error: {type(e).__name__}: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(test_analysis())
