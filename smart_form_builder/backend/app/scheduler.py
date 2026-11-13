"""
APScheduler integration for deferred email delivery.

The scheduler runs inside FastAPI's asyncio event loop (AsyncIOScheduler).
Each poll tick opens its own fresh SessionLocal() and closes it when done —
no session is shared across ticks or reused from a request context.

APScheduler's default max_instances=1 per job prevents tick overlap if a
poll run takes longer than the configured interval.
"""
import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.config.settings import settings

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


async def _poll_due_emails() -> None:
    """
    Job function called by APScheduler every SCHEDULED_EMAIL_POLL_SECONDS.
    Opens a fresh DB session, processes all due pending rows, closes the session.
    """
    from app.database.database import SessionLocal
    from app.services.scheduled_email_share_service import scheduled_email_share_service

    db = SessionLocal()
    try:
        await scheduled_email_share_service.send_due_emails(db)
    except Exception as exc:
        logger.error(f"[Scheduler] Unhandled error in poll job: {exc}", exc_info=True)
    finally:
        db.close()


def start_scheduler() -> None:
    """
    Register the poll job and start the scheduler.
    Call this inside the FastAPI lifespan startup section.
    """
    interval = settings.SCHEDULED_EMAIL_POLL_SECONDS
    scheduler.add_job(
        _poll_due_emails,
        "interval",
        seconds=interval,
        id="scheduled_email_poll",
        max_instances=1,  # prevent overlapping ticks
        replace_existing=True,
    )
    scheduler.start()
    logger.info(
        f"[Scheduler] Started — polling for due scheduled emails every {interval}s."
    )


def stop_scheduler() -> None:
    """
    Shut down the scheduler gracefully.
    Call this inside the FastAPI lifespan shutdown section.
    """
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("[Scheduler] Stopped.")
