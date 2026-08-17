from secrets import token_hex

from core.config import PROJECT_ROOT

# Deliberately outside `public/uploads`: that directory is served statically to
# anyone with the URL, which is fine for profile photos but not for salary
# certificates. Files here are only ever readable through an authenticated,
# ownership-checked download endpoint.
PRIVATE_UPLOADS_DIR = PROJECT_ROOT / "private_uploads"


def save_file(data: bytes, subdir: str, ext: str) -> str:
    """Save bytes to private storage and return a storage key to persist in the DB."""
    directory = PRIVATE_UPLOADS_DIR / subdir
    directory.mkdir(parents=True, exist_ok=True)
    filename = f"{token_hex(16)}.{ext}"
    (directory / filename).write_bytes(data)
    return f"{subdir}/{filename}"


def read_file(key: str) -> bytes:
    return (PRIVATE_UPLOADS_DIR / key).read_bytes()


def delete_file(key: str) -> None:
    path = PRIVATE_UPLOADS_DIR / key
    if path.exists():
        path.unlink()
