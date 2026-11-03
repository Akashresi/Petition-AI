"""Sliding-window rate limiter for FastAPI endpoints."""
from collections import defaultdict
import time
from fastapi import HTTPException


class InMemoryRateLimiter:
    def __init__(self, max_requests: int = 10, window_seconds: int = 60, service_name: str = "request"):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.service_name = service_name
        self._records: dict[str, list[float]] = defaultdict(list)

    def check(self, key: str) -> None:
        """Enforce rate limit for the given key (user ID or client IP)."""
        now = time.time()
        timestamps = self._records[key]
        valid_timestamps = [t for t in timestamps if now - t < self.window_seconds]
        if len(valid_timestamps) >= self.max_requests:
            retry_after = int(self.window_seconds - (now - valid_timestamps[0])) + 1
            raise HTTPException(
                status_code=429,
                detail=f"Rate limit exceeded. Maximum {self.max_requests} {self.service_name}s per {self.window_seconds} seconds. Try again in {retry_after}s.",
                headers={"Retry-After": str(retry_after)},
            )
        valid_timestamps.append(now)
        self._records[key] = valid_timestamps

    def reset(self) -> None:
        """Reset all rate limiter records (useful for testing)."""
        self._records.clear()


# Pre-configured rate limiters
image_analysis_limiter = InMemoryRateLimiter(max_requests=10, window_seconds=60, service_name="image analysis request")
submission_limiter = InMemoryRateLimiter(max_requests=30, window_seconds=60, service_name="petition submission")
auth_limiter = InMemoryRateLimiter(max_requests=15, window_seconds=60, service_name="authentication attempt")
