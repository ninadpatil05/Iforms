import time
from collections import defaultdict
from typing import Any, Dict, List, Optional
from fastapi import HTTPException, Request, status

# Note: This is an in-memory single-process sliding window store.
# For multi-worker or multi-instance deployments, use a centralized store like Redis.

_GLOBAL_RATE_LIMIT_STORE: Dict[Any, List[float]] = defaultdict(list)


def check_rate_limit(
    store: Optional[Dict[Any, List[float]]] = None,
    key: Any = "default",
    max_requests: int = 10,
    window_seconds: int = 60,
    detail: Optional[str] = None,
) -> None:
    """
    In-memory sliding window rate limiter.
    Stores timestamps per key in store dict and evicts expired timestamps and stale keys.
    Raises HTTP 429 if request count within window_seconds >= max_requests.
    """
    target_store = _GLOBAL_RATE_LIMIT_STORE if store is None else store
    now = time.time()
    user_requests = target_store.get(key, [])

    # Prune timestamps outside window
    pruned_requests = [t for t in user_requests if now - t < window_seconds]

    if not pruned_requests:
        # Evict stale key to prevent unbounded memory growth
        target_store.pop(key, None)
    else:
        target_store[key] = pruned_requests

    if len(pruned_requests) >= max_requests:
        window_desc = f"{window_seconds // 60} minute(s)" if window_seconds >= 60 else f"{window_seconds} seconds"
        error_detail = detail or f"Rate limit exceeded. Maximum {max_requests} requests allowed per {window_desc}."
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=error_detail,
        )

    if key not in target_store:
        target_store[key] = []
    target_store[key].append(now)


def get_client_ip(request: Request) -> str:
    """Extract client IP from Request object, respecting X-Forwarded-For if present."""
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return request.client.host if request.client else "127.0.0.1"
