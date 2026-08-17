"""Minimal SMTP sender for reminder emails.

Reads credentials from Settings (SMTP_* env vars). If SMTP_HOST isn't
configured, send_email() logs the message instead of sending it, so the
reminder sweep keeps working on a fresh checkout with no mail server set up.
"""
import logging
import smtplib
from email.message import EmailMessage

from app.engagement.core.config import get_settings

log = logging.getLogger("em.email")


def send_email(to: str, subject: str, body: str) -> bool:
    """Returns True if the message was actually sent (or would have been,
    in the unconfigured/log-only fallback), False if sending failed."""
    settings = get_settings()

    if not settings.smtp_host:
        log.info("SMTP not configured — logging instead of sending: to=%s subject=%r\n%s", to, subject, body)
        return True

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = settings.smtp_from
    msg["To"] = to
    msg.set_content(body)

    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as smtp:
            if settings.smtp_use_tls:
                smtp.starttls()
            if settings.smtp_username:
                smtp.login(settings.smtp_username, settings.smtp_password)
            smtp.send_message(msg)
        return True
    except Exception:
        log.exception("Failed to send email to %s", to)
        return False
