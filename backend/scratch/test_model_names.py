import asyncio
from google import genai
from app.config.settings import settings

async def check_models():
    client = genai.Client(api_key=settings.GEMINI_API_KEY)
    models_to_test = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"]

    for model in models_to_test:
        print(f"Testing model: {model} ...", end=" ")
        try:
            res = await client.aio.models.generate_content(
                model=model,
                contents="Hello, respond with OK"
            )
            print(f"[SUCCESS] Text response: {res.text.strip()[:30] if res.text else 'Empty'}")
        except Exception as e:
            print(f"[FAILED] Error: {e}")

if __name__ == "__main__":
    asyncio.run(check_models())
