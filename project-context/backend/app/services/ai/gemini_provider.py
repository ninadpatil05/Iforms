import asyncio
import json
import logging
import time
from typing import Any

from google import genai
from google.genai import errors, types

from app.config.settings import settings
from app.services.ai.provider_base import AiProvider, AiProviderError

logger = logging.getLogger(__name__)


def _is_transient_error(exc: Exception) -> bool:
    err_str = str(exc).lower()
    if any(k in err_str for k in ("503", "429", "unavailable", "high demand", "overloaded", "timeout")):
        return True
    if isinstance(exc, (asyncio.TimeoutError, TimeoutError, ConnectionError)):
        return True
    if isinstance(exc, errors.ServerError):
        return True
    if isinstance(exc, errors.APIError):
        code = getattr(exc, "code", None)
        if code in (429, 500, 502, 503, 504):
            return True
    try:
        import httpx
        if isinstance(exc, (httpx.TimeoutException, httpx.NetworkError)):
            return True
    except ImportError:
        pass
    return False


def _extract_and_parse_json(text: str | None) -> dict[str, Any]:
    if not text:
        raise ValueError("AI provider returned empty response text")
    cleaned = text.strip()
    if cleaned.startswith("```"):
        lines = cleaned.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip().startswith("```"):
            lines = lines[:-1]
        cleaned = "\n".join(lines).strip()
    
    parsed = json.loads(cleaned)
    if not isinstance(parsed, dict):
        raise ValueError("Parsed JSON response is not a dict object")
    return parsed


def _strip_additional_properties(data: Any) -> None:
    if isinstance(data, dict):
        data.pop("additionalProperties", None)
        for value in list(data.values()):
            _strip_additional_properties(value)
    elif isinstance(data, list):
        for item in data:
            _strip_additional_properties(item)


