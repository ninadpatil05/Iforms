import asyncio
from google import genai
from app.config.settings import settings

async def test():
    client = genai.Client(api_key=settings.GEMINI_API_KEY)
    models = ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-2.5-flash"]
    for m in models:
        print(f"Testing model: {m}...")
        try:
            res = await client.aio.models.generate_content(model=m, contents="Hello")
            print(f"[SUCCESS] {m}: {res.text.strip()[:30]}")
        except Exception as e:
            print(f"[FAILED] {m}: {e}")

if __name__ == "__main__":
    asyncio.run(test())
