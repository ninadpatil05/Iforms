import logging
import os
from datetime import datetime, timezone
from email.message import EmailMessage
from pathlib import Path
from typing import Optional

import aiosmtplib

from app.config.settings import settings

logger = logging.getLogger(__name__)

# Directory where dev-mode emails are written (relative to cwd = backend/)
_DEV_EMAIL_DIR = Path("dev_emails")


class EmailNotConfiguredError(Exception):
    """Raised when email sending is attempted but SMTP server settings are unconfigured."""

    def __init__(self, message: str = "SMTP email service is not configured on the server."):
        self.message = message
        super().__init__(self.message)


def _is_dev_mode() -> bool:
    """
    Dev mode is active when:
      - EMAIL_DEV_MODE=true in .env, OR
      - SMTP_HOST is not set (no real mail server configured)
    In dev mode emails are written to dev_emails/ instead of being sent.
    """
    return settings.EMAIL_DEV_MODE or not (settings.SMTP_HOST and settings.SMTP_HOST.strip())


def _write_dev_email(to: str, subject: str, body: str, reply_to: Optional[str] = None) -> None:
    """Persist an email to the dev_emails/ folder as a readable .txt file."""
    _DEV_EMAIL_DIR.mkdir(exist_ok=True)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S_%f")
    safe_to = to.replace("@", "_at_").replace(".", "_")
    filename = _DEV_EMAIL_DIR / f"{timestamp}_{safe_to}.txt"
    lines = [
        f"To:       {to}",
        f"From:     {settings.SMTP_FROM_NAME or 'Form Builder'} <{settings.SMTP_FROM_EMAIL or 'noreply@example.com'}>",
        f"Subject:  {subject}",
    ]
    if reply_to:
        lines.append(f"Reply-To: {reply_to}")
    lines += ["", "-" * 60, "", body, ""]
    filename.write_text("\n".join(lines), encoding="utf-8")
    logger.info(f"[DEV EMAIL] Written to {filename}")


class EmailService:
    async def send_email(
        self,
        to: str,
        subject: str,
        body: str,
        reply_to: Optional[str] = None,
    ) -> bool:
        """
        Sends an email.

        - In dev mode (SMTP_HOST absent or EMAIL_DEV_MODE=true):
            Writes the email to dev_emails/<timestamp>_<recipient>.txt and returns True.
            No SMTP connection is made; the full flow works without any mail server.

        - In production mode (SMTP_HOST is set):
            Sends via SMTP. Returns True on success, False on SMTP error.
        """
        if _is_dev_mode():
            try:
                _write_dev_email(to, subject, body, reply_to)
                return True
            except Exception as exc:
                logger.error(f"[DEV EMAIL] Failed to write email file: {exc}", exc_info=True)
                return False

        # --- Production SMTP path ---
        msg = EmailMessage()
        from_name = settings.SMTP_FROM_NAME or "IForms Platform"
        from_email = settings.SMTP_FROM_EMAIL or "noreply@example.com"
        msg["From"] = f"{from_name} <{from_email}>"
        msg["To"] = to
        msg["Subject"] = subject
        if reply_to:
            msg["Reply-To"] = reply_to
        msg.set_content(body)

        import re
        html_body = body.replace("\n", "<br>")
        url_pattern = re.compile(r'(https?://[^\s<]+)')
        html_body = url_pattern.sub(
            r'<a href="\1" target="_blank" style="color: #C85A32; font-weight: bold; text-decoration: underline;">\1</a>',
            html_body
        )

        urls = url_pattern.findall(body)
        cta_button = ""
        if urls:
            primary_url = urls[0]
            cta_button = f'''
            <div style="margin: 24px 0;">
              <a href="{primary_url}" target="_blank" style="background-color: #C85A32; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block; font-family: sans-serif; font-size: 14px;">Fill Out Form &rarr;</a>
            </div>
            '''

        full_html = f'''
        <!DOCTYPE html>
        <html>
        <body style="font-family: sans-serif; line-height: 1.6; color: #1F1B16; background-color: #FAF7F0; padding: 24px;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #FFFFFF; border: 1px solid #E5DFD5; padding: 32px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
            <div style="margin-bottom: 24px; border-bottom: 2px solid #C85A32; padding-bottom: 12px;">
              <span style="font-size: 20px; font-weight: bold; color: #C85A32; font-family: serif;">IForms</span>
            </div>
            <div style="font-size: 14px; color: #1F1B16;">
              {html_body}
            </div>
            {cta_button}
            <hr style="border: none; border-top: 1px solid #E5DFD5; margin-top: 32px; margin-bottom: 16px;">
            <p style="font-size: 11px; color: #8C8275; margin: 0;">Sent via IForms Platform &copy; 2026</p>
          </div>
        </body>
        </html>
        '''

        msg.add_alternative(full_html, subtype="html")

        port = settings.SMTP_PORT or 587
        use_tls = bool(settings.SMTP_USE_TLS and port == 465)
        start_tls = bool(settings.SMTP_USE_TLS and port != 465)

        try:
            await aiosmtplib.send(
                msg,
                hostname=settings.SMTP_HOST,
                port=port,
                username=settings.SMTP_USERNAME or None,
                password=settings.SMTP_PASSWORD or None,
                use_tls=use_tls,
                start_tls=start_tls,
            )
            logger.info(f"Email sent to {to}: {subject!r}")
            return True
        except Exception as exc:
            logger.error(f"Failed to send email to {to}: {exc}", exc_info=True)
            return False


email_service = EmailService()
