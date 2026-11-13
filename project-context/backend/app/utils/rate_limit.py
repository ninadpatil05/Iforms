import time
from typing import Dict, List
from fastapi import HTTPException, status


def check_rate_limit(store: Dict[str, List[float]], key: str, max_requests: int, window_seconds: int) -> None:
    """
    In-memory sliding window rate limiter.
    Stores timestamps per key in store dict.
    Raises HTTP 429 if request count within window_seconds >= max_requests.
    """
    now = time.time()
    user_requests = store[key]
    # Prune timestamps outside window
    pruned_requests = [t for t in user_requests if now - t < window_seconds]
    store[key] = pruned_requests

    if len(pruned_requests) >= max_requests:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Rate limit exceeded. Maximum {max_requests} requests allowed per {window_seconds // 60} minutes.",
        )
    store[key].append(now)
