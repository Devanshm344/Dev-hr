from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.core.config import settings
from app.db.database import get_auth_db

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        return None


def get_effective_role(employee, db: Session) -> str:
    """Return the RBAC role for an employee from user_roles table.
    Falls back to 'Employee' if no row exists (default access level).
    This is the SINGLE SOURCE OF TRUTH for access decisions.
    """
    from app.models.base import UserRole
    record = db.query(UserRole).filter(
        UserRole.employee_id == employee.employee_id
    ).first()
    return record.system_role if record else "Employee"


def is_admin_role(role: str) -> bool:
    """Super Admin is a superset of Admin — it passes every Admin-gated
    check. Use this instead of comparing a role string to "Admin" directly,
    which silently excludes Super Admin accounts."""
    return role in ("Admin", "Super Admin")


def set_system_role(db: Session, employee, system_role: str) -> None:
    """The single write path for RBAC role. Upserts user_roles only —
    employees and users carry no role column, so there is nothing else
    to keep in sync.
    """
    from app.models.base import UserRole
    record = db.query(UserRole).filter(
        UserRole.employee_id == employee.employee_id
    ).first()
    if record:
        record.system_role = system_role
        record.email = employee.email
    else:
        db.add(UserRole(
            employee_id=employee.employee_id,
            email=employee.email,
            system_role=system_role,
        ))
    db.commit()


def _touch_last_active(db: Session, employee_id: int, min_interval: timedelta = timedelta(minutes=2)) -> None:
    """Throttled heartbeat on every authenticated request. Distinct from
    last_login, which only moves when a fresh token is issued and can sit
    stale for up to a full 24h token lifetime while someone is actively
    working — last_active is what "is this person currently active" should
    actually read from."""
    from app.models.base import User
    row = db.query(User).filter(User.emp_id == employee_id).first()
    if row is None:
        return  # login row is created at login time; nothing to touch yet
    now = datetime.now(timezone.utc)
    if row.last_active is not None and (now - row.last_active) < min_interval:
        return
    row.last_active = now
    db.commit()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_auth_db)
):
    from app.models.base import Employee
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    token = credentials.credentials
    payload = decode_token(token)
    if payload is None:
        raise credentials_exception
    if payload.get("type") == "mfa_challenge":
        # Short-lived pre-second-factor token — only valid for /login/verify-mfa,
        # never as a general bearer token.
        raise credentials_exception
    user_id: str = payload.get("sub")
    if user_id is None:
        raise credentials_exception
    user = db.query(Employee).filter(Employee.id == int(user_id)).first()
    if user is None:
        raise credentials_exception
    _touch_last_active(db, user.id)
    return user


async def get_current_admin(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_auth_db),
):
    """Dependency that allows Admin or Super Admin roles (from user_roles table).
    Super Admin is a superset of Admin — it passes every Admin-gated check.
    """
    effective_role = get_effective_role(current_user, db)
    if not is_admin_role(effective_role):
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user
