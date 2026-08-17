from datetime import datetime, timedelta, timezone
from pathlib import Path
from secrets import token_hex
from typing import Optional

import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, Response, UploadFile
from fastapi.responses import RedirectResponse
from pydantic import BaseModel

from core.audit import log_audit
from core.auth import (
    SESSION_COOKIE,
    create_session_token,
    hash_password,
    verify_password,
    verify_session_token,
)
from core.config import PROJECT_ROOT, settings as app_settings
from core.db import get_pool
from core.deps import get_current_alumni, get_current_staff
from core.settings_cache import get_password_min_length, get_session_timeout_seconds

router = APIRouter(prefix="/api/auth")

PHOTO_DIR = PROJECT_ROOT / "public" / "uploads" / "photos"

USER_FIELDS = """
  id, first_name AS "firstName", last_name AS "lastName", full_name AS "fullName", email, phone,
  linkedin_url AS "linkedinUrl", profile_photo_path AS "profilePhotoPath", professional_status AS "professionalStatus",
  country, state, employer, designation, industry, joining_month AS "joiningMonth", joining_year AS "joiningYear",
  roles_held AS "rolesHeld", achievements, family_members AS "familyMembers", status
"""

STATUS_MESSAGES = {
    "pending": "Your registration is still under HR review. You'll be notified once approved.",
    "rejected": "Your registration was not approved. Please contact HR for more information.",
    "inactive": "Your account has been deactivated. Please contact HR.",
}


def _set_session_cookie(response: Response, token: str, max_age: int) -> None:
    response.set_cookie(
        key=SESSION_COOKIE,
        value=token,
        max_age=max_age,
        path="/",
        httponly=True,
        secure=app_settings.app_env == "production",
        samesite="lax",
    )


class LoginBody(BaseModel):
    email: str = ""
    password: str = ""


@router.post("/login")
async def login(body: LoginBody, request: Request, response: Response):
    email = body.email.strip()
    password = body.password
    if not email or not password:
        raise HTTPException(status_code=400, detail="Email and password are required.")

    user = await get_pool().fetchrow(
        "SELECT id, full_name, email, password_hash, status FROM users WHERE email = $1", email
    )

    if not user or not user["password_hash"] or not await verify_password(password, user["password_hash"]):
        await log_audit("alumni", email, "Login", "auth", "failed", request)
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    if user["status"] != "active":
        message = STATUS_MESSAGES.get(user["status"], "Your account cannot sign in at this time.")
        await log_audit("alumni", user["email"], "Login", "auth", "failed", request)
        raise HTTPException(status_code=403, detail=message)

    await log_audit("alumni", user["email"], "Login", "auth", "success", request)

    timeout_seconds = await get_session_timeout_seconds()
    token = create_session_token({"userId": user["id"], "email": user["email"], "role": "alumni"}, timeout_seconds)

    _set_session_cookie(response, token, timeout_seconds)
    return {
        "success": True,
        "user": {"id": user["id"], "fullName": user["full_name"], "email": user["email"]},
    }


@router.post("/staff-login")
async def staff_login(body: LoginBody, request: Request, response: Response):
    email = body.email.strip()
    password = body.password
    if not email or not password:
        raise HTTPException(status_code=400, detail="Email and password are required.")

    staff = await get_pool().fetchrow(
        "SELECT id, full_name, email, password_hash, role, active FROM staff_users WHERE email = $1", email
    )

    if not staff or not await verify_password(password, staff["password_hash"]):
        await log_audit("staff", email, "Login", "auth", "failed", request)
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    if not staff["active"]:
        await log_audit("staff", staff["email"], "Login", "auth", "failed", request)
        raise HTTPException(status_code=403, detail="This account has been deactivated. Contact your system administrator.")

    await log_audit("staff", staff["email"], "Login", "auth", "success", request)

    timeout_seconds = await get_session_timeout_seconds()
    token = create_session_token(
        {"userId": staff["id"], "email": staff["email"], "role": staff["role"]}, timeout_seconds
    )

    _set_session_cookie(response, token, timeout_seconds)
    return {
        "success": True,
        "user": {"id": staff["id"], "fullName": staff["full_name"], "email": staff["email"], "role": staff["role"]},
    }


