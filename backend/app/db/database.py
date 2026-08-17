from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

# Single configured database — see backend/.env's DATABASE_URL (currently dev-hr).
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Historically pinned auth to a separate database when multiple databases
# were configured (see git history). Only one database is configured now,
# so this is just an alias — kept because most routes still depend on it.
get_auth_db = get_db
