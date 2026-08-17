from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[1]
PROJECT_ROOT = BACKEND_DIR.parent
UPLOADS_DIR = PROJECT_ROOT / "public" / "uploads"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=str(BACKEND_DIR / ".env"), extra="ignore")

    database_url: str
    auth_secret: str
    app_env: str = "development"
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"

    # SSO handoff from cotelligent-hrms — see routers/auth.py's /sso-login.
    sso_shared_secret: str = ""
    alumni_frontend_url: str = "http://localhost:5174"


settings = Settings()
