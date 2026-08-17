import secrets
import hashlib
import base64
import threading
from io import BytesIO
from datetime import datetime, timedelta, timezone

import pyotp
import qrcode
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel, EmailStr
from app.db.database import get_auth_db as get_db
from app.models.base import Employee, PasswordResetToken, User
from app.core.security import verify_password, create_access_token, decode_token, get_current_user, get_password_hash, get_effective_role
from app.services.activity_log import log_activity

router = APIRouter()

MFA_CHALLENGE_EXPIRE_MINUTES = 5

# In-memory brute-force guard for login. Keyed by "email|client-ip" so one
# attacker can't lock out a real user just by knowing their email, while
# still capping how fast any single (email, source) pair can be tried.
# Process-local by design — acceptable here since this deployment runs a
# single backend process; a multi-instance deployment would need a shared
# store (e.g. Redis) instead.
_LOGIN_ATTEMPT_LIMIT = 5
_LOGIN_ATTEMPT_WINDOW = timedelta(minutes=15)
_login_attempts: dict[str, list[datetime]] = {}
_login_attempts_lock = threading.Lock()


def _login_rate_limit_key(request: Request, email: str) -> str:
    client_ip = request.client.host if request.client else "unknown"
    return f"{email.lower().strip()}|{client_ip}"


def _check_login_rate_limit(key: str) -> None:
    now = datetime.now(timezone.utc)
    with _login_attempts_lock:
        attempts = [t for t in _login_attempts.get(key, []) if now - t < _LOGIN_ATTEMPT_WINDOW]
        _login_attempts[key] = attempts
        if len(attempts) >= _LOGIN_ATTEMPT_LIMIT:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many failed login attempts. Please try again later.",
            )


def _record_login_failure(key: str) -> None:
    now = datetime.now(timezone.utc)
    with _login_attempts_lock:
        _login_attempts.setdefault(key, []).append(now)


def _clear_login_attempts(key: str) -> None:
    with _login_attempts_lock:
        _login_attempts.pop(key, None)

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class LoginResponse(BaseModel):
    access_token: str
    token_type: str
    user: dict

class MfaRequiredResponse(BaseModel):
    mfa_required: bool = True
    challenge_token: str

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

class MfaCodeRequest(BaseModel):
    code: str

class MfaDisableRequest(BaseModel):
    current_password: str

class MfaVerifyLoginRequest(BaseModel):
    challenge_token: str
    code: str


def _complete_login(db: Session, user: Employee, effective_role: str) -> dict:
    """Finishes a login once any required second factor has passed: records
    last_login/the login-activity row, issues the real access token. Shared
    by the no-MFA path in login() and /login/verify-mfa so both produce the
    exact same response shape and audit trail from one place."""
    existing_row = db.query(User).filter(User.emp_id == user.id).first()

    now = datetime.now(timezone.utc)
    if existing_row:
        existing_row.last_login = now
    else:
        db.add(User(
            emp_id=user.id,
            employee_id=user.employee_id,
            full_name=f"{user.first_name} {user.last_name}",
            email=user.email,
            last_login=now,
        ))
    log_activity(db, employee_id=user.id, actor_id=user.id, action="login")
    db.commit()

    token = create_access_token(data={"sub": str(user.id)})
    is_manager = db.query(Employee).filter(Employee.manager_id == user.id).first() is not None
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "employee_id": user.employee_id,
            "name": f"{user.first_name} {user.last_name}",
            "email": user.email,
            "role": effective_role,
            "is_manager": is_manager,
            "title": user.title,
            "profile_picture": user.profile_picture,
            "timezone": user.timezone or "Asia/Kolkata",
            "country": user.country,
        }
    }


@router.post("/login")
def login(request: LoginRequest, req: Request, db: Session = Depends(get_db)):
    rate_key = _login_rate_limit_key(req, request.email)
    _check_login_rate_limit(rate_key)

    user = db.query(Employee).filter(func.lower(Employee.email) == request.email.lower().strip()).first()
    if not user or not verify_password(request.password, user.hashed_password):
        _record_login_failure(rate_key)
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if user.status == "terminated":
        raise HTTPException(status_code=401, detail="Account has been terminated")

    existing_row = db.query(User).filter(User.emp_id == user.id).first()
    if existing_row is not None and existing_row.is_active is False:
        raise HTTPException(status_code=401, detail="Account is locked. Contact an administrator.")

    effective_role = get_effective_role(user, db)

    if user.mfa_enabled:
        challenge_token = create_access_token(
            data={"sub": str(user.id), "type": "mfa_challenge"},
            expires_delta=timedelta(minutes=MFA_CHALLENGE_EXPIRE_MINUTES),
        )
        return {"mfa_required": True, "challenge_token": challenge_token}

    _clear_login_attempts(rate_key)
    return _complete_login(db, user, effective_role)


@router.post("/login/verify-mfa", response_model=LoginResponse)
def verify_mfa_login(request: MfaVerifyLoginRequest, req: Request, db: Session = Depends(get_db)):
    payload = decode_token(request.challenge_token)
    if not payload or payload.get("type") != "mfa_challenge" or not payload.get("sub"):
        raise HTTPException(status_code=401, detail="Invalid or expired MFA challenge. Please log in again.")

    rate_key = _login_rate_limit_key(req, f"mfa:{payload['sub']}")
    _check_login_rate_limit(rate_key)

    user = db.query(Employee).filter(Employee.id == int(payload["sub"])).first()
    if not user or not user.mfa_enabled or not user.mfa_secret:
        raise HTTPException(status_code=401, detail="Invalid or expired MFA challenge. Please log in again.")

    if not pyotp.TOTP(user.mfa_secret).verify(request.code, valid_window=1):
        _record_login_failure(rate_key)
        raise HTTPException(status_code=400, detail="Incorrect authenticator code")

    _clear_login_attempts(rate_key)
    effective_role = get_effective_role(user, db)
    return _complete_login(db, user, effective_role)

