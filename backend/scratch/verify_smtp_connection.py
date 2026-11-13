import argparse
import asyncio
import os
import sys
import aiosmtplib

# Ensure backend root is on sys.path when run directly or as a script
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.config.settings import settings
from app.services.email_service import email_service


if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass


async def verify_smtp(to_address: str | None = None) -> None:
    print("--- System SMTP Connection Check ---")

    if not settings.SMTP_HOST or not settings.SMTP_HOST.strip():
        print("[ERROR] SMTP not configured: SMTP_HOST is empty or missing in environment/settings.")
        sys.exit(1)

    port = settings.SMTP_PORT or 587
    use_tls = bool(settings.SMTP_USE_TLS and port == 465)
    start_tls = bool(settings.SMTP_USE_TLS and port != 465)

    print(f"Attempting SMTP connection to {settings.SMTP_HOST}:{port} (use_tls={use_tls}, start_tls={start_tls})...")

    try:
        client = aiosmtplib.SMTP(
            hostname=settings.SMTP_HOST,
            port=port,
            use_tls=use_tls,
            start_tls=start_tls,
        )
        await client.connect()
        print("Successfully connected to SMTP host.")

        if settings.SMTP_USERNAME:
            print(f"Authenticating with username: {settings.SMTP_USERNAME}...")
            await client.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD or "")
            print("Authentication successful.")
        else:
            print("No SMTP_USERNAME specified; skipped authentication step.")

        await client.quit()
        print("[SUCCESS] Direct SMTP connection & login verified successfully.")

    except Exception as exc:
        print(f"[ERROR] SMTP connection/authentication failed: {exc}", file=sys.stderr)
        sys.exit(1)

    if to_address:
        print(f"\nSending test email to '{to_address}' via email_service.send_email...")
        try:
            success = await email_service.send_email(
                to=to_address,
                subject="Form Builder - System SMTP Verification Test",
                body="Hello! This is a test email verifying that your system SMTP configuration is working correctly.",
            )
            if success:
                print(f"[SUCCESS] Test email successfully delivered to {to_address} via email_service.send_email!")
            else:
                print(f"[ERROR] email_service.send_email returned False when sending to {to_address}.", file=sys.stderr)
                sys.exit(1)
        except Exception as exc:
            print(f"[ERROR] Error sending test email via email_service: {exc}", file=sys.stderr)
            sys.exit(1)


def main():
    parser = argparse.ArgumentParser(
        description="Verify system SMTP server connectivity and optionally send a test email."
    )
    parser.add_argument(
        "--to",
        type=str,
        default=None,
        help="Optional recipient email address to send a test email via email_service.send_email.",
    )
    args = parser.parse_args()

    asyncio.run(verify_smtp(args.to))


if __name__ == "__main__":
    main()
