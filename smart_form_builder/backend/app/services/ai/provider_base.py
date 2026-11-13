from abc import ABC, abstractmethod
from typing import Any


class AiProviderError(Exception):
    """Exception raised when an AI provider operation fails (timeout, quota, malformed output, etc.)."""
    pass


class AiProvider(ABC):
    @abstractmethod
    async def generate_form(
        self,
        prompt: str,
        context: dict[str, Any] | None = None,
        response_schema: dict[str, Any] | type | None = None,
    ) -> dict[str, Any]:
        """
        Generate a form structure using the AI provider.

        Returns an already-parsed JSON dict.
        """
        pass

    @abstractmethod
    async def analyze_responses(
        self,
        payload: dict[str, Any],
        response_schema: dict[str, Any] | type | None = None,
    ) -> dict[str, Any]:
        """
        Analyze form responses using the AI provider.

        Returns an already-parsed JSON dict.
        """
        pass
