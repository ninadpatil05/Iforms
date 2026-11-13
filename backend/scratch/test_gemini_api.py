import sys
import asyncio
from app.config.settings import settings
from app.services.ai.gemini_provider import GeminiProvider, AiProviderError

async def test_gemini():
    print("=" * 60)
    print("TESTING GEMINI API CONNECTIVITY")
    print("=" * 60)
    print(f"Configured API Key present: {bool(settings.GEMINI_API_KEY and settings.GEMINI_API_KEY != 'your_actual_gemini_api_key_here')}")
    print(f"Configured Model Name: {settings.GEMINI_MODEL}")

    if not settings.GEMINI_API_KEY or settings.GEMINI_API_KEY == "your_actual_gemini_api_key_here":
        print("\n[!] GEMINI_API_KEY is not set to a real key in backend/.env yet.")
        print("Please edit backend/.env and replace 'your_actual_gemini_api_key_here' with your real API key from Google AI Studio.")
        return False

    provider = GeminiProvider()
    try:
        res = await provider.generate_form(
            prompt="Create a simple contact feedback form with name and email",
            context={"user_id": 1}
        )
        print("\n[SUCCESS] Gemini API returned valid JSON:")
        print(f"Title: {res.get('title')}")
        print(f"Description: {res.get('description')}")
        print(f"Fields count: {len(res.get('fields', []))}")
        print(f"Sample field: {res.get('fields', [])[0] if res.get('fields') else 'None'}")
        return True
    except AiProviderError as e:
        print(f"\n[X] AiProviderError caught: {e}")
        return False
    except Exception as e:
        print(f"\n[X] Unexpected error: {type(e).__name__}: {e}")
        return False

if __name__ == "__main__":
    success = asyncio.run(test_gemini())
    sys.exit(0 if success else 1)