@router.get("/sso-login")
async def sso_login(token: str, request: Request):
    """
    SSO handoff from cotelligent-hrms. An HRMS Admin/Super Admin clicking the
    "Alumni" tile lands here with a short-lived token (signed with
    SSO_SHARED_SECRET — never AUTH_SECRET, which signs real sessions here).
    We verify it, upsert a matching staff_users row (creating it on first
    visit, keeping it in sync on every later one), issue a normal session the
    same way /staff-login does, and redirect straight into the right
    dashboard — no Alumni login screen involved.
    """
    if not app_settings.sso_shared_secret:
        raise HTTPException(status_code=503, detail="SSO is not configured.")

    try:
        payload = jwt.decode(token, app_settings.sso_shared_secret, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired SSO token.")

    if payload.get("purpose") != "alumni-sso" or payload.get("role") not in ("hr", "admin"):
        raise HTTPException(status_code=401, detail="Invalid SSO token.")

    email = (payload.get("email") or "").strip()
    full_name = (payload.get("fullName") or "").strip() or email
    role = payload["role"]
    if not email:
        raise HTTPException(status_code=401, detail="Invalid SSO token.")

    role_id = await get_pool().fetchval("SELECT id FROM roles WHERE base_role = $1 ORDER BY id LIMIT 1", role)

    # bcrypt is deliberately slow (~100-300ms) — only pay for it the first
    # time this person shows up. Every later click just updates the existing
    # row (role/name may have changed on the HRMS side) and skips hashing
    # entirely, which is most of what made repeat SSO logins slow.
    existing_id = await get_pool().fetchval("SELECT id FROM staff_users WHERE email = $1", email)
    if existing_id is None:
        # Synthetic account driven entirely by HRMS's role mapping — never
        # meant to be password-logged-in directly, so the hash is a
        # discarded random value, not something anyone is ever told.
        placeholder_hash = await hash_password(token_hex(32))
        staff = await get_pool().fetchrow(
            """INSERT INTO staff_users (full_name, email, password_hash, role, role_id, active)
               VALUES ($1, $2, $3, $4, $5, true)
               RETURNING id, full_name, email, role""",
            full_name, email, placeholder_hash, role, role_id,
        )
    else:
        staff = await get_pool().fetchrow(
            """UPDATE staff_users SET full_name = $1, role = $2, role_id = $3, active = true
               WHERE id = $4
               RETURNING id, full_name, email, role""",
            full_name, role, role_id, existing_id,
        )

    await log_audit("staff", staff["email"], "SSO Login", "auth", "success", request)

    timeout_seconds = await get_session_timeout_seconds()
    session_token = create_session_token(
        {"userId": staff["id"], "email": staff["email"], "role": staff["role"]}, timeout_seconds
    )

    redirect = RedirectResponse(url=f"{app_settings.alumni_frontend_url}/{role}/dashboard", status_code=302)
    _set_session_cookie(redirect, session_token, timeout_seconds)
    return redirect


@router.post("/logout")
async def logout(response: Response):
    response.set_cookie(key=SESSION_COOKIE, value="", max_age=0, path="/")
    return {"success": True}


@router.get("/me")
async def get_me(alumni: dict = Depends(get_current_alumni)):
    row = await get_pool().fetchrow(f"SELECT {USER_FIELDS} FROM users WHERE id = $1", alumni["id"])
    await get_pool().execute("UPDATE users SET last_active_at = now() WHERE id = $1", alumni["id"])
    return {"user": dict(row)}


EDITABLE_FIELD_MAP = {
    "firstName": "first_name",
    "lastName": "last_name",
    "phone": "phone",
    "linkedinUrl": "linkedin_url",
    "country": "country",
    "state": "state",
    "employer": "employer",
    "designation": "designation",
    "industry": "industry",
    "professionalStatus": "professional_status",
    "rolesHeld": "roles_held",
    "achievements": "achievements",
    "familyMembers": "family_members",
}


@router.patch("/me")
async def patch_me(request: Request, alumni: dict = Depends(get_current_alumni)):
    body = await request.json()
    updates: list[str] = []
    values: list = []

    for key, column in EDITABLE_FIELD_MAP.items():
        if key in body:
            values.append(body[key])
            idx = len(values)
            if key == "familyMembers":
                updates.append(f"{column} = ${idx}::jsonb")
            else:
                updates.append(f"{column} = ${idx}")

    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update.")

    values.append(alumni["id"])
    await get_pool().execute(
        f"UPDATE users SET {', '.join(updates)}, updated_at = now() WHERE id = ${len(values)}", *values
    )
    row = await get_pool().fetchrow(f"SELECT {USER_FIELDS} FROM users WHERE id = $1", alumni["id"])
    return {"user": dict(row)}


@router.post("/me/photo")
async def upload_my_photo(photo: UploadFile, alumni: dict = Depends(get_current_alumni)):
    if photo.content_type != "image/jpeg":
        raise HTTPException(status_code=400, detail="Profile photo must be a JPEG (.jpg/.jpeg) file.")
    data = await photo.read()
    if not data:
        raise HTTPException(status_code=400, detail="No photo provided.")

    PHOTO_DIR.mkdir(parents=True, exist_ok=True)
    filename = f"{token_hex(16)}.jpg"
    (PHOTO_DIR / filename).write_bytes(data)
    photo_path = f"/uploads/photos/{filename}"

    await get_pool().execute(
        "UPDATE users SET profile_photo_path = $1, updated_at = now() WHERE id = $2", photo_path, alumni["id"]
    )
    row = await get_pool().fetchrow(f"SELECT {USER_FIELDS} FROM users WHERE id = $1", alumni["id"])
    return {"user": dict(row)}


@router.get("/staff-me")
async def get_staff_me(staff: dict = Depends(get_current_staff)):
    return {"user": {"id": staff["id"], "fullName": staff["full_name"], "email": staff["email"], "role": staff["role"]}}


class ForgotPasswordBody(BaseModel):
    email: str = ""


@router.post("/forgot-password")
async def forgot_password(body: ForgotPasswordBody, request: Request):
    email = body.email.strip()
    if not email:
        raise HTTPException(status_code=400, detail="Email is required.")

    user = await get_pool().fetchrow("SELECT id, status FROM users WHERE email = $1", email)
    if not user or user["status"] != "active":
        return {"success": True, "resetUrl": None}

    token = token_hex(32)
    expires_at = datetime.now(timezone.utc) + timedelta(hours=1)
    await get_pool().execute(
        "INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)",
        user["id"], token, expires_at,
    )
    origin = f"{request.url.scheme}://{request.url.netloc}"
    reset_url = f"{origin}/reset-password?token={token}"
    return {"success": True, "resetUrl": reset_url}


class ResetPasswordBody(BaseModel):
    token: str = ""
    password: str = ""


@router.post("/reset-password")
async def reset_password(body: ResetPasswordBody):
    if not body.token or not body.password:
        raise HTTPException(status_code=400, detail="Token and password are required.")
    min_length = await get_password_min_length()
    if len(body.password) < min_length:
        raise HTTPException(status_code=400, detail=f"Password must be at least {min_length} characters.")

    reset_token = await get_pool().fetchrow(
        "SELECT id, user_id, expires_at, used_at FROM password_reset_tokens WHERE token = $1", body.token
    )
    if not reset_token or reset_token["used_at"] or reset_token["expires_at"] < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="This reset link is invalid or has expired. Please request a new one.")

    new_hash = await hash_password(body.password)
    await get_pool().execute("UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2", new_hash, reset_token["user_id"])
    await get_pool().execute("UPDATE password_reset_tokens SET used_at = now() WHERE id = $1", reset_token["id"])
    return {"success": True}


