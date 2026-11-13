from app.config.settings import settings
from app.services.ai.gemini_provider import GeminiProvider
from app.services.ai.provider_base import AiProvider, AiProviderError


def get_ai_provider() -> AiProvider:
    """
    Factory function returning the configured AiProvider instance.
    Reads settings.AI_PROVIDER (defaults to 'gemini').
    """
    provider_name = (settings.AI_PROVIDER or "").strip().lower()
    if provider_name == "gemini":
        return GeminiProvider()
    else:
        raise AiProviderError(f"Unsupported AI provider configured: '{settings.AI_PROVIDER}'")
