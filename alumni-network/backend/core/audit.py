from typing import Literal, Optional

from fastapi import Request

from core.db import get_pool


def get_client_ip(request: Request) -> Optional[str]:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.headers.get("x-real-ip")


async def log_audit(
    actor_type: Literal["alumni", "staff"],
    actor_label: str,
    action: str,
    resource: str,
    status: Literal["success", "failed"],
    request: Optional[Request] = None,
) -> None:
    ip = get_client_ip(request) if request is not None else None
    await get_pool().execute(
        "INSERT INTO audit_logs (actor_type, actor_label, action, resource, status, ip_address) VALUES ($1,$2,$3,$4,$5,$6)",
        actor_type, actor_label, action, resource, status, ip,
    )