class ChangePasswordBody(BaseModel):
    currentPassword: str = ""
    newPassword: str = ""
    confirmPassword: str = ""


@router.post("/change-password")
async def change_password(body: ChangePasswordBody, alumni: dict = Depends(get_current_alumni)):
    if not body.currentPassword or not body.newPassword or not body.confirmPassword:
        raise HTTPException(status_code=400, detail="All fields are required.")
    if body.newPassword != body.confirmPassword:
        raise HTTPException(status_code=400, detail="New password and confirmation don't match.")
    min_length = await get_password_min_length()
    if len(body.newPassword) < min_length:
        raise HTTPException(status_code=400, detail=f"New password must be at least {min_length} characters.")

    if not alumni["password_hash"] or not await verify_password(body.currentPassword, alumni["password_hash"]):
        raise HTTPException(status_code=400, detail="Current password is incorrect.")

    new_hash = await hash_password(body.newPassword)
    await get_pool().execute("UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2", new_hash, alumni["id"])
    return {"success": True}


@router.post("/staff-change-password")
async def staff_change_password(body: ChangePasswordBody, staff: dict = Depends(get_current_staff)):
    if not body.currentPassword or not body.newPassword or not body.confirmPassword:
        raise HTTPException(status_code=400, detail="All fields are required.")
    if body.newPassword != body.confirmPassword:
        raise HTTPException(status_code=400, detail="New password and confirmation don't match.")
    min_length = await get_password_min_length()
    if len(body.newPassword) < min_length:
        raise HTTPException(status_code=400, detail=f"New password must be at least {min_length} characters.")

    row = await get_pool().fetchrow(
        "SELECT password_hash FROM staff_users WHERE id = $1 AND role = $2", staff["id"], staff["role"]
    )
    if not row or not await verify_password(body.currentPassword, row["password_hash"]):
        raise HTTPException(status_code=400, detail="Current password is incorrect.")

    new_hash = await hash_password(body.newPassword)
    await get_pool().execute("UPDATE staff_users SET password_hash = $1 WHERE id = $2", new_hash, staff["id"])
    return {"success": True}
