import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database.database import Base, engine, run_auto_migrations
from app.database import base  # Import all models
from app.api.auth import router as auth_router
from app.api.forms import router as forms_router
from app.api.form_versions import router as form_versions_router
from app.api.sections import router as sections_router
from app.api.branch_rules import router as branch_rules_router
from app.api.fields import router as fields_router
from app.api.conditional_rules import router as conditional_rules_router
from app.api.condition_groups import router as condition_groups_router
from app.api.submissions import router as submissions_router
from app.api.response_values import router as response_values_router
from app.api.public_forms import router as public_forms_router
from app.api.analytics import router as analytics_router
from app.api.export import router as export_router
from app.api.ai_forms import router as ai_forms_router
from app.api.ai_analysis import router as ai_analysis_router
from app.api.duplicate_override import router as duplicate_override_router
from app.config.settings import settings
from app.scheduler import start_scheduler, stop_scheduler

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    if not settings.SMTP_HOST or not settings.SMTP_HOST.strip():
        logger.warning(
            "SMTP_HOST not configured — running in DEV EMAIL MODE. "
            "Emails will be written to backend/dev_emails/ instead of being sent."
        )
    start_scheduler()
    yield
    stop_scheduler()




Base.metadata.create_all(bind=engine)

app = FastAPI(title="Form Builder API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api")
app.include_router(forms_router, prefix="/api")
app.include_router(form_versions_router, prefix="/api")
app.include_router(sections_router, prefix="/api")
app.include_router(branch_rules_router, prefix="/api")
app.include_router(fields_router, prefix="/api")
app.include_router(conditional_rules_router, prefix="/api")
app.include_router(condition_groups_router, prefix="/api")
app.include_router(submissions_router, prefix="/api")

app.include_router(response_values_router, prefix="/api")
app.include_router(public_forms_router, prefix="/api")
app.include_router(analytics_router, prefix="/api")
app.include_router(export_router, prefix="/api")
app.include_router(ai_forms_router, prefix="/api")
app.include_router(ai_analysis_router, prefix="/api")
app.include_router(duplicate_override_router, prefix="/api")




@app.get("/")
def root():
    return {
        "message": "Form Builder Backend is Running 🚀"
    }
