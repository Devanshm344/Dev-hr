import os
from functools import lru_cache

from dotenv import load_dotenv

load_dotenv()


class Settings:
    def __init__(self) -> None:
        self.env: str = os.getenv("ENV", "development")
        self.database_url: str = os.getenv(
            "DATABASE_URL",
            "postgresql://app:app_dev_password@localhost:5432/timesheet_db",
        )
        self.jwt_secret: str = os.getenv("JWT_SECRET", "dev-only-change-me")
        self.jwt_expires_minutes: int = int(os.getenv("JWT_EXPIRES_MINUTES", "480"))
        self.cors_origins: list[str] = [
            o.strip()
            for o in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
            if o.strip()
        ]
        self.smtp_host: str = os.getenv("SMTP_HOST", "")
        self.smtp_port: int = int(os.getenv("SMTP_PORT", "587"))
        self.smtp_username: str = os.getenv("SMTP_USERNAME", "")
        self.smtp_password: str = os.getenv("SMTP_PASSWORD", "")
        self.smtp_from: str = os.getenv("SMTP_FROM", "EM <no-reply@techdemocracy.dev>")
        self.smtp_use_tls: bool = os.getenv("SMTP_USE_TLS", "true").lower() != "false"
        self.reminder_sweep_minutes: int = int(os.getenv("REMINDER_SWEEP_MINUTES", "30"))
        self.app_base_url: str = os.getenv("APP_BASE_URL", "http://localhost:5273")


@lru_cache
def get_settings() -> Settings:
    return Settings()
