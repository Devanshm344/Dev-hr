from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from jose import jwt
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import get_current_user, get_effective_role
from app.db.database import get_auth_db as get_db
from app.models.base import Employee

router = APIRouter()

# HRMS role -> Alumni Network staff role. Only these two are mapped; an
# Employee has no equivalent portal on the Alumni side.
ROLE_MAP = {
    "Super Admin": "admin",
    "Admin": "hr",
}


@router.get("/alumni-sso-url")
def get_alumni_sso_url(
    current_user: Employee = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not settings.ALUMNI_SSO_SHARED_SECRET:
        raise HTTPException(status_code=503, detail="Alumni Network SSO is not configured.")

    effective_role = get_effective_role(current_user, db)
    alumni_role = ROLE_MAP.get(effective_role)
    if alumni_role is None:
        raise HTTPException(
            status_code=403,
            detail="Alumni Network access is limited to Admin and Super Admin roles.",
        )

    now = datetime.now(timezone.utc)
    payload = {
        "email": current_user.email,
        "fullName": f"{current_user.first_name} {current_user.last_name}".strip(),
        "role": alumni_role,
        "purpose": "alumni-sso",
        "exp": now + timedelta(seconds=60),
    }
    token = jwt.encode(payload, settings.ALUMNI_SSO_SHARED_SECRET, algorithm="HS256")

    return {"ssoUrl": f"{settings.ALUMNI_BACKEND_URL}/api/auth/sso-login?token={token}"}