class GeminiProvider(AiProvider):
    def __init__(
        self,
        api_key: str | None = None,
        model_name: str | None = None,
        timeout_seconds: int | None = None,
        max_retries: int | None = None,
    ):
        self._api_key = api_key
        self._model_name = model_name
        self._timeout_seconds = timeout_seconds
        self._max_retries = max_retries

    @property
    def api_key(self) -> str | None:
        return self._api_key or settings.GEMINI_API_KEY

    @property
    def model_name(self) -> str:
        return self._model_name or settings.GEMINI_MODEL

    @property
    def timeout_seconds(self) -> int:
        return self._timeout_seconds if self._timeout_seconds is not None else settings.AI_REQUEST_TIMEOUT_SECONDS

    @property
    def max_retries(self) -> int:
        return self._max_retries if self._max_retries is not None else settings.AI_MAX_RETRIES

    def _get_client(self) -> genai.Client:
        key = self.api_key
        if not key:
            raise AiProviderError("GEMINI_API_KEY is not configured in settings.")
        return genai.Client(api_key=key)

    async def _execute_generate_content(
        self,
        client: genai.Client,
        prompt_text: str,
        config: types.GenerateContentConfig,
    ) -> types.GenerateContentResponse:
        attempts = 0
        total_attempts = 1 + self.max_retries

        while attempts < total_attempts:
            attempts += 1
            try:
                response = await asyncio.wait_for(
                    client.aio.models.generate_content(
                        model=self.model_name,
                        contents=prompt_text,
                        config=config,
                    ),
                    timeout=self.timeout_seconds,
                )
                return response
            except Exception as exc:
                is_transient = _is_transient_error(exc)
                if is_transient and attempts < total_attempts:
                    backoff = 2 ** (attempts - 1)
                    logger.warning(
                        "Transient error calling Gemini API (attempt %d/%d), retrying in %ds: %s",
                        attempts,
                        total_attempts,
                        backoff,
                        str(exc),
                    )
                    await asyncio.sleep(backoff)
                else:
                    if isinstance(exc, (asyncio.TimeoutError, TimeoutError)):
                        raise AiProviderError(
                            f"AI provider request timed out after {self.timeout_seconds}s"
                        ) from exc
                    raise AiProviderError(
                        f"Gemini API request failed: {str(exc)}"
                    ) from exc

        raise AiProviderError("Gemini API request failed after maximum retries.")

    async def _call_ai(
        self,
        method_name: str,
        prompt_text: str,
        response_schema: dict[str, Any] | type | None = None,
    ) -> dict[str, Any]:
        client = self._get_client()

        config_kwargs: dict[str, Any] = {"response_mime_type": "application/json"}
        if response_schema is not None:
            if hasattr(response_schema, "model_json_schema"):
                schema_dict = response_schema.model_json_schema()
                _strip_additional_properties(schema_dict)
                config_kwargs["response_schema"] = schema_dict
            elif isinstance(response_schema, dict):
                schema_dict = json.loads(json.dumps(response_schema))
                _strip_additional_properties(schema_dict)
                config_kwargs["response_schema"] = schema_dict
            else:
                config_kwargs["response_schema"] = response_schema

        config = types.GenerateContentConfig(**config_kwargs)

        start_time = time.perf_counter()
        try:
            response = await self._execute_generate_content(client, prompt_text, config)
            
            try:
                parsed_json = _extract_and_parse_json(response.text)
            except (json.JSONDecodeError, ValueError, TypeError) as parse_err:
                logger.warning(
                    "Initial JSON parsing failed for method %s: %s. Attempting repair retry.",
                    method_name,
                    str(parse_err),
                )
                repair_prompt = (
                    f"{prompt_text}\n\n"
                    "IMPORTANT: Your previous response was not valid JSON matching the required schema. "
                    "Return ONLY valid JSON matching the schema, nothing else."
                )
                repair_response = await self._execute_generate_content(client, repair_prompt, config)
                try:
                    parsed_json = _extract_and_parse_json(repair_response.text)
                    response = repair_response
                except (json.JSONDecodeError, ValueError, TypeError) as repair_parse_err:
                    raise AiProviderError(
                        "Failed to receive valid JSON from AI provider after repair attempt."
                    ) from repair_parse_err

            elapsed = time.perf_counter() - start_time

            usage = getattr(response, "usage_metadata", None)
            prompt_tokens = getattr(usage, "prompt_token_count", None) if usage else None
            candidate_tokens = getattr(usage, "candidates_token_count", None) if usage else None
            total_tokens = getattr(usage, "total_token_count", None) if usage else None

            logger.info(
                "AI provider call succeeded: method=%s, elapsed=%.2fs, prompt_tokens=%s, candidate_tokens=%s, total_tokens=%s",
                method_name,
                elapsed,
                prompt_tokens,
                candidate_tokens,
                total_tokens,
            )
            return parsed_json

        except Exception as exc:
            elapsed = time.perf_counter() - start_time
            if not isinstance(exc, AiProviderError):
                logger.error(
                    "AI provider call failed: method=%s, elapsed=%.2fs, error=%s",
                    method_name,
                    elapsed,
                    str(exc),
                )
                raise AiProviderError(f"AI provider operation failed: {str(exc)}") from exc
            else:
                logger.error(
                    "AI provider call failed: method=%s, elapsed=%.2fs, error=%s",
                    method_name,
                    elapsed,
                    str(exc),
                )
                raise

    async def generate_form(
        self,
        prompt: str,
        context: dict[str, Any] | None = None,
        response_schema: dict[str, Any] | type | None = None,
    ) -> dict[str, Any]:
        formatted_prompt = prompt
        if context:
            formatted_prompt += f"\n\nContext:\n{json.dumps(context, indent=2)}"
        return await self._call_ai(
            method_name="generate_form",
            prompt_text=formatted_prompt,
            response_schema=response_schema,
        )

    async def analyze_responses(
        self,
        payload: dict[str, Any],
        response_schema: dict[str, Any] | type | None = None,
    ) -> dict[str, Any]:
        formatted_prompt = f"Analyze the following form responses payload:\n{json.dumps(payload, indent=2)}"
        return await self._call_ai(
            method_name="analyze_responses",
            prompt_text=formatted_prompt,
            response_schema=response_schema,
        )
