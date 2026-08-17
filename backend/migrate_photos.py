"""
Run from the backend/ directory:
    python migrate_photos.py

Downloads every external profile_picture URL (Zoho etc.) and saves the image
to uploads/{employee_id}/photos/{uuid}.ext, then updates the DB column to the
local URL.  Already-local paths (/uploads/...) are skipped.  Broken relative
URLs (no http scheme) are cleared to NULL.
"""
import sys
import os
import uuid
import urllib.request
import urllib.error
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.config import settings
from sqlalchemy import create_engine, text

engine = create_engine(settings.DATABASE_URL)
UPLOAD_DIR = Path(settings.UPLOAD_DIR)

_CT_MAP = {
    'image/jpeg': '.jpg',
    'image/jpg':  '.jpg',
    'image/png':  '.png',
    'image/webp': '.webp',
    'image/gif':  '.jpg',
    'image/bmp':  '.jpg',
}


def _ext_from_ct(content_type: str, url: str) -> str:
    ct = content_type.split(';')[0].strip().lower()
    if ct in _CT_MAP:
        return _CT_MAP[ct]
    for ext in ('.jpg', '.jpeg', '.png', '.webp'):
        if ext in url.lower():
            return '.jpg' if ext == '.jpeg' else ext
    return '.jpg'


def migrate(db_name: str = 'cotelligent-hrms'):
    base_url = settings.DATABASE_URL.rsplit('/', 1)[0]
    db_url = settings.DATABASE_URL if db_name == 'cotelligent-hrms' else f"{base_url}/{db_name}"
    eng = create_engine(db_url)

    with eng.connect() as conn:
        rows = conn.execute(
            text("SELECT id, profile_picture FROM employees WHERE profile_picture IS NOT NULL")
        ).fetchall()

    print(f"[{db_name}] {len(rows)} employees with profile_picture")
    ok = skipped = cleared = failed = 0

    for emp_id, pic_url in rows:
        # Already stored locally
        if pic_url.startswith('/uploads/'):
            skipped += 1
            continue

        # Broken relative URL — clear it
        if not pic_url.startswith('http'):
            print(f"  [{emp_id}] Broken relative URL → NULL: {pic_url}")
            with eng.begin() as conn:
                conn.execute(
                    text("UPDATE employees SET profile_picture = NULL WHERE id = :id"),
                    {'id': emp_id}
                )
            cleared += 1
            continue

        # Download external URL
        try:
            req = urllib.request.Request(
                pic_url,
                headers={'User-Agent': 'Mozilla/5.0 (compatible; HRMS-migrator/1.0)'}
            )
            with urllib.request.urlopen(req, timeout=15) as resp:
                content_type = resp.headers.get('Content-Type', 'image/jpeg')

                # Auth-wall redirect serving HTML — skip, don't clear
                if 'text/html' in content_type:
                    print(f"  [{emp_id}] Auth-required (HTML response) — keeping URL: {pic_url[:70]}")
                    failed += 1
                    continue

                data = resp.read()

            if len(data) < 100:
                print(f"  [{emp_id}] Empty/tiny response — skipping")
                failed += 1
                continue

            ext = _ext_from_ct(content_type, pic_url)
            photo_dir = UPLOAD_DIR / str(emp_id) / 'photos'
            photo_dir.mkdir(parents=True, exist_ok=True)
            filename = f"{uuid.uuid4()}{ext}"
            (photo_dir / filename).write_bytes(data)

            local_url = f"/uploads/{emp_id}/photos/{filename}"
            with eng.begin() as conn:
                conn.execute(
                    text("UPDATE employees SET profile_picture = :url WHERE id = :id"),
                    {'url': local_url, 'id': emp_id}
                )
            print(f"  [{emp_id}] ✓ {pic_url[:60]}... → {local_url}")
            ok += 1

        except (urllib.error.HTTPError, urllib.error.URLError, OSError) as exc:
            print(f"  [{emp_id}] Error ({exc}) — skipping: {pic_url[:60]}")
            failed += 1

    print(f"\n[{db_name}] Done — downloaded: {ok}, skipped: {skipped}, cleared: {cleared}, failed: {failed}")


if __name__ == '__main__':
    dbs = sys.argv[1:] or ['cotelligent-hrms', 'dev-hr']
    for db in dbs:
        migrate(db)
