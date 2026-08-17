import json
import re
from secrets import token_hex
from typing import Optional

import asyncpg
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse
from starlette.datastructures import UploadFile as StarletteUploadFile

from core.auth import hash_password
from core.config import PROJECT_ROOT
from core.db import get_hr_communications_user_id, get_pool
from core.notifications import create_staff_notification, staff_wants_alert
from core.settings_cache import get_password_min_length, get_system_settings

router = APIRouter(prefix="/api/register")

PHOTO_DIR = PROJECT_ROOT / "public" / "uploads" / "photos"
RESUME_DIR = PROJECT_ROOT / "public" / "uploads" / "resumes"
# Extension is derived from this validated content-type map, never from the
# client-supplied filename — public/uploads is served statically to anyone
# with the URL, so an attacker-chosen extension there is a stored-content risk.
RESUME_EXTENSIONS = {
    "application/pdf": "pdf",
    "application/msword": "doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
}


def _read_json_field(value: Optional[str], fallback):
    if not value or not value.strip():
        return fallback
    try:
        return json.loads(value)
    except (ValueError, TypeError):
        return fallback


LINKEDIN_URL_RE = re.compile(r"^https?://[^\s/]+\.[^\s/]+")


def _is_valid_linkedin_url(value: Optional[str]) -> bool:
    return value is None or bool(LINKEDIN_URL_RE.match(value))


@router.post("")
async def register(request: Request):
    settings = await get_system_settings()
    if not settings["allowNewRegistrations"]:
        raise HTTPException(status_code=403, detail="New registrations are currently closed. Please check back later.")

    form = await request.form()

    first_name = str(form.get("firstName") or "").strip()
    last_name = str(form.get("lastName") or "").strip()
    email = str(form.get("email") or "").strip()
    phone = str(form.get("phone") or "").strip()
    linkedin = str(form.get("linkedin") or "").strip() or None
    country = str(form.get("country") or "").strip()
    state = str(form.get("state") or "").strip() or None
    password = str(form.get("password") or "")

    professional_status = str(form.get("professionalStatus") or "").strip()
    employer = str(form.get("employer") or "").strip() or None
    designation = str(form.get("designation") or "").strip() or None
    industry = str(form.get("industry") or "").strip()

    joining_month = str(form.get("joiningMonth") or "").strip() or None
    joining_year_raw = form.get("joiningYear")
    try:
        joining_year = int(str(joining_year_raw))
    except (TypeError, ValueError):
        joining_year = None
    exited_year_raw = form.get("exitedYear")
    try:
        exited_year = int(str(exited_year_raw))
    except (TypeError, ValueError):
        exited_year = None
    roles_held = str(form.get("rolesHeld") or "").strip() or None
    achievements = str(form.get("achievements") or "").strip() or None

    family_members = _read_json_field(form.get("familyMembers"), [])
    selected_benefits = _read_json_field(form.get("selectedBenefits"), [])

    agreed_terms = form.get("agreedTerms") == "true"
    agreed_comms = form.get("agreedComms") == "true"

    email_ok = bool(re.match(r"^[^\s@]+@[^\s@]+\.[^\s@]+$", email))

    if not first_name or not last_name or not email_ok or not phone or not country or not professional_status or not industry \
            or exited_year is None or not agreed_terms:
        raise HTTPException(status_code=400, detail="Missing or invalid required fields.")

    if not _is_valid_linkedin_url(linkedin):
        raise HTTPException(status_code=400, detail="LinkedIn URL must be a full URL, e.g. https://linkedin.com/in/yourprofile.")

    min_length = await get_password_min_length()
    if len(password) < min_length:
        raise HTTPException(status_code=400, detail=f"Password must be at least {min_length} characters.")
    password_hash = await hash_password(password)

    photo_path = None
    photo = form.get("photo")
    if isinstance(photo, StarletteUploadFile) and photo.size and photo.size > 0:
        if photo.content_type != "image/jpeg":
            raise HTTPException(status_code=400, detail="Profile photo must be a JPEG (.jpg/.jpeg) file.")
        PHOTO_DIR.mkdir(parents=True, exist_ok=True)
        filename = f"{token_hex(16)}.jpg"
        (PHOTO_DIR / filename).write_bytes(await photo.read())
        photo_path = f"/uploads/photos/{filename}"

    resume_path = None
    resume = form.get("resume")
    if isinstance(resume, StarletteUploadFile) and resume.size and resume.size > 0:
        ext = RESUME_EXTENSIONS.get(resume.content_type)
        if ext is None:
            raise HTTPException(status_code=400, detail="Resume must be a PDF, DOC, or DOCX file.")
        RESUME_DIR.mkdir(parents=True, exist_ok=True)
        filename = f"{token_hex(16)}.{ext}"
        (RESUME_DIR / filename).write_bytes(await resume.read())
        resume_path = f"/uploads/resumes/{filename}"

    try:
        new_id = await get_pool().fetchval(
            """INSERT INTO users (
                first_name, last_name, email, phone, linkedin_url, profile_photo_path,
                country, state,
                professional_status, employer, designation, industry, resume_path,
                family_members, joining_month, joining_year, exited_year, roles_held, achievements,
                selected_benefits, agreed_terms, agreed_comms, password_hash
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
            RETURNING id""",
            first_name, last_name, email, phone, linkedin, photo_path,
            country, state,
            professional_status, employer, designation, industry, resume_path,
            family_members, joining_month, joining_year, exited_year, roles_held, achievements,
            selected_benefits, agreed_terms, agreed_comms, password_hash,
        )
    except asyncpg.UniqueViolationError:
        raise HTTPException(status_code=409, detail="An account with this email already exists.")

    hr_comm_id = await get_hr_communications_user_id()
    if hr_comm_id is not None:
        await get_pool().execute(
            """INSERT INTO connections (requester_id, recipient_id, status) VALUES ($1, $2, 'accepted')
               ON CONFLICT (requester_id, recipient_id) DO NOTHING""",
            hr_comm_id, new_id,
        )

    if await staff_wants_alert("hr", "registration"):
        try:
            await create_staff_notification(
                "hr", "registration", "New Registration",
                f"{first_name} {last_name} submitted a new alumni registration.", "/hr/registrations",
            )
        except Exception:
            pass

    return JSONResponse({"id": new_id}, status_code=201)
