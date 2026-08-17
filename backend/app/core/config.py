from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    # Database — always set via .env in real use; this default is a
    # non-functional placeholder so nothing runs against a guessable DB
    # if .env is ever missing.
    DATABASE_URL: str = "postgresql://postgres:CHANGE_ME_DB_PASSWORD@localhost:5432/dev-hr"

    # JWT — always set via .env in real use; placeholder only.
    SECRET_KEY: str = "CHANGE_ME_SECRET_KEY"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    
    # App
    APP_NAME: str = "Cotelligent HRMS"
    DEBUG: bool = True
    
    # File uploads
    UPLOAD_DIR: str = "uploads"
    MAX_UPLOAD_SIZE: int = 10 * 1024 * 1024  # 10MB

    # AI
    ANTHROPIC_API_KEY: Optional[str] = None
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3.2:3b"

    # SSO handoff to the Alumni Network app (see api/routes/alumni_sso.py).
    # Dedicated secret, distinct from SECRET_KEY — must match
    # SSO_SHARED_SECRET in alumni-network/backend/.env exactly.
    ALUMNI_SSO_SHARED_SECRET: str = ""
    ALUMNI_BACKEND_URL: str = "http://localhost:8010"

    class Config:
        env_file = ".env"

settings = Settings()
