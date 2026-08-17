from typing import TypedDict

from core.db import get_pool


class SystemSettings(TypedDict):
    portalName: str
    organizationName: str
    supportEmail: str
    defaultTimezone: str
    enablePublicLandingPage: bool
    allowNewRegistrations: bool
    showAlumniStatsOnLanding: bool
    passwordMinLength: int
    sessionTimeoutMinutes: int
    maintenanceMode: bool


async def get_system_settings() -> SystemSettings:
    row = await get_pool().fetchrow("""
        SELECT portal_name, organization_name, support_email, default_timezone,
               enable_public_landing_page, allow_new_registrations, show_alumni_stats_on_landing,
               password_min_length, session_timeout_minutes, maintenance_mode
        FROM system_settings WHERE id = 1
    """)
    assert row is not None
    return {
        "portalName": row["portal_name"],
        "organizationName": row["organization_name"],
        "supportEmail": row["support_email"],
        "defaultTimezone": row["default_timezone"],
        "enablePublicLandingPage": row["enable_public_landing_page"],
        "allowNewRegistrations": row["allow_new_registrations"],
        "showAlumniStatsOnLanding": row["show_alumni_stats_on_landing"],
        "passwordMinLength": row["password_min_length"],
        "sessionTimeoutMinutes": row["session_timeout_minutes"],
        "maintenanceMode": row["maintenance_mode"],
    }


async def get_password_min_length() -> int:
    settings = await get_system_settings()
    return settings["passwordMinLength"]


async def get_session_timeout_seconds() -> int:
    settings = await get_system_settings()
    return settings["sessionTimeoutMinutes"] * 60