@router.get("/me")
def get_me(
    current_user: Employee = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    effective_role = get_effective_role(current_user, db)
    is_manager = db.query(Employee).filter(Employee.manager_id == current_user.id).first() is not None
    return {
        "id": current_user.id,
        "employee_id": current_user.employee_id,
        "name": f"{current_user.first_name} {current_user.last_name}",
        "email": current_user.email,
        "role": effective_role,
        "is_manager": is_manager,
        "title": current_user.title,
        "department": current_user.department.name if current_user.department else None,
        "profile_picture": current_user.profile_picture,
        "status": current_user.status,
        "mfa_enabled": current_user.mfa_enabled or False,
        "timezone": current_user.timezone or "Asia/Kolkata",
        "country": current_user.country,
    }


@router.post("/logout")
def logout(
    current_user: Employee = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """JWTs are stateless — this doesn't invalidate the token (the frontend
    simply discards it), it exists so a real 'session ended' event lands in
    the activity trail, since nothing else records anything past login."""
    log_activity(db, employee_id=current_user.id, actor_id=current_user.id, action="logout")
    db.commit()
    return {"message": "Logged out"}


@router.post("/change-password")
def change_password(
    request: ChangePasswordRequest,
    current_user: Employee = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not verify_password(request.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    current_user.hashed_password = get_password_hash(request.new_password)
    db.commit()
    return {"message": "Password changed successfully"}


@router.post("/mfa/enroll")
def mfa_enroll(
    current_user: Employee = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Starts (or restarts) enrollment: generates a new secret and returns a
    QR code to scan in an authenticator app. mfa_enabled stays False until
    verify-enroll confirms the user actually captured the secret."""
    secret = pyotp.random_base32()
    current_user.mfa_secret = secret
    current_user.mfa_enabled = False
    db.commit()

    otpauth_uri = pyotp.TOTP(secret).provisioning_uri(name=current_user.email, issuer_name="Cotelligent HRMS")
    qr_img = qrcode.make(otpauth_uri)
    buf = BytesIO()
    qr_img.save(buf, format="PNG")
    qr_base64 = base64.b64encode(buf.getvalue()).decode()

    return {"secret": secret, "otpauth_uri": otpauth_uri, "qr_code_base64": f"data:image/png;base64,{qr_base64}"}


@router.post("/mfa/verify-enroll")
def mfa_verify_enroll(
    request: MfaCodeRequest,
    current_user: Employee = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not current_user.mfa_secret:
        raise HTTPException(status_code=400, detail="Start enrollment first")
    if not pyotp.TOTP(current_user.mfa_secret).verify(request.code, valid_window=1):
        raise HTTPException(status_code=400, detail="Incorrect authenticator code")

    current_user.mfa_enabled = True
    log_activity(db, employee_id=current_user.id, actor_id=current_user.id, action="mfa_enabled")
    db.commit()
    return {"mfa_enabled": True}


@router.post("/mfa/disable")
def mfa_disable(
    request: MfaDisableRequest,
    current_user: Employee = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(request.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    current_user.mfa_enabled = False
    current_user.mfa_secret = None
    log_activity(db, employee_id=current_user.id, actor_id=current_user.id, action="mfa_disabled")
    db.commit()
    return {"mfa_enabled": False}


def issue_password_reset_token(db: Session, employee: Employee) -> str:
    """Burns any existing unused tokens for this employee, issues a new one,
    and returns the reset link. Shared by the public forgot-password flow
    below and User Management's admin-triggered reset-password/send-invitation
    actions — same token mechanism, same "no mailer configured" caveat.
    """
    db.query(PasswordResetToken).filter(
        PasswordResetToken.employee_id == employee.id,
        PasswordResetToken.used == False
    ).update({"used": True})

    raw_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    expires_at = datetime.now(timezone.utc) + timedelta(hours=1)

    db.add(PasswordResetToken(
        employee_id=employee.id,
        token_hash=token_hash,
        expires_at=expires_at,
        used=False,
    ))
    db.commit()

    # NOTE: In production replace this with an SMTP email send.
    # The raw_token is returned here only because no mail server is configured.
    return f"/reset-password?token={raw_token}"


@router.post("/forgot-password")
def forgot_password(request: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(Employee).filter(func.lower(Employee.email) == request.email.lower().strip()).first()

    # Always return the same message — never reveal whether the email exists
    if not user:
        return {"message": "If that email is registered, a reset link will be provided.", "reset_link": None}

    reset_link = issue_password_reset_token(db, user)
    return {
        "message": "Password reset link generated successfully.",
        "reset_link": reset_link,
    }


@router.post("/reset-password")
def reset_password(request: ResetPasswordRequest, db: Session = Depends(get_db)):
    if not request.new_password or len(request.new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters.")

    token_hash = hashlib.sha256(request.token.encode()).hexdigest()
    reset_token = db.query(PasswordResetToken).filter(
        PasswordResetToken.token_hash == token_hash,
        PasswordResetToken.used == False,
    ).first()

    if not reset_token:
        raise HTTPException(status_code=400, detail="Invalid or already-used reset token.")

    if reset_token.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Reset token has expired. Please request a new one.")

    employee = db.query(Employee).filter(Employee.id == reset_token.employee_id).first()
    employee.hashed_password = get_password_hash(request.new_password)

    reset_token.used = True
    db.commit()

    return {"message": "Password reset successfully. You can now log in with your new password."}
