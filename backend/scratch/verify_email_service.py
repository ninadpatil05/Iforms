import asyncio
import os
import sys

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.config.settings import settings
from app.services.email_service import email_service, EmailNotConfiguredError


async def main():
    print("--- Verifying EmailService ---")

    # 1. Test unconfigured SMTP_HOST raises EmailNotConfiguredError
    original_smtp_host = settings.SMTP_HOST
    try:
        settings.SMTP_HOST = None
        try:
            await email_service.send_email(
                to="test@example.com",
                subject="Test",
                body="Test body",
            )
            print("❌ FAIL: Expected EmailNotConfiguredError when SMTP_HOST is None, but none was raised.")
            sys.exit(1)
        except EmailNotConfiguredError as exc:
            print(f"[PASS] EmailNotConfiguredError correctly raised when SMTP_HOST is None: '{exc.message}'")
    finally:
        settings.SMTP_HOST = original_smtp_host

    # 2. Test sending real email if TEST_EMAIL_TO is configured
    test_recipient = os.getenv("TEST_EMAIL_TO")
    if not test_recipient:
        print("[SKIP] TEST_EMAIL_TO environment variable is not set. Real email dispatch skipped.")
        print("   To test real email dispatch, run: $env:TEST_EMAIL_TO='your@email.com'; python scratch/verify_email_service.py")
        print("--- EmailService Verification Completed Successfully ---")
        return

    if not settings.SMTP_HOST:
        print("[SKIP] SMTP_HOST environment variable is not set in Settings/environment.")
        print("   To test real email dispatch, configure SMTP_HOST, SMTP_PORT, etc. in .env or environment.")
        print("--- EmailService Verification Completed Successfully ---")
        return

    print(f"Sending test email to {test_recipient} via SMTP host {settings.SMTP_HOST}...")
    success = await email_service.send_email(
        to=test_recipient,
        subject="Form Builder - Test Email Service Verification",
        body="This is a test email sent from Form Builder EmailService verification script.",
        reply_to="owner@example.com",
    )

    if success:
        print(f"[PASS] Test email sent successfully to {test_recipient}")
    else:
        print(f"[FAIL] Email service reported failure when sending to {test_recipient}")

    print("--- EmailService Verification Completed ---")


if __name__ == "__main__":
    asyncio.run(main())
