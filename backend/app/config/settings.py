from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]
    PUBLIC_APP_URL: str = "http://localhost:5173"
    GOOGLE_CLIENT_ID: str

    # SMTP Email Configuration (Optional at type level)
    SMTP_HOST: str | None = None
    SMTP_PORT: int | None = None
    SMTP_USERNAME: str | None = None
    SMTP_PASSWORD: str | None = None
    SMTP_FROM_EMAIL: str | None = None
    SMTP_FROM_NAME: str | None = "Form Builder"
    SMTP_USE_TLS: bool = True

    # Scheduler: how often (seconds) to poll for due scheduled emails
    SCHEDULED_EMAIL_POLL_SECONDS: int = 60

    # Dev email mode — when True, emails are written to dev_emails/ instead of sent via SMTP.
    # Automatically set to True when SMTP_HOST is not configured.
    EMAIL_DEV_MODE: bool = False

    # AI Feature Configuration
    AI_PROVIDER: str = "gemini"
    GEMINI_API_KEY: str | None = None
    GEMINI_MODEL: str = "gemini-3.5-flash-lite"
    AI_REQUEST_TIMEOUT_SECONDS: int = 30
    AI_MAX_RETRIES: int = 2


    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, value):
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    model_config = SettingsConfigDict(env_file=".env")


settings = Settings()
