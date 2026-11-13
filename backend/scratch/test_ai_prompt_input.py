import asyncio
from app.database.database import SessionLocal
from app.models.user import User
from app.services.ai_form_service import ai_form_service
from app.services.ai.gemini_provider import GeminiProvider

async def test_prompts():
    db = SessionLocal()
    user = db.query(User).first()
    
    print("Test 1: Normal Form Prompt ('Create a software engineer job application form')")
    try:
        draft1 = await ai_form_service.generate_draft(db, user, "Create a software engineer job application form")
        print(f"[SUCCESS] Draft Created! Title: {draft1.generated_json.get('title')}")
    except Exception as e:
        print(f"[FAILED] Error: {type(e).__name__}: {e}")

    print("\nTest 2: System Prompt Input (Meta instructions without form topic)")
    try:
        draft2 = await ai_form_service.generate_draft(db, user, "You are an advanced AI Form Generator... Return ONLY the structured form definition")
        print(f"[SUCCESS] Draft Created! Title: {draft2.generated_json.get('title')}")
    except Exception as e:
        print(f"[FAILED] Error: {type(e).__name__}: {e}")

if __name__ == "__main__":
    asyncio.run(test_prompts())
