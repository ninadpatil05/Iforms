import asyncio
import logging
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.config.settings import settings
from app.main import app


async def test_startup():
    print("--- Testing App Lifespan Startup Warning ---")
    log_capture = []

    class CapturingHandler(logging.Handler):
        def emit(self, record):
            log_capture.append(self.format(record))

    logger = logging.getLogger("app.main")
    handler = CapturingHandler()
    logger.addHandler(handler)

    # 1. Test when SMTP_HOST is empty
    settings.SMTP_HOST = ""
    async with app.router.lifespan_context(app):
        pass

    warning_found = any("Email sharing is disabled: SMTP_HOST is not configured" in msg for msg in log_capture)
    if warning_found:
        print("[SUCCESS] Startup warning logged correctly when SMTP_HOST is empty.")
    else:
        print(f"[FAIL] Expected startup warning not found. Captured logs: {log_capture}")
        sys.exit(1)

    # 2. Test when SMTP_HOST is set
    log_capture.clear()
    settings.SMTP_HOST = "smtp.gmail.com"
    async with app.router.lifespan_context(app):
        pass

    warning_found_when_set = any("Email sharing is disabled: SMTP_HOST is not configured" in msg for msg in log_capture)
    if not warning_found_when_set:
        print("[SUCCESS] No warning logged when SMTP_HOST is properly set.")
    else:
        print("[FAIL] Unexpected warning logged when SMTP_HOST is set.")
        sys.exit(1)

    print("--- Startup Warning Verification Passed ---")


if __name__ == "__main__":
    asyncio.run(test_startup())
